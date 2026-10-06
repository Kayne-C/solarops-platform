using SolarOps.Application.Abstractions;

namespace SolarOps.Infrastructure.Tenancy;

/// <summary>
/// Scoped holder for the tenant of the current unit of work: set once from the JWT claim (HTTP) or from the
/// message header (worker). Unresolved means <see cref="Guid.Empty"/>, which matches no rows — fail closed.
/// </summary>
public sealed class TenantContext : ITenantContext
{
    public Guid TenantId { get; private set; }

    public bool IsResolved => TenantId != Guid.Empty;

    public void Set(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id cannot be empty.", nameof(tenantId));
        }

        if (IsResolved && tenantId != TenantId)
        {
            throw new InvalidOperationException("The tenant of a scope cannot be changed once resolved.");
        }

        TenantId = tenantId;
    }
}

public sealed class CrossTenantWriteException(string entityName)
    : InvalidOperationException($"Refusing to persist '{entityName}': it belongs to a different tenant than the current scope.");
