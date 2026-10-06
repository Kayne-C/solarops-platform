using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Scalar.AspNetCore;
using SolarOps.Api.Endpoints;
using SolarOps.Api.Grpc;
using SolarOps.Api.Infrastructure;
using SolarOps.Api.Security;
using SolarOps.Application;
using SolarOps.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration)
    .AddBackgroundMessaging()
    .AddApiSecurity(builder.Configuration)
    .AddTenantRateLimiting(builder.Configuration)
    .AddApiDocumentation()
    .AddProblemDetails(options => options.AddTraceId())
    .AddExceptionHandler<GlobalExceptionHandler>()
    .ConfigureHttpJsonOptions(options => options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddGrpc();
builder.Services.AddHealthChecks().AddInfrastructureHealthChecks();
builder.AddObservability();

var app = builder.Build();

await app.Services.InitializeDatabaseAsync();

// One-shot mode for deployment pipelines / docker-compose: migrate (+ optionally seed) and exit,
// so application replicas never race each other on schema changes.
if (args.Contains("--migrate-only"))
{
    return;
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

if (!app.Environment.IsProduction())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous();
}

app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false }).AllowAnonymous().DisableRateLimiting();
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") })
    .AllowAnonymous()
    .DisableRateLimiting();

app.MapGroup("/api/v1")
    .MapAuthEndpoints()
    .MapUserEndpoints()
    .MapAssetEndpoints()
    .MapProductionEndpoints()
    .MapWorkOrderEndpoints();

app.MapGrpcService<YieldIngestionService>();

await app.RunAsync();

/// <summary>Entry point marker for <c>WebApplicationFactory&lt;Program&gt;</c> in integration tests.</summary>
public partial class Program;
