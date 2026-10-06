using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Common;
using SolarOps.Application.Diagnostics;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Application.Features.Production;

public sealed record DailyYieldInput(DateOnly Date, decimal EnergyKwh);

public sealed record RejectedDailyYield(DateOnly Date, string Code, string Reason);

public sealed record RecordDailyYieldsResponse(
    Guid PlantId,
    int Created,
    int Updated,
    int Unchanged,
    IReadOnlyList<RejectedDailyYield> Rejected);

/// <summary>
/// Single write path for daily production (REST, file import, gRPC stream). One range read + one
/// SaveChanges per batch; the plant aggregate emits one <c>ProductionRecorded</c> event per batch, not per row.
/// </summary>
public sealed class DailyYieldWriter(IApplicationDbContext db, ITenantContext tenant, TimeProvider clock, HybridCache cache)
{
    public async Task<Result<RecordDailyYieldsResponse>> WriteAsync(
        Guid plantId,
        ProductionSource source,
        IReadOnlyCollection<DailyYieldInput> entries,
        CancellationToken cancellationToken)
    {
        if (entries.Count == 0)
        {
            return ProductionErrors.EmptyBatch;
        }

        var plant = await db.Plants.FirstOrDefaultAsync(p => p.Id == plantId, cancellationToken);
        if (plant is null)
        {
            return PlantErrors.NotFound(plantId);
        }

        // Last value wins when the same day appears twice in one batch (e.g. corrected rows in an export).
        var batch = entries.GroupBy(e => e.Date).Select(g => g.Last()).OrderBy(e => e.Date).ToList();
        var from = batch[0].Date;
        var to = batch[^1].Date;

        var existing = await db.DailyYields
            .Where(y => y.PlantId == plantId && y.Date >= from && y.Date <= to)
            .ToDictionaryAsync(y => y.Date, cancellationToken);

        var utcNow = clock.GetUtcNow().UtcDateTime;
        int created = 0, updated = 0, unchanged = 0;
        var rejected = new List<RejectedDailyYield>();
        DateOnly? acceptedFrom = null, acceptedTo = null;

        foreach (var entry in batch)
        {
            if (existing.TryGetValue(entry.Date, out var current))
            {
                var revision = current.Revise(plant, entry.EnergyKwh, source, utcNow);
                if (revision.IsFailure)
                {
                    rejected.Add(new RejectedDailyYield(entry.Date, revision.Error.Code, revision.Error.Description));
                    continue;
                }

                if (!revision.Value)
                {
                    unchanged++;
                    continue;
                }

                updated++;
            }
            else
            {
                var recorded = DailyYield.Record(plant, entry.Date, entry.EnergyKwh, source, utcNow);
                if (recorded.IsFailure)
                {
                    rejected.Add(new RejectedDailyYield(entry.Date, recorded.Error.Code, recorded.Error.Description));
                    continue;
                }

                db.DailyYields.Add(recorded.Value);
                created++;
            }

            acceptedFrom = acceptedFrom is null || entry.Date < acceptedFrom ? entry.Date : acceptedFrom;
            acceptedTo = acceptedTo is null || entry.Date > acceptedTo ? entry.Date : acceptedTo;
        }

        if (created + updated > 0)
        {
            plant.RecordProduction(acceptedFrom!.Value, acceptedTo!.Value, created + updated, source);

            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (UniqueConstraintViolationException)
            {
                // A concurrent writer inserted one of these days first. The batch is an idempotent upsert, so a retry is safe.
                return ProductionErrors.ConcurrentWrite;
            }

            await cache.RemoveByTagAsync([CacheTags.Plant(tenant.TenantId, plantId), CacheTags.Portfolio(tenant.TenantId)], cancellationToken);
        }

        var sourceTag = new KeyValuePair<string, object?>("source", source.ToString());
        SolarOpsTelemetry.DailyYieldsWritten.Add(created + updated, sourceTag);
        SolarOpsTelemetry.DailyYieldsRejected.Add(rejected.Count, sourceTag);

        return new RecordDailyYieldsResponse(plantId, created, updated, unchanged, rejected);
    }
}
