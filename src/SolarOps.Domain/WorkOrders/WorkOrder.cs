using SolarOps.Domain.Common;
using SolarOps.Domain.WorkOrders.Events;

namespace SolarOps.Domain.WorkOrders;

public enum WorkOrderType
{
    Maintenance,
    Fault,
    Inspection,
    Other,
}

public enum WorkOrderPriority
{
    Low,
    Medium,
    High,
    Urgent,
}

public enum WorkOrderStatus
{
    Open,
    InProgress,
    Completed,
    Cancelled,
}

public enum WorkOrderOrigin
{
    Manual,

    /// <summary>Opened automatically by the performance evaluation pipeline.</summary>
    PerformanceAlert,
}

/// <summary>
/// Field work for a plant. Every mutation rotates <see cref="ConcurrencyStamp"/>, which is mapped as an
/// optimistic concurrency token and exposed to HTTP clients as an ETag.
/// </summary>
public sealed class WorkOrder : AggregateRoot, ITenantOwned, IAuditable
{
    public const int TitleMaxLength = 200;
    public const int TextMaxLength = 4000;
    public const int CorrelationKeyMaxLength = 128;

    private readonly List<WorkOrderAssignment> _assignments = [];
    private readonly List<WorkActivity> _activities = [];

    private WorkOrder()
    {
    }

    public Guid TenantId { get; private set; }

    public Guid PlantId { get; private set; }

    public string Title { get; private set; } = null!;

    public string? Description { get; private set; }

    public WorkOrderType Type { get; private set; }

    public WorkOrderPriority Priority { get; private set; }

    public WorkOrderStatus Status { get; private set; }

    public WorkOrderOrigin Origin { get; private set; }

    /// <summary>Tenant-unique idempotency key. Automated producers derive it from the triggering condition.</summary>
    public string CorrelationKey { get; private set; } = null!;

    public Guid? CreatedByUserId { get; private set; }

    public DateOnly? DueDate { get; private set; }

    public DateTime? StartedAtUtc { get; private set; }

    public DateTime? CompletedAtUtc { get; private set; }

    public string? Resolution { get; private set; }

    public Guid ConcurrencyStamp { get; private set; } = Guid.NewGuid();

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public IReadOnlyCollection<WorkOrderAssignment> Assignments => _assignments.AsReadOnly();

    public IReadOnlyCollection<WorkActivity> Activities => _activities.AsReadOnly();

    public bool IsTerminal => Status is WorkOrderStatus.Completed or WorkOrderStatus.Cancelled;

    public static Result<WorkOrder> Create(
        Guid plantId,
        string title,
        string? description,
        WorkOrderType type,
        WorkOrderPriority priority,
        WorkOrderOrigin origin = WorkOrderOrigin.Manual,
        string? correlationKey = null,
        Guid? createdByUserId = null,
        DateOnly? dueDate = null)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return WorkOrderErrors.TitleRequired;
        }

        var workOrder = new WorkOrder
        {
            PlantId = plantId,
            Title = title.Trim(),
            Description = description?.Trim(),
            Type = type,
            Priority = priority,
            Status = WorkOrderStatus.Open,
            Origin = origin,
            CreatedByUserId = createdByUserId,
            DueDate = dueDate,
        };
        workOrder.CorrelationKey = correlationKey ?? $"manual:{workOrder.Id:N}";

        workOrder.Raise(new WorkOrderCreatedDomainEvent(workOrder.Id, plantId, priority, origin));
        return workOrder;
    }

    public Result Assign(Guid userId, DateTime utcNow)
    {
        if (IsTerminal)
        {
            return WorkOrderErrors.Closed(Status);
        }

        if (_assignments.Any(a => a.UserId == userId))
        {
            return WorkOrderErrors.AlreadyAssigned;
        }

        _assignments.Add(new WorkOrderAssignment(Id, userId, utcNow));
        Touch();
        Raise(new WorkOrderAssignedDomainEvent(Id, userId));
        return Result.Success();
    }

    public Result Start(DateTime utcNow)
    {
        if (Status != WorkOrderStatus.Open)
        {
            return WorkOrderErrors.InvalidTransition(Status, WorkOrderStatus.InProgress);
        }

        if (_assignments.Count == 0)
        {
            return WorkOrderErrors.NoAssignee;
        }

        StartedAtUtc = utcNow;
        return TransitionTo(WorkOrderStatus.InProgress);
    }

    public Result Complete(string resolution, DateTime utcNow)
    {
        if (Status != WorkOrderStatus.InProgress)
        {
            return WorkOrderErrors.InvalidTransition(Status, WorkOrderStatus.Completed);
        }

        if (string.IsNullOrWhiteSpace(resolution))
        {
            return WorkOrderErrors.ResolutionRequired;
        }

        Resolution = resolution.Trim();
        CompletedAtUtc = utcNow;
        return TransitionTo(WorkOrderStatus.Completed);
    }

    public Result Cancel(string reason)
    {
        if (IsTerminal)
        {
            return WorkOrderErrors.InvalidTransition(Status, WorkOrderStatus.Cancelled);
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            return WorkOrderErrors.ResolutionRequired;
        }

        Resolution = reason.Trim();
        return TransitionTo(WorkOrderStatus.Cancelled);
    }

    /// <summary>Raises priority only; automated re-evaluations must never silently downgrade a human decision.</summary>
    public bool Escalate(WorkOrderPriority priority)
    {
        if (IsTerminal || priority <= Priority)
        {
            return false;
        }

        Priority = priority;
        Touch();
        return true;
    }

    public Result<WorkActivity> AddActivity(Guid authorUserId, string description, DateTime utcNow)
    {
        if (IsTerminal)
        {
            return WorkOrderErrors.Closed(Status);
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return WorkOrderErrors.ActivityDescriptionRequired;
        }

        var activity = new WorkActivity(Id, authorUserId, description.Trim(), utcNow);
        _activities.Add(activity);
        Touch();
        return activity;
    }

    private Result TransitionTo(WorkOrderStatus next)
    {
        var previous = Status;
        Status = next;
        Touch();
        Raise(new WorkOrderStatusChangedDomainEvent(Id, PlantId, previous, next));
        return Result.Success();
    }

    private void Touch() => ConcurrencyStamp = Guid.NewGuid();
}

