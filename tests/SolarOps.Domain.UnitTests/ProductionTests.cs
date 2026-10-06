using SolarOps.Domain.Assets.Events;
using SolarOps.Domain.Production;
using SolarOps.Domain.WorkOrders;

namespace SolarOps.Domain.UnitTests;

public sealed class YieldProjectionTests
{
    [Fact]
    public void Project_applies_compound_degradation_per_year()
    {
        // 100 000 kWh * 0.995^3 = 98 507.4875
        var result = YieldProjection.Project(100_000m, baseYear: 2022, targetYear: 2025, commissioningYear: 2022, annualDegradationRatePercent: 0.5m);

        Assert.True(result.IsSuccess);
        Assert.Equal(98_507.49m, result.Value);
    }

    [Fact]
    public void Project_to_the_same_year_returns_the_base_value()
    {
        var result = YieldProjection.Project(12_345.67m, 2024, 2024, 2022, 0.7m);

        Assert.Equal(12_345.67m, result.Value);
    }

    [Theory]
    [InlineData(2025, 2024, 2022, "Projection.Backward")]
    [InlineData(2021, 2024, 2022, "Projection.BaseYearBeforeCommissioning")]
    [InlineData(2023, 2021, 2022, "Projection.TargetYearBeforeCommissioning")]
    public void Project_rejects_impossible_periods(int baseYear, int targetYear, int commissioningYear, string expectedCode)
    {
        var result = YieldProjection.Project(1_000m, baseYear, targetYear, commissioningYear, 0.5m);

        Assert.True(result.IsFailure);
        Assert.Equal(expectedCode, result.Error.Code);
    }

    [Fact]
    public void Resolve_prefers_an_explicit_baseline_for_the_requested_year()
    {
        var plant = TestData.Plant();
        var baselines = new[]
        {
            ProductionBaseline.Create(plant.Id, 2022, 6, 100_000m, BaselineSource.PvSyst).Value,
            ProductionBaseline.Create(plant.Id, 2026, 6, 90_000m, BaselineSource.PvSyst).Value,
        };

        var expected = YieldProjection.Resolve(plant, baselines, 2026, 6);

        Assert.Equal(new ExpectedYield(90_000m, BaselineSource.PvSyst, 2026), expected);
    }

    [Fact]
    public void Resolve_projects_the_latest_earlier_pvsyst_year_when_no_baseline_exists()
    {
        var plant = TestData.Plant(degradationPercent: 0.5m);
        var baselines = new[]
        {
            ProductionBaseline.Create(plant.Id, 2022, 6, 100_000m, BaselineSource.PvSyst).Value,
            ProductionBaseline.Create(plant.Id, 2023, 6, 99_000m, BaselineSource.PvSyst).Value,
            ProductionBaseline.Create(plant.Id, 2023, 7, 50_000m, BaselineSource.PvSyst).Value,
        };

        var expected = YieldProjection.Resolve(plant, baselines, 2025, 6);

        // 99 000 * 0.995^2
        Assert.Equal(new ExpectedYield(98_012.48m, BaselineSource.Projected, 2023), expected);
    }

    [Fact]
    public void Resolve_returns_null_without_any_usable_baseline()
    {
        var plant = TestData.Plant();

        Assert.Null(YieldProjection.Resolve(plant, [], 2025, 6));
    }
}

public sealed class PerformanceAssessmentTests
{
    [Theory]
    [InlineData(9_000, 10_000, PerformanceStatus.Normal)]
    [InlineData(8_500, 10_000, PerformanceStatus.Normal)]
    [InlineData(8_000, 10_000, PerformanceStatus.Warning)]
    [InlineData(7_500, 10_000, PerformanceStatus.Warning)]
    [InlineData(7_499, 10_000, PerformanceStatus.Critical)]
    public void Evaluate_classifies_against_the_tenant_threshold(decimal actual, decimal expected, PerformanceStatus status)
    {
        var assessment = PerformanceAssessment.Evaluate(actual, expected, alertThreshold: 0.85m);

        Assert.Equal(status, assessment.Status);
        Assert.Equal(status != PerformanceStatus.Normal, assessment.RequiresIntervention);
    }

