namespace SolarOps.Infrastructure.Messaging;

public enum MessageTransport
{
    /// <summary>In-process dispatch (single host, local development, tests).</summary>
    InMemory,
    RabbitMq,
}

public sealed class MessagingOptions
{
    public const string Section = "Messaging";

    public MessageTransport Transport { get; set; } = MessageTransport.InMemory;

    /// <summary>Starts broker consumers in this host (Worker). The API host normally only produces.</summary>
    public bool ConsumersEnabled { get; set; }

    public RabbitMqOptions RabbitMq { get; set; } = new();

    public OutboxOptions Outbox { get; set; } = new();
}

public sealed class RabbitMqOptions
{
    public string ConnectionString { get; set; } = "amqp://guest:guest@localhost:5672/";

    public string Exchange { get; set; } = "solarops.events";

    public string QueuePrefix { get; set; } = "solarops";

    public ushort PrefetchCount { get; set; } = 16;
}

public sealed class OutboxOptions
{
    /// <summary>Runs the outbox relay in this host.</summary>
    public bool Enabled { get; set; } = true;

    public int BatchSize { get; set; } = 100;

    public TimeSpan PollingInterval { get; set; } = TimeSpan.FromSeconds(1);

    /// <summary>After this many failed publishes a message is parked for manual inspection.</summary>
    public int MaxAttempts { get; set; } = 10;
}

/// <summary>Transport-neutral message as it travels from the outbox to a consumer.</summary>
public sealed record EventEnvelope(
    Guid MessageId,
    string EventName,
    Guid? TenantId,
    string Payload,
    string? TraceParent,
    DateTime OccurredOnUtc);

public interface IEventBus
{
    Task PublishAsync(EventEnvelope envelope, CancellationToken cancellationToken);
}

public interface IOutboxProcessor
{
    /// <returns>Number of messages picked up (published or failed).</returns>
    Task<int> ProcessBatchAsync(CancellationToken cancellationToken);
}
