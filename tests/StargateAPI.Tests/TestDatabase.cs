using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests;

/// <summary>
/// Real SQLite in memory with the real migrations applied, so constraints,
/// collations and date storage behave as they do in the running API.
/// </summary>
public sealed class TestDatabase : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<StargateContext> _options;

    public TestDatabase()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();

        _options = new DbContextOptionsBuilder<StargateContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = CreateContext();
        context.Database.Migrate();
    }

    /// <summary>A new context over the same database, like a new request scope.</summary>
    public StargateContext CreateContext() => new(_options);

    public void Dispose() => _connection.Dispose();
}
