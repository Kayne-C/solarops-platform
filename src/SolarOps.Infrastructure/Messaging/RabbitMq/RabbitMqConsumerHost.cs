using System.Text;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using SolarOps.Application.Abstractions.Events;

namespace SolarOps.Infrastructure.Messaging.RabbitMq;

/// <summary>
/// Hosts one channel + consumer per subscription with manual acks and bounded prefetch (back-pressure).
/// Failures are requeued; the quorum queue's delivery limit turns a poison message into a dead letter.
/// </summary>
public sealed partial class RabbitMqConsumerHost(
    RabbitMqConnection connection,
    EventSubscriptionRegistry registry,
    IntegrationEventDispatcher dispatcher,
    IOptions<MessagingOptions> options,
    ILogger<RabbitMqConsumerHost> logger) : BackgroundService
{
    private readonly List<IChannel> _channels = [];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (settings.Transport != MessageTransport.RabbitMq || !settings.ConsumersEnabled)
        {
            return;
        }

        var brokerConnection = await ConnectWithRetryAsync(stoppingToken);

        await using (var topology = await brokerConnection.CreateChannelAsync(cancellationToken: stoppingToken))
        {
            await RabbitMqTopology.DeclareExchangesAsync(topology, settings.RabbitMq, stoppingToken);
            foreach (var subscription in registry.All)
            {
                await RabbitMqTopology.DeclareSubscriptionAsync(topology, settings.RabbitMq, subscription, stoppingToken);
            }
        }

        foreach (var subscription in registry.All)
        {
            var channel = await brokerConnection.CreateChannelAsync(cancellationToken: stoppingToken);
            await channel.BasicQosAsync(0, settings.RabbitMq.PrefetchCount, global: false, stoppingToken);

            var consumer = new AsyncEventingBasicConsumer(channel);
            consumer.ReceivedAsync += (_, delivery) => HandleAsync(channel, subscription, delivery, stoppingToken);

            var queue = RabbitMqTopology.QueueName(settings.RabbitMq, subscription);
            await channel.BasicConsumeAsync(queue, autoAck: false, consumer, stoppingToken);
            _channels.Add(channel);
            LogSubscribed(logger, subscription.ConsumerName, queue, subscription.EventName);
        }

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Graceful shutdown.
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        foreach (var channel in _channels)
        {
            await channel.CloseAsync(cancellationToken);
            await channel.DisposeAsync();
        }
    }

    private async Task HandleAsync(IChannel channel, EventSubscription subscription, BasicDeliverEventArgs delivery, CancellationToken stoppingToken)
    {
        try
        {
            var envelope = new EventEnvelope(
                Guid.Parse(delivery.BasicProperties.MessageId ?? throw new InvalidOperationException("Missing message id.")),
                delivery.BasicProperties.Type ?? subscription.EventName,
                ReadHeader(delivery, RabbitMqEventBus.TenantHeader) is { } tenant ? Guid.Parse(tenant) : null,
                Encoding.UTF8.GetString(delivery.Body.Span),
                ReadHeader(delivery, RabbitMqEventBus.TraceParentHeader),
                DateTimeOffset.FromUnixTimeSeconds(delivery.BasicProperties.Timestamp.UnixTime).UtcDateTime);

            await dispatcher.DispatchAsync(envelope, subscription, stoppingToken);
            await channel.BasicAckAsync(delivery.DeliveryTag, multiple: false, stoppingToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            LogConsumeFailed(logger, exception, subscription.ConsumerName, delivery.BasicProperties.MessageId);
            await channel.BasicNackAsync(delivery.DeliveryTag, multiple: false, requeue: true, stoppingToken);
        }
    }

    private async Task<IConnection> ConnectWithRetryAsync(CancellationToken stoppingToken)
    {
        var delay = TimeSpan.FromSeconds(1);
        while (true)
        {
            try
            {
                return await connection.GetAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                LogBrokerUnavailable(logger, exception, delay.TotalSeconds);
                await Task.Delay(delay, stoppingToken);
                delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 30));
            }
        }
    }

    private static string? ReadHeader(BasicDeliverEventArgs delivery, string name) =>
        delivery.BasicProperties.Headers?.TryGetValue(name, out var value) == true
            ? value switch
            {
                byte[] bytes => Encoding.UTF8.GetString(bytes),
                null => null,
                _ => value.ToString(),
            }
            : null;

    [LoggerMessage(Level = LogLevel.Information, Message = "{Consumer} consuming {Queue} (routing key {EventName})")]
    private static partial void LogSubscribed(ILogger logger, string consumer, string queue, string eventName);

    [LoggerMessage(Level = LogLevel.Error, Message = "{Consumer} failed on message {MessageId}; requeued (dead-lettered after the delivery limit)")]
    private static partial void LogConsumeFailed(ILogger logger, Exception exception, string consumer, string? messageId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "RabbitMQ unavailable, retrying in {DelaySeconds}s")]
    private static partial void LogBrokerUnavailable(ILogger logger, Exception exception, double delaySeconds);
}
