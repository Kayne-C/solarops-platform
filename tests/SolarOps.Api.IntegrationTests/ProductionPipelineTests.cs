using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Grpc.Core;
using Grpc.Net.Client;
using SolarOps.Api.Grpc;
using SolarOps.Application.Common;
using SolarOps.Application.Features.Performance;
using SolarOps.Application.Features.Production;
using SolarOps.Application.Features.WorkOrders;
using SolarOps.Domain.Production;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Api.IntegrationTests;

[Collection(ApiCollection.Name)]
public sealed class ProductionPipelineTests(SolarOpsApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Bulk_upsert_is_idempotent_and_rejects_physically_impossible_values()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");
        var entries = new[]
        {
            new DailyYieldInput(new DateOnly(2025, 6, 1), 6_100m),
            new DailyYieldInput(new DateOnly(2025, 6, 2), 6_250m),
            new DailyYieldInput(new DateOnly(2025, 6, 3), 7_133_443m), // cumulative counter of a 1 MWp plant
        };

        var first = await PutYieldsAsync(client, tenant, entries);
        var replay = await PutYieldsAsync(client, tenant, entries);

        Assert.Equal((2, 0, 0), (first.Created, first.Updated, first.Unchanged));
        Assert.Equal("Production.ImplausibleEnergy", Assert.Single(first.Rejected).Code);
        Assert.Equal((0, 0, 2), (replay.Created, replay.Updated, replay.Unchanged));
    }

    [Fact]
    public async Task Underperformance_opens_exactly_one_urgent_work_order_through_the_outbox()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");

        // June 2025 expectation (projected from PVsyst 2022): ~6 500 kWh/day. Recording ~3 000 kWh/day is critical.
        var lowDays = Enumerable.Range(1, 10).Select(d => new DailyYieldInput(new DateOnly(2025, 6, d), 3_000m)).ToList();
        await PutYieldsAsync(client, tenant, lowDays);
        await factory.DrainOutboxAsync();

        // Replays and further bad days must not open duplicates (correlation key + inbox).
        await PutYieldsAsync(client, tenant, lowDays);
        await PutYieldsAsync(client, tenant, [new DailyYieldInput(new DateOnly(2025, 6, 11), 2_900m)]);
        await factory.DrainOutboxAsync();
        await factory.DrainOutboxAsync();

        var workOrders = await client.GetFromJsonAsync<PagedResponse<WorkOrderSummaryResponse>>(
            $"/api/v1/work-orders?plantId={tenant.PlantId}", SolarOpsApiFactory.Json, Ct);
        var alert = Assert.Single(workOrders!.Items);
        Assert.Equal((WorkOrderOrigin.PerformanceAlert, WorkOrderPriority.Urgent, WorkOrderType.Fault), (alert.Origin, alert.Priority, alert.Type));
        Assert.Contains("2025-06", alert.Title, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Healthy_production_does_not_raise_alerts()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");

        await PutYieldsAsync(client, tenant, Enumerable.Range(1, 10).Select(d => new DailyYieldInput(new DateOnly(2025, 6, d), 6_400m)).ToList());
        await factory.DrainOutboxAsync();

        var workOrders = await client.GetFromJsonAsync<PagedResponse<WorkOrderSummaryResponse>>(
            $"/api/v1/work-orders?plantId={tenant.PlantId}", SolarOpsApiFactory.Json, Ct);
        Assert.Empty(workOrders!.Items);
    }

    [Fact]
    public async Task FusionSolar_export_round_trips_through_the_import_endpoint()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Rapor");
        sheet.Cell(2, 1).Value = "İstatistik zamanı";
        sheet.Cell(2, 2).Value = "İnverter Kazancı (kWh)";
        for (var day = 1; day <= 3; day++)
        {
            sheet.Cell(2 + day, 1).Value = $"2025-07-0{day}";
            sheet.Cell(2 + day, 2).Value = 6_000 + day;
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        using var file = new ByteArrayContent(stream.ToArray());
        file.Headers.ContentType = new MediaTypeHeaderValue("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        using var form = new MultipartFormDataContent { { file, "file", "fusionsolar-2025-07.xlsx" }, { new StringContent("FusionSolar"), "format" } };

        var response = await client.PostAsync($"/api/v1/plants/{tenant.PlantId}/daily-yields/imports", form, Ct);

        response.EnsureSuccessStatusCode();
        var import = await response.Content.ReadFromJsonAsync<ImportProductionFileResponse>(SolarOpsApiFactory.Json, Ct);
        Assert.Equal(3, import!.Result.Created);
        var stored = await client.GetFromJsonAsync<List<DailyYieldResponse>>(
            $"/api/v1/plants/{tenant.PlantId}/daily-yields?from=2025-07-01&to=2025-07-31", SolarOpsApiFactory.Json, Ct);
        Assert.All(stored!, y => Assert.Equal(ProductionSource.FusionSolar, y.Source));
        Assert.Equal([6_001m, 6_002m, 6_003m], stored!.Select(y => y.EnergyKwh));
    }

    [Fact]
    public async Task Portfolio_dashboard_cache_is_invalidated_by_new_production()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");
        const string url = "/api/v1/portfolio/performance?year=2025&month=8";

        await PutYieldsAsync(client, tenant, [new DailyYieldInput(new DateOnly(2025, 8, 1), 6_000m)]);
        var before = await client.GetFromJsonAsync<PortfolioPerformanceResponse>(url, SolarOpsApiFactory.Json, Ct);
        await PutYieldsAsync(client, tenant, [new DailyYieldInput(new DateOnly(2025, 8, 2), 5_000m)]);
        var after = await client.GetFromJsonAsync<PortfolioPerformanceResponse>(url, SolarOpsApiFactory.Json, Ct);

        Assert.Equal(6_000m, before!.ActualKwh);
        Assert.Equal(11_000m, after!.ActualKwh);
        Assert.Equal(2, Assert.Single(after.Plants).DaysWithData);
    }

    [Fact]
    public async Task Baseline_projection_applies_module_degradation()
    {
        var tenant = await factory.SeedTenantAsync();
        using var client = await factory.CreateClientAsync(tenant, "engineer");

        var response = await client.PostAsJsonAsync(
            $"/api/v1/plants/{tenant.PlantId}/baselines/projections", new { baseYear = 2022, targetYear = 2026, persist = true }, Ct);

        response.EnsureSuccessStatusCode();
        var projection = await response.Content.ReadFromJsonAsync<AnnualBaselineResponse>(SolarOpsApiFactory.Json, Ct);
        var june = projection!.Months.Single(m => m.Month == 6);
        Assert.Equal(decimal.Round(198_000m * (decimal)Math.Pow(0.995, 4), 2), june.ExpectedKwh);
        var stored = await client.GetFromJsonAsync<AnnualBaselineResponse>($"/api/v1/plants/{tenant.PlantId}/baselines/2026", SolarOpsApiFactory.Json, Ct);
        Assert.All(stored!.Months, m => Assert.Equal(BaselineSource.Projected, m.Source));
    }

    [Fact]
    public async Task Grpc_client_stream_is_written_in_bounded_batches()
    {
        var tenant = await factory.SeedTenantAsync();
        using var http = await factory.CreateClientAsync(tenant, "engineer");
        using var channel = GrpcChannel.ForAddress(factory.Server.BaseAddress, new GrpcChannelOptions { HttpHandler = factory.Server.CreateHandler() });
        var client = new YieldIngestion.YieldIngestionClient(channel);
        var headers = new Metadata { { "Authorization", http.DefaultRequestHeaders.Authorization!.ToString() } };

        using var call = client.StreamDailyYields(headers, cancellationToken: Ct);
        var start = new DateOnly(2022, 1, 1);
        for (var i = 0; i < 1_200; i++)
        {
            await call.RequestStream.WriteAsync(new DailyYieldReading
            {
                PlantId = tenant.PlantId.ToString(),
                Date = start.AddDays(i).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                EnergyKwh = 4_000 + i,
            }, Ct);
        }

        await call.RequestStream.WriteAsync(new DailyYieldReading { PlantId = "not-a-guid", Date = "2025-01-01", EnergyKwh = 1 }, Ct);
        await call.RequestStream.WriteAsync(new DailyYieldReading { PlantId = tenant.PlantId.ToString(), Date = "01/02/2025", EnergyKwh = 1 }, Ct);
        await call.RequestStream.CompleteAsync();
        var summary = await call;

        Assert.Equal(1_202, summary.Received);
        Assert.Equal(1_200, summary.Created);
        Assert.Equal(2, summary.Rejected);
        Assert.Equal(3, summary.Batches); // 500 + 500 + 200
    }

    [Fact]
    public async Task Grpc_requires_an_engineering_role()
    {
        var tenant = await factory.SeedTenantAsync();
        using var http = await factory.CreateClientAsync(tenant, "tech");
        using var channel = GrpcChannel.ForAddress(factory.Server.BaseAddress, new GrpcChannelOptions { HttpHandler = factory.Server.CreateHandler() });
        var client = new YieldIngestion.YieldIngestionClient(channel);

        using var call = client.StreamDailyYields(new Metadata { { "Authorization", http.DefaultRequestHeaders.Authorization!.ToString() } }, cancellationToken: Ct);

        var error = await Assert.ThrowsAsync<RpcException>(async () =>
        {
            await call.RequestStream.CompleteAsync();
            await call;
        });
        Assert.Equal(StatusCode.PermissionDenied, error.StatusCode);
    }

    private static async Task<RecordDailyYieldsResponse> PutYieldsAsync(HttpClient client, SeededTenant tenant, IReadOnlyList<DailyYieldInput> entries)
    {
        var response = await client.PutAsJsonAsync(
            $"/api/v1/plants/{tenant.PlantId}/daily-yields", new { entries }, SolarOpsApiFactory.Json, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RecordDailyYieldsResponse>(SolarOpsApiFactory.Json, Ct))!;
    }
}
