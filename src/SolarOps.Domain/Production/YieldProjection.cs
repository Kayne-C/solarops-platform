using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;

namespace SolarOps.Domain.Production;

public sealed record ExpectedYield(decimal Kwh, BaselineSource Source, int BaselineYear);

/// <summary>
/// Projects PVsyst expectations across years using compound module degradation:
/// <c>E(target) = E(base) * (1 - r)^(targetYear - baseYear)</c>.
/// </summary>
public static class YieldProjection
{
    public static Result<decimal> Project(
        decimal baseExpectedKwh,
        int baseYear,
        int targetYear,
        int commissioningYear,
        decimal annualDegradationRatePercent)
    {
        if (baseYear < commissioningYear)
        {
            return YieldProjectionErrors.BaseYearBeforeCommissioning(baseYear, commissioningYear);
        }

        if (targetYear < commissioningYear)
        {
            return YieldProjectionErrors.TargetYearBeforeCommissioning(targetYear, commissioningYear);
        }

        if (targetYear < baseYear)
        {
            return YieldProjectionErrors.BackwardProjection(baseYear, targetYear);
        }

        var retainedFraction = 1d - (double)(annualDegradationRatePercent / 100m);
        var factor = (decimal)Math.Pow(retainedFraction, targetYear - baseYear);
        return decimal.Round(baseExpectedKwh * factor, 2, MidpointRounding.AwayFromZero);
    }

    /// <summary>
    /// Resolves the expectation for a plant-month: an explicit baseline wins; otherwise the most recent
    /// earlier PVsyst baseline for the same calendar month is projected forward.
    /// </summary>
    public static ExpectedYield? Resolve(Plant plant, IEnumerable<ProductionBaseline> baselines, int year, int month)
    {
        ProductionBaseline? closestEarlier = null;
        foreach (var baseline in baselines)
        {
            if (baseline.Month != month)
            {
                continue;
            }

            if (baseline.Year == year)
            {
                return new ExpectedYield(baseline.ExpectedKwh, baseline.Source, baseline.Year);
            }

            if (baseline.Source == BaselineSource.PvSyst && baseline.Year < year &&
                (closestEarlier is null || baseline.Year > closestEarlier.Year))
            {
                closestEarlier = baseline;
            }
        }

        if (closestEarlier is null)
        {
            return null;
        }

        var projected = Project(
            closestEarlier.ExpectedKwh,
            closestEarlier.Year,
            year,
            plant.CommissioningDate.Year,
            plant.AnnualDegradationRatePercent);

        return projected.IsSuccess
            ? new ExpectedYield(projected.Value, BaselineSource.Projected, closestEarlier.Year)
            : null;
    }
}

public static class YieldProjectionErrors
{
    public static Error BaseYearBeforeCommissioning(int baseYear, int commissioningYear) => Error.BusinessRule(
        "Projection.BaseYearBeforeCommissioning",
        $"Base year {baseYear} is before the commissioning year {commissioningYear}.");

    public static Error TargetYearBeforeCommissioning(int targetYear, int commissioningYear) => Error.BusinessRule(
        "Projection.TargetYearBeforeCommissioning",
        $"Target year {targetYear} is before the commissioning year {commissioningYear}.");

    public static Error BackwardProjection(int baseYear, int targetYear) => Error.BusinessRule(
        "Projection.Backward",
        $"Cannot project backwards from {baseYear} to {targetYear}; degradation only accumulates forward in time.");
}
