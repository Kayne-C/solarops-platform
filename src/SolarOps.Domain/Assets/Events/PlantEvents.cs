using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Domain.Assets.Events;

public sealed record PlantRegisteredDomainEvent(Guid PlantId, string Code, decimal InstalledCapacityKwp) : DomainEvent;

public sealed record ProductionRecordedDomainEvent(
    Guid PlantId,
    DateOnly From,
    DateOnly To,
    int RecordCount,
    ProductionSource Source) : DomainEvent;
