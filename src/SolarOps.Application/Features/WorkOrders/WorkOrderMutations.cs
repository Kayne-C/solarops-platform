using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Application.Features.WorkOrders;

/// <summary>
/// Shared optimistic-concurrency envelope for every work order mutation:
/// 1) fail fast when the client's ETag is already stale, 2) let the database token catch the race in between.
/// </summary>
internal sealed class WorkOrderMutator(IApplicationDbContext db)
{
    public async Task<Result<WorkOrderVersionResponse>> MutateAsync(
        Guid workOrderId,
        Guid expectedConcurrencyStamp,
        Func<WorkOrder, Result> mutation,
        CancellationToken cancellationToken,
        bool includeAssignments = false)
    {
        var query = db.WorkOrders.AsQueryable();
        if (includeAssignments)
        {
            query = query.Include(w => w.Assignments);
        }

        var workOrder = await query.FirstOrDefaultAsync(w => w.Id == workOrderId, cancellationToken);
        if (workOrder is null)
        {
            return WorkOrderErrors.NotFound(workOrderId);
        }

        if (workOrder.ConcurrencyStamp != expectedConcurrencyStamp)
        {
            return WorkOrderErrors.StaleVersion;
        }

        var outcome = mutation(workOrder);
        if (outcome.IsFailure)
        {
            return outcome.Error;
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return WorkOrderErrors.StaleVersion;
        }

        return new WorkOrderVersionResponse(workOrder.Id, workOrder.Status, workOrder.ConcurrencyStamp);
    }
}

public sealed record AssignWorkOrderCommand(Guid WorkOrderId, Guid UserId, Guid ExpectedConcurrencyStamp)
    : ICommand<WorkOrderVersionResponse>;

internal sealed class AssignWorkOrderValidator : AbstractValidator<AssignWorkOrderCommand>
{
    public AssignWorkOrderValidator()
    {
        RuleFor(c => c.WorkOrderId).NotEmpty();
        RuleFor(c => c.UserId).NotEmpty();
        RuleFor(c => c.ExpectedConcurrencyStamp).NotEmpty();
    }
}

internal sealed class AssignWorkOrderHandler(IApplicationDbContext db, WorkOrderMutator mutator, TimeProvider clock)
    : ICommandHandler<AssignWorkOrderCommand, WorkOrderVersionResponse>
{
    public async Task<Result<WorkOrderVersionResponse>> Handle(AssignWorkOrderCommand command, CancellationToken cancellationToken)
    {
        // Tenant-filtered: users of another tenant cannot be assigned even with a known id.
        if (!await db.Users.AnyAsync(u => u.Id == command.UserId && u.IsActive, cancellationToken))
        {
            return Error.NotFound("User.NotFound", $"User '{command.UserId}' was not found.");
        }

        return await mutator.MutateAsync(
            command.WorkOrderId,
            command.ExpectedConcurrencyStamp,
            w => w.Assign(command.UserId, clock.GetUtcNow().UtcDateTime),
            cancellationToken,
            includeAssignments: true);
    }
}

public enum WorkOrderTransition
{
    Start,
    Complete,
    Cancel,
}

public sealed record TransitionWorkOrderCommand(
    Guid WorkOrderId,
    WorkOrderTransition Transition,
    string? Note,
    Guid ExpectedConcurrencyStamp) : ICommand<WorkOrderVersionResponse>;

internal sealed class TransitionWorkOrderValidator : AbstractValidator<TransitionWorkOrderCommand>
{
    public TransitionWorkOrderValidator()
    {
        RuleFor(c => c.WorkOrderId).NotEmpty();
        RuleFor(c => c.Transition).IsInEnum();
        RuleFor(c => c.Note).MaximumLength(WorkOrder.TextMaxLength);
        RuleFor(c => c.ExpectedConcurrencyStamp).NotEmpty();
    }
}

internal sealed class TransitionWorkOrderHandler(WorkOrderMutator mutator, TimeProvider clock)
    : ICommandHandler<TransitionWorkOrderCommand, WorkOrderVersionResponse>
{
    public Task<Result<WorkOrderVersionResponse>> Handle(TransitionWorkOrderCommand command, CancellationToken cancellationToken)
    {
        var utcNow = clock.GetUtcNow().UtcDateTime;
        return mutator.MutateAsync(
            command.WorkOrderId,
            command.ExpectedConcurrencyStamp,
            w => command.Transition switch
            {
                WorkOrderTransition.Start => w.Start(utcNow),
                WorkOrderTransition.Complete => w.Complete(command.Note ?? string.Empty, utcNow),
                WorkOrderTransition.Cancel => w.Cancel(command.Note ?? string.Empty),
                _ => throw new ArgumentOutOfRangeException(nameof(command), command.Transition, null),
            },
            cancellationToken,
            includeAssignments: command.Transition == WorkOrderTransition.Start);
    }
}

public sealed record AddWorkActivityCommand(Guid WorkOrderId, string Description, Guid ExpectedConcurrencyStamp)
    : ICommand<WorkOrderVersionResponse>;

internal sealed class AddWorkActivityValidator : AbstractValidator<AddWorkActivityCommand>
{
    public AddWorkActivityValidator()
    {
        RuleFor(c => c.WorkOrderId).NotEmpty();
        RuleFor(c => c.Description).NotEmpty().MaximumLength(WorkOrder.TextMaxLength);
        RuleFor(c => c.ExpectedConcurrencyStamp).NotEmpty();
    }
}

internal sealed class AddWorkActivityHandler(WorkOrderMutator mutator, ICurrentUser currentUser, TimeProvider clock)
    : ICommandHandler<AddWorkActivityCommand, WorkOrderVersionResponse>
{
    public Task<Result<WorkOrderVersionResponse>> Handle(AddWorkActivityCommand command, CancellationToken cancellationToken)
    {
        if (currentUser.UserId is not { } authorId)
        {
            return Task.FromResult<Result<WorkOrderVersionResponse>>(
                Error.Forbidden("WorkActivity.AnonymousAuthor", "Activities must be logged by an authenticated user."));
        }

        return mutator.MutateAsync(
            command.WorkOrderId,
            command.ExpectedConcurrencyStamp,
            w => w.AddActivity(authorId, command.Description, clock.GetUtcNow().UtcDateTime),
            cancellationToken);
    }
}
