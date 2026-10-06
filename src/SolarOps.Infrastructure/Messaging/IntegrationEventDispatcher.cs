using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Events;
using SolarOps.Application.Diagnostics;
using SolarOps.Domain.Common;
using SolarOps.Infrastructure.Persistence;
using SolarOps.Infrastructure.Persistence.Outbox;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Infrastructure.Messaging;

/// <summary>
/// Runs one subscription for one message: new DI scope, tenant restored from the envelope, trace continued
/// from the producer, inbox check for idempotency. Shared by the RabbitMQ consumer and the in-memory bus.
/// </summary>
public sealed partial class IntegrationEventDispatcher(
    IServiceScopeFactory scopeFactory,
    TimeProvider clock,
    ILogger<IntegrationEventDispatcher> logger)
{
    public async Task DispatchAsync(EventEnvelope envelope, EventSubscription subscription, CancellationToken cancellationToken)
    {
        ActivityContext.TryParse(envelope.TraceParent, null, out var parentContext);
        using var activity = SolarOpsTelemetry.ActivitySource.StartActivity(
            $"{subscription.EventName} process", ActivityKind.Consumer, parentContext);
        activity?.SetTag("messaging.message.id", envelope.MessageId);
        activity?.SetTag("messaging.consumer.group.name", subscription.ConsumerName);

        await using var scope = scopeFactory.CreateAsyncScope();
        if (envelope.TenantId is { } tenantId)
        {
            scope.ServiceProvider.GetRequiredService<TenantContext>().Set(tenantId);
        }

        var db = scope.ServiceProvider.GetRequiredService<SolarOpsDbContext>();
        var alreadyProcessed = await db.InboxMessages.AsNoTracking()
            .AnyAsync(m => m.MessageId == envelope.MessageId && m.Consumer == subscription.ConsumerName, cancellationToken);

        if (alreadyProcessed)
        {
            LogDuplicate(logger, envelope.MessageId, subscription.ConsumerName);
            return;
        }

        var domainEvent = (IDomainEvent)(JsonSerializer.Deserialize(envelope.Payload, subscription.EventType, EventSerialization.Options)
            ?? throw new InvalidOperationException($"Message {envelope.MessageId} has an empty payload."));

        var handler = scope.ServiceProvider.GetRequiredService(subscription.HandlerType);
        await subscription.InvokeAsync(handler, domainEvent, cancellationToken);

        db.InboxMessages.Add(new InboxMessage(envelope.MessageId, subscription.ConsumerName, clock.GetUtcNow().UtcDateTime));
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            // A concurrent redelivery finished first; the handler is idempotent so nothing is lost.
            LogDuplicate(logger, envelope.MessageId, subscription.ConsumerName);
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Skipping duplicate message {MessageId} for {Consumer}")]
    private static partial void LogDuplicate(ILogger logger, Guid messageId, string consumer);
}

/// <summary>Synchronous in-process transport: publishing invokes every matching subscription directly.</summary>
public sealed class InMemoryEventBus(EventSubscriptionRegistry registry, IntegrationEventDispatcher dispatcher) : IEventBus
{
    public async Task PublishAsync(EventEnvelope envelope, CancellationToken cancellationToken)
    {
        foreach (var subscription in registry.For(envelope.EventName))
        {
            await dispatcher.DispatchAsync(envelope, subscription, cancellationToken);
        }
    }
}
