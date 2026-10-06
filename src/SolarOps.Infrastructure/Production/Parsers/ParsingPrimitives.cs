using System.Globalization;
using System.Text;
using ClosedXML.Excel;

namespace SolarOps.Infrastructure.Production.Parsers;

internal static class ParsingPrimitives
{
    private static readonly string[] DateFormats = ["yyyy-MM-dd", "dd.MM.yyyy", "dd/MM/yyyy", "yyyy/MM/dd", "yyyy.MM.dd"];

    /// <summary>
    /// Header comparison that survives Turkish casing (İ/ı) and diacritics:
    /// "İnverter Kazancı (kWh)" and "inverter kazanci (kwh)" normalize to the same key.
    /// </summary>
    public static string NormalizeHeader(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        foreach (var c in value.Trim())
        {
            builder.Append(c switch
            {
                'İ' or 'I' or 'ı' => 'i',
                'Ş' or 'ş' => 's',
                'Ğ' or 'ğ' => 'g',
                'Ü' or 'ü' => 'u',
                'Ö' or 'ö' => 'o',
                'Ç' or 'ç' => 'c',
                _ => char.ToLowerInvariant(c),
            });
        }

        return builder.ToString();
    }

    /// <summary>
    /// Parses energy values written by different locales: "1234.56", "1.234,56", "1,234.56", "1234,56".
    /// When both separators appear the right-most one is the decimal separator.
    /// </summary>
    public static bool TryParseEnergy(string? raw, out decimal value)
    {
        value = 0;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var text = raw.Trim().Replace(" ", string.Empty, StringComparison.Ordinal).Replace(" ", string.Empty, StringComparison.Ordinal);
        var lastComma = text.LastIndexOf(',');
        var lastDot = text.LastIndexOf('.');

        if (lastComma >= 0 && lastDot >= 0)
        {
            text = lastComma > lastDot
                ? text.Replace(".", string.Empty, StringComparison.Ordinal).Replace(',', '.')
                : text.Replace(",", string.Empty, StringComparison.Ordinal);
        }
        else if (lastComma >= 0)
        {
            text = text.Count(c => c == ',') > 1
                ? text.Replace(",", string.Empty, StringComparison.Ordinal)
                : text.Replace(',', '.');
        }
        else if (text.Count(c => c == '.') > 1)
        {
            text = text.Replace(".", string.Empty, StringComparison.Ordinal);
        }

        return decimal.TryParse(text, NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out value);
    }

    public static bool TryParseDate(string? raw, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var text = raw.Trim();
        if (DateOnly.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
        {
            return true;
        }

        // Exports sometimes append a time ("2025-06-01 00:00:00"); keep only the date part when it is midnight.
        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTime) && dateTime.TimeOfDay == TimeSpan.Zero)
        {
            date = DateOnly.FromDateTime(dateTime);
            return true;
        }

        return false;
    }

    public static bool TryReadEnergy(IXLCell cell, out decimal value)
    {
        var cellValue = cell.Value;
        if (cellValue.IsNumber)
        {
            value = (decimal)cellValue.GetNumber();
            return true;
        }

        value = 0;
        return cellValue.IsText && TryParseEnergy(cellValue.GetText(), out value);
    }

    /// <summary>Reads a date cell; <paramref name="timeOfDay"/> is non-zero when the cell carries a time component.</summary>
    public static bool TryReadDate(IXLCell cell, out DateOnly date, out TimeSpan timeOfDay)
    {
        var cellValue = cell.Value;
        timeOfDay = TimeSpan.Zero;

        if (cellValue.IsDateTime)
        {
            var dateTime = cellValue.GetDateTime();
            date = DateOnly.FromDateTime(dateTime);
            timeOfDay = dateTime.TimeOfDay;
            return true;
        }

        date = default;
        return cellValue.IsText && TryParseDate(cellValue.GetText(), out date);
    }

    public static string CellText(IXLCell cell) => cell.Value.IsText ? cell.Value.GetText() : cell.Value.ToString(CultureInfo.InvariantCulture);
}
