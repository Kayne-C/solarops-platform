using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;
using SolarOps.Domain.Identity;

namespace SolarOps.Application.Features.Users;

public sealed record UserResponse(Guid Id, string Email, string DisplayName, UserRole Role, bool IsActive);

public sealed record CreateUserCommand(string Email, string DisplayName, UserRole Role, string Password) : ICommand<Guid>;

internal sealed class CreateUserValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserValidator()
    {
        RuleFor(c => c.Email).NotEmpty().EmailAddress().MaximumLength(User.EmailMaxLength);
        RuleFor(c => c.DisplayName).NotEmpty().MaximumLength(User.DisplayNameMaxLength);
        RuleFor(c => c.Role).IsInEnum();
        RuleFor(c => c.Password).NotEmpty().MinimumLength(12).MaximumLength(256);
    }
}

internal sealed class CreateUserHandler(IApplicationDbContext db, IPasswordHasher passwordHasher)
    : ICommandHandler<CreateUserCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateUserCommand command, CancellationToken cancellationToken)
    {
        var email = User.NormalizeEmail(command.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return Error.Conflict("User.DuplicateEmail", "A user with this e-mail already exists in the tenant.");
        }

        var user = User.Create(email, command.DisplayName, passwordHasher.Hash(command.Password), command.Role);
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            return Error.Conflict("User.DuplicateEmail", "A user with this e-mail already exists in the tenant.");
        }

        return user.Id;
    }
}

public sealed record ListUsersQuery : IQuery<IReadOnlyList<UserResponse>>;

internal sealed class ListUsersHandler(IApplicationDbContext db) : IQueryHandler<ListUsersQuery, IReadOnlyList<UserResponse>>
{
    public async Task<Result<IReadOnlyList<UserResponse>>> Handle(ListUsersQuery query, CancellationToken cancellationToken)
    {
        var users = await db.Users.AsNoTracking()
            .OrderBy(u => u.DisplayName)
            .Select(u => new UserResponse(u.Id, u.Email, u.DisplayName, u.Role, u.IsActive))
            .ToListAsync(cancellationToken);

        return users;
    }
}
