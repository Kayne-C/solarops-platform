using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Application.Features.Performance;

public sealed record PlantPerformanceResponse(
    Guid PlantId,
    string PlantCode,
    int Year,
    decimal AlertThreshold,
    decimal ActualKwh,
    decimal ExpectedToDateKwh,
    decimal? PerformanceIndex,
    IReadOnlyList<MonthlyPerformance> Months);

public sealed record GetPlantPerformanceQuery(Guid PlantId, int Year) : IQuery<PlantPerformanceResponse>;

internal sealed class GetPlantPerformanceValidator : AbstractValidator<GetPlantPerformanceQuery>
{
    public GetPlantPerformanceValidator() => RuleFor(q => q.Year).InclusiveBetween(2000, 2100);
}

internal sealed class GetPlantPerformanceHandler(IApplicationDbContext db, ITenantContext tenant, HybridCache cache)
    : IQueryHandler<GetPlantPerformanceQuery, PlantPerformanceResponse>
{
    private static readonly HybridCacheEntryOptions CacheOptions = new()
    {
        Expiration = TimeSpan.FromMinutes(10),
        LocalCacheExpiration = TimeSpan.FromMinutes(2),
    };

    public async Task<Result<PlantPerformanceResponse>> Handle(GetPlantPerformanceQuery query, CancellationToken cancellationToken)
    {
        var key = $"{CacheTags.Plant(tenant.TenantId, query.PlantId)}:performance:{query.Year}";
        var response = await cache.GetOrCreateAsync(
            key,
            (Handler: this, Query: query),
            static (state, ct) => new ValueTask<PlantPerformanceResponse?>(state.Handler.ComputeAsync(state.Query, ct)),
            CacheOptions,
            [CacheTags.Plant(tenant.TenantId, query.PlantId)],
            cancellationToken);

        return response is null ? PlantErrors.NotFound(query.PlantId) : response;
    }

    private async Task<PlantPerformanceResponse?> ComputeAsync(GetPlantPerformanceQuery query, CancellationToken cancellationToken)
    {
        var plant = await db.Plants.AsNoTracking().FirstOrDefaultAsync(p => p.Id == query.PlantId, cancellationToken);
        if (plant is null)
        {
            return null;
        }

        var threshold = await db.GetAlertThresholdAsync(tenant, cancellationToken);
        var baselines = await db.ProductionBaselines.AsNoTracking()
            .Where(b => b.PlantId == plant.Id && b.Year <= query.Year)
            .ToListAsync(cancellationToken);

        var yearStart = new DateOnly(query.Year, 1, 1);
        var yearEnd = new DateOnly(query.Year, 12, 31);
        var daily = await db.DailyYields.AsNoTracking()
            .Where(y => y.PlantId == plant.Id && y.Date >= yearStart && y.Date <= yearEnd)
            .Select(y => new { y.Date, y.EnergyKwh })
            .ToListAsync(cancellationToken);

        var byMonth = daily.GroupBy(d => d.Date.Month).ToDictionary(g => g.Key, g => (Kwh: g.Sum(d => d.EnergyKwh), Days: g.Count()));

        var months = Enumerable.Range(1, 12).Select(month =>
        {
            var actual = byMonth.GetValueOrDefault(month);
            return PerformanceMath.Evaluate(plant, baselines, query.Year, month, actual.Kwh, actual.Days, threshold);
        }).ToList();

        var comparable = months.Where(m => m.ExpectedToDateKwh > 0).ToList();
        var actualTotal = comparable.Sum(m => m.ActualKwh);
        var expectedTotal = comparable.Sum(m => m.ExpectedToDateKwh!.Value);

        return new PlantPerformanceResponse(
            plant.Id,
            plant.Code,
            query.Year,
            threshold,
            actualTotal,
            expectedTotal,
            expectedTotal > 0 ? decimal.Round(actualTotal / expectedTotal, 4) : null,
            months);
    }
}

public sealed record PlantMonthPerformance(
    Guid PlantId,
    string Code,
    string Name,
    decimal InstalledCapacityKwp,
    decimal ActualKwh,
    int DaysWithData,
    decimal? ExpectedToDateKwh,
    decimal? PerformanceIndex,
    PerformanceStatus? Status,
    decimal SpecificYieldKwhPerKwp);

public sealed record PortfolioPerformanceResponse(
    int Year,
    int Month,
    decimal AlertThreshold,
    int PlantCount,
    int PlantsBelowThreshold,
    decimal ActualKwh,
    decimal ExpectedToDateKwh,
    decimal? PerformanceIndex,
    IReadOnlyList<PlantMonthPerformance> Plants);

