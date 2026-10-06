using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Application.Features.WorkOrders;

public sealed record WorkActivityResponse(Guid Id, Guid AuthorUserId, string Description, DateTime CreatedAtUtc);

public sealed record WorkOrderDetailsResponse(
    Guid Id,
    Guid PlantId,
    string Title,
    string? Description,
    WorkOrderType Type,
    WorkOrderPriority Priority,
    WorkOrderStatus Status,
    WorkOrderOrigin Origin,
    DateOnly? DueDate,
    DateTime CreatedAtUtc,
    DateTime? StartedAtUtc,
    DateTime? CompletedAtUtc,
    string? Resolution,
    IReadOnlyList<Guid> AssigneeIds,
    IReadOnlyList<WorkActivityResponse> Activities,
    Guid ConcurrencyStamp);

public sealed record WorkOrderSummaryResponse(
    Guid Id,
    Guid PlantId,
    string Title,
    WorkOrderType Type,
    WorkOrderPriority Priority,
    WorkOrderStatus Status,
    WorkOrderOrigin Origin,
    DateTime CreatedAtUtc);

/// <summary>Returned by every mutation so clients can chain the next conditional request.</summary>
public sealed record WorkOrderVersionResponse(Guid Id, WorkOrderStatus Status, Guid ConcurrencyStamp);

public sealed record CreateWorkOrderCommand(
    Guid PlantId,
    string Title,
    string? Description,
    WorkOrderType Type,
    WorkOrderPriority Priority,
    DateOnly? DueDate) : ICommand<WorkOrderVersionResponse>;

internal sealed class CreateWorkOrderValidator : AbstractValidator<CreateWorkOrderCommand>
{
    public CreateWorkOrderValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.Title).NotEmpty().MaximumLength(WorkOrder.TitleMaxLength);
        RuleFor(c => c.Description).MaximumLength(WorkOrder.TextMaxLength);
        RuleFor(c => c.Type).IsInEnum();
        RuleFor(c => c.Priority).IsInEnum();
    }
}

internal sealed class CreateWorkOrderHandler(IApplicationDbContext db, ICurrentUser currentUser)
    : ICommandHandler<CreateWorkOrderCommand, WorkOrderVersionResponse>
{
    public async Task<Result<WorkOrderVersionResponse>> Handle(CreateWorkOrderCommand command, CancellationToken cancellationToken)
    {
        if (!await db.Plants.AnyAsync(p => p.Id == command.PlantId, cancellationToken))
        {
            return PlantErrors.NotFound(command.PlantId);
        }

        var created = WorkOrder.Create(
            command.PlantId,
            command.Title,
            command.Description,
            command.Type,
            command.Priority,
            WorkOrderOrigin.Manual,
            createdByUserId: currentUser.UserId,
            dueDate: command.DueDate);

        if (created.IsFailure)
        {
            return created.Error;
        }

        db.WorkOrders.Add(created.Value);
        await db.SaveChangesAsync(cancellationToken);
        return new WorkOrderVersionResponse(created.Value.Id, created.Value.Status, created.Value.ConcurrencyStamp);
    }
}

public sealed record GetWorkOrderQuery(Guid WorkOrderId) : IQuery<WorkOrderDetailsResponse>;

internal sealed class GetWorkOrderHandler(IApplicationDbContext db) : IQueryHandler<GetWorkOrderQuery, WorkOrderDetailsResponse>
{
    public async Task<Result<WorkOrderDetailsResponse>> Handle(GetWorkOrderQuery query, CancellationToken cancellationToken)
    {
        // Split queries are enabled globally in Infrastructure, so the two collection includes do not
        // produce an assignments x activities cartesian product.
        var workOrder = await db.WorkOrders.AsNoTracking()
            .Include(w => w.Assignments)
            .Include(w => w.Activities)
            .FirstOrDefaultAsync(w => w.Id == query.WorkOrderId, cancellationToken);

        if (workOrder is null)
        {
            return WorkOrderErrors.NotFound(query.WorkOrderId);
        }

        return new WorkOrderDetailsResponse(
            workOrder.Id,
            workOrder.PlantId,
            workOrder.Title,
            workOrder.Description,
            workOrder.Type,
            workOrder.Priority,
            workOrder.Status,
            workOrder.Origin,
            workOrder.DueDate,
            workOrder.CreatedAtUtc,
            workOrder.StartedAtUtc,
            workOrder.CompletedAtUtc,
            workOrder.Resolution,
            workOrder.Assignments.Select(a => a.UserId).ToList(),
            workOrder.Activities
                .OrderBy(a => a.CreatedAtUtc)
                .Select(a => new WorkActivityResponse(a.Id, a.AuthorUserId, a.Description, a.CreatedAtUtc))
                .ToList(),
            workOrder.ConcurrencyStamp);
    }
}

public sealed record ListWorkOrdersQuery(
    int Page = 1,
    int PageSize = 25,
    WorkOrderStatus? Status = null,
    WorkOrderPriority? Priority = null,
    Guid? PlantId = null) : IQuery<PagedResponse<WorkOrderSummaryResponse>>;

internal sealed class ListWorkOrdersValidator : AbstractValidator<ListWorkOrdersQuery>
{
    public ListWorkOrdersValidator()
    {
        RuleFor(q => q.Page).MustBeValidPage();
        RuleFor(q => q.PageSize).MustBeValidPageSize();
    }
}

internal sealed class ListWorkOrdersHandler(IApplicationDbContext db)
    : IQueryHandler<ListWorkOrdersQuery, PagedResponse<WorkOrderSummaryResponse>>
{
    public async Task<Result<PagedResponse<WorkOrderSummaryResponse>>> Handle(ListWorkOrdersQuery query, CancellationToken cancellationToken)
    {
        var workOrders = db.WorkOrders.AsNoTracking();
        if (query.Status is { } status)
        {
            workOrders = workOrders.Where(w => w.Status == status);
        }

        if (query.Priority is { } priority)
        {
            workOrders = workOrders.Where(w => w.Priority == priority);
        }

        if (query.PlantId is { } plantId)
        {
            workOrders = workOrders.Where(w => w.PlantId == plantId);
        }

        var total = await workOrders.CountAsync(cancellationToken);
        var items = await workOrders
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.Id)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(w => new WorkOrderSummaryResponse(w.Id, w.PlantId, w.Title, w.Type, w.Priority, w.Status, w.Origin, w.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResponse<WorkOrderSummaryResponse>(items, query.Page, query.PageSize, total);
    }
}
