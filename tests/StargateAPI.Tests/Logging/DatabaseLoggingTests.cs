using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Data;
using StargateAPI.Business.Logging;
using StargateAPI.Tests.Api;

namespace StargateAPI.Tests.Logging;

/// <summary>Request outcomes and exceptions are stored in the LogEntry table, and logging never changes an HTTP result.</summary>
public class DatabaseLoggingTests
{
    private static async Task<List<LogEntry>> StoredAsync(ApiFactory api)
    {
        var queue = api.Services.GetRequiredService<DatabaseLogQueue>();
        Assert.True(await queue.WaitUntilIdleAsync(TimeSpan.FromSeconds(10)), "The log queue did not drain.");

        using var scope = api.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<StargateContext>();
        return await context.LogEntries.AsNoTracking().OrderBy(x => x.Id).ToListAsync();
    }

    [Fact]
    public async Task A_successful_create_writes_a_success_entry_with_its_duration_and_actor()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");
        Assert.Equal(HttpStatusCode.Created, response.Status);

        var entry = Assert.Single((await StoredAsync(api)).Where(e => e.Operation == "CreatePerson"));
        Assert.Equal(LogLevel.Information, entry.Level);
        Assert.Contains("succeeded", entry.Message);
        Assert.NotNull(entry.DurationMs);
        Assert.True(entry.DurationMs >= 0);
        Assert.Null(entry.Exception);
        Assert.Equal(ApiHttp.Actor, entry.Actor);
        Assert.False(string.IsNullOrWhiteSpace(entry.TraceId));
        Assert.Contains("LoggingBehavior", entry.Category);
    }

    [Fact]
    public async Task A_conflict_writes_a_warning_entry_with_the_status_code()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "Jack Rourke" }""");
        Assert.Equal(HttpStatusCode.Conflict, response.Status);

        var entry = Assert.Single((await StoredAsync(api)).Where(e => e.Operation == "CreatePerson"));
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Equal(409, entry.StatusCode);
        Assert.NotNull(entry.DurationMs);
        Assert.Null(entry.Exception);
    }

    [Fact]
    public async Task A_not_found_query_is_a_warning_with_404()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        await client.GetAsync("/Person/Nobody");

        var entry = Assert.Single((await StoredAsync(api)).Where(e => e.Operation == "GetPersonByName"));
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Equal(404, entry.StatusCode);
    }

    private sealed class ExplodingActorProvider : IActorProvider
    {
        public string? Actor => throw new InvalidOperationException("boom");
    }

    [Fact]
    public async Task An_unexpected_exception_writes_an_error_entry_with_the_stack_trace_and_the_trace_id_of_the_response()
    {
        using var api = new ApiFactory(services => services.AddScoped<IActorProvider, ExplodingActorProvider>());
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");
        Assert.Equal(HttpStatusCode.InternalServerError, response.Status);
        var traceId = response.Json.GetProperty("traceId").GetString();

        var entries = await StoredAsync(api);
        var exceptionEntry = Assert.Single(entries, e => e.Exception is not null);

        Assert.Equal(LogLevel.Error, exceptionEntry.Level);
        Assert.Equal(500, exceptionEntry.StatusCode);
        Assert.Equal(traceId, exceptionEntry.TraceId);
        Assert.Contains("InvalidOperationException: boom", exceptionEntry.Exception);
        Assert.Contains(" at ", exceptionEntry.Exception);

        var operationEntry = Assert.Single(entries, e => e.Operation == "CreatePerson");
        Assert.Equal(LogLevel.Error, operationEntry.Level);
        Assert.Equal(500, operationEntry.StatusCode);
        Assert.NotNull(operationEntry.DurationMs);
    }

    [Fact]
    public async Task Request_payloads_are_not_logged()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        await client.PostAsync("/Person", """{ "name": "Zebulon Unique-Name" }""");

        var entries = await StoredAsync(api);
        Assert.DoesNotContain(entries, e => e.Message.Contains("Zebulon") || (e.Exception?.Contains("Zebulon") ?? false));
    }

    [Fact]
    public async Task Entity_framework_and_framework_noise_is_not_stored()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");
        await client.GetAsync("/Person");

        var entries = await StoredAsync(api);
        Assert.NotEmpty(entries);
        Assert.DoesNotContain(entries, e => e.Category.StartsWith("Microsoft.EntityFrameworkCore"));
        Assert.DoesNotContain(entries, e => e.Level < LogLevel.Information);
    }

    [Fact]
    public async Task A_broken_log_store_does_not_change_the_http_result()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        using (var scope = api.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<StargateContext>();
            await context.Database.ExecuteSqlRawAsync("DROP TABLE LogEntry");
        }

        var created = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");
        var conflict = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");
        var read = await client.GetAsync("/Person/Alan%20Shepard");

        Assert.Equal(HttpStatusCode.Created, created.Status);
        Assert.Equal(HttpStatusCode.Conflict, conflict.Status);
        Assert.Equal(HttpStatusCode.OK, read.Status);

        // The entries are dropped, not retried forever.
        var queue = api.Services.GetRequiredService<DatabaseLogQueue>();
        Assert.True(await queue.WaitUntilIdleAsync(TimeSpan.FromSeconds(10)));
    }

    [Fact]
    public async Task A_request_is_not_held_up_while_the_log_writer_waits_for_the_write_gate()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();
        var queue = api.Services.GetRequiredService<DatabaseLogQueue>();
        await queue.WaitUntilIdleAsync(TimeSpan.FromSeconds(10));

        Task<ApiResponse> read;
        using (await WriteGate.EnterAsync(CancellationToken.None))
        {
            read = client.GetAsync("/Person");
            var finished = await Task.WhenAny(read, Task.Delay(TimeSpan.FromSeconds(10)));
            Assert.Same(read, finished);
            Assert.Equal(HttpStatusCode.OK, (await read).Status);
            Assert.True(queue.Pending > 0, "The entry should wait in the queue while the gate is held.");
        }

        var stored = await StoredAsync(api);
        Assert.Contains(stored, e => e.Operation == "GetPeople");
    }

    [Fact]
    public async Task Entries_still_queued_or_mid_write_are_stored_when_the_host_stops()
    {
        using var db = new TestDatabase();
        var services = new ServiceCollection();
        services.AddScoped(_ => db.CreateContext());
        using var provider = services.BuildServiceProvider();

        var queue = new DatabaseLogQueue();
        var writer = new DatabaseLogWriter(queue, provider.GetRequiredService<IServiceScopeFactory>(),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<DatabaseLogWriter>.Instance);

        await writer.StartAsync(CancellationToken.None);
        for (var i = 0; i < 250; i++)
        {
            Assert.True(queue.TryEnqueue(new LogEntry { Category = "Test", Message = $"entry {i}", Level = LogLevel.Information, TimestampUtc = DateTime.UtcNow }));
        }

        await writer.StopAsync(CancellationToken.None);

        using var context = db.CreateContext();
        Assert.Equal(250, await context.LogEntries.CountAsync());
        Assert.Equal(0, queue.Pending);
    }

    [Fact]
    public void A_full_queue_drops_entries_instead_of_blocking()
    {
        var queue = new DatabaseLogQueue(capacity: 2);

        Assert.True(queue.TryEnqueue(new LogEntry()));
        Assert.True(queue.TryEnqueue(new LogEntry()));
        Assert.False(queue.TryEnqueue(new LogEntry()));
        Assert.Equal(2, queue.Pending);
    }

    [Fact]
    public void A_logger_that_cannot_build_an_entry_does_not_throw()
    {
        var queue = new DatabaseLogQueue(capacity: 1);
        using var provider = new DatabaseLoggerProvider(queue, new Microsoft.AspNetCore.Http.HttpContextAccessor(), TimeProvider.System);
        var logger = provider.CreateLogger("Test.Category");

        logger.Log(LogLevel.Information, new EventId(1), "state", null, (_, _) => throw new InvalidOperationException("formatter failed"));

        Assert.Equal(0, queue.Pending);
    }
}
