using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Application.Features.Production;

public sealed record MonthlyBaselineResponse(int Month, decimal ExpectedKwh, BaselineSource Source);

public sealed record AnnualBaselineResponse(Guid PlantId, int Year, decimal TotalExpectedKwh, IReadOnlyList<MonthlyBaselineResponse> Months);

/// <summary>Stores the 12 PVsyst monthly expectations of a year (upsert).</summary>
public sealed record SetAnnualBaselineCommand(Guid PlantId, int Year, IReadOnlyList<decimal> MonthlyExpectedKwh)
    : ICommand<AnnualBaselineResponse>;

internal sealed class SetAnnualBaselineValidator : AbstractValidator<SetAnnualBaselineCommand>
{
    public SetAnnualBaselineValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.Year).InclusiveBetween(2000, 2100);
        RuleFor(c => c.MonthlyExpectedKwh).NotNull().Must(m => m.Count == 12).WithMessage("Exactly 12 monthly values are required.");
        RuleForEach(c => c.MonthlyExpectedKwh).GreaterThanOrEqualTo(0);
    }
}

internal sealed class SetAnnualBaselineHandler(IApplicationDbContext db, ITenantContext tenant, HybridCache cache)
    : ICommandHandler<SetAnnualBaselineCommand, AnnualBaselineResponse>
{
    public async Task<Result<AnnualBaselineResponse>> Handle(SetAnnualBaselineCommand command, CancellationToken cancellationToken)
    {
        if (!await db.Plants.AnyAsync(p => p.Id == command.PlantId, cancellationToken))
        {
            return PlantErrors.NotFound(command.PlantId);
        }

        var existing = await db.ProductionBaselines
            .Where(b => b.PlantId == command.PlantId && b.Year == command.Year)
            .ToDictionaryAsync(b => b.Month, cancellationToken);

        for (var month = 1; month <= 12; month++)
        {
            var expected = command.MonthlyExpectedKwh[month - 1];
            if (existing.TryGetValue(month, out var baseline))
            {
                var update = baseline.Update(expected, BaselineSource.PvSyst);
                if (update.IsFailure)
                {
                    return update.Error;
                }
            }
            else
            {
                var created = ProductionBaseline.Create(command.PlantId, command.Year, month, expected, BaselineSource.PvSyst);
                if (created.IsFailure)
                {
                    return created.Error;
                }

                db.ProductionBaselines.Add(created.Value);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await cache.RemoveByTagAsync([CacheTags.Plant(tenant.TenantId, command.PlantId), CacheTags.Portfolio(tenant.TenantId)], cancellationToken);

        var months = command.MonthlyExpectedKwh
            .Select((kwh, index) => new MonthlyBaselineResponse(index + 1, decimal.Round(kwh, 2), BaselineSource.PvSyst))
            .ToList();
        return new AnnualBaselineResponse(command.PlantId, command.Year, months.Sum(m => m.ExpectedKwh), months);
    }
}

/// <summary>
/// Degradation-aware projection of a PVsyst year to a target year. Optionally persists the result as
/// <see cref="BaselineSource.Projected"/> rows (never overwriting PVsyst data).
/// </summary>
public sealed record ProjectBaselineCommand(Guid PlantId, int BaseYear, int TargetYear, bool Persist)
    : ICommand<AnnualBaselineResponse>;

internal sealed class ProjectBaselineValidator : AbstractValidator<ProjectBaselineCommand>
{
    public ProjectBaselineValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.BaseYear).InclusiveBetween(2000, 2100);
        RuleFor(c => c.TargetYear).InclusiveBetween(2000, 2100);
    }
}

internal sealed class ProjectBaselineHandler(IApplicationDbContext db, ITenantContext tenant, HybridCache cache)
    : ICommandHandler<ProjectBaselineCommand, AnnualBaselineResponse>
{
    public async Task<Result<AnnualBaselineResponse>> Handle(ProjectBaselineCommand command, CancellationToken cancellationToken)
    {
        var plant = await db.Plants.AsNoTracking().FirstOrDefaultAsync(p => p.Id == command.PlantId, cancellationToken);
        if (plant is null)
        {
            return PlantErrors.NotFound(command.PlantId);
        }

        var baselines = await db.ProductionBaselines
            .Where(b => b.PlantId == command.PlantId && (b.Year == command.BaseYear || b.Year == command.TargetYear))
            .ToListAsync(cancellationToken);

        var source = baselines.Where(b => b.Year == command.BaseYear && b.Source == BaselineSource.PvSyst).ToDictionary(b => b.Month);
        if (source.Count == 0)
        {
            return Error.NotFound("Baseline.NotFound", $"No PVsyst baseline exists for {command.BaseYear}.");
        }

        var months = new List<MonthlyBaselineResponse>(12);
        foreach (var (month, baseline) in source.OrderBy(kv => kv.Key))
        {
            var projected = YieldProjection.Project(
                baseline.ExpectedKwh,
                command.BaseYear,
                command.TargetYear,
                plant.CommissioningDate.Year,
                plant.AnnualDegradationRatePercent);

            if (projected.IsFailure)
            {
                return projected.Error;
            }

            months.Add(new MonthlyBaselineResponse(month, projected.Value, BaselineSource.Projected));
        }

        if (command.Persist && command.TargetYear != command.BaseYear)
        {
            var target = baselines.Where(b => b.Year == command.TargetYear).ToDictionary(b => b.Month);
            foreach (var projection in months)
            {
                if (!target.TryGetValue(projection.Month, out var row))
                {
                    db.ProductionBaselines.Add(ProductionBaseline.Create(
                        plant.Id, command.TargetYear, projection.Month, projection.ExpectedKwh, BaselineSource.Projected).Value);
                }
                else if (row.Source == BaselineSource.Projected)
                {
                    row.Update(projection.ExpectedKwh, BaselineSource.Projected);
                }
            }

            await db.SaveChangesAsync(cancellationToken);
            await cache.RemoveByTagAsync([CacheTags.Plant(tenant.TenantId, plant.Id), CacheTags.Portfolio(tenant.TenantId)], cancellationToken);
        }

        return new AnnualBaselineResponse(plant.Id, command.TargetYear, months.Sum(m => m.ExpectedKwh), months);
    }
}

public sealed record GetAnnualBaselineQuery(Guid PlantId, int Year) : IQuery<AnnualBaselineResponse>;

internal sealed class GetAnnualBaselineHandler(IApplicationDbContext db) : IQueryHandler<GetAnnualBaselineQuery, AnnualBaselineResponse>
{
    public async Task<Result<AnnualBaselineResponse>> Handle(GetAnnualBaselineQuery query, CancellationToken cancellationToken)
    {
        if (!await db.Plants.AnyAsync(p => p.Id == query.PlantId, cancellationToken))
        {
            return PlantErrors.NotFound(query.PlantId);
        }

        var months = await db.ProductionBaselines.AsNoTracking()
            .Where(b => b.PlantId == query.PlantId && b.Year == query.Year)
            .OrderBy(b => b.Month)
            .Select(b => new MonthlyBaselineResponse(b.Month, b.ExpectedKwh, b.Source))
            .ToListAsync(cancellationToken);

        return new AnnualBaselineResponse(query.PlantId, query.Year, months.Sum(m => m.ExpectedKwh), months);
    }
}
