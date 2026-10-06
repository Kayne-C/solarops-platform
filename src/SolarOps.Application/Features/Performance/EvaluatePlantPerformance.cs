using System.Globalization;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Diagnostics;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Application.Features.Performance;

public enum PerformanceEvaluationOutcome
{
    InsufficientData,
    NoBaseline,
    WithinThreshold,
    WorkOrderOpened,
    WorkOrderEscalated,
    WorkOrderAlreadyOpen,
}

public sealed record PerformanceEvaluationResponse(
    Guid PlantId,
    int Year,
    int Month,
    PerformanceEvaluationOutcome Outcome,
    decimal? PerformanceIndex,
    PerformanceStatus? Status,
    Guid? WorkOrderId);

/// <summary>
/// Invoked asynchronously after production is recorded. Opens (or escalates) exactly one work order per
/// plant-month; idempotency is guaranteed by a tenant-unique correlation key backed by a unique index.
/// </summary>
public sealed record EvaluatePlantPerformanceCommand(Guid PlantId, int Year, int Month) : ICommand<PerformanceEvaluationResponse>;

internal sealed class EvaluatePlantPerformanceValidator : AbstractValidator<EvaluatePlantPerformanceCommand>
{
    public EvaluatePlantPerformanceValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.Year).InclusiveBetween(2000, 2100);
        RuleFor(c => c.Month).InclusiveBetween(1, 12);
    }
}

internal sealed class EvaluatePlantPerformanceHandler(IApplicationDbContext db, ITenantContext tenant)
    : ICommandHandler<EvaluatePlantPerformanceCommand, PerformanceEvaluationResponse>
{
    /// <summary>Fewer days than this are too noisy (one cloudy day) to justify dispatching a crew.</summary>
    public const int MinimumDaysWithData = 3;

    public async Task<Result<PerformanceEvaluationResponse>> Handle(
        EvaluatePlantPerformanceCommand command,
        CancellationToken cancellationToken)
    {
        var plant = await db.Plants.AsNoTracking().FirstOrDefaultAsync(p => p.Id == command.PlantId, cancellationToken);
        if (plant is null)
        {
            return PlantErrors.NotFound(command.PlantId);
        }

        var monthStart = new DateOnly(command.Year, command.Month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var daily = await db.DailyYields.AsNoTracking()
            .Where(y => y.PlantId == plant.Id && y.Date >= monthStart && y.Date <= monthEnd)
            .Select(y => y.EnergyKwh)
            .ToListAsync(cancellationToken);

        if (daily.Count < MinimumDaysWithData)
        {
            return Outcome(command, PerformanceEvaluationOutcome.InsufficientData);
        }

        var baselines = await db.ProductionBaselines.AsNoTracking()
            .Where(b => b.PlantId == plant.Id && b.Month == command.Month && b.Year <= command.Year)
            .ToListAsync(cancellationToken);

        var threshold = await db.GetAlertThresholdAsync(tenant, cancellationToken);
        var performance = PerformanceMath.Evaluate(
            plant, baselines, command.Year, command.Month, daily.Sum(), daily.Count, threshold);

        if (performance.Status is null)
        {
            return Outcome(command, PerformanceEvaluationOutcome.NoBaseline);
        }

        if (performance.Status == PerformanceStatus.Normal)
        {
            return Outcome(command, PerformanceEvaluationOutcome.WithinThreshold, performance);
        }

        var priority = performance.Status == PerformanceStatus.Critical ? WorkOrderPriority.Urgent : WorkOrderPriority.High;
        var correlationKey = string.Create(
            CultureInfo.InvariantCulture, $"perf-alert:{plant.Id:N}:{command.Year:D4}-{command.Month:D2}");

        var existing = await db.WorkOrders.FirstOrDefaultAsync(w => w.CorrelationKey == correlationKey, cancellationToken);
        if (existing is not null)
        {
            return await EscalateAsync(command, existing, priority, performance, cancellationToken);
        }

        var workOrder = WorkOrder.Create(
            plant.Id,
            string.Create(
                CultureInfo.InvariantCulture,
                $"Under-performance {plant.Code} {command.Year:D4}-{command.Month:D2}: index {performance.PerformanceIndex:P1}"),
            string.Create(
                CultureInfo.InvariantCulture,
                $"Measured {performance.ActualKwh:N0} kWh vs. expected {performance.ExpectedToDateKwh:N0} kWh over {performance.DaysWithData} day(s); alert threshold {threshold:P0}. Check inverters, strings and soiling."),
            WorkOrderType.Fault,
            priority,
            WorkOrderOrigin.PerformanceAlert,
            correlationKey).Value;

        db.WorkOrders.Add(workOrder);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            // Another consumer instance won the race for this plant-month.
            return Outcome(command, PerformanceEvaluationOutcome.WorkOrderAlreadyOpen, performance);
        }

        SolarOpsTelemetry.PerformanceAlerts.Add(1, new KeyValuePair<string, object?>("status", performance.Status.ToString()));
        return Outcome(command, PerformanceEvaluationOutcome.WorkOrderOpened, performance, workOrder.Id);
    }

    private async Task<Result<PerformanceEvaluationResponse>> EscalateAsync(
        EvaluatePlantPerformanceCommand command,
        WorkOrder existing,
        WorkOrderPriority priority,
        MonthlyPerformance performance,
        CancellationToken cancellationToken)
    {
        if (!existing.Escalate(priority))
        {
            return Outcome(command, PerformanceEvaluationOutcome.WorkOrderAlreadyOpen, performance, existing.Id);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // A technician changed the work order meanwhile; the human edit wins over automation.
            return Outcome(command, PerformanceEvaluationOutcome.WorkOrderAlreadyOpen, performance, existing.Id);
        }

        return Outcome(command, PerformanceEvaluationOutcome.WorkOrderEscalated, performance, existing.Id);
    }

    private static PerformanceEvaluationResponse Outcome(
        EvaluatePlantPerformanceCommand command,
        PerformanceEvaluationOutcome outcome,
        MonthlyPerformance? performance = null,
        Guid? workOrderId = null) =>
        new(command.PlantId, command.Year, command.Month, outcome, performance?.PerformanceIndex, performance?.Status, workOrderId);
}
