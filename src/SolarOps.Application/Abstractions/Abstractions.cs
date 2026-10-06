using Microsoft.EntityFrameworkCore;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Production;
using SolarOps.Domain.Tenants;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Application.Abstractions;

/// <summary>
/// Unit of work over the aggregates. Every <see cref="Domain.Common.ITenantOwned"/> set is transparently
/// filtered to the current tenant; bypassing it requires an explicit <c>IgnoreQueryFilters([QueryFilterNames.Tenant])</c>.
/// </summary>
public interface IApplicationDbContext
{
    DbSet<Tenant> Tenants { get; }

    DbSet<User> Users { get; }

    DbSet<Investor> Investors { get; }

    DbSet<Site> Sites { get; }

    DbSet<Plant> Plants { get; }

    DbSet<DailyYield> DailyYields { get; }

    DbSet<ProductionBaseline> ProductionBaselines { get; }

    DbSet<WorkOrder> WorkOrders { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>Names of the EF Core 10 named query filters, so callers can disable one without disabling the others.</summary>
public static class QueryFilterNames
{
    public const string Tenant = "TenantIsolation";
    public const string SoftDelete = "SoftDelete";
}

/// <summary>Provider-neutral signal that a unique index rejected the write (SQL Server 2601/2627, ORA-00001, SQLite 2067).</summary>
public sealed class UniqueConstraintViolationException(string message, Exception innerException)
    : Exception(message, innerException);

public interface ITenantContext
{
    Guid TenantId { get; }

    bool IsResolved { get; }
}

public interface ICurrentUser
{
    Guid? UserId { get; }
}

public interface IPasswordHasher
{
    string Hash(string password);

    bool Verify(string hashedPassword, string providedPassword);
}

public sealed record AccessToken(string Token, DateTime ExpiresAtUtc);

public interface IAccessTokenIssuer
{
    AccessToken Issue(User user, Tenant tenant);
}

public interface INotificationSender
{
    Task SendAsync(string channel, string subject, string body, CancellationToken cancellationToken);
}
