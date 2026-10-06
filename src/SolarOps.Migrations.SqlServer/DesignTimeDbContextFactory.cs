using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SolarOps.Infrastructure;
using SolarOps.Infrastructure.Persistence;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Migrations.SqlServer;

/// <summary>Used by <c>dotnet ef</c> only; never opens a connection while generating migrations.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SolarOpsDbContext>
{
    public SolarOpsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SolarOpsDbContext>();
        options.UseSqlServer(
            "Server=localhost,1433;Database=SolarOps;User Id=sa;Password=Design-time-only1;TrustServerCertificate=True",
            sql => sql.MigrationsAssembly(DependencyInjection.SqlServerMigrationsAssembly));
        return new SolarOpsDbContext(options.Options, new TenantContext());
    }
}