public sealed record GetPortfolioPerformanceQuery(int Year, int Month) : IQuery<PortfolioPerformanceResponse>;

internal sealed class GetPortfolioPerformanceValidator : AbstractValidator<GetPortfolioPerformanceQuery>
{
    public GetPortfolioPerformanceValidator()
    {
        RuleFor(q => q.Year).InclusiveBetween(2000, 2100);
        RuleFor(q => q.Month).InclusiveBetween(1, 12);
    }
}

/// <summary>
/// Tenant-wide dashboard. Aggregation runs in the database (one GROUP BY), and the result is cached per tenant
/// with tag-based invalidation on every production or baseline write.
/// </summary>
internal sealed class GetPortfolioPerformanceHandler(IApplicationDbContext db, ITenantContext tenant, HybridCache cache)
    : IQueryHandler<GetPortfolioPerformanceQuery, PortfolioPerformanceResponse>
{
    private static readonly HybridCacheEntryOptions CacheOptions = new()
    {
        Expiration = TimeSpan.FromMinutes(5),
        LocalCacheExpiration = TimeSpan.FromMinutes(1),
    };

    public async Task<Result<PortfolioPerformanceResponse>> Handle(GetPortfolioPerformanceQuery query, CancellationToken cancellationToken)
    {
        var key = $"{CacheTags.Portfolio(tenant.TenantId)}:{query.Year:D4}-{query.Month:D2}";
        var response = await cache.GetOrCreateAsync(
            key,
            (Handler: this, Query: query),
            static (state, ct) => new ValueTask<PortfolioPerformanceResponse>(state.Handler.ComputeAsync(state.Query, ct)),
            CacheOptions,
            [CacheTags.Portfolio(tenant.TenantId)],
            cancellationToken);

        return response;
    }

    private async Task<PortfolioPerformanceResponse> ComputeAsync(GetPortfolioPerformanceQuery query, CancellationToken cancellationToken)
    {
        var threshold = await db.GetAlertThresholdAsync(tenant, cancellationToken);
        var plants = await db.Plants.AsNoTracking()
            .Where(p => p.Status != PlantStatus.Decommissioned)
            .OrderBy(p => p.Code)
            .ToListAsync(cancellationToken);

        var baselines = (await db.ProductionBaselines.AsNoTracking()
                .Where(b => b.Month == query.Month && b.Year <= query.Year)
                .ToListAsync(cancellationToken))
            .ToLookup(b => b.PlantId);

        var monthStart = new DateOnly(query.Year, query.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var actuals = await db.DailyYields.AsNoTracking()
            .Where(y => y.Date >= monthStart && y.Date <= monthEnd)
            .GroupBy(y => y.PlantId)
            .Select(g => new { PlantId = g.Key, Kwh = g.Sum(y => y.EnergyKwh), Days = g.Count() })
            .ToDictionaryAsync(a => a.PlantId, cancellationToken);

        var rows = new List<PlantMonthPerformance>(plants.Count);
        foreach (var plant in plants)
        {
            var actual = actuals.GetValueOrDefault(plant.Id);
            var actualKwh = actual?.Kwh ?? 0m;
            var month = PerformanceMath.Evaluate(
                plant, baselines[plant.Id], query.Year, query.Month, actualKwh, actual?.Days ?? 0, threshold);

            rows.Add(new PlantMonthPerformance(
                plant.Id,
                plant.Code,
                plant.Name,
                plant.InstalledCapacityKwp,
                actualKwh,
                month.DaysWithData,
                month.ExpectedToDateKwh,
                month.PerformanceIndex,
                month.Status,
                decimal.Round(actualKwh / plant.InstalledCapacityKwp, 2)));
        }

        var comparable = rows.Where(r => r.ExpectedToDateKwh > 0).ToList();
        var actualTotal = comparable.Sum(r => r.ActualKwh);
        var expectedTotal = comparable.Sum(r => r.ExpectedToDateKwh!.Value);

        return new PortfolioPerformanceResponse(
            query.Year,
            query.Month,
            threshold,
            rows.Count,
            rows.Count(r => r.Status is PerformanceStatus.Warning or PerformanceStatus.Critical),
            actualTotal,
            expectedTotal,
            expectedTotal > 0 ? decimal.Round(actualTotal / expectedTotal, 4) : null,
            rows.OrderBy(r => r.PerformanceIndex ?? decimal.MaxValue).ToList());
    }
}
