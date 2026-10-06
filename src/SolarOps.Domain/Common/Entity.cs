namespace SolarOps.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.CreateVersion7();
}

/// <summary>
/// Consistency boundary. Domain events raised here are persisted to the transactional outbox
/// in the same database transaction as the state change.
/// </summary>
public abstract class AggregateRoot : Entity
{
    private readonly List<IDomainEvent> _domainEvents = [];

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void Raise(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}

public interface IDomainEvent
{
    Guid EventId { get; }

    DateTime OccurredOnUtc { get; }
}

public abstract record DomainEvent : IDomainEvent
{
    public Guid EventId { get; init; } = Guid.CreateVersion7();

    public DateTime OccurredOnUtc { get; init; } = DateTime.UtcNow;
}

/// <summary>Marks rows that belong to exactly one tenant. Enforced by global query filters and a save interceptor.</summary>
public interface ITenantOwned
{
    Guid TenantId { get; }
}

public interface IAuditable
{
    DateTime CreatedAtUtc { get; }

    DateTime? UpdatedAtUtc { get; }
}

public interface ISoftDeletable
{
    bool IsDeleted { get; }

    DateTime? DeletedAtUtc { get; }
}
