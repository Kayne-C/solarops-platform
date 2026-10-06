using System.Globalization;
using Grpc.Core;
using Microsoft.AspNetCore.Authorization;
using SolarOps.Api.Security;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Features.Production;
using SolarOps.Domain.Production;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Api.Grpc;

/// <summary>
/// Client-streaming ingestion. Readings are buffered up to <see cref="BatchSize"/> and flushed through the same
/// <see cref="RecordDailyYieldsCommand"/> as the REST API. HTTP/2 flow control provides natural back-pressure:
/// the server stops reading while a batch is being written. Each flush runs in a fresh DI scope so a long
/// stream never accumulates tracked entities in one DbContext.
/// </summary>
[Authorize(Policy = Policies.Engineering)]
internal sealed class YieldIngestionService(IServiceScopeFactory scopeFactory, ITenantContext tenant) : YieldIngestion.YieldIngestionBase
{
    public const int BatchSize = 500;

    public override async Task<IngestionSummary> StreamDailyYields(
        IAsyncStreamReader<DailyYieldReading> requestStream,
        ServerCallContext context)
    {
        var summary = new IngestionSummary();
        var buffer = new Dictionary<Guid, List<DailyYieldInput>>();
        var buffered = 0;

        await foreach (var reading in requestStream.ReadAllAsync(context.CancellationToken))
        {
            summary.Received++;
            if (!Guid.TryParse(reading.PlantId, out var plantId) ||
                !DateOnly.TryParseExact(reading.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) ||
                double.IsNaN(reading.EnergyKwh) || double.IsInfinity(reading.EnergyKwh))
            {
                summary.Rejected++;
                continue;
            }

            if (!buffer.TryGetValue(plantId, out var entries))
            {
                buffer[plantId] = entries = [];
            }

            entries.Add(new DailyYieldInput(date, (decimal)reading.EnergyKwh));
            if (++buffered >= BatchSize)
            {
                await FlushAsync(buffer, summary, context.CancellationToken);
                buffered = 0;
            }
        }

        await FlushAsync(buffer, summary, context.CancellationToken);
        return summary;
    }

    private async Task FlushAsync(Dictionary<Guid, List<DailyYieldInput>> buffer, IngestionSummary summary, CancellationToken cancellationToken)
    {
        if (buffer.Count == 0)
        {
            return;
        }

        await using var scope = scopeFactory.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().Set(tenant.TenantId);
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        foreach (var (plantId, entries) in buffer)
        {
            var result = await sender.Send(new RecordDailyYieldsCommand(plantId, ProductionSource.Telemetry, entries), cancellationToken);
            if (result.IsFailure)
            {
                summary.Rejected += entries.Count;
                continue;
            }

            summary.Created += result.Value.Created;
            summary.Updated += result.Value.Updated;
            summary.Unchanged += result.Value.Unchanged;
            summary.Rejected += result.Value.Rejected.Count;
        }

        summary.Batches++;
        buffer.Clear();
    }
}
