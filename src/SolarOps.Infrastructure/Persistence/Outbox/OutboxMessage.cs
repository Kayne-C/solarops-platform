using System.Text.Json;
using System.Text.Json.Serialization;
using SolarOps.Domain.Common;

namespace SolarOps.Infrastructure.Persistence.Outbox;

/// <summary>
/// Domain event persisted in the same transaction as the state change that raised it (transactional outbox),
/// then relayed to the broker asynchronously. Guarantees no event is lost and none is published for a rolled-back change.
/// </summary>
public sealed class OutboxMessage
{
    public const int TypeMaxLength = 256;

    /// <summary>Large enough to force LOB storage: nvarchar(max) on SQL Server, NCLOB on Oracle.</summary>
    public const int PayloadMaxLength = 1_000_000;
    public const int ErrorMaxLength = 2000;

    private OutboxMessage()
    {
    }

    public Guid Id { get; private set; }

    public Guid? TenantId { get; private set; }

    /// <summary>Event type name; doubles as the broker routing key. Never an assembly-qualified name.</summary>
    public string Type { get; private set; } = null!;

    public string Payload { get; private set; } = null!;

    /// <summary>W3C trace context of the originating request, so the consumer span joins the same trace.</summary>
    public string? TraceParent { get; private set; }

    public DateTime OccurredOnUtc { get; private set; }

    public DateTime? ProcessedOnUtc { get; private set; }

    public int Attempts { get; private set; }

    public string? LastError { get; private set; }

    public static OutboxMessage From(IDomainEvent domainEvent, Guid? tenantId, string? traceParent) => new()
    {
        Id = domainEvent.EventId,
        TenantId = tenantId,
        Type = domainEvent.GetType().Name,
        Payload = JsonSerializer.Serialize(domainEvent, domainEvent.GetType(), EventSerialization.Options),
        TraceParent = traceParent,
        OccurredOnUtc = domainEvent.OccurredOnUtc,
    };

    public void MarkProcessed(DateTime utcNow)
    {
        ProcessedOnUtc = utcNow;
        LastError = null;
    }

    public void MarkFailed(string error)
    {
        Attempts++;
        LastError = error.Length > ErrorMaxLength ? error[..ErrorMaxLength] : error;
    }
}

/// <summary>Consumer-side de-duplication record: (message, consumer) is processed at most once.</summary>
public sealed class InboxMessage
{
    public const int ConsumerMaxLength = 200;

    private InboxMessage()
    {
    }

    public InboxMessage(Guid messageId, string consumer, DateTime processedOnUtc)
    {
        MessageId = messageId;
        Consumer = consumer;
        ProcessedOnUtc = processedOnUtc;
    }

    public Guid MessageId { get; private set; }

    public string Consumer { get; private set; } = null!;

    public DateTime ProcessedOnUtc { get; private set; }
}

public static class EventSerialization
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };
}
