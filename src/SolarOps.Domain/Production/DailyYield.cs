using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;

namespace SolarOps.Domain.Production;

public enum ProductionSource
{
    Manual,
    FusionSolar,
    NetEco,
    Retgen,
    Telemetry,
}

/// <summary>Measured energy for one plant and one calendar day. Unique per (tenant, plant, date) — writes are upserts.</summary>
public sealed class DailyYield : Entity, ITenantOwned
{
    private DailyYield()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid PlantId { get; private set; }

    public DateOnly Date { get; private set; }

    public decimal EnergyKwh { get; private set; }

    public ProductionSource Source { get; private set; }

    public DateTime RecordedAtUtc { get; private set; }

    public static Result<DailyYield> Record(Plant plant, DateOnly date, decimal energyKwh, ProductionSource source, DateTime utcNow)
    {
        var validation = Validate(plant, date, energyKwh, utcNow);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        return new DailyYield
        {
            PlantId = plant.Id,
            Date = date,
            EnergyKwh = decimal.Round(energyKwh, 3),
            Source = source,
            RecordedAtUtc = utcNow,
        };
    }

    /// <returns><c>true</c> when the stored value actually changed.</returns>
    public Result<bool> Revise(Plant plant, decimal energyKwh, ProductionSource source, DateTime utcNow)
    {
        var validation = Validate(plant, Date, energyKwh, utcNow);
        if (validation.IsFailure)
        {
            return validation.Error;
        }

        var rounded = decimal.Round(energyKwh, 3);
        if (rounded == EnergyKwh && source == Source)
        {
            return false;
        }

        EnergyKwh = rounded;
        Source = source;
        RecordedAtUtc = utcNow;
        return true;
    }

    private static Result Validate(Plant plant, DateOnly date, decimal energyKwh, DateTime utcNow)
    {
        if (energyKwh < 0)
        {
            return ProductionErrors.NegativeEnergy;
        }

        if (energyKwh > plant.MaxPlausibleDailyYieldKwh)
        {
            return ProductionErrors.ImplausibleEnergy(plant.MaxPlausibleDailyYieldKwh);
        }

        if (date < plant.CommissioningDate)
        {
            return ProductionErrors.BeforeCommissioning;
        }

        // Plants run on local time (UTC+3 for Türkiye); allow one day of clock skew.
        if (date > DateOnly.FromDateTime(utcNow).AddDays(1))
        {
            return ProductionErrors.FutureDate;
        }

        return Result.Success();
    }
}

public static class ProductionErrors
{
    public static readonly Error NegativeEnergy =
        Error.BusinessRule("Production.NegativeEnergy", "Energy cannot be negative.");

    public static readonly Error BeforeCommissioning =
        Error.BusinessRule("Production.BeforeCommissioning", "Date is before the plant's commissioning date.");

    public static readonly Error FutureDate =
        Error.BusinessRule("Production.FutureDate", "Production cannot be recorded for a future date.");

    public static readonly Error EmptyBatch =
        Error.BusinessRule("Production.EmptyBatch", "At least one daily yield is required.");

    public static readonly Error ConcurrentWrite = Error.Conflict(
        "Production.ConcurrentWrite", "Another writer recorded the same day concurrently. Retry the request.");

    public static Error ImplausibleEnergy(decimal maxKwh) => Error.BusinessRule(
        "Production.ImplausibleEnergy",
        $"Energy exceeds the physical daily maximum of {maxKwh:0.##} kWh (capacity x 24h). Is this a cumulative meter value?");
}
