using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests.Commands;

/// <summary>Overlapping requests on a file database: each handler gets its own connection, as in the running API.</summary>
public class ConcurrencyTests
{
    private static async Task<CreatePersonResult> CreatePersonAsync(TestDatabase db, string name)
    {
        using var context = db.CreateContext();
        return await Outcome.Of(() => new CreatePersonHandler(context, new FixedActorProvider(), TimeProvider.System)
            .Handle(new CreatePerson { Name = name }, default));
    }

    private static async Task<CreateAstronautDutyResult> AddDutyAsync(TestDatabase db, string date)
    {
        using var context = db.CreateContext();
        return await Outcome.Of(() => new CreateAstronautDutyHandler(context, new FixedActorProvider(), new FixedTimeProvider())
            .Handle(new CreateAstronautDuty { Name = "John Doe", Rank = "CPT", DutyTitle = "Pilot", DutyStartDate = date, Reason = "Concurrency test." }, default));
    }

    [Fact]
    public async Task Overlapping_duties_for_one_person_all_succeed_and_the_timeline_stays_consistent()
    {
        using var db = new TestDatabase(fileBacked: true);
        var created = await CreatePersonAsync(db, "John Doe");
        var dates = Enumerable.Range(0, 12).Select(i => new DateOnly(2020, 1, 1).AddDays(i * 30)).OrderBy(_ => Guid.NewGuid()).ToList();

        var results = await Task.WhenAll(dates.Select(d => Task.Run(() => AddDutyAsync(db, d.ToString("yyyy-MM-dd")))));

        Assert.All(results, r => Assert.Equal(201, r.ResponseCode));

        using var context = db.CreateContext();
        var timeline = await context.AstronautDuties.Where(d => d.PersonId == created.Id).OrderBy(d => d.DutyStartDate).ToListAsync();
        Assert.Equal(dates.OrderBy(d => d), timeline.Select(d => d.DutyStartDate));
        Assert.Single(timeline, d => d.DutyEndDate is null);
        for (var i = 0; i < timeline.Count - 1; i++)
        {
            Assert.Equal(timeline[i + 1].DutyStartDate.AddDays(-1), timeline[i].DutyEndDate);
        }

        Assert.Equal(dates.Count, await context.AuditEntries.CountAsync(a => a.EntityType == StargateAPI.Business.Auditing.AuditEntityType.Duty));
    }

    [Fact]
    public async Task Overlapping_creates_of_the_same_non_ascii_name_in_different_case_make_exactly_one_person()
    {
        using var db = new TestDatabase(fileBacked: true);
        var names = Enumerable.Range(0, 6).SelectMany(_ => new[] { "Émile Zola", "émile zola" }).ToList();

        var results = await Task.WhenAll(names.Select(n => Task.Run(() => CreatePersonAsync(db, n))));

        Assert.Single(results, r => r.ResponseCode == 201);
        Assert.All(results.Where(r => r.ResponseCode != 201), r => Assert.Equal(409, r.ResponseCode));
        using var context = db.CreateContext();
        Assert.Equal(1, await context.People.CountAsync());
    }

    [Fact]
    public async Task Overlapping_creates_of_different_people_all_succeed()
    {
        using var db = new TestDatabase(fileBacked: true);

        var results = await Task.WhenAll(Enumerable.Range(0, 12).Select(i => Task.Run(() => CreatePersonAsync(db, $"Person {i}"))));

        Assert.All(results, r => Assert.Equal(201, r.ResponseCode));
        using var context = db.CreateContext();
        Assert.Equal(12, await context.People.CountAsync());
        Assert.Equal(12, await context.AuditEntries.CountAsync());
    }
}
