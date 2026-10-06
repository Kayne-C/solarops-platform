using SolarOps.Domain.WorkOrders;
using SolarOps.Domain.WorkOrders.Events;

namespace SolarOps.Domain.UnitTests;

public sealed class WorkOrderTests
{
    private static readonly DateTime Now = TestData.UtcNow;

    private static WorkOrder NewWorkOrder() =>
        WorkOrder.Create(Guid.NewGuid(), "Inverter 3 offline", null, WorkOrderType.Fault, WorkOrderPriority.High).Value;

    [Fact]
    public void Create_opens_the_order_and_raises_an_event()
    {
        var workOrder = NewWorkOrder();

        Assert.Equal(WorkOrderStatus.Open, workOrder.Status);
        Assert.StartsWith("manual:", workOrder.CorrelationKey, StringComparison.Ordinal);
        Assert.IsType<WorkOrderCreatedDomainEvent>(Assert.Single(workOrder.DomainEvents));
    }

    [Fact]
    public void Start_requires_an_assignee()
    {
        var workOrder = NewWorkOrder();

        var result = workOrder.Start(Now);

        Assert.Equal(WorkOrderErrors.NoAssignee, result.Error);
        Assert.Equal(WorkOrderStatus.Open, workOrder.Status);
    }

    [Fact]
    public void Full_lifecycle_records_timestamps_and_status_events()
    {
        var workOrder = NewWorkOrder();

        Assert.True(workOrder.Assign(Guid.NewGuid(), Now).IsSuccess);
        Assert.True(workOrder.Start(Now).IsSuccess);
        Assert.True(workOrder.AddActivity(Guid.NewGuid(), "Replaced DC fuse on string 12", Now).IsSuccess);
        Assert.True(workOrder.Complete("Fuse replaced, inverter back online", Now.AddHours(3)).IsSuccess);

        Assert.Equal(WorkOrderStatus.Completed, workOrder.Status);
        Assert.Equal(Now, workOrder.StartedAtUtc);
        Assert.Equal(Now.AddHours(3), workOrder.CompletedAtUtc);
        Assert.Equal(2, workOrder.DomainEvents.OfType<WorkOrderStatusChangedDomainEvent>().Count());
    }

    [Fact]
    public void Terminal_orders_reject_further_changes()
    {
        var workOrder = NewWorkOrder();
        workOrder.Cancel("Duplicate of WO-17");

        Assert.True(workOrder.Assign(Guid.NewGuid(), Now).IsFailure);
        Assert.True(workOrder.AddActivity(Guid.NewGuid(), "late note", Now).IsFailure);
        Assert.True(workOrder.Cancel("again").IsFailure);
        Assert.False(workOrder.Escalate(WorkOrderPriority.Urgent));
    }

    [Fact]
    public void Every_mutation_rotates_the_concurrency_stamp()
    {
        var workOrder = NewWorkOrder();
        var stamps = new HashSet<Guid> { workOrder.ConcurrencyStamp };

        workOrder.Assign(Guid.NewGuid(), Now);
        stamps.Add(workOrder.ConcurrencyStamp);
        workOrder.AddActivity(Guid.NewGuid(), "on site", Now);
        stamps.Add(workOrder.ConcurrencyStamp);
        workOrder.Start(Now);
        stamps.Add(workOrder.ConcurrencyStamp);

        Assert.Equal(4, stamps.Count);
    }

    [Fact]
    public void Escalate_only_raises_priority()
    {
        var workOrder = NewWorkOrder();

        Assert.False(workOrder.Escalate(WorkOrderPriority.Low));
        Assert.True(workOrder.Escalate(WorkOrderPriority.Urgent));
        Assert.Equal(WorkOrderPriority.Urgent, workOrder.Priority);
    }

    [Fact]
    public void Assigning_the_same_user_twice_is_a_conflict()
    {
        var workOrder = NewWorkOrder();
        var technician = Guid.NewGuid();

        workOrder.Assign(technician, Now);

        Assert.Equal(WorkOrderErrors.AlreadyAssigned, workOrder.Assign(technician, Now).Error);
    }
}
