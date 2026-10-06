using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Features.Assets;
using SolarOps.Application.Features.Auth;
using SolarOps.Application.Features.Production;
using SolarOps.Application.Features.Users;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Tenants;
using SolarOps.Infrastructure.Messaging;
using SolarOps.Infrastructure.Persistence;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Api.IntegrationTests;

public sealed record SeededTenant(Guid TenantId, string Slug, Guid PlantId, Guid TechnicianId);

/// <summary>
/// Boots the real API (middleware, auth, EF Core, outbox) on an in-memory SQLite database. The outbox relay is
/// driven manually through <see cref="DrainOutboxAsync"/> so event-driven flows are deterministic.
/// </summary>
public sealed class SolarOpsApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string Password = "Integration-Test-Pass1!";

    /// <summary>PVsyst monthly specific yield used for every seeded plant (kWh/kWp).</summary>
    public static readonly decimal[] SpecificYield = [72, 92, 135, 158, 182, 198, 210, 196, 162, 124, 86, 66];

    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly string _connectionString = $"Data Source=file:solarops-{Guid.NewGuid():N}?mode=memory&cache=shared";
    private readonly SqliteConnection _keepAlive;

    public SolarOpsApiFactory()
    {
        // A shared in-memory SQLite database lives as long as one connection stays open.
        _keepAlive = new SqliteConnection(_connectionString);
        _keepAlive.Open();
    }

    public ValueTask InitializeAsync()
    {
        _ = Server; // starts the host: schema is created by the API's own initializer
        return ValueTask.CompletedTask;
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Database:Provider"] = "Sqlite",
            ["Database:ConnectionString"] = _connectionString,
            ["Database:ApplyMigrationsOnStartup"] = "true",
            ["Database:SeedDemoData"] = "false",
            ["Jwt:SigningKey"] = "integration-tests-signing-key-0123456789abcdef",
            ["Messaging:Transport"] = "InMemory",
            ["Messaging:Outbox:Enabled"] = "false",
            ["RateLimiting:TenantPermitsPerSecond"] = "100000",
            ["RateLimiting:TenantBurst"] = "100000",
            ["RateLimiting:TokenRequestsPerMinute"] = "100000",
        }));
    }

    /// <summary>Creates an isolated tenant with an admin, an engineer, a technician and one 1 MWp plant with a 2022 PVsyst baseline.</summary>
    public async Task<SeededTenant> SeedTenantAsync()
    {
        var slug = $"t-{Guid.NewGuid():N}"[..16];
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SolarOpsDbContext>();
        var tenant = Tenant.Create($"Tenant {slug}", slug).Value;
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(tenant.Id);

        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        Unwrap(await sender.Send(new CreateUserCommand($"admin@{slug}.test", "Admin", UserRole.TenantAdmin, Password)));
        Unwrap(await sender.Send(new CreateUserCommand($"engineer@{slug}.test", "Engineer", UserRole.Engineer, Password)));
        var technician = Unwrap(await sender.Send(new CreateUserCommand($"tech@{slug}.test", "Technician", UserRole.Technician, Password)));

        var investor = Unwrap(await sender.Send(new CreateInvestorCommand("Investor A.Ş.", null, null, null)));
        var site = Unwrap(await sender.Send(new CreateSiteCommand("Site", "Konya")));
        var plant = Unwrap(await sender.Send(new RegisterPlantCommand(
            "PLT-01", "Test GES", PlantType.GroundSolar, investor, site, 1_000m, new DateOnly(2022, 1, 1), 0.5m, null, null)));
        Unwrap(await sender.Send(new SetAnnualBaselineCommand(plant, 2022, SpecificYield.Select(y => y * 1_000m).ToList())));

        return new SeededTenant(tenant.Id, slug, plant, technician);
    }

    public async Task<HttpClient> CreateClientAsync(SeededTenant tenant, string role = "admin")
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/v1/auth/token",
            new IssueAccessTokenCommand(tenant.Slug, $"{role}@{tenant.Slug}.test", Password));
        response.EnsureSuccessStatusCode();

        var token = await response.Content.ReadFromJsonAsync<AccessTokenResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token!.AccessToken);
        return client;
    }

    /// <summary>Relays the outbox until it is empty, executing every subscribed handler in-process.</summary>
    public async Task DrainOutboxAsync()
    {
        var relay = Services.GetRequiredService<IOutboxProcessor>();
        for (var round = 0; round < 20 && await relay.ProcessBatchAsync(CancellationToken.None) > 0; round++)
        {
        }
    }

    private static T Unwrap<T>(Result<T> result) =>
        result.IsSuccess ? result.Value : throw new InvalidOperationException(result.Error.Description);
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<SolarOpsApiFactory>
{
    public const string Name = "api";
}
