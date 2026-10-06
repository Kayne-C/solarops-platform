using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using SolarOps.Application;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Diagnostics;
using SolarOps.Infrastructure;
using SolarOps.Infrastructure.Identity;

// Event-processing host: relays the transactional outbox to RabbitMQ and runs the broker consumers
// (performance evaluation, notifications). Scale it horizontally — consumers compete per queue.
var builder = Host.CreateApplicationBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddBackgroundMessaging()
    .AddSingleton<ICurrentUser, SystemCurrentUser>();

var otel = builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(builder.Environment.ApplicationName))
    .WithTracing(tracing => tracing.AddSource(SolarOpsTelemetry.SourceName))
    .WithMetrics(metrics => metrics.AddMeter(SolarOpsTelemetry.SourceName).AddRuntimeInstrumentation());

builder.Logging.AddOpenTelemetry(logging => logging.IncludeFormattedMessage = true);

if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
{
    otel.UseOtlpExporter();
}

var host = builder.Build();
await host.RunAsync();
