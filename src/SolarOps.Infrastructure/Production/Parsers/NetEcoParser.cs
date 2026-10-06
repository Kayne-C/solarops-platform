using System.Globalization;
using System.Text;
using SolarOps.Application.Features.Production;
using SolarOps.Domain.Common;
using SolarOps.Domain.Production;
using static SolarOps.Infrastructure.Production.Parsers.ParsingPrimitives;

namespace SolarOps.Infrastructure.Production.Parsers;

/// <summary>
/// Huawei NetEco monthly energy export: UTF-16 LE (BOM) or UTF-8, tab separated, every field quoted — and the
/// date field itself contains a trailing tab inside its quotes, so a naive split on tabs misaligns columns.
/// Layout: line 1 metadata, then a "Generated On | &lt;plant&gt; | &lt;inverter 1&gt; ..." header, then one row per day.
/// The plant total (column 2) is imported; per-inverter columns are ignored.
/// </summary>
internal sealed class NetEcoParser : IProductionFileParser
{
    private const int MaxLines = 1_000;

    public ProductionFileFormat Format => ProductionFileFormat.NetEco;

    public ProductionSource Source => ProductionSource.NetEco;

    public Result<ParsedProductionFile> Parse(Stream content)
    {
        using var reader = new StreamReader(content, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);

        var entries = new List<DailyYieldInput>();
        var warnings = new List<string>();
        var headerFound = false;
        var lineNumber = 0;

        while (reader.ReadLine() is { } line)
        {
            if (++lineNumber > MaxLines)
            {
                return Error.BusinessRule("Import.TooManyRows", $"NetEco files may not exceed {MaxLines} lines.");
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var fields = SplitQuoted(line, '\t');
            if (!headerFound)
            {
                headerFound = fields.Count >= 2 && NormalizeHeader(fields[0]) == "generated on";
                continue;
            }

            if (!TryParseDate(fields[0], out var date))
            {
                warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Line {lineNumber}: '{fields[0]}' is not a date; skipped."));
                continue;
            }

            if (fields.Count < 2 || !TryParseEnergy(fields[1], out var energy))
            {
                warnings.Add(string.Create(CultureInfo.InvariantCulture, $"Line {lineNumber}: no plant total for {date:yyyy-MM-dd}; skipped."));
                continue;
            }

            entries.Add(new DailyYieldInput(date, energy));
        }

        return headerFound
            ? new ParsedProductionFile(entries, warnings)
            : Error.BusinessRule("Import.HeaderNotFound", "NetEco: header row 'Generated On' was not found.");
    }

    /// <summary>RFC 4180-style tokenizer (quotes may contain the separator; "" escapes a quote). Fields are trimmed.</summary>
    internal static List<string> SplitQuoted(string line, char separator)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (inQuotes)
            {
                if (c == '"' && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else if (c == '"')
                {
                    inQuotes = false;
                }
                else
                {
                    current.Append(c);
                }
            }
            else if (c == '"')
            {
                inQuotes = true;
            }
            else if (c == separator)
            {
                fields.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString().Trim());
        return fields;
    }
}
