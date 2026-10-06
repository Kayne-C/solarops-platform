using SolarOps.Api.Infrastructure;
using SolarOps.Api.Security;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Application.Features.WorkOrders;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Api.Endpoints;

public sealed record AssignWorkOrderRequest(Guid UserId);

public sealed record TransitionWorkOrderRequest(WorkOrderTransition Transition, string? Note);

public sealed record AddWorkActivityRequest(string Description);

/// <summary>
/// Work orders are edited concurrently by dispatchers and technicians in the field. Reads return an ETag;
/// every mutation must send it back in <c>If-Match</c> and receives the next one (lost-update protection).
/// </summary>
internal static class WorkOrderEndpoints
{
    public static RouteGroupBuilder MapWorkOrderEndpoints(this RouteGroupBuilder api)
    {
        var workOrders = api.MapGroup("/work-orders").WithTags("Work orders").RequireAuthorization(Policies.FieldOperations);

        workOrders.MapGet("/", async (
                    ISender sender,
                    CancellationToken ct,
                    int page = 1,
                    int pageSize = 25,
                    WorkOrderStatus? status = null,
                    WorkOrderPriority? priority = null,
                    Guid? plantId = null) =>
                (await sender.Send(new ListWorkOrdersQuery(page, pageSize, status, priority, plantId), ct)).ToHttp(TypedResults.Ok))
            .Produces<PagedResponse<WorkOrderSummaryResponse>>();

        workOrders.MapGet("/{id:guid}", async (Guid id, HttpContext http, ISender sender, CancellationToken ct) =>
                (await sender.Send(new GetWorkOrderQuery(id), ct)).ToHttp(workOrder =>
                {
                    http.SetETag(workOrder.ConcurrencyStamp);
                    return TypedResults.Ok(workOrder);
                }))
            .Produces<WorkOrderDetailsResponse>()
            .ProducesProblem(StatusCodes.Status404NotFound);

        workOrders.MapPost("/", async (CreateWorkOrderCommand command, HttpContext http, ISender sender, CancellationToken ct) =>
                (await sender.Send(command, ct)).ToHttp(version =>
                {
                    http.SetETag(version.ConcurrencyStamp);
                    return TypedResults.Created($"/api/v1/work-orders/{version.Id}", version);
                }))
            .RequireAuthorization(Policies.Engineering)
            .Produces<WorkOrderVersionResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem();

        workOrders.MapPost("/{id:guid}/assignments", (Guid id, AssignWorkOrderRequest request, HttpContext http, ISender sender, CancellationToken ct) =>
                MutateAsync(http, stamp => sender.Send(new AssignWorkOrderCommand(id, request.UserId, stamp), ct)))
            .RequireAuthorization(Policies.Engineering)
            .WithVersionedMutationMetadata();

        workOrders.MapPost("/{id:guid}/transitions", (Guid id, TransitionWorkOrderRequest request, HttpContext http, ISender sender, CancellationToken ct) =>
                MutateAsync(http, stamp => sender.Send(new TransitionWorkOrderCommand(id, request.Transition, request.Note, stamp), ct)))
            .WithSummary("Start, complete or cancel a work order (state machine enforced by the aggregate).")
            .WithVersionedMutationMetadata();

        workOrders.MapPost("/{id:guid}/activities", (Guid id, AddWorkActivityRequest request, HttpContext http, ISender sender, CancellationToken ct) =>
                MutateAsync(http, stamp => sender.Send(new AddWorkActivityCommand(id, request.Description, stamp), ct)))
            .WithVersionedMutationMetadata();

        return api;
    }

    private static async Task<IResult> MutateAsync(
        HttpContext http,
        Func<Guid, Task<Domain.Common.Result<WorkOrderVersionResponse>>> mutation)
    {
        if (!http.Request.TryGetIfMatch(out var stamp, out var problem))
        {
            return problem!;
        }

        return (await mutation(stamp)).ToHttp(version =>
        {
            http.SetETag(version.ConcurrencyStamp);
            return TypedResults.Ok(version);
        });
    }

    private static RouteHandlerBuilder WithVersionedMutationMetadata(this RouteHandlerBuilder builder) => builder
        .Produces<WorkOrderVersionResponse>()
        .ProducesProblem(StatusCodes.Status404NotFound)
        .ProducesProblem(StatusCodes.Status412PreconditionFailed)
        .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
        .ProducesProblem(StatusCodes.Status428PreconditionRequired);
}
