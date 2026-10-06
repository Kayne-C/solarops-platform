using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using SolarOps.Application.Abstractions;
using SolarOps.Domain.Common;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Write-side half of tenant isolation (the read side is the global query filter):
/// stamps the tenant on new rows and refuses any change to a row of another tenant.
/// </summary>
internal sealed class AuditAndTenantInterceptor(ITenantContext tenant, TimeProvider clock) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var utcNow = clock.GetUtcNow().UtcDateTime;
        foreach (var entry in context.ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified or EntityState.Deleted))
            {
                continue;
            }

            if (entry.Entity is ITenantOwned owned)
            {
                if (entry.State == EntityState.Added && owned.TenantId == Guid.Empty)
                {
                    if (!tenant.IsResolved)
                    {
                        throw new InvalidOperationException(
                            $"Cannot persist '{entry.Metadata.ClrType.Name}' without a resolved tenant.");
                    }

                    entry.Property(nameof(ITenantOwned.TenantId)).CurrentValue = tenant.TenantId;
                }
                else if (tenant.IsResolved && owned.TenantId != tenant.TenantId)
                {
                    throw new CrossTenantWriteException(entry.Metadata.ClrType.Name);
                }
            }

            if (entry.Entity is IAuditable)
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Property(nameof(IAuditable.CreatedAtUtc)).CurrentValue = utcNow;
                }
                else if (entry.State == EntityState.Modified)
                {
                    entry.Property(nameof(IAuditable.UpdatedAtUtc)).CurrentValue = utcNow;
                }
            }
        }
    }
}
