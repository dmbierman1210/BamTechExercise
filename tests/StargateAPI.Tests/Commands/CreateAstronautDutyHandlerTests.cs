using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests.Commands;

public class CreateAstronautDutyHandlerTests
{
    private static async Task<int> AddPersonAsync(TestDatabase db, string name)
    {
        using var context = db.CreateContext();
        var person = new Person { Name = name };
        context.People.Add(person);
        await context.SaveChangesAsync();
        return person.Id;
    }

    [Fact]
    public async Task First_duty_creates_the_astronaut_detail()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        using (var context = db.CreateContext())
        {
            var result = await new CreateAstronautDutyHandler(context).Handle(
                new CreateAstronautDuty { Name = "John Doe", Rank = "1LT", DutyTitle = "Commander", DutyStartDate = new DateTime(2024, 3, 1) },
                default);
            Assert.NotNull(result.Id);
        }

        using (var context = db.CreateContext())
        {
            var detail = await context.AstronautDetails.SingleAsync(d => d.PersonId == personId);
            Assert.Equal("Commander", detail.CurrentDutyTitle);
            Assert.Equal(new DateOnly(2024, 3, 1), detail.CareerStartDate);
            Assert.Null(detail.CareerEndDate);

            var duty = await context.AstronautDuties.SingleAsync(d => d.PersonId == personId);
            Assert.Null(duty.DutyEndDate);
        }
    }

    [Fact]
    public async Task Second_duty_closes_the_previous_one_the_day_before()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        foreach (var (title, start) in new[] { ("Pilot", new DateTime(2024, 3, 1)), ("Commander", new DateTime(2024, 6, 10)) })
        {
            using var context = db.CreateContext();
            await new CreateAstronautDutyHandler(context).Handle(
                new CreateAstronautDuty { Name = "John Doe", Rank = "CPT", DutyTitle = title, DutyStartDate = start },
                default);
        }

        using (var context = db.CreateContext())
        {
            var duties = await context.AstronautDuties.Where(d => d.PersonId == personId).OrderBy(d => d.DutyStartDate).ToListAsync();
            Assert.Equal(new DateOnly(2024, 6, 9), duties[0].DutyEndDate);
            Assert.Null(duties[1].DutyEndDate);
            Assert.Equal("Commander", (await context.AstronautDetails.SingleAsync(d => d.PersonId == personId)).CurrentDutyTitle);
        }
    }

    [Fact]
    public async Task Retiring_sets_the_career_end_date_and_matches_the_title_case_insensitively()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        foreach (var (title, start) in new[] { ("Pilot", new DateTime(2024, 3, 1)), ("retired", new DateTime(2024, 9, 1)) })
        {
            using var context = db.CreateContext();
            await new CreateAstronautDutyHandler(context).Handle(
                new CreateAstronautDuty { Name = "John Doe", Rank = "CPT", DutyTitle = title, DutyStartDate = start },
                default);
        }

        using (var context = db.CreateContext())
        {
            var detail = await context.AstronautDetails.SingleAsync(d => d.PersonId == personId);
            Assert.Equal(new DateOnly(2024, 8, 31), detail.CareerEndDate);
        }
    }

    [Theory]
    [InlineData("'; DROP TABLE Person;--")]
    [InlineData("x' OR '1'='1")]
    public async Task Hostile_names_are_rejected_and_the_tables_stay_intact(string name)
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        var request = new CreateAstronautDuty { Name = name, Rank = "CPT", DutyTitle = "Pilot", DutyStartDate = new DateTime(2024, 3, 1) };

        using (var context = db.CreateContext())
        {
            await Assert.ThrowsAsync<BadHttpRequestException>(() => new CreateAstronautDutyPreProcessor(context).Process(request, default));
            await Assert.ThrowsAsync<BadHttpRequestException>(() => new CreateAstronautDutyHandler(context).Handle(request, default));
        }

        using (var context = db.CreateContext())
        {
            Assert.Equal(1, await context.People.CountAsync());
            Assert.Empty(context.AstronautDuties);
        }
    }
}
