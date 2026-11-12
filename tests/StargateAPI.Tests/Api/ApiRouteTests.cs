using System.Net;
using Microsoft.Extensions.DependencyInjection;
using StargateAPI.Business.Auditing;

namespace StargateAPI.Tests.Api;

/// <summary>Every route over HTTP: a success and each documented error, always in the contract envelope.</summary>
public class ApiRouteTests
{
    // ---- GET /Person ----

    [Fact]
    public async Task Get_people_lists_the_seeded_people()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/Person");

        Assert.Equal(HttpStatusCode.OK, response.Status);
        response.AssertEnvelope(success: true);
        var people = response.Json.GetProperty("people").EnumerateArray().ToList();
        Assert.Equal(6, people.Count);
        Assert.Contains(people, p => p.GetProperty("astronautStatus").GetString() == "Retired");
    }

    // ---- GET /Person/{name} ----

    [Fact]
    public async Task Get_person_returns_the_person_ignoring_case_and_spaces()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/Person/%20jack%20rourke%20");

        Assert.Equal(HttpStatusCode.OK, response.Status);
        response.AssertEnvelope(success: true);
        Assert.Equal("Jack Rourke", response.Json.GetProperty("person").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Get_person_for_an_unknown_name_is_404_with_the_contract_body()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/Person/Nobody");

        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        response.AssertEnvelope(success: false);
        Assert.Equal("Person not found.", response.Json.GetProperty("message").GetString());
        Assert.Equal(new[] { "success", "message", "responseCode" }, response.PropertyNames);
    }

    // ---- POST /Person ----

    [Fact]
    public async Task Post_person_creates_and_answers_201_with_an_id()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "  Alan Shepard " }""");

        Assert.Equal(HttpStatusCode.Created, response.Status);
        response.AssertEnvelope(success: true);
        Assert.True(response.Json.GetProperty("id").GetInt32() > 0);
        Assert.False(response.Json.TryGetProperty("errors", out _));

        var read = await client.GetAsync("/Person/alan%20shepard");
        Assert.Equal(HttpStatusCode.OK, read.Status);
        Assert.Equal("Alan Shepard", read.Json.GetProperty("person").GetProperty("name").GetString());
    }

    [Fact]
    public async Task Post_person_with_a_blank_name_is_400_with_a_field_error()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "   " }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        response.AssertEnvelope(success: false);
        Assert.Equal(new[] { ("name", "The name is required.") }, response.Errors);
        Assert.False(response.Json.TryGetProperty("id", out _));
    }

    [Fact]
    public async Task Post_person_without_an_actor_is_400_on_the_x_actor_field()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""", actor: null);

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal(new[] { ("X-Actor", "The X-Actor header is required.") }, response.Errors);
    }

    [Fact]
    public async Task Post_person_with_a_taken_name_is_409()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "JACK ROURKE" }""");

        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        response.AssertEnvelope(success: false);
        Assert.Equal("A person with this name already exists.", response.Json.GetProperty("message").GetString());
        Assert.False(response.Json.TryGetProperty("id", out _));
    }

    // ---- PUT /Person/{name} ----

    [Fact]
    public async Task Put_person_renames_and_the_duties_follow()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PutAsync("/Person/Jack%20Rourke", """{ "newName": "Jonathan Rourke" }""");

        Assert.Equal(HttpStatusCode.OK, response.Status);
        response.AssertEnvelope(success: true);
        var duties = await client.GetAsync("/AstronautDuty/Jonathan%20Rourke");
        Assert.Equal(3, duties.Json.GetProperty("astronautDuties").GetArrayLength());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/Person/Jack%20Rourke")).Status);
    }

    [Fact]
    public async Task Put_person_with_a_blank_new_name_is_400()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PutAsync("/Person/Jack%20Rourke", """{ "newName": "" }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal(new[] { ("newName", "The new name is required.") }, response.Errors);
    }

    [Fact]
    public async Task Put_person_for_an_unknown_name_is_404()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PutAsync("/Person/Nobody", """{ "newName": "Somebody" }""");

        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        response.AssertEnvelope(success: false);
    }

    [Fact]
    public async Task Put_person_onto_a_taken_name_is_409()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PutAsync("/Person/Jack%20Rourke", """{ "newName": "nadia okafor" }""");

        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        response.AssertEnvelope(success: false);
    }

    // ---- GET /AstronautDuty/{name} ----

    [Fact]
    public async Task Get_duties_returns_the_timeline_newest_first()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/AstronautDuty/Jack%20Rourke");

        Assert.Equal(HttpStatusCode.OK, response.Status);
        response.AssertEnvelope(success: true);
        var starts = response.Json.GetProperty("astronautDuties").EnumerateArray().Select(d => d.GetProperty("dutyStartDate").GetString()).ToList();
        Assert.Equal(new[] { "2022-09-05", "2018-02-15", "2014-08-01" }, starts);
    }

    [Fact]
    public async Task Get_duties_for_an_unknown_name_is_404()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/AstronautDuty/Nobody");

        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        response.AssertEnvelope(success: false);
        Assert.False(response.Json.TryGetProperty("astronautDuties", out _));
    }

    // ---- POST /AstronautDuty ----

    private const string NewDuty = """{ "name": "Ellen Voss", "rank": "1LT", "dutyTitle": "Pilot", "dutyStartDate": "2024-03-01" }""";

    [Fact]
    public async Task Post_duty_creates_and_answers_201_with_an_id()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", NewDuty);

        Assert.Equal(HttpStatusCode.Created, response.Status);
        response.AssertEnvelope(success: true);
        Assert.True(response.Json.GetProperty("id").GetInt32() > 0);
        var person = await client.GetAsync("/Person/Ellen%20Voss");
        Assert.Equal("Active", person.Json.GetProperty("person").GetProperty("astronautStatus").GetString());
    }

    [Fact]
    public async Task Post_duty_with_missing_fields_is_400_with_a_field_error_each()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", """{ "name": "Ellen Voss", "dutyTitle": "Pilot" }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal(
            new[] { ("rank", "The rank is required."), ("dutyStartDate", "The duty start date must be a date in the form yyyy-MM-dd.") },
            response.Errors);
    }

    [Fact]
    public async Task Post_duty_that_needs_a_reason_without_one_is_400_on_reason()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", """{ "name": "Samuel Whitaker", "rank": "MAJ", "dutyTitle": "Instructor", "dutyStartDate": "2020-02-01" }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        Assert.Equal(new[] { ("reason", "A reason is required to add a duty after the person has retired.") }, response.Errors);
    }

    [Fact]
    public async Task Post_duty_for_an_unknown_person_is_404()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", NewDuty.Replace("Ellen Voss", "Nobody"));

        Assert.Equal(HttpStatusCode.NotFound, response.Status);
        response.AssertEnvelope(success: false);
    }

    [Fact]
    public async Task Post_duty_on_an_existing_start_date_is_409()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", """{ "name": "Jack Rourke", "rank": "MAJ", "dutyTitle": "Pilot", "dutyStartDate": "2022-09-05" }""");

        Assert.Equal(HttpStatusCode.Conflict, response.Status);
        Assert.Equal("The person already has a duty starting on this date.", response.Json.GetProperty("message").GetString());
    }

    // ---- malformed requests ----

    public static IEnumerable<object[]> MalformedBodies() => new[]
    {
        new object[] { "{ \"name\": \"Alan\"" },
        new object[] { "not json at all" },
        new object[] { "[1, 2, 3]" },
        new object[] { "\"just a string\"" },
        new object[] { "" },
        new object[] { "null" },
    };

    [Theory]
    [MemberData(nameof(MalformedBodies))]
    public async Task A_missing_or_malformed_body_is_400_in_the_envelope_on_every_write_route(string body)
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        foreach (var response in new[]
        {
            await client.PostAsync("/Person", body),
            await client.PutAsync("/Person/Jack%20Rourke", body),
            await client.PostAsync("/AstronautDuty", body),
        })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.Status);
            response.AssertEnvelope(success: false);
            AssertNoFrameworkProblemDetails(response);
        }
    }

    [Fact]
    public async Task A_value_of_the_wrong_type_is_a_field_error()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/AstronautDuty", """{ "name": "Ellen Voss", "rank": 5, "dutyTitle": "Pilot", "dutyStartDate": "2024-03-01" }""");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        response.AssertEnvelope(success: false);
        Assert.Equal("rank", Assert.Single(response.Errors).Field);
        AssertNoFrameworkProblemDetails(response);
    }

    [Fact]
    public async Task A_body_that_is_not_json_is_400_not_415()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", "name=Alan", contentType: "text/plain");

        Assert.Equal(HttpStatusCode.BadRequest, response.Status);
        response.AssertEnvelope(success: false);
    }

    [Fact]
    public async Task Unknown_routes_and_methods_use_the_envelope()
    {
        using var api = new ApiFactory();
        using var client = api.CreateClient();

        var unknown = await client.GetAsync("/Nothing/Here");
        var wrongMethod = await client.SendAsync(HttpMethod.Delete, "/Person");

        Assert.Equal(HttpStatusCode.NotFound, unknown.Status);
        unknown.AssertEnvelope(success: false);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, wrongMethod.Status);
        wrongMethod.AssertEnvelope(success: false);
    }

    // ---- unexpected failures ----

    private sealed class ExplodingActorProvider : IActorProvider
    {
        public string? Actor => throw new InvalidOperationException("secret connection string and internal detail");
    }

    [Fact]
    public async Task An_unexpected_failure_is_a_generic_500_with_a_trace_id_and_no_internals()
    {
        using var api = new ApiFactory(services => services.AddScoped<IActorProvider, ExplodingActorProvider>());
        using var client = api.CreateClient();

        var response = await client.PostAsync("/Person", """{ "name": "Alan Shepard" }""");

        Assert.Equal(HttpStatusCode.InternalServerError, response.Status);
        response.AssertEnvelope(success: false);
        Assert.Equal("An unexpected error occurred.", response.Json.GetProperty("message").GetString());
        Assert.False(string.IsNullOrWhiteSpace(response.Json.GetProperty("traceId").GetString()));
        Assert.DoesNotContain("secret", response.Raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("InvalidOperationException", response.Raw);
        Assert.DoesNotContain("StargateAPI", response.Raw);
        Assert.DoesNotContain(" at ", response.Raw);
    }

    private static void AssertNoFrameworkProblemDetails(ApiResponse response)
    {
        Assert.DoesNotContain("traceId", response.Raw);
        Assert.DoesNotContain("\"type\"", response.Raw);
        Assert.DoesNotContain("\"title\"", response.Raw);
        Assert.DoesNotContain("LineNumber", response.Raw);
        Assert.DoesNotContain("StargateAPI", response.Raw);
    }
}
