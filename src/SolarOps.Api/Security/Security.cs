using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using SolarOps.Application.Abstractions;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Tenants;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Api.Security;

public sealed class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "solarops";

    public string Audience { get; set; } = "solarops-api";

    /// <summary>HMAC-SHA256 key (≥ 32 bytes). Supplied via user-secrets / environment / Key Vault, never committed for production.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public TimeSpan TokenLifetime { get; set; } = TimeSpan.FromMinutes(60);

    public SymmetricSecurityKey GetSigningKey() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public static class SolarOpsClaims
{
    public const string TenantId = "tenant_id";
    public const string TenantSlug = "tenant";
    public const string Role = "role";
    public const string Subject = JwtRegisteredClaimNames.Sub;
}

public static class Policies
{
    public const string TenantAdmin = "tenant-admin";
    public const string Engineering = "engineering";
    public const string FieldOperations = "field-operations";
}

internal sealed class JwtAccessTokenIssuer(IOptions<JwtOptions> options, TimeProvider clock) : IAccessTokenIssuer
{
    private readonly JsonWebTokenHandler _handler = new();

    public AccessToken Issue(User user, Tenant tenant)
    {
        var settings = options.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var expires = now.Add(settings.TokenLifetime);

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = expires,
            SigningCredentials = new SigningCredentials(settings.GetSigningKey(), SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                [SolarOpsClaims.Subject] = user.Id.ToString(),
                [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString("N"),
                [SolarOpsClaims.TenantId] = tenant.Id.ToString(),
                [SolarOpsClaims.TenantSlug] = tenant.Slug,
                [SolarOpsClaims.Role] = user.Role.ToString(),
                [JwtRegisteredClaimNames.Email] = user.Email,
                [JwtRegisteredClaimNames.Name] = user.DisplayName,
            },
        });

        return new AccessToken(token, expires);
    }
}

internal sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(SolarOpsClaims.Subject), out var id) ? id : null;
}

/// <summary>Binds the request scope to the tenant in the validated token. Runs after authentication, before authorization.</summary>
internal sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, TenantContext tenant)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            if (!Guid.TryParse(context.User.FindFirstValue(SolarOpsClaims.TenantId), out var tenantId))
            {
                await Results.Problem(
                        statusCode: StatusCodes.Status403Forbidden,
                        title: "Tenant.Missing",
                        detail: "The access token does not carry a tenant.")
                    .ExecuteAsync(context);
                return;
            }

            tenant.Set(tenantId);
            Activity.Current?.SetTag("tenant.id", tenantId);
        }

        await next(context);
    }
}

internal static class SecurityServiceCollectionExtensions
{
    public static IServiceCollection AddApiSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.Section))
            .Validate(o => Encoding.UTF8.GetByteCount(o.SigningKey) >= 32, "Jwt:SigningKey must be at least 32 bytes.")
            .ValidateOnStart();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
            {
                bearer.MapInboundClaims = false;
                bearer.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.Value.Issuer,
                    ValidAudience = jwt.Value.Audience,
                    IssuerSigningKey = jwt.Value.GetSigningKey(),
                    ValidateIssuerSigningKey = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = JwtRegisteredClaimNames.Name,
                    RoleClaimType = SolarOpsClaims.Role,
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(Policies.TenantAdmin, p => p.RequireRole(nameof(UserRole.TenantAdmin)))
            .AddPolicy(Policies.Engineering, p => p.RequireRole(nameof(UserRole.TenantAdmin), nameof(UserRole.Engineer)))
            .AddPolicy(Policies.FieldOperations, p => p.RequireRole(
                nameof(UserRole.TenantAdmin), nameof(UserRole.Engineer), nameof(UserRole.Technician)));

        return services;
    }
}
