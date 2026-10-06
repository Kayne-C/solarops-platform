using SolarOps.Domain.Common;

namespace SolarOps.Domain.Identity;

public enum UserRole
{
    TenantAdmin,
    Engineer,
    Technician,
}

public sealed class User : Entity, ITenantOwned, IAuditable
{
    public const int EmailMaxLength = 256;
    public const int DisplayNameMaxLength = 128;

    private User()
    {
    }

    public Guid TenantId { get; private set; }

    public string Email { get; private set; } = null!;

    public string DisplayName { get; private set; } = null!;

    public string PasswordHash { get; private set; } = null!;

    public UserRole Role { get; private set; }

    public bool IsActive { get; private set; }

    public DateTime CreatedAtUtc { get; private set; }

    public DateTime? UpdatedAtUtc { get; private set; }

    public static User Create(string email, string displayName, string passwordHash, UserRole role) => new()
    {
        Email = NormalizeEmail(email),
        DisplayName = displayName.Trim(),
        PasswordHash = passwordHash,
        Role = role,
        IsActive = true,
    };

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    public void Deactivate() => IsActive = false;
}
