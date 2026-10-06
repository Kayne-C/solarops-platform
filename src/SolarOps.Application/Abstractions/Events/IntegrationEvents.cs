using System.Reflection;
using SolarOps.Domain.Common;

namespace SolarOps.Application.Abstractions.Events;

/// <summary>
/// Asynchronous reaction to a domain event delivered through the outbox + message broker.
/// Delivery is at-least-once; handlers must be idempotent (the inbox de-duplicates redeliveries).
/// </summary>
public interface IIntegrationEventHandler<in TEvent>
    where TEvent : IDomainEvent
{
    Task HandleAsync(TEvent domainEvent, CancellationToken cancellationToken);
}

/// <summary>One handler bound to one event type. Each subscription owns a dedicated broker queue.</summary>
public sealed class EventSubscription
{
    private static readonly MethodInfo InvokeMethod =
        typeof(EventSubscription).GetMethod(nameof(InvokeTyped), BindingFlags.NonPublic | BindingFlags.Static)!;

    private readonly Func<object, IDomainEvent, CancellationToken, Task> _invoker;

    public EventSubscription(Type eventType, Type handlerType)
    {
        EventType = eventType;
        HandlerType = handlerType;
        _invoker = InvokeMethod.MakeGenericMethod(eventType)
            .CreateDelegate<Func<object, IDomainEvent, CancellationToken, Task>>();
    }

    public Type EventType { get; }

    public Type HandlerType { get; }

    /// <summary>Stable routing key: the event's type name.</summary>
    public string EventName => EventType.Name;

    /// <summary>Stable consumer identity (used for the queue name and inbox de-duplication).</summary>
    public string ConsumerName => HandlerType.Name;

    public Task InvokeAsync(object handler, IDomainEvent domainEvent, CancellationToken cancellationToken) =>
        _invoker(handler, domainEvent, cancellationToken);

    private static Task InvokeTyped<TEvent>(object handler, IDomainEvent domainEvent, CancellationToken cancellationToken)
        where TEvent : IDomainEvent =>
        ((IIntegrationEventHandler<TEvent>)handler).HandleAsync((TEvent)domainEvent, cancellationToken);
}

public sealed class EventSubscriptionRegistry(IEnumerable<EventSubscription> subscriptions)
{
    private readonly ILookup<string, EventSubscription> _byEventName = subscriptions.ToLookup(s => s.EventName);

    public IEnumerable<EventSubscription> All => _byEventName.SelectMany(group => group);

    public IEnumerable<EventSubscription> For(string eventName) => _byEventName[eventName];
}
