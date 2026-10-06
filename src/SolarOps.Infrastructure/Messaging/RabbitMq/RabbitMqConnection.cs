using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using SolarOps.Application.Abstractions.Events;

namespace SolarOps.Infrastructure.Messaging.RabbitMq;

/// <summary>One long-lived, auto-recovering connection per process; channels are cheap and created per use case.</summary>
public sealed class RabbitMqConnection(IOptions<MessagingOptions> options) : IAsyncDisposable
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IConnection? _connection;

    public bool IsOpen => _connection?.IsOpen == true;

    public async Task<IConnection> GetAsync(CancellationToken cancellationToken)
    {
        if (_connection is { IsOpen: true } open)
        {
            return open;
        }

        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_connection is { IsOpen: true } raced)
            {
                return raced;
            }

            var factory = new ConnectionFactory
            {
                Uri = new Uri(options.Value.RabbitMq.ConnectionString),
                ClientProvidedName = $"solarops-{Environment.MachineName}",
                AutomaticRecoveryEnabled = true,
                TopologyRecoveryEnabled = true,
            };

            _connection = await factory.CreateConnectionAsync(cancellationToken);
            return _connection;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        {
            await _connection.DisposeAsync();
        }

        _gate.Dispose();
    }
}

/// <summary>
/// Topology: one durable topic exchange; one quorum queue per subscription (competing consumers within a
/// subscription, fan-out across subscriptions). Failed deliveries are retried by the broker up to
/// <see cref="DeliveryLimit"/> times, then dead-lettered into "&lt;queue&gt;.dlq" for inspection and replay.
/// </summary>
internal static class RabbitMqTopology
{
    public const int DeliveryLimit = 5;

    public static string DeadLetterExchange(RabbitMqOptions options) => $"{options.Exchange}.dlx";

    public static string QueueName(RabbitMqOptions options, EventSubscription subscription) =>
        $"{options.QueuePrefix}.{subscription.ConsumerName}".ToLowerInvariant();

    public static Task DeclareExchangesAsync(IChannel channel, RabbitMqOptions options, CancellationToken cancellationToken) =>
        Task.WhenAll(
            channel.ExchangeDeclareAsync(options.Exchange, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: cancellationToken),
            channel.ExchangeDeclareAsync(DeadLetterExchange(options), ExchangeType.Direct, durable: true, autoDelete: false, cancellationToken: cancellationToken));

    public static async Task DeclareSubscriptionAsync(
        IChannel channel,
        RabbitMqOptions options,
        EventSubscription subscription,
        CancellationToken cancellationToken)
    {
        var queue = QueueName(options, subscription);
        var deadLetterQueue = $"{queue}.dlq";

        await channel.QueueDeclareAsync(deadLetterQueue, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(deadLetterQueue, DeadLetterExchange(options), routingKey: queue, cancellationToken: cancellationToken);

        var arguments = new Dictionary<string, object?>
        {
            ["x-dead-letter-exchange"] = DeadLetterExchange(options),
            ["x-dead-letter-routing-key"] = queue,
            ["x-queue-type"] = "quorum",
            ["x-delivery-limit"] = DeliveryLimit,
        };

        await channel.QueueDeclareAsync(queue, durable: true, exclusive: false, autoDelete: false, arguments, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(queue, options.Exchange, routingKey: subscription.EventName, cancellationToken: cancellationToken);
    }
}

internal sealed class RabbitMqHealthCheck(RabbitMqConnection connection, IOptions<MessagingOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        // A host that neither relays the outbox nor consumes must stay ready while the broker is down:
        // the API only writes to the outbox, so a broker outage must not take it out of rotation.
        var settings = options.Value;
        if (settings.Transport != MessageTransport.RabbitMq || (!settings.Outbox.Enabled && !settings.ConsumersEnabled))
        {
            return HealthCheckResult.Healthy("RabbitMQ is not used by this host.");
        }

        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            var open = await connection.GetAsync(timeout.Token);
            return open.IsOpen ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("Connection closed.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Unhealthy("RabbitMQ is unreachable.", exception);
        }
    }
}
