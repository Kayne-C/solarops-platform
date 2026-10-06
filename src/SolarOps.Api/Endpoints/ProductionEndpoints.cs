using Microsoft.AspNetCore.Mvc;
using SolarOps.Api.Infrastructure;
using SolarOps.Api.Security;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Features.Performance;
using SolarOps.Application.Features.Production;
using SolarOps.Domain.Production;

namespace SolarOps.Api.Endpoints;

public sealed record RecordDailyYieldsRequest(IReadOnlyList<DailyYieldInput> Entries, ProductionSource Source = ProductionSource.Manual);

public sealed record SetAnnualBaselineRequest(IReadOnlyList<decimal> MonthlyExpectedKwh);

public sealed record ProjectBaselineRequest(int BaseYear, int TargetYear, bool Persist = false);

internal static class ProductionEndpoints
{
    private const long MaxUploadBytes = 10 * 1024 * 1024;

    public static RouteGroupBuilder MapProductionEndpoints(this RouteGroupBuilder api)
    {
        var plant = api.MapGroup("/plants/{plantId:guid}").WithTags("Production");

        plant.MapPut("/daily-yields", async (Guid plantId, RecordDailyYieldsRequest request, ISender sender, CancellationToken ct) =>
                (await sender.Send(new RecordDailyYieldsCommand(plantId, request.Source, request.Entries), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.Engineering)
            .WithSummary("Idempotent bulk upsert of daily yields (one row per plant and day).")
            .Produces<RecordDailyYieldsResponse>()
            .ProducesValidationProblem();

        plant.MapGet("/daily-yields", async (Guid plantId, DateOnly from, DateOnly to, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetDailyYieldsQuery(plantId, from, to), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<IReadOnlyList<DailyYieldResponse>>();

        plant.MapPost("/daily-yields/imports", async (
                    Guid plantId,
                    IFormFile file,
                    [FromForm] ProductionFileFormat format,
                    ISender sender,
                    CancellationToken ct) =>
                {
                    await using var content = file.OpenReadStream();
                    var command = new ImportProductionFileCommand(plantId, format, file.FileName, content);
                    return (await sender.Send(command, ct)).ToHttp(TypedResults.Ok);
                })
            .RequireAuthorization(Policies.Engineering)
            .DisableAntiforgery() // Bearer-token API: no ambient cookies, so CSRF does not apply.
            .WithMetadata(new RequestSizeLimitAttribute(MaxUploadBytes))
            .WithSummary("Import a FusionSolar (.xlsx), NetEco (.csv) or Retgen (.xlsx) export.")
            .Produces<ImportProductionFileResponse>()
            .ProducesValidationProblem();

        plant.MapPut("/baselines/{year:int}", async (Guid plantId, int year, SetAnnualBaselineRequest request, ISender sender, CancellationToken ct) =>
                (await sender.Send(new SetAnnualBaselineCommand(plantId, year, request.MonthlyExpectedKwh), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.Engineering)
            .WithSummary("Store the 12 monthly PVsyst expectations of a year.")
            .Produces<AnnualBaselineResponse>();

        plant.MapGet("/baselines/{year:int}", async (Guid plantId, int year, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetAnnualBaselineQuery(plantId, year), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<AnnualBaselineResponse>();

        plant.MapPost("/baselines/projections", async (Guid plantId, ProjectBaselineRequest request, ISender sender, CancellationToken ct) =>
                (await sender.Send(new ProjectBaselineCommand(plantId, request.BaseYear, request.TargetYear, request.Persist), ct))
                .ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.Engineering)
            .WithSummary("Project a PVsyst year to another year using the plant's module degradation rate.")
            .Produces<AnnualBaselineResponse>();

        plant.MapGet("/performance", async (Guid plantId, int year, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetPlantPerformanceQuery(plantId, year), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .WithTags("Performance")
            .Produces<PlantPerformanceResponse>();

        api.MapGet("/portfolio/performance", async (int year, int month, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetPortfolioPerformanceQuery(year, month), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .WithTags("Performance")
            .WithSummary("Tenant-wide actual vs. expected yield for one month (cached, tag-invalidated).")
            .Produces<PortfolioPerformanceResponse>();

        return api;
    }
}
