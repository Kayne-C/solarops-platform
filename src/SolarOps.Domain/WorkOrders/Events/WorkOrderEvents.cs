using SolarOps.Domain.Common;

namespace SolarOps.Domain.WorkOrders.Events;

public sealed record WorkOrderCreatedDomainEvent(
    Guid WorkOrderId,
    Guid PlantId,
    WorkOrderPriority Priority,
    WorkOrderOrigin Origin) : DomainEvent;

public sealed record WorkOrderAssignedDomainEvent(Guid WorkOrderId, Guid UserId) : DomainEvent;

public sealed record WorkOrderStatusChangedDomainEvent(
    Guid WorkOrderId,
    Guid PlantId,
    WorkOrderStatus From,
    WorkOrderStatus To) : DomainEvent;
