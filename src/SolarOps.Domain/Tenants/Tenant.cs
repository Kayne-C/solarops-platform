using SolarOps.Domain.Common;

namespace SolarOps.Domain.Tenants;

/// <summary>An O&amp;M company subscribed to the platform. Every business row is owned by exactly one tenant.</summary>
public sealed class Tenant : AggregateRoot, IAuditable
{
    public const int NameMaxLength = 128;
    public const int SlugMaxLength = 64;
    public const decimal DefaultAlertThreshold = 0.85m;

    private Tenant()
    {
    }

    public string Name { get; private set; } = null!;

    /// <summary>URL/login friendly unique key, e.g. <c>anatolia-solar</c>.</summary>
    public string Slug { get; private set; } = null!;

    public bool IsActive { get; private set; }

    /// <summary>Performance index (actual / expected) below which a plant is considered under-performing.</summary>
    public decimal PerformanceAlertThreshold { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public static Result<Tenant> Create(string name, string slug, decimal performanceAlertThreshold = DefaultAlertThreshold)
    {
        if (!IsValidThreshold(performanceAlertThreshold))
        {
            return TenantErrors.InvalidThreshold;
        }

        return new Tenant
        {
            Name = name.Trim(),
            Slug = slug.Trim().ToLowerInvariant(),
            IsActive = true,
            PerformanceAlertThreshold = performanceAlertThreshold,
        };
    }

    public Result ChangePerformanceAlertThreshold(decimal threshold)
    {
        if (!IsValidThreshold(threshold))
        {
            return TenantErrors.InvalidThreshold;
        }

        PerformanceAlertThreshold = threshold;
        return Result.Success();
    }

    private static bool IsValidThreshold(decimal threshold) => threshold is > 0.5m and < 1m;
}

public static class TenantErrors
{
    public static readonly Error InvalidThreshold = Error.BusinessRule(
        "Tenant.InvalidThreshold", "Performance alert threshold must be between 0.5 and 1.0.");
}