public sealed class WorkOrderAssignment
{
    private WorkOrderAssignment()
    {
    }

    internal WorkOrderAssignment(Guid workOrderId, Guid userId, DateTime assignedAtUtc)
    {
        WorkOrderId = workOrderId;
        UserId = userId;
        AssignedAtUtc = assignedAtUtc;
    }

    public Guid WorkOrderId { get; private set; }

    public Guid UserId { get; private set; }

    public DateTime AssignedAtUtc { get; private set; }
}

public sealed class WorkActivity : Entity
{
    private WorkActivity()
    {
    }

    internal WorkActivity(Guid workOrderId, Guid authorUserId, string description, DateTime createdAtUtc)
    {
        WorkOrderId = workOrderId;
        AuthorUserId = authorUserId;
        Description = description;
        CreatedAtUtc = createdAtUtc;
    }

    public Guid WorkOrderId { get; private set; }

    public Guid AuthorUserId { get; private set; }

    public string Description { get; private set; } = null!;

    public DateTime CreatedAtUtc { get; private set; }
}

public static class WorkOrderErrors
{
    public static readonly Error TitleRequired = Error.BusinessRule("WorkOrder.TitleRequired", "Title is required.");

    public static readonly Error NoAssignee = Error.BusinessRule(
        "WorkOrder.NoAssignee", "A work order needs at least one assignee before it can be started.");

    public static readonly Error AlreadyAssigned =
        Error.Conflict("WorkOrder.AlreadyAssigned", "The user is already assigned to this work order.");

    public static readonly Error ResolutionRequired =
        Error.BusinessRule("WorkOrder.ResolutionRequired", "A resolution or reason note is required.");

    public static readonly Error ActivityDescriptionRequired =
        Error.BusinessRule("WorkOrder.ActivityDescriptionRequired", "Activity description is required.");

    public static readonly Error StaleVersion = Error.PreconditionFailed(
        "WorkOrder.StaleVersion",
        "The work order was modified by someone else. Reload it and retry with the latest ETag.");

    public static Error NotFound(Guid id) => Error.NotFound("WorkOrder.NotFound", $"Work order '{id}' was not found.");

    public static Error Closed(WorkOrderStatus status) =>
        Error.BusinessRule("WorkOrder.Closed", $"A {status} work order cannot be modified.");

    public static Error InvalidTransition(WorkOrderStatus from, WorkOrderStatus to) =>
        Error.BusinessRule("WorkOrder.InvalidTransition", $"Cannot move a work order from {from} to {to}.");
}
