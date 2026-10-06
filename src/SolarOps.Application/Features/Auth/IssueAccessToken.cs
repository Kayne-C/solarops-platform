using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;
using SolarOps.Domain.Identity;

namespace SolarOps.Application.Features.Auth;

public sealed record IssueAccessTokenCommand(string Tenant, string Email, string Password) : ICommand<AccessTokenResponse>;

public sealed record AccessTokenResponse(string AccessToken, string TokenType, DateTime ExpiresAtUtc, string Role);

internal sealed class IssueAccessTokenValidator : AbstractValidator<IssueAccessTokenCommand>
{
    public IssueAccessTokenValidator()
    {
        RuleFor(c => c.Tenant).NotEmpty().MaximumLength(64);
        RuleFor(c => c.Email).NotEmpty().EmailAddress().MaximumLength(User.EmailMaxLength);
        RuleFor(c => c.Password).NotEmpty().MaximumLength(256);
    }
}

internal sealed class IssueAccessTokenHandler(
    IApplicationDbContext db,
    IPasswordHasher passwordHasher,
    IAccessTokenIssuer tokenIssuer) : ICommandHandler<IssueAccessTokenCommand, AccessTokenResponse>
{
    private static readonly Error InvalidCredentials =
        Error.Unauthorized("Auth.InvalidCredentials", "Tenant, e-mail or password is incorrect.");

    // Verified when the user does not exist so that response time does not reveal valid e-mails.
    // A benign race on first use only computes the hash twice.
    private static string? s_dummyHash;

    public async Task<Result<AccessTokenResponse>> Handle(IssueAccessTokenCommand command, CancellationToken cancellationToken)
    {
        var slug = command.Tenant.Trim().ToLowerInvariant();
        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == slug && t.IsActive, cancellationToken);

        if (tenant is null)
        {
            BurnEquivalentTime(command.Password);
            return InvalidCredentials;
        }

        // The tenant is not resolved yet (anonymous request), so the tenant filter is bypassed explicitly
        // and replaced by an explicit predicate on the tenant we just looked up.
        var email = User.NormalizeEmail(command.Email);
        var user = await db.Users.IgnoreQueryFilters([QueryFilterNames.Tenant]).AsNoTracking()
            .FirstOrDefaultAsync(u => u.TenantId == tenant.Id && u.Email == email && u.IsActive, cancellationToken);

        if (user is null)
        {
            BurnEquivalentTime(command.Password);
            return InvalidCredentials;
        }

        if (!passwordHasher.Verify(user.PasswordHash, command.Password))
        {
            return InvalidCredentials;
        }

        var token = tokenIssuer.Issue(user, tenant);
        return new AccessTokenResponse(token.Token, "Bearer", token.ExpiresAtUtc, user.Role.ToString());
    }

    private void BurnEquivalentTime(string password)
    {
        s_dummyHash ??= passwordHasher.Hash(Guid.NewGuid().ToString());
        passwordHasher.Verify(s_dummyHash, password);
    }
}
