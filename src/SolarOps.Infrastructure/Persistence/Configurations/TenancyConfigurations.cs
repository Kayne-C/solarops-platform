using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SolarOps.Domain.Assets;
using SolarOps.Domain.Identity;
using SolarOps.Domain.Tenants;

namespace SolarOps.Infrastructure.Persistence.Configurations;

internal sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("Tenants");
        builder.Property(t => t.Name).HasMaxLength(Tenant.NameMaxLength).IsRequired();
        builder.Property(t => t.Slug).HasMaxLength(Tenant.SlugMaxLength).IsRequired();
        builder.Property(t => t.PerformanceAlertThreshold).HasPrecision(5, 4);
        builder.HasIndex(t => t.Slug).IsUnique();
    }
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.Property(u => u.Email).HasMaxLength(User.EmailMaxLength).IsRequired();
        builder.Property(u => u.DisplayName).HasMaxLength(User.DisplayNameMaxLength).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(512).IsRequired();
        builder.HasIndex(u => new { u.TenantId, u.Email }).IsUnique();
        builder.HasOne<Tenant>().WithMany().HasForeignKey(u => u.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class InvestorConfiguration : IEntityTypeConfiguration<Investor>
{
    public void Configure(EntityTypeBuilder<Investor> builder)
    {
        builder.ToTable("Investors");
        builder.Property(i => i.CompanyName).HasMaxLength(Investor.CompanyNameMaxLength).IsRequired();
        builder.Property(i => i.ContactPerson).HasMaxLength(Investor.ContactMaxLength);
        builder.Property(i => i.Email).HasMaxLength(Investor.EmailMaxLength);
        builder.Property(i => i.Phone).HasMaxLength(Investor.PhoneMaxLength);
        builder.HasIndex(i => new { i.TenantId, i.CompanyName });
        builder.HasOne<Tenant>().WithMany().HasForeignKey(i => i.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class SiteConfiguration : IEntityTypeConfiguration<Site>
{
    public void Configure(EntityTypeBuilder<Site> builder)
    {
        builder.ToTable("Sites");
        builder.Property(s => s.Name).HasMaxLength(Site.NameMaxLength).IsRequired();
        builder.Property(s => s.City).HasMaxLength(Site.CityMaxLength).IsRequired();
        builder.HasIndex(s => new { s.TenantId, s.Name });
        builder.HasOne<Tenant>().WithMany().HasForeignKey(s => s.TenantId).OnDelete(DeleteBehavior.Restrict);
    }
}
