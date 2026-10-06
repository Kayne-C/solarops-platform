using FluentValidation;
using Microsoft.EntityFrameworkCore;
using SolarOps.Application.Abstractions;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Application.Features.Production;

public sealed record RecordDailyYieldsCommand(Guid PlantId, ProductionSource Source, IReadOnlyList<DailyYieldInput> Entries)
    : ICommand<RecordDailyYieldsResponse>;

internal sealed class RecordDailyYieldsValidator : AbstractValidator<RecordDailyYieldsCommand>
{
    public const int MaxBatchSize = 5_000;

    public RecordDailyYieldsValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.Source).IsInEnum();
        RuleFor(c => c.Entries).NotEmpty().Must(e => e.Count <= MaxBatchSize)
            .WithMessage($"A batch may contain at most {MaxBatchSize} entries.");
    }
}

internal sealed class RecordDailyYieldsHandler(DailyYieldWriter writer)
    : ICommandHandler<RecordDailyYieldsCommand, RecordDailyYieldsResponse>
{
    public Task<Result<RecordDailyYieldsResponse>> Handle(RecordDailyYieldsCommand command, CancellationToken cancellationToken) =>
        writer.WriteAsync(command.PlantId, command.Source, command.Entries, cancellationToken);
}

public sealed record DailyYieldResponse(DateOnly Date, decimal EnergyKwh, ProductionSource Source, DateTime RecordedAtUtc);

public sealed record GetDailyYieldsQuery(Guid PlantId, DateOnly From, DateOnly To) : IQuery<IReadOnlyList<DailyYieldResponse>>;

internal sealed class GetDailyYieldsValidator : AbstractValidator<GetDailyYieldsQuery>
{
    public GetDailyYieldsValidator()
    {
        RuleFor(q => q.To).GreaterThanOrEqualTo(q => q.From);
        RuleFor(q => q).Must(q => q.To.DayNumber - q.From.DayNumber <= 366)
            .WithName("range").WithMessage("The requested range may not exceed 366 days.");
    }
}

internal sealed class GetDailyYieldsHandler(IApplicationDbContext db)
    : IQueryHandler<GetDailyYieldsQuery, IReadOnlyList<DailyYieldResponse>>
{
    public async Task<Result<IReadOnlyList<DailyYieldResponse>>> Handle(GetDailyYieldsQuery query, CancellationToken cancellationToken)
    {
        if (!await db.Plants.AnyAsync(p => p.Id == query.PlantId, cancellationToken))
        {
            return PlantErrors.NotFound(query.PlantId);
        }

        var yields = await db.DailyYields.AsNoTracking()
            .Where(y => y.PlantId == query.PlantId && y.Date >= query.From && y.Date <= query.To)
            .OrderBy(y => y.Date)
            .Select(y => new DailyYieldResponse(y.Date, y.EnergyKwh, y.Source, y.RecordedAtUtc))
            .ToListAsync(cancellationToken);

        return yields;
    }
}
