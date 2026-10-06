using SolarOps.Domain.Assets;

namespace SolarOps.Domain.UnitTests;

internal static class TestData
{
    public static readonly DateTime UtcNow = new(2026, 10, 6, 12, 0, 0, DateTimeKind.Utc);

    public static Plant Plant(decimal capacityKwp = 1_000m, decimal degradationPercent = 0.5m, int commissioningYear = 2022) =>
        Domain.Assets.Plant.Register(
            "TST-01",
            "Test GES",
            PlantType.GroundSolar,
            Guid.NewGuid(),
            Guid.NewGuid(),
            capacityKwp,
            new DateOnly(commissioningYear, 1, 1),
            degradationPercent).Value;
}
