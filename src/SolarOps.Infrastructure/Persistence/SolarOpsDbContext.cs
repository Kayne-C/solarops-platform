using System.Reflection;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Oracle.ManagedDataAccess.Client;
using SolarOps.Application.Abstractions;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Production;
using SolarOps.Domain.Tenants;
using SolarOps.Domain.WorkOrders;
using SolarOps.Infrastructure.Persistence.Outbox;

namespace SolarOps.Infrastructure.Persistence;

public sealed class SolarOpsDbContext(DbContextOptions<SolarOpsDbContext> options, ITenantContext tenantContext)
    : DbContext(options), IApplicationDbContext
{
    private const string OracleProviderName = "Oracle.EntityFrameworkCore";

    private static readonly MethodInfo ApplyTenantFilterMethod =
        typeof(SolarOpsDbContext).GetMethod(nameof(ApplyTenantFilter), BindingFlags.Instance | BindingFlags.NonPublic)!;

    public DbSet<Tenant> Tenants => Set<Tenant>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Investor> Investors => Set<Investor>();

    public DbSet<Site> Sites => Set<Site>();

    public DbSet<Plant> Plants => Set<Plant>();

    public DbSet<DailyYield> DailyYields => Set<DailyYield>();

    public DbSet<ProductionBaseline> ProductionBaselines => Set<ProductionBaseline>();

    public DbSet<WorkOrder> WorkOrders => Set<WorkOrder>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<InboxMessage> InboxMessages => Set<InboxMessage>();

    /// <summary>Read by the tenant query filter; EF Core turns it into a per-query parameter (one cached plan for all tenants).</summary>
    private Guid CurrentTenantId => tenantContext.TenantId;

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            // The unit of work failed as a whole: discard it so a follow-up save in the same scope
            // (e.g. the inbox record) does not replay the rejected rows.
            ChangeTracker.Clear();

            if (IsUniqueConstraintViolation(exception))
            {
                throw new UniqueConstraintViolationException("A unique constraint rejected the write.", exception);
            }

            throw;
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SolarOpsDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes().ToList())
        {
            var clrType = entityType.ClrType;

            if (typeof(Entity).IsAssignableFrom(clrType))
            {
                // Ids are generated in the domain (UUIDv7); EF must not treat a set key as "already persisted".
                modelBuilder.Entity(clrType).Property(nameof(Entity.Id)).ValueGeneratedNever();
            }

            if (typeof(AggregateRoot).IsAssignableFrom(clrType))
            {
                modelBuilder.Entity(clrType).Ignore(nameof(AggregateRoot.DomainEvents));
            }

            if (typeof(ITenantOwned).IsAssignableFrom(clrType))
            {
                ApplyTenantFilterMethod.MakeGenericMethod(clrType).Invoke(this, [modelBuilder]);
            }
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(18, 4);
        configurationBuilder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);

        if (Database.IsSqlite())
        {
            // SQLite has no decimal type; REAL keeps ORDER BY / SUM translatable for local runs and tests.
            configurationBuilder.Properties<decimal>().HaveConversion<double>();
        }
        else if (Database.ProviderName == OracleProviderName)
        {
            // The Oracle provider maps DateOnly to NVARCHAR2(10); store it as a native DATE instead.
            configurationBuilder.Properties<DateOnly>().HaveConversion<DateOnlyToDateTimeConverter>().HaveColumnType("DATE");
        }
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantOwned =>
        modelBuilder.Entity<TEntity>().HasQueryFilter(QueryFilterNames.Tenant, e => e.TenantId == CurrentTenantId);

    private static bool IsUniqueConstraintViolation(DbUpdateException exception) => exception.InnerException switch
    {
        SqlException sql => sql.Number is 2601 or 2627,
        OracleException oracle => oracle.Number == 1,
        SqliteException sqlite => sqlite.SqliteErrorCode == 19 && sqlite.SqliteExtendedErrorCode is 2067 or 1555,
        _ => false,
    };
}

internal sealed class DateOnlyToDateTimeConverter() : ValueConverter<DateOnly, DateTime>(
    date => date.ToDateTime(TimeOnly.MinValue),
    dateTime => DateOnly.FromDateTime(dateTime));
