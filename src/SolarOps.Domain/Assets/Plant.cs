using SolarOps.Domain.Assets.Events;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Domain.Assets;

public enum PlantType
{
    /// <summary>Ground-mounted solar (GES).</summary>
    GroundSolar,

    /// <summary>Rooftop solar (ÇGES).</summary>
    RooftopSolar,

    /// <summary>Floating solar.</summary>
    FloatingSolar,

    /// <summary>Hybrid plant with storage (BES).</summary>
    SolarWithStorage,
}

public enum PlantStatus
{
    Active,
    Maintenance,
    Decommissioned,
}

public sealed class Plant : AggregateRoot, ITenantOwned, IAuditable, ISoftDeletable
{
    public const int CodeMaxLength = 32;
    public const int NameMaxLength = 128;
    public const int EquipmentMaxLength = 128;
    public const decimal MaxDegradationRatePercent = 5m;

    private Plant()
    {
    }

    public Guid TenantId { get; private set; }

    /// <summary>Tenant-unique business key (e.g. <c>KNY-01</c>).</summary>
    public string Code { get; private set; } = null!;

    public string Name { get; private set; } = null!;

    public PlantType Type { get; private set; }

    public PlantStatus Status { get; private set; }

    public Guid InvestorId { get; private set; }

    public Guid SiteId { get; private set; }

    public decimal InstalledCapacityKwp { get; private set; }

    public DateOnly CommissioningDate { get; private set; }

    /// <summary>Linear yearly PV module degradation, in percent (e.g. 0.55 means 0.55 % per year).</summary>
    public decimal AnnualDegradationRatePercent { get; private set; }

    public string? PvModuleModel { get; private set; }

    public string? InverterModel { get; private set; }

    public DateOnly? LastProductionDate { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public bool IsDeleted { get; private set; }

    public DateTime? DeletedAtUtc { get; private set; }

    /// <summary>
    /// Physical upper bound for a single day: capacity running at nameplate for 24 hours.
    /// Rejects cumulative meter readings that are accidentally imported as daily yield.
    /// </summary>
    public decimal MaxPlausibleDailyYieldKwh => InstalledCapacityKwp * 24m;

    public static Result<Plant> Register(
        string code,
        string name,
        PlantType type,
        Guid investorId,
        Guid siteId,
        decimal installedCapacityKwp,
        DateOnly commissioningDate,
        decimal annualDegradationRatePercent,
        string? pvModuleModel = null,
        string? inverterModel = null)
    {
        if (installedCapacityKwp <= 0)
        {
            return PlantErrors.InvalidCapacity;
        }

        if (annualDegradationRatePercent is < 0 or > MaxDegradationRatePercent)
        {
            return PlantErrors.InvalidDegradationRate;
        }

        var plant = new Plant
        {
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Type = type,
            Status = PlantStatus.Active,
            InvestorId = investorId,
            SiteId = siteId,
            InstalledCapacityKwp = installedCapacityKwp,
            CommissioningDate = commissioningDate,
            AnnualDegradationRatePercent = annualDegradationRatePercent,
            PvModuleModel = pvModuleModel?.Trim(),
            InverterModel = inverterModel?.Trim(),
        };

        plant.Raise(new PlantRegisteredDomainEvent(plant.Id, plant.Code, plant.InstalledCapacityKwp));
        return plant;
    }

    public void ChangeStatus(PlantStatus status) => Status = status;

    /// <summary>Signals that a batch of daily yields was written; drives downstream performance evaluation.</summary>
    public void RecordProduction(DateOnly from, DateOnly to, int recordCount, ProductionSource source)
    {
        if (LastProductionDate is null || to > LastProductionDate)
        {
            LastProductionDate = to;
        }

        Raise(new ProductionRecordedDomainEvent(Id, from, to, recordCount, source));
    }

    public void SoftDelete(DateTime utcNow)
    {
        IsDeleted = true;
        DeletedAtUtc = utcNow;
        Status = PlantStatus.Decommissioned;
    }
}

public static class PlantErrors
{
    public static readonly Error InvalidCapacity =
        Error.BusinessRule("Plant.InvalidCapacity", "Installed capacity must be greater than zero.");

    public static readonly Error InvalidDegradationRate = Error.BusinessRule(
        "Plant.InvalidDegradationRate",
        $"Annual degradation rate must be between 0 and {MaxDegradationRate} percent.");

    public static readonly Error DuplicateCode =
        Error.Conflict("Plant.DuplicateCode", "A plant with the same code already exists.");

    public static Error NotFound(Guid plantId) =>
        Error.NotFound("Plant.NotFound", $"Plant '{plantId}' was not found.");

    private const decimal MaxDegradationRate = Plant.MaxDegradationRatePercent;
}
