using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Production;
using SolarOps.Domain.Tenants;

namespace SolarOps.Application.Features.Performance;

public sealed record MonthlyPerformance(
    int Month,
    decimal? ExpectedMonthKwh,
    BaselineSource? ExpectationSource,
    decimal ActualKwh,
    int DaysWithData,
    decimal? ExpectedToDateKwh,
    decimal? PerformanceIndex,
    PerformanceStatus? Status);

internal static class PerformanceMath
{
    /// <summary>
    /// Pro-rates the monthly expectation to the days that actually have data, so that a month in progress
    /// (or a data gap) is not mistaken for under-performance. Data completeness is reported separately.
    /// </summary>
    public static MonthlyPerformance Evaluate(
        Plant plant,
        IEnumerable<ProductionBaseline> baselines,
        int year,
        int month,
        decimal actualKwh,
        int daysWithData,
        decimal alertThreshold)
    {
        var expected = YieldProjection.Resolve(plant, baselines, year, month);
        if (expected is null || daysWithData == 0)
        {
            return new MonthlyPerformance(month, expected?.Kwh, expected?.Source, actualKwh, daysWithData, null, null, null);
        }

        var expectedToDate = decimal.Round(expected.Kwh * daysWithData / DateTime.DaysInMonth(year, month), 2);
        if (expectedToDate <= 0)
        {
            return new MonthlyPerformance(month, expected.Kwh, expected.Source, actualKwh, daysWithData, expectedToDate, null, null);
        }

        var assessment = PerformanceAssessment.Evaluate(actualKwh, expectedToDate, alertThreshold);
        return new MonthlyPerformance(
            month,
            expected.Kwh,
            expected.Source,
            actualKwh,
            daysWithData,
            expectedToDate,
            assessment.PerformanceIndex,
            assessment.Status);
    }

    public static async Task<decimal> GetAlertThresholdAsync(
        this IApplicationDbContext db,
        ITenantContext tenant,
        CancellationToken cancellationToken)
    {
        var threshold = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenant.TenantId)
            .Select(t => (decimal?)t.PerformanceAlertThreshold)
            .FirstOrDefaultAsync(cancellationToken);

        return threshold ?? Tenant.DefaultAlertThreshold;
    }
}
