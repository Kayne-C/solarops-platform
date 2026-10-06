using System.Globalization;
using Microsoft.Extensions.Logging;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Events;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Assets.Events;
using SolarOps.Domain.WorkOrders;
using SolarOps.Domain.WorkOrders.Events;

namespace SolarOps.Application.Features.Performance;

/// <summary>Production written → evaluate every affected plant-month.</summary>
internal sealed partial class EvaluatePerformanceOnProductionRecorded(
    ISender sender,
    ILogger<EvaluatePerformanceOnProductionRecorded> logger) : IIntegrationEventHandler<ProductionRecordedDomainEvent>
{
    /// <summary>Guards against a historical back-fill fanning out into hundreds of evaluations at once.</summary>
    private const int MaxMonthsPerEvent = 24;

    public async Task HandleAsync(ProductionRecordedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        var cursor = new DateOnly(domainEvent.From.Year, domainEvent.From.Month, 1);
        var last = new DateOnly(domainEvent.To.Year, domainEvent.To.Month, 1);
        var evaluated = 0;

        while (cursor <= last && evaluated < MaxMonthsPerEvent)
        {
            var result = await sender.Send(
                new EvaluatePlantPerformanceCommand(domainEvent.PlantId, cursor.Year, cursor.Month), cancellationToken);

            if (result.IsSuccess)
            {
                LogEvaluated(logger, domainEvent.PlantId, cursor.Year, cursor.Month, result.Value.Outcome);
            }

            cursor = cursor.AddMonths(1);
            evaluated++;
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Performance of plant {PlantId} for {Year}-{Month} evaluated: {Outcome}")]
    private static partial void LogEvaluated(ILogger logger, Guid plantId, int year, int month, PerformanceEvaluationOutcome outcome);
}

/// <summary>Fan-out example: a second, independent consumer of the same event stream.</summary>
internal sealed class NotifyOnUrgentWorkOrder(INotificationSender notifications)
    : IIntegrationEventHandler<WorkOrderCreatedDomainEvent>
{
    public Task HandleAsync(WorkOrderCreatedDomainEvent domainEvent, CancellationToken cancellationToken)
    {
        if (domainEvent.Priority < WorkOrderPriority.High)
        {
            return Task.CompletedTask;
        }

        return notifications.SendAsync(
            "ops-alerts",
            string.Create(CultureInfo.InvariantCulture, $"[{domainEvent.Priority}] work order {domainEvent.WorkOrderId:N}"),
            string.Create(
                CultureInfo.InvariantCulture,
                $"Plant {domainEvent.PlantId:N} needs attention (origin: {domainEvent.Origin})."),
            cancellationToken);
    }
}
