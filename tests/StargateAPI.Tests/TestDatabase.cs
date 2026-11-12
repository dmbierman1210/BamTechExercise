using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests;

/// <summary>
/// Real SQLite with the real migrations applied, so constraints, collations and date storage behave as they do in
/// the running API. In memory by default (one shared connection); file backed when a test needs several
/// connections that really contend for the database.
/// </summary>
public sealed class TestDatabase : IDisposable
{
    private readonly SqliteConnection? _connection;
    private readonly string? _path;

    public TestDatabase(bool fileBacked = false)
    {
        if (fileBacked)
        {
            _path = Path.Combine(Path.GetTempPath(), $"stargate-test-{Guid.NewGuid():N}.db");
        }
        else
        {
            _connection = new SqliteConnection("Data Source=:memory:");
            _connection.Open();
        }

        using var context = CreateContext();
        context.Database.Migrate();
    }

    /// <summary>A new context over the same database, like a new request scope.</summary>
    public StargateContext CreateContext() => CreateContext(Array.Empty<IInterceptor>());

    public StargateContext CreateContext(params IInterceptor[] interceptors)
    {
        var builder = new DbContextOptionsBuilder<StargateContext>();

        if (_connection is not null)
        {
            builder.UseSqlite(_connection);
        }
        else
        {
            builder.UseSqlite($"Data Source={_path};Pooling=False");
        }

        return new StargateContext(builder.AddInterceptors(interceptors).Options);
    }

    public void Dispose()
    {
        _connection?.Dispose();

        if (_path is not null)
        {
            SqliteConnection.ClearAllPools();
            File.Delete(_path);
        }
    }
}
