using System.Diagnostics;
using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using SolarOps.Api.Security;
using SolarOps.Application.Diagnostics;

namespace SolarOps.Api.Infrastructure;

public sealed class RateLimitingSettings
{
    public const string Section = "RateLimiting";

    /// <summary>Sustained requests per second per tenant (token bucket refill).</summary>
    public int TenantPermitsPerSecond { get; set; } = 50;

    /// <summary>Burst capacity per tenant.</summary>
    public int TenantBurst { get; set; } = 200;

    /// <summary>Login attempts per client IP per minute (credential stuffing protection).</summary>
    public int TokenRequestsPerMinute { get; set; } = 10;
}

internal static class ApiServiceExtensions
{
    public const string TokenIssuancePolicy = "token-issuance";

    /// <summary>
    /// Noisy-neighbour protection: every tenant gets its own token bucket, so one tenant's import burst
    /// cannot starve the others. Anonymous traffic is partitioned by client IP.
    /// </summary>
    public static IServiceCollection AddTenantRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RateLimitingSettings>().Bind(configuration.GetSection(RateLimitingSettings.Section));
        services.AddRateLimiter(_ => { });
        services.AddOptions<RateLimiterOptions>().Configure<IOptions<RateLimitingSettings>>((options, settings) =>
        {
            var limits = settings.Value;
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var tenant = context.User.FindFirstValue(SolarOpsClaims.TenantId);
                var key = tenant is not null ? $"tenant:{tenant}" : $"ip:{context.Connection.RemoteIpAddress}";
                return RateLimitPartition.GetTokenBucketLimiter(key, _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = limits.TenantBurst,
                    TokensPerPeriod = limits.TenantPermitsPerSecond,
                    ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                    QueueLimit = 0,
                    AutoReplenishment = true,
                });
            });

            options.AddPolicy(TokenIssuancePolicy, context => RateLimitPartition.GetFixedWindowLimiter(
                $"ip:{context.Connection.RemoteIpAddress}",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = limits.TokenRequestsPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            options.OnRejected = async (rejected, cancellationToken) =>
            {
                if (rejected.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    rejected.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                }

                await TypedResults.Problem(
                        statusCode: StatusCodes.Status429TooManyRequests,
                        title: "RateLimit.Exceeded",
                        detail: "Too many requests for this tenant. Retry after the indicated delay.")
                    .ExecuteAsync(rejected.HttpContext);
            };
        });

        return services;
    }

    public static IServiceCollection AddApiDocumentation(this IServiceCollection services) =>
        services.AddOpenApi(options => options.AddDocumentTransformer<BearerSecuritySchemeTransformer>());

    public static WebApplicationBuilder AddObservability(this WebApplicationBuilder builder)
    {
        var otel = builder.Services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(builder.Environment.ApplicationName))
            .WithTracing(tracing => tracing
                .AddSource(SolarOpsTelemetry.SourceName)
                .AddAspNetCoreInstrumentation(o => o.Filter = context => !context.Request.Path.StartsWithSegments("/health"))
                .AddHttpClientInstrumentation())
            .WithMetrics(metrics => metrics
                .AddMeter(SolarOpsTelemetry.SourceName)
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation());

        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        // Standard OTEL_* environment variables drive the exporter (e.g. the Aspire dashboard in docker-compose).
        if (!string.IsNullOrWhiteSpace(builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]))
        {
            otel.UseOtlpExporter();
        }

        return builder;
    }

    public static void AddTraceId(this ProblemDetailsOptions options) =>
        options.CustomizeProblemDetails = context =>
            context.ProblemDetails.Extensions["traceId"] = Activity.Current?.TraceId.ToString() ?? context.HttpContext.TraceIdentifier;
}

internal sealed class BearerSecuritySchemeTransformer : IOpenApiDocumentTransformer
{
    private const string SchemeName = "Bearer";

    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        document.Info = new OpenApiInfo
        {
            Title = "SolarOps Platform API",
            Version = "v1",
            Description = "Multi-tenant solar asset performance & O&M platform. Obtain a token from POST /api/v1/auth/token.",
        };

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[SchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "JWT issued by /api/v1/auth/token. Carries the tenant and role claims.",
        };

        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference(SchemeName, document)] = [] });
        return Task.CompletedTask;
    }
}
