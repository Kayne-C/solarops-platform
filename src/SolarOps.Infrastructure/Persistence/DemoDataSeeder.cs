using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Features.Assets;
using SolarOps.Application.Features.Production;
using SolarOps.Application.Features.Users;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Production;
using SolarOps.Domain.Tenants;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Infrastructure.Persistence;

/// <summary>
/// Seeds two isolated demo tenants through the real use cases (so validation, auditing, tenant stamping and the
/// outbox all run). One plant simulates an inverter fault in the last 12 days, which the performance pipeline
/// turns into an urgent work order as soon as the outbox is relayed.
/// </summary>
public sealed partial class DemoDataSeeder(IServiceScopeFactory scopeFactory, TimeProvider clock, ILogger<DemoDataSeeder> logger)
{
    public const string DemoPassword = "SolarOps!2026";

    /// <summary>Monthly specific yield of a fixed-tilt plant in Central Anatolia (kWh per kWp).</summary>
    private static readonly decimal[] SpecificYieldProfile = [72, 92, 135, 158, 182, 198, 210, 196, 162, 124, 86, 66];

    private sealed record PlantSeed(
        string Code,
        string Name,
        PlantType Type,
        decimal CapacityKwp,
        DateOnly CommissioningDate,
        decimal DegradationPercent,
        bool SimulateFault);

    private sealed record TenantSeed(string Name, string Slug, string Investor, string Site, string City, PlantSeed[] Plants);

    private static readonly TenantSeed[] Tenants =
    [
        new("Anatolia Solar O&M", "anatolia-solar", "Kapadokya Enerji A.Ş.", "Konya Karapınar", "Konya",
        [
            new("KNY-01", "Karapınar GES-1", PlantType.GroundSolar, 4_200m, new DateOnly(2021, 4, 15), 0.55m, SimulateFault: false),
            new("KNY-02", "Karapınar GES-2", PlantType.GroundSolar, 2_750m, new DateOnly(2022, 6, 1), 0.50m, SimulateFault: true),
            new("ANT-01", "Antalya OSB Çatı GES", PlantType.RooftopSolar, 980m, new DateOnly(2023, 3, 10), 0.45m, SimulateFault: false),
        ]),
        new("Aegean Energy Services", "aegean-energy", "Ege Güneş Yatırım A.Ş.", "Torbalı", "İzmir",
        [
            new("IZM-01", "Torbalı GES", PlantType.GroundSolar, 1_600m, new DateOnly(2022, 5, 1), 0.50m, SimulateFault: false),
        ]),
    ];

    public async Task SeedAsync(CancellationToken cancellationToken)
    {
        await using (var probe = scopeFactory.CreateAsyncScope())
        {
            if (await probe.ServiceProvider.GetRequiredService<SolarOpsDbContext>().Tenants.AnyAsync(cancellationToken))
            {
                return;
            }
        }

        var random = new Random(42);
        foreach (var seed in Tenants)
        {
            await SeedTenantAsync(seed, random, cancellationToken);
            LogSeeded(logger, seed.Slug, seed.Plants.Length);
        }
    }

    private async Task SeedTenantAsync(TenantSeed seed, Random random, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<SolarOpsDbContext>();

        var tenant = Tenant.Create(seed.Name, seed.Slug).Value;
        db.Tenants.Add(tenant);
        await db.SaveChangesAsync(cancellationToken);
        services.GetRequiredService<TenantContext>().Set(tenant.Id);

        var sender = services.GetRequiredService<ISender>();
        var domain = $"{seed.Slug}.demo";
        Unwrap(await sender.Send(new CreateUserCommand($"admin@{domain}", "Tenant Admin", UserRole.TenantAdmin, DemoPassword), cancellationToken));
        Unwrap(await sender.Send(new CreateUserCommand($"engineer@{domain}", "Field Engineer", UserRole.Engineer, DemoPassword), cancellationToken));
        Unwrap(await sender.Send(new CreateUserCommand($"tech@{domain}", "Field Technician", UserRole.Technician, DemoPassword), cancellationToken));

        var investorId = Unwrap(await sender.Send(new CreateInvestorCommand(seed.Investor, "Yatırımcı İlişkileri", null, null), cancellationToken));
        var siteId = Unwrap(await sender.Send(new CreateSiteCommand(seed.Site, seed.City), cancellationToken));

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        foreach (var plant in seed.Plants)
        {
            var plantId = Unwrap(await sender.Send(
                new RegisterPlantCommand(
                    plant.Code,
                    plant.Name,
                    plant.Type,
                    investorId,
                    siteId,
                    plant.CapacityKwp,
                    plant.CommissioningDate,
                    plant.DegradationPercent,
                    "JA Solar JAM72S30 550W",
                    "Huawei SUN2000-185KTL-H1"),
                cancellationToken));

            var pvsyst = SpecificYieldProfile.Select(kwhPerKwp => kwhPerKwp * plant.CapacityKwp).ToList();
            Unwrap(await sender.Send(new SetAnnualBaselineCommand(plantId, plant.CommissioningDate.Year, pvsyst), cancellationToken));

            var entries = new List<DailyYieldInput>();
            for (var date = today.AddDays(-75); date < today; date = date.AddDays(1))
            {
                var monthly = pvsyst[date.Month - 1] * (1 - plant.DegradationPercent / 100m * (date.Year - plant.CommissioningDate.Year));
                var weather = 0.80m + (decimal)random.NextDouble() * 0.28m;
                var fault = plant.SimulateFault && date >= today.AddDays(-12) ? 0.55m : 1m;
                entries.Add(new DailyYieldInput(date, decimal.Round(monthly / DateTime.DaysInMonth(date.Year, date.Month) * weather * fault, 1)));
            }

            Unwrap(await sender.Send(new RecordDailyYieldsCommand(plantId, ProductionSource.Telemetry, entries), cancellationToken));
        }
    }

    private static T Unwrap<T>(Result<T> result) =>
        result.IsSuccess ? result.Value : throw new InvalidOperationException($"Seeding failed: {result.Error.Code} {result.Error.Description}");

    [LoggerMessage(Level = LogLevel.Information, Message = "Seeded demo tenant {Tenant} with {PlantCount} plant(s)")]
    private static partial void LogSeeded(ILogger logger, string tenant, int plantCount);
}
