using SolarOps.Domain.Common;

namespace SolarOps.Domain.Assets;

/// <summary>A physical field/region that groups plants for crew planning (e.g. "Konya Karapınar").</summary>
public sealed class Site : Entity, ITenantOwned, IAuditable
{
    public const int NameMaxLength = 128;
    public const int CityMaxLength = 64;

    private Site()
    {
    }

    public Guid TenantId { get; private set; }

    public string Name { get; private set; } = null!;

    public string City { get; private set; } = null!;

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public static Site Create(string name, string city) => new()
    {
        Name = name.Trim(),
        City = city.Trim(),
    };
}
