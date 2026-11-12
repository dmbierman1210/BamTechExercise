using System.Text.Json;
using System.Text.RegularExpressions;

namespace StargateAPI.Tests.Api;

/// <summary>Swagger must describe the same routes and status codes as docs/api/openapi.yaml, and controllers must not catch.</summary>
public class ContractTests
{
    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "StargateAPI.sln")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    /// <summary>"get /Person/{name} 404" for every operation and status code the contract lists (indentation based, no YAML library needed).</summary>
    private static List<string> ContractOperations()
    {
        var operations = new List<string>();
        string? path = null;
        string? method = null;

        foreach (var line in File.ReadLines(Path.Combine(RepositoryRoot(), "docs", "api", "openapi.yaml")))
        {
            if (line.StartsWith("components:"))
            {
                break;
            }

            if (Regex.Match(line, @"^  (/\S+):\s*$") is { Success: true } p)
            {
                path = p.Groups[1].Value;
            }
            else if (Regex.Match(line, @"^    (get|post|put|delete|patch):\s*$") is { Success: true } m)
            {
                method = m.Groups[1].Value;
            }
            else if (Regex.Match(line, @"^        '(\d{3})':") is { Success: true } s)
            {
                operations.Add($"{method} {path} {s.Groups[1].Value}");
            }
        }

        return operations.OrderBy(o => o, StringComparer.Ordinal).ToList();
    }

    [Fact]
    public async Task Swagger_lists_the_same_routes_and_status_codes_as_the_contract()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();
        using var swagger = JsonDocument.Parse(await client.GetStringAsync("/swagger/v1/swagger.json"));

        var documented = new List<string>();
        foreach (var path in swagger.RootElement.GetProperty("paths").EnumerateObject())
        {
            foreach (var operation in path.Value.EnumerateObject())
            {
                foreach (var response in operation.Value.GetProperty("responses").EnumerateObject())
                {
                    documented.Add($"{operation.Name} {path.Name} {response.Name}");
                }
            }
        }

        var contract = ContractOperations();
        Assert.NotEmpty(contract);
        Assert.Equal(contract, documented.OrderBy(o => o, StringComparer.Ordinal).ToList());
    }

    [Fact]
    public void Controllers_have_no_try_or_catch_blocks()
    {
        var controllers = Directory.GetFiles(Path.Combine(RepositoryRoot(), "api", "Controllers"), "*.cs");

        Assert.NotEmpty(controllers);
        foreach (var file in controllers)
        {
            Assert.DoesNotMatch(@"(?m)^\s*(try|catch)\b", File.ReadAllText(file));
        }
    }
}
