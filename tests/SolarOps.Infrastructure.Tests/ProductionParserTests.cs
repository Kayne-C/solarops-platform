using System.Text;
using ClosedXML.Excel;
using SolarOps.Infrastructure.Production.Parsers;

namespace SolarOps.Infrastructure.Tests;

/// <summary>Fixtures mirror the real vendor layouts (synthetic values, no customer data).</summary>
public sealed class ProductionParserTests
{
    private static MemoryStream Workbook(Action<IXLWorksheet> fill)
    {
        using var workbook = new XLWorkbook();
        fill(workbook.AddWorksheet("Rapor"));
        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }

    [Fact]
    public void FusionSolar_locates_the_inverter_yield_column_by_header_and_reads_row_dates()
    {
        using var file = Workbook(sheet =>
        {
            sheet.Cell(1, 1).Value = "Tesis Raporu_DEMO GES";
            string[] headers = ["İstatistik zamanı", "Toplam Dizi Kapasitesi (kWp)", "PV Kazancı (kWh)", "İnverter Kazancı (kWh)", "Toplam Kazanç (kWh)"];
            for (var i = 0; i < headers.Length; i++)
            {
                sheet.Cell(2, i + 1).Value = headers[i];
            }

            sheet.Cell(3, 1).Value = "2025-07-01";
            sheet.Cell(3, 4).Value = 21_128.25;
            sheet.Cell(3, 5).Value = 7_133_443.03; // cumulative counter — must not be picked up
            sheet.Cell(4, 1).Value = "2025-07-02";
            sheet.Cell(4, 4).Value = "22.251,18"; // Turkish-formatted text cell
            sheet.Cell(5, 1).Value = "Toplam";
        });

        var result = new FusionSolarParser().Parse(file);

        Assert.True(result.IsSuccess);
        Assert.Collection(
            result.Value.Entries,
            e => Assert.Equal((new DateOnly(2025, 7, 1), 21_128.25m), (e.Date, e.EnergyKwh)),
            e => Assert.Equal((new DateOnly(2025, 7, 2), 22_251.18m), (e.Date, e.EnergyKwh)));
        Assert.Single(result.Value.Warnings);
    }

    [Fact]
    public void FusionSolar_without_the_expected_header_fails_with_a_clear_error()
    {
        using var file = Workbook(sheet => sheet.Cell(1, 1).Value = "unrelated");

        var result = new FusionSolarParser().Parse(file);

        Assert.Equal("Import.HeaderNotFound", result.Error.Code);
    }

    [Fact]
    public void Retgen_skips_rows_with_a_time_component_and_rows_outside_the_period()
    {
        using var file = Workbook(sheet =>
        {
            sheet.Cell(1, 1).Value = "Yatırımcı";
            sheet.Cell(4, 1).Value = "Başlangıç Tarihi";
            sheet.Cell(4, 2).Value = new DateTime(2025, 6, 1);
            sheet.Cell(5, 1).Value = "Bitiş Tarihi";
            sheet.Cell(5, 2).Value = new DateTime(2025, 6, 30);
            sheet.Cell(6, 1).Value = "Tarih";
            sheet.Cell(6, 2).Value = "Gerçekleşen Üretim (kWh)";
            sheet.Cell(7, 1).Value = new DateTime(2025, 6, 22, 1, 0, 0); // stray duplicate row seen in real exports
            sheet.Cell(7, 2).Value = 1_784.65;
            sheet.Cell(8, 1).Value = new DateTime(2025, 6, 1);
            sheet.Cell(8, 2).Value = 83.05;
            sheet.Cell(9, 1).Value = new DateTime(2025, 6, 2);
            sheet.Cell(9, 2).Value = 85.22;
            sheet.Cell(10, 1).Value = new DateTime(2025, 7, 1);
            sheet.Cell(10, 2).Value = 80.00;
        });

        var result = new RetgenParser().Parse(file);

        Assert.True(result.IsSuccess);
        Assert.Equal([new DateOnly(2025, 6, 1), new DateOnly(2025, 6, 2)], result.Value.Entries.Select(e => e.Date));
        Assert.Equal(2, result.Value.Warnings.Count);
        Assert.Contains(result.Value.Warnings, w => w.Contains("time component", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("utf-16")]
    [InlineData("utf-8")]
    public void NetEco_reads_the_plant_total_despite_tabs_inside_quoted_fields(string encodingName)
    {
        var csv = new StringBuilder()
            .Append("\"PV plant name:DEMO  Period:Month  Unit:Energy Yield (kWh)\"\t\n")
            .Append("\"Generated On\"\t\" DEMO\"\t\" 50KTL-M3(COM1-12)\"\t\" 50KTL-M3(COM1-13)\"\t\n")
            .Append("\"2025-06-01\t\"\t\"6980.35\"\t\"261.15\"\t\"235.11\"\t\n")
            .Append("\"2025-06-02\t\"\t\"10326.11\"\t\"366.00\"\t\"345.62\"\t\n")
            .Append("\"Total\"\t\"17306.46\"\t\n")
            .ToString();

        Encoding encoding = encodingName == "utf-16" ? new UnicodeEncoding(bigEndian: false, byteOrderMark: true) : new UTF8Encoding(true);
        using var file = new MemoryStream([.. encoding.GetPreamble(), .. encoding.GetBytes(csv)]);

        var result = new NetEcoParser().Parse(file);

        Assert.True(result.IsSuccess);
        Assert.Equal([6_980.35m, 10_326.11m], result.Value.Entries.Select(e => e.EnergyKwh));
        Assert.Single(result.Value.Warnings);
    }

    [Fact]
    public void Non_excel_input_is_reported_as_unreadable()
    {
        using var file = new MemoryStream("not a workbook"u8.ToArray());

        Assert.Equal("Import.UnreadableFile", new RetgenParser().Parse(file).Error.Code);
    }

    [Theory]
    [InlineData("1234.56", 1234.56)]
    [InlineData("1.234,56", 1234.56)]
    [InlineData("1,234.56", 1234.56)]
    [InlineData("1234,56", 1234.56)]
    [InlineData("1.234.567", 1234567)]
    [InlineData(" 7 133 443,03 ", 7133443.03)]
    public void Energy_values_from_different_locales_are_normalized(string raw, double expected)
    {
        Assert.True(ParsingPrimitives.TryParseEnergy(raw, out var value));
        Assert.Equal((decimal)expected, value);
    }

    [Theory]
    [InlineData("İnverter Kazancı (kWh)", "inverter kazanci (kwh)")]
    [InlineData("İSTATİSTİK ZAMANI", "istatistik zamani")]
    [InlineData("Başlangıç Tarihi", "baslangic tarihi")]
    public void Headers_are_normalized_independent_of_turkish_casing(string header, string expected) =>
        Assert.Equal(expected, ParsingPrimitives.NormalizeHeader(header));

    [Fact]
    public void Quoted_tokenizer_honours_escaped_quotes_and_embedded_separators() =>
        Assert.Equal(["a\tb", "say \"hi\"", "c"], NetEcoParser.SplitQuoted("\"a\tb\"\t\"say \"\"hi\"\"\"\tc", '\t'));
}
