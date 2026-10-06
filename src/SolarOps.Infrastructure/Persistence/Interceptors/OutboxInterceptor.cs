using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SolarOps.Domain.Common;
using SolarOps.Infrastructure.Persistence.Outbox;

namespace SolarOps.Infrastructure.Persistence.Interceptors;

/// <summary>Converts pending domain events into outbox rows inside the same SaveChanges (and therefore the same transaction).</summary>
internal sealed class OutboxInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Enqueue(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Enqueue(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void Enqueue(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var aggregates = context.ChangeTracker.Entries<AggregateRoot>()
            .Select(entry => entry.Entity)
            .Where(aggregate => aggregate.DomainEvents.Count > 0)
            .ToList();

        var traceParent = Activity.Current?.Id;
        foreach (var aggregate in aggregates)
        {
            var tenantId = (aggregate as ITenantOwned)?.TenantId;
            foreach (var domainEvent in aggregate.DomainEvents)
            {
                context.Set<OutboxMessage>().Add(OutboxMessage.From(domainEvent, tenantId, traceParent));
            }

            aggregate.ClearDomainEvents();
        }
    }
}
