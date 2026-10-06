using System.Globalization;
using ClosedXML.Excel;
using SolarOps.Application.Features.Production;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;
using static SolarOps.Infrastructure.Production.Parsers.ParsingPrimitives;

namespace SolarOps.Infrastructure.Production.Parsers;

internal static class ExcelErrors
{
    public static Error Unreadable(ProductionFileFormat format) =>
        Error.BusinessRule("Import.UnreadableFile", $"The file is not a valid {format} Excel workbook.");

    public static Error HeaderNotFound(ProductionFileFormat format, string header) =>
        Error.BusinessRule("Import.HeaderNotFound", $"{format}: column '{header}' was not found in the first rows.");

    public static bool TryOpen(Stream content, out XLWorkbook? workbook)
    {
        try
        {
            workbook = new XLWorkbook(content);
            return true;
        }
#pragma warning disable CA1031 // Any parse failure of untrusted input maps to a single business error.
        catch (Exception)
#pragma warning restore CA1031
        {
            workbook = null;
            return false;
        }
    }
}

/// <summary>
/// Huawei FusionSolar "Tesis Raporu" export. Columns are located by header text (TR or EN export), never by
/// fixed position, and the date is read from each row — fixing the v1 prototype that hard-coded the month.
/// </summary>
internal sealed class FusionSolarParser : IProductionFileParser
{
    private const int HeaderSearchDepth = 10;
    private static readonly string[] DateHeaders = ["istatistik zamani", "statistical period", "statistical time"];
    private static readonly string[] YieldHeaders = ["inverter kazanci", "inverter yield"];

    public ProductionFileFormat Format => ProductionFileFormat.FusionSolar;

    public ProductionSource Source => ProductionSource.FusionSolar;

    public Result<ParsedProductionFile> Parse(Stream content)
    {
        if (!ExcelErrors.TryOpen(content, out var workbook))
        {
            return ExcelErrors.Unreadable(Format);
        }

        using (workbook)
        {
            var sheet = workbook!.Worksheets.First();
            var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;
            var lastColumn = sheet.LastColumnUsed()?.ColumnNumber() ?? 0;

            int headerRow = 0, dateColumn = 0, yieldColumn = 0;
            for (var row = 1; row <= Math.Min(HeaderSearchDepth, lastRow) && yieldColumn == 0; row++)
            {
                for (var column = 1; column <= lastColumn; column++)
                {
                    var header = NormalizeHeader(CellText(sheet.Cell(row, column)));
                    if (DateHeaders.Any(header.StartsWith))
                    {
                        dateColumn = column;
                    }
                    else if (YieldHeaders.Any(header.StartsWith))
                    {
                        yieldColumn = column;
                        headerRow = row;
                    }
                }
            }

            if (yieldColumn == 0)
            {
                return ExcelErrors.HeaderNotFound(Format, "İnverter Kazancı (kWh)");
            }

            dateColumn = dateColumn == 0 ? 1 : dateColumn;
            var entries = new List<DailyYieldInput>();
            var warnings = new List<string>();

            for (var row = headerRow + 1; row <= lastRow; row++)
            {
                var dateCell = sheet.Cell(row, dateColumn);
                if (dateCell.IsEmpty())
                {
                    continue;
                }

                if (!TryReadDate(dateCell, out var date, out _))
                {
                    warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Row {row}: '{CellText(dateCell)}' is not a date; skipped."));
                    continue;
                }

                if (!TryReadEnergy(sheet.Cell(row, yieldColumn), out var energy))
                {
                    warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Row {row}: no inverter yield for {date:yyyy-MM-dd}; skipped."));
                    continue;
                }

                entries.Add(new DailyYieldInput(date, energy));
            }

            return new ParsedProductionFile(entries, warnings);
        }
    }
}

/// <summary>
/// Retgen daily production report: a metadata block (investor, plant, start/end date) followed by a
/// "Tarih | Gerçekleşen Üretim (kWh)" table. Rows with a time component (seen around DST changes) or outside
/// the declared period are skipped with a warning instead of being imported as an extra day.
/// </summary>
internal sealed class RetgenParser : IProductionFileParser
{
    private const int HeaderSearchDepth = 20;

    public ProductionFileFormat Format => ProductionFileFormat.Retgen;

    public ProductionSource Source => ProductionSource.Retgen;

    public Result<ParsedProductionFile> Parse(Stream content)
    {
        if (!ExcelErrors.TryOpen(content, out var workbook))
        {
            return ExcelErrors.Unreadable(Format);
        }

        using (workbook)
        {
            var sheet = workbook!.Worksheets.First();
            var lastRow = sheet.LastRowUsed()?.RowNumber() ?? 0;

            DateOnly? periodStart = null, periodEnd = null;
            var headerRow = 0;
            for (var row = 1; row <= Math.Min(HeaderSearchDepth, lastRow); row++)
            {
                var label = NormalizeHeader(CellText(sheet.Cell(row, 1)));
                if (label.StartsWith("baslangic", StringComparison.Ordinal) && TryReadDate(sheet.Cell(row, 2), out var start, out _))
                {
                    periodStart = start;
                }
                else if (label.StartsWith("bitis", StringComparison.Ordinal) && TryReadDate(sheet.Cell(row, 2), out var end, out _))
                {
                    periodEnd = end;
                }
                else if (label == "tarih")
                {
                    headerRow = row;
                    break;
                }
            }

            if (headerRow == 0)
            {
                return ExcelErrors.HeaderNotFound(Format, "Tarih");
            }

            var entries = new List<DailyYieldInput>();
            var warnings = new List<string>();
            for (var row = headerRow + 1; row <= lastRow; row++)
            {
                var dateCell = sheet.Cell(row, 1);
                if (dateCell.IsEmpty())
                {
                    continue;
                }

                if (!TryReadDate(dateCell, out var date, out var timeOfDay))
                {
                    warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Row {row}: '{CellText(dateCell)}' is not a date; skipped."));
                    continue;
                }

                if (timeOfDay != TimeSpan.Zero)
                {
                    warnings.Add(string.Create(
                        CultureInfo.InvariantCulture,
                        $"Row {row}: {date:yyyy-MM-dd} {timeOfDay:hh\\:mm} carries a time component (duplicate/summary row); skipped."));
                    continue;
                }

                if (date < periodStart || date > periodEnd)
                {
                    warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Row {row}: {date:yyyy-MM-dd} is outside the report period; skipped."));
                    continue;
                }

                if (!TryReadEnergy(sheet.Cell(row, 2), out var energy))
                {
                    warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Row {row}: no production value for {date:yyyy-MM-dd}; skipped."));
                    continue;
                }

                entries.Add(new DailyYieldInput(date, energy));
            }

            return new ParsedProductionFile(entries, warnings);
        }
    }
}
