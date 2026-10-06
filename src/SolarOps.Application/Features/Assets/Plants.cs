using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Application.Common;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;

namespace SolarOps.Application.Features.Assets;

public sealed record PlantSummaryResponse(
    Guid Id,
    string Code,
    string Name,
    PlantType Type,
    PlantStatus Status,
    decimal InstalledCapacityKwp,
    Guid SiteId,
    DateOnly? LastProductionDate);

public sealed record PlantDetailsResponse(
    Guid Id,
    string Code,
    string Name,
    PlantType Type,
    PlantStatus Status,
    Guid InvestorId,
    string InvestorName,
    Guid SiteId,
    string SiteName,
    decimal InstalledCapacityKwp,
    DateOnly CommissioningDate,
    decimal AnnualDegradationRatePercent,
    string? PvModuleModel,
    string? InverterModel,
    DateOnly? LastProductionDate);

public sealed record RegisterPlantCommand(
    string Code,
    string Name,
    PlantType Type,
    Guid InvestorId,
    Guid SiteId,
    decimal InstalledCapacityKwp,
    DateOnly CommissioningDate,
    decimal AnnualDegradationRatePercent,
    string? PvModuleModel,
    string? InverterModel) : ICommand<Guid>;

internal sealed class RegisterPlantValidator : AbstractValidator<RegisterPlantCommand>
{
    public RegisterPlantValidator()
    {
        RuleFor(c => c.Code).NotEmpty().MaximumLength(Plant.CodeMaxLength).Matches("^[A-Za-z0-9-]+$");
        RuleFor(c => c.Name).NotEmpty().MaximumLength(Plant.NameMaxLength);
        RuleFor(c => c.Type).IsInEnum();
        RuleFor(c => c.InvestorId).NotEmpty();
        RuleFor(c => c.SiteId).NotEmpty();
        RuleFor(c => c.InstalledCapacityKwp).GreaterThan(0).LessThanOrEqualTo(2_000_000);
        RuleFor(c => c.AnnualDegradationRatePercent).InclusiveBetween(0, Plant.MaxDegradationRatePercent);
        RuleFor(c => c.CommissioningDate).GreaterThan(new DateOnly(2000, 1, 1));
        RuleFor(c => c.PvModuleModel).MaximumLength(Plant.EquipmentMaxLength);
        RuleFor(c => c.InverterModel).MaximumLength(Plant.EquipmentMaxLength);
    }
}

internal sealed class RegisterPlantHandler(IApplicationDbContext db) : ICommandHandler<RegisterPlantCommand, Guid>
{
    public async Task<Result<Guid>> Handle(RegisterPlantCommand command, CancellationToken cancellationToken)
    {
        // Both lookups are tenant-filtered, so ids from another tenant are indistinguishable from unknown ids.
        if (!await db.Investors.AnyAsync(i => i.Id == command.InvestorId, cancellationToken))
        {
            return Error.NotFound("Investor.NotFound", $"Investor '{command.InvestorId}' was not found.");
        }

        if (!await db.Sites.AnyAsync(s => s.Id == command.SiteId, cancellationToken))
        {
            return Error.NotFound("Site.NotFound", $"Site '{command.SiteId}' was not found.");
        }

        var code = command.Code.Trim().ToUpperInvariant();
        if (await db.Plants.IgnoreQueryFilters([QueryFilterNames.SoftDelete]).AnyAsync(p => p.Code == code, cancellationToken))
        {
            return PlantErrors.DuplicateCode;
        }

        var registration = Plant.Register(
            code,
            command.Name,
            command.Type,
            command.InvestorId,
            command.SiteId,
            command.InstalledCapacityKwp,
            command.CommissioningDate,
            command.AnnualDegradationRatePercent,
            command.PvModuleModel,
            command.InverterModel);

        if (registration.IsFailure)
        {
            return registration.Error;
        }

        db.Plants.Add(registration.Value);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (UniqueConstraintViolationException)
        {
            return PlantErrors.DuplicateCode;
        }

        return registration.Value.Id;
    }
}

public sealed record GetPlantQuery(Guid PlantId) : IQuery<PlantDetailsResponse>;

internal sealed class GetPlantHandler(IApplicationDbContext db) : IQueryHandler<GetPlantQuery, PlantDetailsResponse>
{
    public async Task<Result<PlantDetailsResponse>> Handle(GetPlantQuery query, CancellationToken cancellationToken)
    {
        var plant = await (
                from p in db.Plants.AsNoTracking()
                join i in db.Investors on p.InvestorId equals i.Id
                join s in db.Sites on p.SiteId equals s.Id
                where p.Id == query.PlantId
                select new PlantDetailsResponse(
                    p.Id,
                    p.Code,
                    p.Name,
                    p.Type,
                    p.Status,
                    i.Id,
                    i.CompanyName,
                    s.Id,
                    s.Name,
                    p.InstalledCapacityKwp,
                    p.CommissioningDate,
                    p.AnnualDegradationRatePercent,
                    p.PvModuleModel,
                    p.InverterModel,
                    p.LastProductionDate))
            .FirstOrDefaultAsync(cancellationToken);

        return plant is null ? PlantErrors.NotFound(query.PlantId) : plant;
    }
}

public sealed record ListPlantsQuery(
    int Page = 1,
    int PageSize = 25,
    PlantStatus? Status = null,
    Guid? SiteId = null,
    string? Search = null) : IQuery<PagedResponse<PlantSummaryResponse>>;

internal sealed class ListPlantsValidator : AbstractValidator<ListPlantsQuery>
{
    public ListPlantsValidator()
    {
        RuleFor(q => q.Page).MustBeValidPage();
        RuleFor(q => q.PageSize).MustBeValidPageSize();
        RuleFor(q => q.Search).MaximumLength(64);
    }
}

internal sealed class ListPlantsHandler(IApplicationDbContext db)
    : IQueryHandler<ListPlantsQuery, PagedResponse<PlantSummaryResponse>>
{
    public async Task<Result<PagedResponse<PlantSummaryResponse>>> Handle(ListPlantsQuery query, CancellationToken cancellationToken)
    {
        var plants = db.Plants.AsNoTracking();

        if (query.Status is { } status)
        {
            plants = plants.Where(p => p.Status == status);
        }

        if (query.SiteId is { } siteId)
        {
            plants = plants.Where(p => p.SiteId == siteId);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            // Invariant casing on purpose: tr-TR would map "i" to "İ" and miss codes like "KNY-01".
            var codeTerm = term.ToUpperInvariant();
            plants = plants.Where(p => p.Name.Contains(term) || p.Code.Contains(codeTerm));
        }

        var total = await plants.CountAsync(cancellationToken);
        var items = await plants
            .OrderBy(p => p.Code)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(p => new PlantSummaryResponse(
                p.Id, p.Code, p.Name, p.Type, p.Status, p.InstalledCapacityKwp, p.SiteId, p.LastProductionDate))
            .ToListAsync(cancellationToken);

        return new PagedResponse<PlantSummaryResponse>(items, query.Page, query.PageSize, total);
    }
}
