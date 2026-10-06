using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Features.Production;
using SolarOps.Infrastructure.Identity;
using SolarOps.Infrastructure.Messaging;
using SolarOps.Infrastructure.Messaging.RabbitMq;
using SolarOps.Infrastructure.Persistence;
using SolarOps.Infrastructure.Persistence.Interceptors;
using SolarOps.Infrastructure.Production.Parsers;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Infrastructure;

public static class DependencyInjection
{
    public const string SqlServerMigrationsAssembly = "SolarOps.Migrations.SqlServer";
    public const string OracleMigrationsAssembly = "SolarOps.Migrations.Oracle";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<DatabaseOptions>().Bind(configuration.GetSection(DatabaseOptions.Section));
        services.AddOptions<MessagingOptions>().Bind(configuration.GetSection(MessagingOptions.Section));
        services.TryAddSingleton(TimeProvider.System);

        AddPersistence(services);
        AddCaching(services, configuration);
        AddMessaging(services);

        services.AddSingleton<IPasswordHasher, IdentityPasswordHasher>();
        services.AddSingleton<INotificationSender, LoggingNotificationSender>();
        services.AddSingleton<IProductionFileParser, FusionSolarParser>();
        services.AddSingleton<IProductionFileParser, NetEcoParser>();
        services.AddSingleton<IProductionFileParser, RetgenParser>();

        return services;
    }

    /// <summary>Outbox relay + broker consumers. Each self-disables according to <see cref="MessagingOptions"/>.</summary>
    public static IServiceCollection AddBackgroundMessaging(this IServiceCollection services)
    {
        services.AddHostedService(sp => sp.GetRequiredService<OutboxProcessor>());
        services.AddHostedService<RabbitMqConsumerHost>();
        return services;
    }

    public static IHealthChecksBuilder AddInfrastructureHealthChecks(this IHealthChecksBuilder builder) => builder
        .AddDbContextCheck<SolarOpsDbContext>("database", tags: ["ready"])
        .AddCheck<RabbitMqHealthCheck>("rabbitmq", tags: ["ready"])
        .AddCheck<DistributedCacheHealthCheck>("redis", tags: ["ready"]);

    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken cancellationToken = default)
    {
        await using var scope = services.CreateAsyncScope();
        var options = scope.ServiceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
        var db = scope.ServiceProvider.GetRequiredService<SolarOpsDbContext>();

        if (options.ApplyMigrationsOnStartup)
        {
            if (options.Provider == DatabaseProvider.Sqlite)
            {
                await db.Database.EnsureCreatedAsync(cancellationToken);
            }
            else
            {
                await db.Database.MigrateAsync(cancellationToken);
            }
        }

        if (options.SeedDemoData)
        {
            await scope.ServiceProvider.GetRequiredService<DemoDataSeeder>().SeedAsync(cancellationToken);
        }
    }

    private static void AddPersistence(IServiceCollection services)
    {
        services.AddScoped<TenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<TenantContext>());
        services.AddScoped<AuditAndTenantInterceptor>();
        services.AddSingleton<OutboxInterceptor>();

        services.AddDbContext<SolarOpsDbContext>((sp, options) =>
        {
            var database = sp.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            switch (database.Provider)
            {
                case DatabaseProvider.SqlServer:
                    options.UseSqlServer(database.ConnectionString, sql => sql
                        .MigrationsAssembly(SqlServerMigrationsAssembly)
                        .EnableRetryOnFailure(maxRetryCount: 5)
                        .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
                    break;
                case DatabaseProvider.Oracle:
                    options.UseOracle(database.ConnectionString, oracle => oracle
                        .MigrationsAssembly(OracleMigrationsAssembly)
                        .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
                    break;
                default:
                    options.UseSqlite(database.ConnectionString, sqlite => sqlite
                        .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
                    break;
            }

            // Interceptor order matters: the tenant must be stamped before events are copied to the outbox.
            options.AddInterceptors(sp.GetRequiredService<AuditAndTenantInterceptor>(), sp.GetRequiredService<OutboxInterceptor>());

            // Child rows (activities, assignments) are only reachable through their tenant-filtered aggregate root.
            options.ConfigureWarnings(w => w.Ignore(CoreEventId.PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning));
        });

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<SolarOpsDbContext>());
        services.AddScoped<DemoDataSeeder>();
    }

    private static void AddCaching(IServiceCollection services, IConfiguration configuration)
    {
        // L1 in-process + optional L2 Redis, with stampede protection and tag invalidation.
        services.AddHybridCache(options =>
        {
            options.MaximumPayloadBytes = 1024 * 1024;
            options.DefaultEntryOptions = new() { Expiration = TimeSpan.FromMinutes(5), LocalCacheExpiration = TimeSpan.FromMinutes(1) };
        });

        var redis = configuration.GetConnectionString("Redis");
        if (!string.IsNullOrWhiteSpace(redis))
        {
            services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = redis;
                options.InstanceName = "solarops:";
            });
        }
    }

    private static void AddMessaging(IServiceCollection services)
    {
        services.AddSingleton<IntegrationEventDispatcher>();
        services.AddSingleton<InMemoryEventBus>();
        services.AddSingleton<RabbitMqConnection>();
        services.AddSingleton<RabbitMqEventBus>();
        services.AddSingleton<IEventBus>(sp =>
            sp.GetRequiredService<IOptions<MessagingOptions>>().Value.Transport == MessageTransport.RabbitMq
                ? sp.GetRequiredService<RabbitMqEventBus>()
                : sp.GetRequiredService<InMemoryEventBus>());

        services.AddSingleton<OutboxProcessor>();
        services.AddSingleton<IOutboxProcessor>(sp => sp.GetRequiredService<OutboxProcessor>());
    }
}

internal sealed class DistributedCacheHealthCheck(IServiceProvider services) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        if (services.GetService<IDistributedCache>() is not { } cache)
        {
            return HealthCheckResult.Healthy("L2 cache not configured (in-process only).");
        }

        try
        {
            await cache.GetAsync("health-probe", cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Degraded("Redis unreachable; serving from L1/database.", exception);
        }
    }
}
