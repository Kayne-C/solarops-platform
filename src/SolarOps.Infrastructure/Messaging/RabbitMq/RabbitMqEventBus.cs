using System.Text;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace SolarOps.Infrastructure.Messaging.RabbitMq;

/// <summary>Publishes with publisher confirms: <see cref="PublishAsync"/> only completes once the broker has persisted the message.</summary>
public sealed class RabbitMqEventBus(RabbitMqConnection connection, IOptions<MessagingOptions> options) : IEventBus, IAsyncDisposable
{
    internal const string TenantHeader = "x-tenant-id";
    internal const string TraceParentHeader = "traceparent";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private IChannel? _channel;

    public async Task PublishAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        var settings = options.Value.RabbitMq;
        var properties = new BasicProperties
        {
            MessageId = envelope.MessageId.ToString(),
            Type = envelope.EventName,
            ContentType = "application/json",
            DeliveryMode = DeliveryModes.Persistent,
            Timestamp = new AmqpTimestamp(new DateTimeOffset(envelope.OccurredOnUtc, TimeSpan.Zero).ToUnixTimeSeconds()),
            Headers = new Dictionary<string, object?>
            {
                [TenantHeader] = envelope.TenantId?.ToString(),
                [TraceParentHeader] = envelope.TraceParent,
            },
        };

        // Channels are not safe for concurrent publishing; the relay is sequential anyway.
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var channel = await GetChannelAsync(settings, cancellationToken);
            await channel.BasicPublishAsync(
                settings.Exchange,
                routingKey: envelope.EventName,
                mandatory: false,
                basicProperties: properties,
                body: Encoding.UTF8.GetBytes(envelope.Payload),
                cancellationToken: cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null)
        {
            await _channel.DisposeAsync();
        }

        _gate.Dispose();
    }

    private async Task<IChannel> GetChannelAsync(RabbitMqOptions settings, CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true } open)
        {
            return open;
        }

        var connectionInstance = await connection.GetAsync(cancellationToken);
        _channel = await connectionInstance.CreateChannelAsync(
            new CreateChannelOptions(publisherConfirmationsEnabled: true, publisherConfirmationTrackingEnabled: true),
            cancellationToken);

        await RabbitMqTopology.DeclareExchangesAsync(_channel, settings, cancellationToken);
        return _channel;
    }
}
