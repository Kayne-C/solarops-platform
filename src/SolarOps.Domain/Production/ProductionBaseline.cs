using SolarOps.Domain.Common;

namespace SolarOps.Domain.Production;

public enum BaselineSource
{
    /// <summary>Simulated by PVsyst during plant design.</summary>
    PvSyst,

    /// <summary>Derived from an earlier PVsyst year by applying module degradation.</summary>
    Projected,
}

/// <summary>Expected (simulated) energy for a plant-month — the yardstick for performance evaluation.</summary>
public sealed class ProductionBaseline : Entity, ITenantOwned, IAuditable
{
    private ProductionBaseline()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid PlantId { get; private set; }

    public int Year { get; private set; }

    public int Month { get; private set; }

    public decimal ExpectedKwh { get; private set; }

    public BaselineSource Source { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public static Result<ProductionBaseline> Create(Guid plantId, int year, int month, decimal expectedKwh, BaselineSource source)
    {
        var validation = Validate(year, month, expectedKwh);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        return new ProductionBaseline
        {
            PlantId = plantId,
            Year = year,
            Month = month,
            ExpectedKwh = decimal.Round(expectedKwh, 2),
            Source = source,
        };
    }

    public Result Update(decimal expectedKwh, BaselineSource source)
    {
        var validation = Validate(Year, Month, expectedKwh);
        if (validation.IsFailure)
        {
            return validation;
        }

        ExpectedKwh = decimal.Round(expectedKwh, 2);
        Source = source;
        return Result.Success();
    }

    private static Result Validate(int year, int month, decimal expectedKwh)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
        {
            return Error.BusinessRule("Baseline.InvalidPeriod", "Year must be 2000-2100 and month 1-12.");
        }

        return expectedKwh < 0
            ? Error.BusinessRule("Baseline.NegativeExpectation", "Expected energy cannot be negative.")
            : Result.Success();
    }
}
