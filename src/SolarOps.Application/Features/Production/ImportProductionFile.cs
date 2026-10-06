using FluentValidation;
using SolarOps.Application.Abstractions.Messaging;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;

namespace SolarOps.Application.Features.Production;

public enum ProductionFileFormat
{
    /// <summary>Huawei FusionSolar "plant report" (.xlsx).</summary>
    FusionSolar,

    /// <summary>Huawei NetEco monthly energy export (.csv, UTF-16 or UTF-8, tab separated).</summary>
    NetEco,

    /// <summary>Retgen daily production report (.xlsx).</summary>
    Retgen,
}

public sealed record ParsedProductionFile(IReadOnlyList<DailyYieldInput> Entries, IReadOnlyList<string> Warnings);

/// <summary>Strategy per vendor export format. Implementations must be stateless and never trust cell positions blindly.</summary>
public interface IProductionFileParser
{
    ProductionFileFormat Format { get; }

    ProductionSource Source { get; }

    Result<ParsedProductionFile> Parse(Stream content);
}

public sealed record ImportProductionFileCommand(Guid PlantId, ProductionFileFormat Format, string FileName, Stream Content)
    : ICommand<ImportProductionFileResponse>;

public sealed record ImportProductionFileResponse(
    string FileName,
    ProductionFileFormat Format,
    int ParsedRows,
    RecordDailyYieldsResponse Result,
    IReadOnlyList<string> Warnings);

internal sealed class ImportProductionFileValidator : AbstractValidator<ImportProductionFileCommand>
{
    public const long MaxFileSizeBytes = 10 * 1024 * 1024;

    public ImportProductionFileValidator()
    {
        RuleFor(c => c.PlantId).NotEmpty();
        RuleFor(c => c.Format).IsInEnum();
        RuleFor(c => c.FileName).NotEmpty().MaximumLength(255)
            .Must(name => Path.GetExtension(name).ToLowerInvariant() is ".xlsx" or ".csv")
            .WithMessage("Only .xlsx and .csv files are supported.");
        RuleFor(c => c.Content).NotNull()
            .Must(s => !s.CanSeek || s.Length is > 0 and <= MaxFileSizeBytes)
            .WithMessage("File must be between 1 byte and 10 MB.");
    }
}

internal sealed class ImportProductionFileHandler(IEnumerable<IProductionFileParser> parsers, DailyYieldWriter writer)
    : ICommandHandler<ImportProductionFileCommand, ImportProductionFileResponse>
{
    public async Task<Result<ImportProductionFileResponse>> Handle(ImportProductionFileCommand command, CancellationToken cancellationToken)
    {
        var parser = parsers.FirstOrDefault(p => p.Format == command.Format);
        if (parser is null)
        {
            return Error.BusinessRule("Import.UnsupportedFormat", $"No parser is registered for {command.Format}.");
        }

        var parsed = parser.Parse(command.Content);
        if (parsed.IsFailure)
        {
            return parsed.Error;
        }

        if (parsed.Value.Entries.Count == 0)
        {
            return Error.BusinessRule("Import.NoRows", "The file did not contain any daily production rows.");
        }

        var written = await writer.WriteAsync(command.PlantId, parser.Source, parsed.Value.Entries.ToList(), cancellationToken);
        if (written.IsFailure)
        {
            return written.Error;
        }

        return new ImportProductionFileResponse(
            command.FileName, command.Format, parsed.Value.Entries.Count, written.Value, parsed.Value.Warnings);
    }
}
