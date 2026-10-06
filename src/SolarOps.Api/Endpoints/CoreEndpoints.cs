using SolarOps.Api.Infrastructure;
using SolarOps.Api.Security;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Application.Features.Assets;
using SolarOps.Application.Features.Auth;
using SolarOps.Application.Features.Users;
using SolarOps.Domain.Assets;

namespace SolarOps.Api.Endpoints;

internal static class CoreEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Auth");

        auth.MapPost("/token", async (IssueAccessTokenCommand command, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(TypedResults.Ok))
            .AllowAnonymous()
            .RequireRateLimiting(ApiServiceExtensions.TokenIssuancePolicy)
            .WithSummary("Exchange tenant + e-mail + password for a JWT access token.")
            .Produces<AccessTokenResponse>()
            .ProducesProblem(StatusCodes.Status401Unauthorized);

        return api;
    }

    public static RouteGroupBuilder MapUserEndpoints(this RouteGroupBuilder api)
    {
        var users = api.MapGroup("/users").WithTags("Users");

        users.MapGet("/", async (ISender sender, CancellationToken ct) =>
                (await sender.Send(new ListUsersQuery(), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<IReadOnlyList<UserResponse>>();

        users.MapPost("/", async (CreateUserCommand command, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(id => TypedResults.Created($"/api/v1/users/{id}", new { id })))
            .RequireAuthorization(Policies.TenantAdmin)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }

    public static RouteGroupBuilder MapAssetEndpoints(this RouteGroupBuilder api)
    {
        var investors = api.MapGroup("/investors").WithTags("Assets");
        investors.MapGet("/", async (ISender sender, CancellationToken ct) =>
                (await sender.Send(new ListInvestorsQuery(), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<IReadOnlyList<InvestorResponse>>();
        investors.MapPost("/", async (CreateInvestorCommand command, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(id => TypedResults.Created($"/api/v1/investors/{id}", new { id })))
            .RequireAuthorization(Policies.Engineering)
            .ProducesValidationProblem();

        var sites = api.MapGroup("/sites").WithTags("Assets");
        sites.MapGet("/", async (ISender sender, CancellationToken ct) =>
                (await sender.Send(new ListSitesQuery(), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<IReadOnlyList<SiteResponse>>();
        sites.MapPost("/", async (CreateSiteCommand command, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(id => TypedResults.Created($"/api/v1/sites/{id}", new { id })))
            .RequireAuthorization(Policies.Engineering)
            .ProducesValidationProblem();

        var plants = api.MapGroup("/plants").WithTags("Assets");
        plants.MapGet("/", async (
                    ISender sender,
                    CancellationToken ct,
                    int page = 1,
                    int pageSize = 25,
                    PlantStatus? status = null,
                    Guid? siteId = null,
                    string? search = null) =>
                (await sender.Send(new ListPlantsQuery(page, pageSize, status, siteId, search), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<PagedResponse<PlantSummaryResponse>>();

        plants.MapGet("/{plantId:guid}", async (Guid plantId, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetPlantQuery(plantId), ct)).ToHttp(TypedResults.Ok))
            .RequireAuthorization(Policies.FieldOperations)
            .Produces<PlantDetailsResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        plants.MapPost("/", async (RegisterPlantCommand command, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(id => TypedResults.Created($"/api/v1/plants/{id}", new { id })))
            .RequireAuthorization(Policies.Engineering)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }
}
