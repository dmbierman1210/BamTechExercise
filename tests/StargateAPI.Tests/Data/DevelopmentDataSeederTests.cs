using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests.Data;

public class DevelopmentDataSeederTests
{
    [Fact]
    public async Task Seeding_twice_does_not_duplicate_data()
    {
        using var db = new TestDatabase();

        using (var context = db.CreateContext())
        {
            await DevelopmentDataSeeder.SeedAsync(context);
        }

        int people, duties, details;
        using (var context = db.CreateContext())
        {
            people = await context.People.CountAsync();
            duties = await context.AstronautDuties.CountAsync();
            details = await context.AstronautDetails.CountAsync();
            await DevelopmentDataSeeder.SeedAsync(context);
        }

        using (var context = db.CreateContext())
        {
            Assert.True(people >= 6);
            Assert.Equal(people, await context.People.CountAsync());
            Assert.Equal(duties, await context.AstronautDuties.CountAsync());
            Assert.Equal(details, await context.AstronautDetails.CountAsync());
        }
    }

    [Fact]
    public async Task Seed_data_covers_every_astronaut_state_and_follows_the_duty_rules()
    {
        using var db = new TestDatabase();
        using var context = db.CreateContext();
        await DevelopmentDataSeeder.SeedAsync(context);

        var people = await context.People
            .Include(p => p.AstronautDetail)
            .Include(p => p.AstronautDuties)
            .ToListAsync();

        Assert.Contains(people, p => p.AstronautDetail is null && p.AstronautDuties.Count == 0);
        Assert.Contains(people, p => p.AstronautDetail is { CareerEndDate: null, CurrentDutyTitle: not "RETIRED" });
        Assert.Contains(people, p => p.AstronautDetail is { CareerEndDate: not null, CurrentDutyTitle: "RETIRED" });
        Assert.Contains(people, p => p.AstronautDuties.Any(d => d.DutyTitle == "RETIRED") && p.AstronautDetail!.CurrentDutyTitle != "RETIRED");

        foreach (var person in people.Where(p => p.AstronautDuties.Count > 0))
        {
            var timeline = person.AstronautDuties.OrderBy(d => d.DutyStartDate).ToList();

            Assert.Single(timeline, d => d.DutyEndDate is null);
            Assert.Null(timeline[^1].DutyEndDate);

            for (var i = 0; i < timeline.Count - 1; i++)
            {
                Assert.Equal(timeline[i + 1].DutyStartDate.AddDays(-1), timeline[i].DutyEndDate);
            }

            Assert.Equal(timeline[0].DutyStartDate, person.AstronautDetail!.CareerStartDate);
            Assert.Equal(timeline[^1].DutyTitle, person.AstronautDetail.CurrentDutyTitle);
        }
    }
}
