using FluentValidation;

namespace SolarOps.Application.Common;

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class Paging
{
    public const int MaxPageSize = 100;

    public static IRuleBuilderOptions<T, int> MustBeValidPage<T>(this IRuleBuilder<T, int> rule) =>
        rule.GreaterThanOrEqualTo(1);

    public static IRuleBuilderOptions<T, int> MustBeValidPageSize<T>(this IRuleBuilder<T, int> rule) =>
        rule.InclusiveBetween(1, MaxPageSize);
}

/// <summary>Cache keys and invalidation tags are always tenant-scoped so one tenant can never read another's entry.</summary>
public static class CacheTags
{
    public static string Plant(Guid tenantId, Guid plantId) => $"t:{tenantId:N}:plant:{plantId:N}";

    public static string Portfolio(Guid tenantId) => $"t:{tenantId:N}:portfolio";
}