    [Fact]
    public void Evaluate_reports_index_and_deviation()
    {
        var assessment = PerformanceAssessment.Evaluate(5_106m, 10_000m, 0.85m);

        Assert.Equal(0.5106m, assessment.PerformanceIndex);
        Assert.Equal(-48.94m, assessment.DeviationPercent);
        Assert.Equal(WorkOrderPriority.Urgent, assessment.SuggestedPriority);
    }

    [Fact]
    public void Evaluate_requires_a_positive_expectation() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => PerformanceAssessment.Evaluate(1m, 0m, 0.85m));
}

public sealed class DailyYieldTests
{
    [Fact]
    public void Record_rejects_values_above_the_physical_daily_maximum()
    {
        // A 1 MWp plant cannot produce 7.1 GWh in a day — that is a cumulative meter reading.
        var plant = TestData.Plant(capacityKwp: 1_000m);

        var result = DailyYield.Record(plant, new DateOnly(2025, 6, 1), 7_133_443m, ProductionSource.FusionSolar, TestData.UtcNow);

        Assert.Equal("Production.ImplausibleEnergy", result.Error.Code);
    }

    [Theory]
    [InlineData(-1, 2025, 6, 1, "Production.NegativeEnergy")]
    [InlineData(100, 2021, 12, 31, "Production.BeforeCommissioning")]
    [InlineData(100, 2026, 10, 8, "Production.FutureDate")]
    public void Record_enforces_domain_rules(decimal energy, int year, int month, int day, string code)
    {
        var plant = TestData.Plant(commissioningYear: 2022);

        var result = DailyYield.Record(plant, new DateOnly(year, month, day), energy, ProductionSource.Manual, TestData.UtcNow);

        Assert.Equal(code, result.Error.Code);
    }

    [Fact]
    public void Revise_reports_whether_the_value_changed()
    {
        var plant = TestData.Plant();
        var yield = DailyYield.Record(plant, new DateOnly(2025, 6, 1), 4_000m, ProductionSource.Manual, TestData.UtcNow).Value;

        Assert.False(yield.Revise(plant, 4_000m, ProductionSource.Manual, TestData.UtcNow).Value);
        Assert.True(yield.Revise(plant, 4_100m, ProductionSource.NetEco, TestData.UtcNow).Value);
        Assert.Equal(4_100m, yield.EnergyKwh);
        Assert.Equal(ProductionSource.NetEco, yield.Source);
    }
}

public sealed class PlantTests
{
    [Theory]
    [InlineData(0, 0.5)]
    [InlineData(-10, 0.5)]
    [InlineData(1_000, 5.1)]
    [InlineData(1_000, -0.1)]
    public void Register_rejects_invalid_technical_data(decimal capacity, decimal degradation)
    {
        var result = Assets.Plant.Register(
            "X-1", "X", Assets.PlantType.GroundSolar, Guid.NewGuid(), Guid.NewGuid(), capacity, new DateOnly(2022, 1, 1), degradation);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public void RecordProduction_raises_one_event_and_only_moves_the_watermark_forward()
    {
        var plant = TestData.Plant();
        plant.ClearDomainEvents();

        plant.RecordProduction(new DateOnly(2025, 6, 1), new DateOnly(2025, 6, 30), 30, ProductionSource.NetEco);
        plant.RecordProduction(new DateOnly(2025, 5, 1), new DateOnly(2025, 5, 31), 31, ProductionSource.NetEco);

        Assert.Equal(new DateOnly(2025, 6, 30), plant.LastProductionDate);
        Assert.Equal(2, plant.DomainEvents.OfType<ProductionRecordedDomainEvent>().Count());
    }
}
