using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SolarOps.Application.Abstractions;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Production;
using SolarOps.Domain.Tenants;

namespace SolarOps.Infrastructure.Persistence.Configurations;

internal sealed class PlantConfiguration : IEntityTypeConfiguration<Plant>
{
    public void Configure(EntityTypeBuilder<Plant> builder)
    {
        builder.ToTable("Plants");
        builder.Property(p => p.Code).HasMaxLength(Plant.CodeMaxLength).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(Plant.NameMaxLength).IsRequired();
        builder.Property(p => p.InstalledCapacityKwp).HasPrecision(12, 3);
        builder.Property(p => p.AnnualDegradationRatePercent).HasPrecision(5, 3);
        builder.Property(p => p.PvModuleModel).HasMaxLength(Plant.EquipmentMaxLength);
        builder.Property(p => p.InverterModel).HasMaxLength(Plant.EquipmentMaxLength);

        // Codes stay reserved after a soft delete, hence the unique index ignores IsDeleted.
        builder.HasIndex(p => new { p.TenantId, p.Code }).IsUnique();
        builder.HasIndex(p => new { p.TenantId, p.Status });

        builder.HasQueryFilter(QueryFilterNames.SoftDelete, p => !p.IsDeleted);

        builder.HasOne<Tenant>().WithMany().HasForeignKey(p => p.TenantId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Investor>().WithMany().HasForeignKey(p => p.InvestorId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Site>().WithMany().HasForeignKey(p => p.SiteId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class DailyYieldConfiguration : IEntityTypeConfiguration<DailyYield>
{
    public void Configure(EntityTypeBuilder<DailyYield> builder)
    {
        builder.ToTable("DailyYields");
        builder.Property(y => y.EnergyKwh).HasPrecision(14, 3);

        // Natural key of the upsert; also serves plant time-range scans.
        builder.HasIndex(y => new { y.TenantId, y.PlantId, y.Date }).IsUnique();

        // Portfolio dashboard: all plants of a tenant for one month.
        builder.HasIndex(y => new { y.TenantId, y.Date });

        builder.HasOne<Plant>().WithMany().HasForeignKey(y => y.PlantId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class ProductionBaselineConfiguration : IEntityTypeConfiguration<ProductionBaseline>
{
    public void Configure(EntityTypeBuilder<ProductionBaseline> builder)
    {
        builder.ToTable("ProductionBaselines");
        builder.Property(b => b.ExpectedKwh).HasPrecision(14, 2);
        builder.HasIndex(b => new { b.TenantId, b.PlantId, b.Year, b.Month }).IsUnique();
        builder.HasOne<Plant>().WithMany().HasForeignKey(b => b.PlantId).OnDelete(DeleteBehavior.Restrict);
    }
}
