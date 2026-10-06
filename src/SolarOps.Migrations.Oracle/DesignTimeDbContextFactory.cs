using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SolarOps.Infrastructure;
using SolarOps.Infrastructure.Persistence;
using SolarOps.Infrastructure.Tenancy;

namespace SolarOps.Migrations.OracleDb;

/// <summary>Used by <c>dotnet ef</c> only; never opens a connection while generating migrations.</summary>
internal sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<SolarOpsDbContext>
{
    public SolarOpsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SolarOpsDbContext>();
        options.UseOracle(
            "User Id=solarops;Password=design-time-only;Data Source=localhost:1521/FREEPDB1",
            oracle => oracle.MigrationsAssembly(DependencyInjection.OracleMigrationsAssembly));
        return new SolarOpsDbContext(options.Options, new TenantContext());
    }
}
