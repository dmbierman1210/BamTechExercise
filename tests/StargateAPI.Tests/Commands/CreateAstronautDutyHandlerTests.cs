using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
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

    private static Task<CreateAstronautDutyResult> AddAsync(
        TestDatabase db, string name, string rank, string title, string? date, string? actor = FixedActorProvider.DefaultActor)
    {
        using var context = db.CreateContext();
        return new CreateAstronautDutyHandler(context, new FixedActorProvider(actor)).Handle(
            new CreateAstronautDuty { Name = name, Rank = rank, DutyTitle = title, DutyStartDate = date },
            default);
    }

    private static async Task<List<AstronautDuty>> TimelineAsync(TestDatabase db, int personId)
    {
        using var context = db.CreateContext();
        return await context.AstronautDuties.AsNoTracking().Where(d => d.PersonId == personId).OrderBy(d => d.DutyStartDate).ToListAsync();
    }

    private static async Task<AstronautDetail?> DetailAsync(TestDatabase db, int personId)
    {
        using var context = db.CreateContext();
        return await context.AstronautDetails.AsNoTracking().SingleOrDefaultAsync(d => d.PersonId == personId);
    }

    /// <summary>Exactly one open duty, the detail mirrors the latest duty, and the chain has no gaps or overlaps.</summary>
    private static async Task AssertConsistentAsync(TestDatabase db, int personId)
    {
        var timeline = await TimelineAsync(db, personId);
        var detail = await DetailAsync(db, personId);

        Assert.Single(timeline, d => d.DutyEndDate is null);
        Assert.Null(timeline[^1].DutyEndDate);
        for (var i = 0; i < timeline.Count - 1; i++)
        {
            Assert.Equal(timeline[i + 1].DutyStartDate.AddDays(-1), timeline[i].DutyEndDate);
        }

        Assert.NotNull(detail);
        Assert.Equal(timeline[^1].Rank, detail.CurrentRank);
        Assert.Equal(timeline[^1].DutyTitle, detail.CurrentDutyTitle);
        Assert.Equal(timeline[0].DutyStartDate, detail.CareerStartDate);
        Assert.Equal(
            DutyTitles.IsRetired(timeline[^1].DutyTitle) ? timeline[^1].DutyStartDate.AddDays(-1) : (DateOnly?)null,
            detail.CareerEndDate);
    }

    private static async Task<(int Duties, int Details)> CountsAsync(TestDatabase db)
    {
        using var context = db.CreateContext();
        return (await context.AstronautDuties.CountAsync(), await context.AstronautDetails.CountAsync());
    }

    [Fact]
    public async Task First_duty_creates_the_astronaut_detail_and_answers_201()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", "1LT", "Commander", "2024-03-01");

        Assert.True(result.Success);
        Assert.Equal(201, result.ResponseCode);
        Assert.NotNull(result.Id);
        var detail = await DetailAsync(db, personId);
        Assert.Equal("Commander", detail!.CurrentDutyTitle);
        Assert.Equal(new DateOnly(2024, 3, 1), detail.CareerStartDate);
        Assert.Null(detail.CareerEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Second_duty_closes_the_previous_one_the_day_before()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-06-10");

        var timeline = await TimelineAsync(db, personId);
        Assert.Equal(new DateOnly(2024, 6, 9), timeline[0].DutyEndDate);
        Assert.Null(timeline[1].DutyEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Retiring_after_an_active_duty_sets_the_career_end_one_day_before()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2024-09-01");

        Assert.Equal(new DateOnly(2024, 8, 31), (await DetailAsync(db, personId))!.CareerEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Retiring_as_the_very_first_duty_sets_the_career_end_one_day_before_too()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2024-09-01");

        var detail = await DetailAsync(db, personId);
        Assert.Equal(new DateOnly(2024, 9, 1), detail!.CareerStartDate);
        Assert.Equal(new DateOnly(2024, 8, 31), detail.CareerEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task The_retired_title_is_matched_ignoring_case()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", "retired", "2024-09-01");
        var after = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-01-01");

        Assert.Equal(409, after.ResponseCode);
        Assert.Equal(new DateOnly(2024, 8, 31), (await DetailAsync(db, personId))!.CareerEndDate);
    }

    [Fact]
    public async Task A_future_start_date_is_accepted_like_any_later_date()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        var future = DateOnly.FromDateTime(DateTime.UtcNow).AddYears(2).ToString("yyyy-MM-dd");

        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var result = await AddAsync(db, "John Doe", "MAJ", "Commander", future);

        Assert.Equal(201, result.ResponseCode);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Two_people_may_hold_the_same_title_from_the_same_date()
    {
        using var db = new TestDatabase();
        var first = await AddPersonAsync(db, "John Doe");
        var second = await AddPersonAsync(db, "Jane Doe");

        var a = await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var b = await AddAsync(db, "Jane Doe", "CPT", "Pilot", "2024-03-01");

        Assert.Equal(201, a.ResponseCode);
        Assert.Equal(201, b.ResponseCode);
        await AssertConsistentAsync(db, first);
        await AssertConsistentAsync(db, second);
    }

    [Fact]
    public async Task A_duty_on_the_same_date_as_an_existing_one_is_409_and_changes_nothing()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await CountsAsync(db);

        var result = await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-03-01");

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal("The person already has a duty starting on this date.", result.Message);
        Assert.Null(result.Id);
        Assert.Equal(before, await CountsAsync(db));
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task An_earlier_start_date_is_409_and_changes_nothing()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await TimelineAsync(db, personId);

        var result = await AddAsync(db, "John Doe", "1LT", "Pilot", "2023-01-01");

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal(before.Select(d => (d.Id, d.DutyStartDate, d.DutyEndDate)), (await TimelineAsync(db, personId)).Select(d => (d.Id, d.DutyStartDate, d.DutyEndDate)));
    }

    [Fact]
    public async Task Any_duty_after_retirement_is_409_and_changes_nothing()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2024-09-01");
        var before = await CountsAsync(db);

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-01-01");

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal(before, await CountsAsync(db));
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task An_unknown_person_is_404()
    {
        using var db = new TestDatabase();

        var result = await AddAsync(db, "Nobody Here", "CPT", "Pilot", "2024-03-01");

        Assert.Equal(404, result.ResponseCode);
        Assert.Equal((0, 0), await CountsAsync(db));
    }

    [Fact]
    public async Task The_person_is_found_ignoring_case_and_surrounding_spaces()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "  john doe ", "  CPT ", " Pilot ", " 2024-03-01 ");

        Assert.Equal(201, result.ResponseCode);
        var duty = Assert.Single(await TimelineAsync(db, personId));
        Assert.Equal("CPT", duty.Rank);
        Assert.Equal("Pilot", duty.DutyTitle);
    }

    [Fact]
    public async Task Missing_fields_and_a_bad_date_are_400_with_a_field_error_each()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", " ", "Pilot", "01/02/2024");

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal(
            new[] { ("rank", "The rank is required."), ("dutyStartDate", "The duty start date must be a date in the form yyyy-MM-dd.") },
            result.Errors!.Select(e => (e.Field, e.Message)));
        Assert.Equal((0, 0), await CountsAsync(db));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2024-02-30")]
    [InlineData("2024-3-1")]
    public async Task A_missing_or_invalid_date_is_400(string? date)
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", date);

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("dutyStartDate", Assert.Single(result.Errors!).Field);
    }

    [Fact]
    public async Task A_rank_or_title_over_100_characters_is_400()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", new string('r', 101), new string('t', 101), "2024-03-01");

        Assert.Equal(new[] { "rank", "dutyTitle" }, result.Errors!.Select(e => e.Field));
    }

    [Fact]
    public async Task A_missing_actor_is_400_and_the_validation_runs_before_the_person_lookup()
    {
        using var db = new TestDatabase();

        var result = await AddAsync(db, "Nobody Here", "CPT", "Pilot", "2024-03-01", actor: null);

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("X-Actor", Assert.Single(result.Errors!).Field);
    }

    [Fact]
    public async Task A_concurrent_duty_on_the_same_date_is_409_and_nothing_is_kept()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        using var context = db.CreateContext(new RivalDutyInterceptor(personId, "2024-03-01"));

        var result = await new CreateAstronautDutyHandler(context, new FixedActorProvider()).Handle(
            new CreateAstronautDuty { Name = "John Doe", Rank = "CPT", DutyTitle = "Pilot", DutyStartDate = "2024-03-01" },
            default);

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal((0, 0), await CountsAsync(db));
    }

    [Fact]
    public async Task Response_bodies_match_the_contract_shape()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var created = JsonSerializer.Serialize(await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01"), web);
        var conflict = JsonSerializer.Serialize(await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01"), web);
        var invalid = JsonSerializer.Serialize(await AddAsync(db, "John Doe", "", "Pilot", "2024-03-02"), web);

        Assert.Contains("\"id\":", created);
        Assert.DoesNotContain("\"id\"", conflict);
        Assert.DoesNotContain("errors", conflict);
        Assert.DoesNotContain("\"id\"", invalid);
        Assert.Contains("\"errors\":[{\"field\":\"rank\",\"message\":\"The rank is required.\"}]", invalid);
    }

    /// <summary>Inserts a duty for the person just before the first save, as a concurrent request would.</summary>
    private sealed class RivalDutyInterceptor : SaveChangesInterceptor
    {
        private readonly int _personId;
        private readonly string _date;
        private bool _done;

        public RivalDutyInterceptor(int personId, string date)
        {
            _personId = personId;
            _date = date;
        }

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!_done)
            {
                _done = true;
                await eventData.Context!.Database.ExecuteSqlInterpolatedAsync(
                    $"INSERT INTO AstronautDuty (PersonId, Rank, DutyTitle, DutyStartDate) VALUES ({_personId}, 'CPT', 'Rival', {_date})",
                    cancellationToken);
            }

            return result;
        }
    }
}
