namespace SolarOps.Infrastructure.Persistence;

public enum DatabaseProvider
{
    /// <summary>Zero-dependency local development and integration tests.</summary>
    Sqlite,
    SqlServer,
    Oracle,
}

public sealed class DatabaseOptions
{
    public const string Section = "Database";

    public DatabaseProvider Provider { get; set; } = DatabaseProvider.Sqlite;

    public string ConnectionString { get; set; } = "Data Source=solarops.db";

    /// <summary>Runs EF Core migrations (or <c>EnsureCreated</c> for SQLite) at startup. Enable on one host only.</summary>
    public bool ApplyMigrationsOnStartup { get; set; }

    public bool SeedDemoData { get; set; }
}
