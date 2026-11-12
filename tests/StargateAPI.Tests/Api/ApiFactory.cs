using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests.Api;

/// <summary>The real API in memory on an in-memory SQLite database, started in Development so the seed data and Swagger are there.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly Action<IServiceCollection>? _customize;

    public ApiFactory(Action<IServiceCollection>? customize = null)
    {
        _customize = customize;
        _connection.Open();
    }

    /// <summary>A client whose methods return parsed envelopes (hides the base CreateClient on purpose).</summary>
    public new ApiHttp CreateClient() => new(base.CreateClient());

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<DbContextOptions<StargateContext>>();
            services.AddDbContext<StargateContext>(options => options.UseSqlite(_connection));
            _customize?.Invoke(services);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }
}

public sealed record ApiResponse(HttpStatusCode Status, string Raw, JsonElement Json)
{
    public int Code => (int)Status;

    /// <summary>The envelope every body has: success, message and a responseCode equal to the status.</summary>
    public void AssertEnvelope(bool success)
    {
        Assert.Equal(success, Json.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(Json.GetProperty("message").GetString()));
        Assert.Equal(Code, Json.GetProperty("responseCode").GetInt32());
    }

    public IReadOnlyList<(string Field, string Message)> Errors =>
        Json.TryGetProperty("errors", out var errors)
            ? errors.EnumerateArray().Select(e => (e.GetProperty("field").GetString()!, e.GetProperty("message").GetString()!)).ToList()
            : new List<(string, string)>();

    public IEnumerable<string> PropertyNames => Json.EnumerateObject().Select(p => p.Name);
}

/// <summary>An HttpClient that returns parsed envelopes. Its method names deliberately shadow HttpClient's to keep the tests short.</summary>
public sealed class ApiHttp : IDisposable
{
    public const string Actor = "flight.director";

    private readonly HttpClient _client;

    public ApiHttp(HttpClient client)
    {
        _client = client;
    }

    public async Task<ApiResponse> SendAsync(
        HttpMethod method, string path, string? body = null, string? actor = Actor, string contentType = "application/json")
    {
        using var request = new HttpRequestMessage(method, path);
        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8, contentType);
        }

        if (actor is not null)
        {
            request.Headers.Add("X-Actor", actor);
        }

        using var response = await _client.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();
        Assert.StartsWith("application/json", response.Content.Headers.ContentType?.MediaType ?? string.Empty);
        return new ApiResponse(response.StatusCode, raw, JsonDocument.Parse(raw).RootElement.Clone());
    }

    public Task<ApiResponse> GetAsync(string path) => SendAsync(HttpMethod.Get, path, actor: null);

    public Task<ApiResponse> PostAsync(string path, string? body, string? actor = Actor, string contentType = "application/json") =>
        SendAsync(HttpMethod.Post, path, body, actor, contentType);

    public Task<ApiResponse> PutAsync(string path, string? body, string? actor = Actor) =>
        SendAsync(HttpMethod.Put, path, body, actor);

    public Task<string> GetStringAsync(string path) => _client.GetStringAsync(path);

    public void Dispose() => _client.Dispose();
}
