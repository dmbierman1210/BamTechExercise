using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business;
using StargateAPI.Business.Data;
using StargateAPI.Business.Dtos;
using StargateAPI.Business.Exceptions;
using StargateAPI.Business.Queries;

namespace StargateAPI.Tests.Queries;

public class QueryHandlerTests
{
    private static async Task<TestDatabase> SeededDatabaseAsync()
    {
        var db = new TestDatabase();
        using var context = db.CreateContext();
        await DevelopmentDataSeeder.SeedAsync(context);
        return db;
    }

    [Fact]
    public async Task GetPeople_returns_every_person_with_the_right_status()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetPeopleHandler(context).Handle(new GetPeople(), default);

        Assert.Equal(6, result.People.Count);
        Assert.Equal(AstronautStatus.None, result.People.Single(p => p.Name == "Ellen Voss").AstronautStatus);
        Assert.Equal(AstronautStatus.Active, result.People.Single(p => p.Name == "Jack Rourke").AstronautStatus);
        Assert.Equal(AstronautStatus.Retired, result.People.Single(p => p.Name == "Samuel Whitaker").AstronautStatus);
        Assert.Equal(AstronautStatus.Active, result.People.Single(p => p.Name == "Priya Raman").AstronautStatus);
    }

    [Fact]
    public async Task GetPersonByName_maps_a_person_with_no_duties()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetPersonByNameHandler(context).Handle(new GetPersonByName { Name = "Ellen Voss" }, default);

        var person = Assert.IsType<PersonAstronaut>(result.Person);
        Assert.Equal(AstronautStatus.None, person.AstronautStatus);
        Assert.Null(person.CurrentRank);
        Assert.Null(person.CurrentDutyTitle);
        Assert.Null(person.CareerStartDate);
        Assert.Null(person.CareerEndDate);
    }

    [Fact]
    public async Task GetPersonByName_maps_an_active_astronaut_and_ignores_name_case()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetPersonByNameHandler(context).Handle(new GetPersonByName { Name = "jack rourke" }, default);

        var person = Assert.IsType<PersonAstronaut>(result.Person);
        Assert.Equal("Jack Rourke", person.Name);
        Assert.Equal(AstronautStatus.Active, person.AstronautStatus);
        Assert.Equal("MAJ", person.CurrentRank);
        Assert.Equal("Commander", person.CurrentDutyTitle);
        Assert.Equal(new DateOnly(2014, 8, 1), person.CareerStartDate);
        Assert.Null(person.CareerEndDate);
    }

    [Fact]
    public async Task GetPersonByName_maps_a_retired_astronaut()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetPersonByNameHandler(context).Handle(new GetPersonByName { Name = "Samuel Whitaker" }, default);

        var person = Assert.IsType<PersonAstronaut>(result.Person);
        Assert.Equal(AstronautStatus.Retired, person.AstronautStatus);
        Assert.Equal(DutyTitles.RetiredDutyTitle, person.CurrentDutyTitle);
        Assert.Equal(new DateOnly(2015, 6, 30), person.CareerEndDate);
    }

    [Fact]
    public async Task GetAstronautDutiesByName_returns_the_duties_newest_first()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Jack Rourke" }, default);

        Assert.Equal("Jack Rourke", result.Person?.Name);
        Assert.Equal(
            new[] { new DateOnly(2022, 9, 5), new DateOnly(2018, 2, 15), new DateOnly(2014, 8, 1) },
            result.AstronautDuties!.Select(d => d.DutyStartDate));
    }

    [Fact]
    public async Task GetAstronautDutiesByName_for_an_unknown_name_is_404()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var thrown = await Assert.ThrowsAsync<NotFoundException>(() => new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Nobody Here" }, default));

        Assert.Equal("Person not found.", thrown.Message);
    }

    [Fact]
    public async Task GetAstronautDutiesByName_for_a_person_without_duties_is_200_with_an_empty_list()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        var result = await new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Ellen Voss" }, default);

        Assert.True(result.Success);
        Assert.Equal(200, result.ResponseCode);
        Assert.Equal(AstronautStatus.None, result.Person?.AstronautStatus);
        Assert.Empty(result.AstronautDuties!);
    }

    [Theory]
    [InlineData("  john doe ")]
    [InlineData("JOHN DOE")]
    public async Task Lookups_trim_the_name_and_ignore_case(string typed)
    {
        using var db = new TestDatabase();
        using (var context = db.CreateContext())
        {
            context.People.Add(new Person { Name = "John Doe" });
            await context.SaveChangesAsync();
        }

        using (var context = db.CreateContext())
        {
            var person = await new GetPersonByNameHandler(context).Handle(new GetPersonByName { Name = typed }, default);
            var duties = await new GetAstronautDutiesByNameHandler(context).Handle(new GetAstronautDutiesByName { Name = typed }, default);

            Assert.Equal("John Doe", person.Person?.Name);
            Assert.Equal("John Doe", duties.Person?.Name);
        }
    }

    [Fact]
    public async Task GetPersonByName_for_an_unknown_name_is_404()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        await Assert.ThrowsAsync<NotFoundException>(() => new GetPersonByNameHandler(context)
            .Handle(new GetPersonByName { Name = "Nobody Here" }, default));
    }

    [Fact]
    public async Task Duty_bodies_match_the_contract_shape()
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var found = await new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Jack Rourke" }, default);

        using var foundJson = JsonDocument.Parse(JsonSerializer.Serialize(found, options));
        var duty = foundJson.RootElement.GetProperty("astronautDuties")[0];
        Assert.Equal(
            new[] { "id", "personId", "rank", "dutyTitle", "dutyStartDate", "dutyEndDate", "reason" },
            duty.EnumerateObject().Select(p => p.Name));
        Assert.Equal("2022-09-05", duty.GetProperty("dutyStartDate").GetString());
    }

    [Theory]
    [InlineData("'; DROP TABLE Person;--")]
    [InlineData("x' OR '1'='1")]
    public async Task Hostile_names_find_nothing_and_leave_the_tables_intact(string name)
    {
        using var db = await SeededDatabaseAsync();
        using var context = db.CreateContext();

        await Assert.ThrowsAsync<NotFoundException>(() => new GetPersonByNameHandler(context)
            .Handle(new GetPersonByName { Name = name }, default));
        await Assert.ThrowsAsync<NotFoundException>(() => new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = name }, default));

        Assert.Equal(6, await context.People.CountAsync());
        Assert.True(await context.AstronautDuties.AnyAsync());
        Assert.True(await context.AstronautDetails.AnyAsync());
    }

    [Fact]
    public void AstronautStatus_is_serialized_as_text()
    {
        var json = JsonSerializer.Serialize(
            new PersonAstronaut { Name = "A", AstronautStatus = AstronautStatus.Retired },
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"astronautStatus\":\"Retired\"", json);
    }
}
