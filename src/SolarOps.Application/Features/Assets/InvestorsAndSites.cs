using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;

namespace SolarOps.Application.Features.Assets;

public sealed record InvestorResponse(Guid Id, string CompanyName, string? ContactPerson, string? Email, string? Phone);

public sealed record CreateInvestorCommand(string CompanyName, string? ContactPerson, string? Email, string? Phone)
    : ICommand<Guid>;

internal sealed class CreateInvestorValidator : AbstractValidator<CreateInvestorCommand>
{
    public CreateInvestorValidator()
    {
        RuleFor(c => c.CompanyName).NotEmpty().MaximumLength(Investor.CompanyNameMaxLength);
        RuleFor(c => c.ContactPerson).MaximumLength(Investor.ContactMaxLength);
        RuleFor(c => c.Email).EmailAddress().MaximumLength(Investor.EmailMaxLength).When(c => c.Email is not null);
        RuleFor(c => c.Phone).MaximumLength(Investor.PhoneMaxLength);
    }
}

internal sealed class CreateInvestorHandler(IApplicationDbContext db) : ICommandHandler<CreateInvestorCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateInvestorCommand command, CancellationToken cancellationToken)
    {
        var investor = Investor.Create(command.CompanyName, command.ContactPerson, command.Email, command.Phone);
        db.Investors.Add(investor);
        await db.SaveChangesAsync(cancellationToken);
        return investor.Id;
    }
}

public sealed record ListInvestorsQuery : IQuery<IReadOnlyList<InvestorResponse>>;

internal sealed class ListInvestorsHandler(IApplicationDbContext db)
    : IQueryHandler<ListInvestorsQuery, IReadOnlyList<InvestorResponse>>
{
    public async Task<Result<IReadOnlyList<InvestorResponse>>> Handle(ListInvestorsQuery query, CancellationToken cancellationToken)
    {
        var investors = await db.Investors.AsNoTracking()
            .OrderBy(i => i.CompanyName)
            .Select(i => new InvestorResponse(i.Id, i.CompanyName, i.ContactPerson, i.Email, i.Phone))
            .ToListAsync(cancellationToken);

        return investors;
    }
}

public sealed record SiteResponse(Guid Id, string Name, string City);

public sealed record CreateSiteCommand(string Name, string City) : ICommand<Guid>;

internal sealed class CreateSiteValidator : AbstractValidator<CreateSiteCommand>
{
    public CreateSiteValidator()
    {
        RuleFor(c => c.Name).NotEmpty().MaximumLength(Site.NameMaxLength);
        RuleFor(c => c.City).NotEmpty().MaximumLength(Site.CityMaxLength);
    }
}

internal sealed class CreateSiteHandler(IApplicationDbContext db) : ICommandHandler<CreateSiteCommand, Guid>
{
    public async Task<Result<Guid>> Handle(CreateSiteCommand command, CancellationToken cancellationToken)
    {
        var site = Site.Create(command.Name, command.City);
        db.Sites.Add(site);
        await db.SaveChangesAsync(cancellationToken);
        return site.Id;
    }
}

public sealed record ListSitesQuery : IQuery<IReadOnlyList<SiteResponse>>;

internal sealed class ListSitesHandler(IApplicationDbContext db) : IQueryHandler<ListSitesQuery, IReadOnlyList<SiteResponse>>
{
    public async Task<Result<IReadOnlyList<SiteResponse>>> Handle(ListSitesQuery query, CancellationToken cancellationToken)
    {
        var sites = await db.Sites.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new SiteResponse(s.Id, s.Name, s.City))
            .ToListAsync(cancellationToken);

        return sites;
    }
}
