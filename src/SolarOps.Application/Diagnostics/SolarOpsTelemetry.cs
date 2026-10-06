using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace SolarOps.Application.Diagnostics;

public static class SolarOpsTelemetry
{
    public const string SourceName = "SolarOps";

    public static readonly ActivitySource ActivitySource = new(SourceName);

    private static readonly Meter Meter = new(SourceName);

    public static readonly Histogram<double> RequestDuration =
        Meter.CreateHistogram<double>("solarops.request.duration", "ms", "Application use case duration.");

    public static readonly Counter<long> DailyYieldsWritten =
        Meter.CreateCounter<long>("solarops.production.daily_yields_written", description: "Daily yield rows created or revised.");

    public static readonly Counter<long> DailyYieldsRejected =
        Meter.CreateCounter<long>("solarops.production.daily_yields_rejected", description: "Daily yield rows rejected by domain rules.");

    public static readonly Counter<long> PerformanceAlerts =
        Meter.CreateCounter<long>("solarops.performance.alerts", description: "Work orders opened by the performance pipeline.");

    public static readonly Counter<long> OutboxMessagesPublished =
        Meter.CreateCounter<long>("solarops.outbox.published", description: "Outbox messages relayed to the broker.");
}
