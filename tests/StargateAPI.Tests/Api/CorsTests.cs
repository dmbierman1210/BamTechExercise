using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace StargateAPI.Tests.Api;

/// <summary>The browser UI runs on another origin, so the API allows exactly that one origin, and only in Development.</summary>
public class CorsTests
{
    private const string UiOrigin = "http://localhost:4200";

    private static HttpRequestMessage Preflight(string origin, string method, string headers)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/Person");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", method);
        request.Headers.Add("Access-Control-Request-Headers", headers);
        return request;
    }

    private static string? Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : null;

    [Theory]
    [InlineData("PUT", "content-type,x-actor")]
    [InlineData("POST", "content-type,x-actor")]
    [InlineData("GET", "x-actor")]
    public async Task Preflight_from_the_ui_origin_is_allowed_for_the_methods_and_headers_the_ui_sends(string method, string headers)
    {
        using var api = new ApiFactory();
        using var client = api.CreateDefaultClient();

        using var response = await client.SendAsync(Preflight(UiOrigin, method, headers));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(UiOrigin, Header(response, "Access-Control-Allow-Origin"));
        Assert.Contains(method, Header(response, "Access-Control-Allow-Methods")!);
        Assert.Contains("X-Actor", Header(response, "Access-Control-Allow-Headers")!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Actual_response_carries_the_allow_origin_header_and_never_a_wildcard()
    {
        using var api = new ApiFactory();
        using var client = api.CreateDefaultClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/Person");
        request.Headers.Add("Origin", UiOrigin);

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(UiOrigin, Header(response, "Access-Control-Allow-Origin"));
    }

    [Theory]
    [InlineData("http://evil.example", "PUT", "content-type,x-actor")]
    [InlineData(UiOrigin, "DELETE", "content-type")]
    [InlineData(UiOrigin, "PUT", "authorization")]
    public async Task Preflight_does_not_permit_another_origin_method_or_header(string origin, string method, string headers)
    {
        using var api = new ApiFactory();
        using var client = api.CreateDefaultClient();

        using var response = await client.SendAsync(Preflight(origin, method, headers));

        // The framework may still echo an allowed origin; the browser refuses unless the method and every header are listed.
        var permitted = Header(response, "Access-Control-Allow-Origin") == origin
            && (Header(response, "Access-Control-Allow-Methods") ?? string.Empty).Split(',').Contains(method)
            && headers.Split(',').All(h => (Header(response, "Access-Control-Allow-Headers") ?? string.Empty)
                .Split(',').Any(allowed => allowed.Trim().Equals(h, StringComparison.OrdinalIgnoreCase)));
        Assert.False(permitted);
    }

    [Fact]
    public async Task The_allowed_origin_comes_from_configuration()
    {
        using var api = new ApiFactory().WithWebHostBuilder(builder => builder.UseSetting("Cors:AllowedOrigin", "http://localhost:9999"));
        using var client = api.CreateDefaultClient();

        using var configured = await client.SendAsync(Preflight("http://localhost:9999", "PUT", "x-actor"));
        using var defaultOrigin = await client.SendAsync(Preflight(UiOrigin, "PUT", "x-actor"));

        Assert.Equal("http://localhost:9999", Header(configured, "Access-Control-Allow-Origin"));
        Assert.Null(Header(defaultOrigin, "Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Outside_development_no_cors_headers_are_sent()
    {
        using var api = new ApiFactory().WithWebHostBuilder(builder => builder.UseEnvironment("Production"));
        using var client = api.CreateDefaultClient();

        using var response = await client.SendAsync(Preflight(UiOrigin, "PUT", "x-actor"));

        Assert.Null(Header(response, "Access-Control-Allow-Origin"));
    }
}
