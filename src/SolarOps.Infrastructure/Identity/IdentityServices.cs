using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using SolarOps.Application.Abstractions;

namespace SolarOps.Infrastructure.Identity;

/// <summary>PBKDF2 (HMAC-SHA512, 100k iterations, per-hash salt) via ASP.NET Core Identity's battle-tested hasher.</summary>
internal sealed class IdentityPasswordHasher : IPasswordHasher
{
    private static readonly object Subject = new();
    private readonly PasswordHasher<object> _hasher = new();

    public string Hash(string password) => _hasher.HashPassword(Subject, password);

    public bool Verify(string hashedPassword, string providedPassword) =>
        _hasher.VerifyHashedPassword(Subject, hashedPassword, providedPassword) != PasswordVerificationResult.Failed;
}

/// <summary>Identity for background work (outbox relay, consumers, seeding).</summary>
public sealed class SystemCurrentUser : ICurrentUser
{
    public Guid? UserId => null;
}

/// <summary>Placeholder channel: production deployments would plug in e-mail, Teams or SMS here.</summary>
internal sealed partial class LoggingNotificationSender(ILogger<LoggingNotificationSender> logger) : INotificationSender
{
    public Task SendAsync(string channel, string subject, string body, CancellationToken cancellationToken)
    {
        LogNotification(logger, channel, subject, body);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Notification [{Channel}] {Subject}: {Body}")]
    private static partial void LogNotification(ILogger logger, string channel, string subject, string body);
}
