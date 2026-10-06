using SolarOps.Domain.WorkOrders;

namespace SolarOps.Domain.Production;

public enum PerformanceStatus
{
    Normal,
    Warning,
    Critical,
}

/// <summary>
/// Compares measured energy against the (pro-rated) expectation. The performance index is
/// <c>actual / expected</c>; it is intentionally not called "PR" because irradiance is not measured here.
/// </summary>
public sealed record PerformanceAssessment(
    decimal ActualKwh,
    decimal ExpectedKwh,
    decimal PerformanceIndex,
    decimal DeviationPercent,
    PerformanceStatus Status)
{
    /// <summary>Distance below the alert threshold at which a deviation becomes critical.</summary>
    public const decimal CriticalBand = 0.10m;

    public bool RequiresIntervention => Status != PerformanceStatus.Normal;

    public static PerformanceAssessment Evaluate(decimal actualKwh, decimal expectedKwh, decimal alertThreshold)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(expectedKwh);
        ArgumentOutOfRangeException.ThrowIfNegative(actualKwh);

        var index = decimal.Round(actualKwh / expectedKwh, 4);
        var deviation = decimal.Round((index - 1m) * 100m, 2);

        var status = index >= alertThreshold
            ? PerformanceStatus.Normal
            : index >= alertThreshold - CriticalBand
                ? PerformanceStatus.Warning
                : PerformanceStatus.Critical;

        return new PerformanceAssessment(actualKwh, expectedKwh, index, deviation, status);
    }

    public WorkOrderPriority SuggestedPriority => Status switch
    {
        PerformanceStatus.Critical => WorkOrderPriority.Urgent,
        PerformanceStatus.Warning => WorkOrderPriority.High,
        _ => WorkOrderPriority.Low,
    };
}
