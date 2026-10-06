using SolarOps.Domain.Common;

namespace SolarOps.Domain.Assets;

/// <summary>Owner of one or more plants (the O&amp;M company's customer).</summary>
public sealed class Investor : Entity, ITenantOwned, IAuditable
{
    public const int CompanyNameMaxLength = 128;
    public const int ContactMaxLength = 128;
    public const int EmailMaxLength = 256;
    public const int PhoneMaxLength = 32;

    private Investor()
    {
    }

    public Guid TenantId { get; private set; }

    public string CompanyName { get; private set; } = null!;

    public string? ContactPerson { get; private set; }

    public string? Email { get; private set; }

    public string? Phone { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public static Investor Create(string companyName, string? contactPerson, string? email, string? phone) => new()
    {
        CompanyName = companyName.Trim(),
        ContactPerson = contactPerson?.Trim(),
        Email = email?.Trim().ToLowerInvariant(),
        Phone = phone?.Trim(),
    };
}
