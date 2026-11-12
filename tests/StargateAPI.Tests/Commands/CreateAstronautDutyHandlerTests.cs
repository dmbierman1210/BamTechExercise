using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using StargateAPI.Business;
using StargateAPI.Business.Auditing;
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

    private static async Task<CreateAstronautDutyResult> AddAsync(
        TestDatabase db, string name, string rank, string title, string? date, string? reason = null, string? actor = FixedActorProvider.DefaultActor)
    {
        using var context = db.CreateContext();
        return await Outcome.Of(() => new CreateAstronautDutyHandler(context, new FixedActorProvider(actor), new FixedTimeProvider()).Handle(
            new CreateAstronautDuty { Name = name, Rank = rank, DutyTitle = title, DutyStartDate = date, Reason = reason },
            default));
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

    private static async Task<List<AuditEntry>> AuditAsync(TestDatabase db)
    {
        using var context = db.CreateContext();
        return await context.AuditEntries.AsNoTracking().OrderBy(a => a.Id).ToListAsync();
    }

    /// <summary>Exactly one open duty, the detail mirrors the timeline, and the chain has no gaps or overlaps.</summary>
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

    private static async Task<(int Duties, int Details, int Audit)> CountsAsync(TestDatabase db)
    {
        using var context = db.CreateContext();
        return (await context.AstronautDuties.CountAsync(), await context.AstronautDetails.CountAsync(), await context.AuditEntries.CountAsync());
    }

    // ---- the forward-in-time rules ----

    [Fact]
    public async Task First_duty_creates_the_astronaut_detail_and_answers_201()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", "1LT", "Commander", "2024-03-01");

        Assert.True(result.Success);
        Assert.Equal(201, result.ResponseCode);
        Assert.True(result.Id > 0);
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

        Assert.Equal(new DateOnly(2024, 8, 31), (await DetailAsync(db, personId))!.CareerEndDate);
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
    public async Task A_duty_on_the_same_date_as_an_existing_one_is_409_even_with_a_reason_and_changes_nothing()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await CountsAsync(db);

        var withoutReason = await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-03-01");
        var withReason = await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-03-01", reason: "Correction.");

        Assert.Equal(409, withoutReason.ResponseCode);
        Assert.Equal("The person already has a duty starting on this date.", withoutReason.Message);
        Assert.Equal(409, withReason.ResponseCode);
        Assert.Equal(before, await CountsAsync(db));
        await AssertConsistentAsync(db, personId);
    }

    // ---- the reason rule ----

    [Fact]
    public async Task A_future_start_date_needs_a_reason()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await CountsAsync(db);

        var without = await AddAsync(db, "John Doe", "MAJ", "Commander", "2025-06-16");
        var blank = await AddAsync(db, "John Doe", "MAJ", "Commander", "2025-06-16", reason: "   ");
        var with = await AddAsync(db, "John Doe", "MAJ", "Commander", "2025-06-16", reason: "Planned promotion.");

        foreach (var rejected in new[] { without, blank })
        {
            Assert.Equal(400, rejected.ResponseCode);
            var error = Assert.Single(rejected.Errors!);
            Assert.Equal("reason", error.Field);
            Assert.Equal("A reason is required when the duty starts in the future.", error.Message);
        }

        Assert.Equal(201, with.ResponseCode);
        Assert.Equal(before.Duties + 1, (await CountsAsync(db)).Duties);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Today_in_utc_is_not_the_future()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-06-15");

        Assert.Equal(201, result.ResponseCode);
    }

    [Fact]
    public async Task The_future_reason_rule_is_part_of_validation_and_comes_before_404_and_409()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-07-01", reason: "Planned.");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2025-08-01", reason: "Planned.");

        var unknownPerson = await AddAsync(db, "Nobody", "CPT", "Pilot", "2025-09-01");
        var sameDate = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-07-01");
        var afterRetirement = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-09-01");

        foreach (var result in new[] { unknownPerson, sameDate, afterRetirement })
        {
            Assert.Equal(400, result.ResponseCode);
            var error = Assert.Single(result.Errors!);
            Assert.Equal("reason", error.Field);
            Assert.Equal("A reason is required when the duty starts in the future.", error.Message);
        }
    }

    [Fact]
    public async Task Conflicts_come_before_the_rules_that_depend_on_the_duty_history()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2024-09-01");

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");

        Assert.Equal(409, result.ResponseCode);
    }

    [Fact]
    public async Task A_backdated_duty_without_a_reason_is_400_and_changes_nothing()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await CountsAsync(db);

        var result = await AddAsync(db, "John Doe", "1LT", "Trainee", "2023-01-01");

        Assert.Equal(400, result.ResponseCode);
        var error = Assert.Single(result.Errors!);
        Assert.Equal("reason", error.Field);
        Assert.Equal("A reason is required when the duty starts before the person's latest duty.", error.Message);
        Assert.Equal(before, await CountsAsync(db));
    }

    [Fact]
    public async Task A_duty_after_retirement_without_a_reason_is_400_and_changes_nothing()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2024-09-01");
        var before = await CountsAsync(db);

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2025-01-01");

        Assert.Equal(400, result.ResponseCode);
        var error = Assert.Single(result.Errors!);
        Assert.Equal("reason", error.Field);
        Assert.Equal("A reason is required to add a duty after the person has retired.", error.Message);
        Assert.Equal(before, await CountsAsync(db));
    }

    [Fact]
    public async Task A_reason_that_is_not_needed_is_stored_trimmed_and_a_blank_one_as_null()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        await AddAsync(db, "John Doe", "1LT", "Trainee", "2024-01-01", reason: "  Joined the programme.  ");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-06-01", reason: "   ");

        var timeline = await TimelineAsync(db, personId);
        Assert.Equal("Joined the programme.", timeline[0].Reason);
        Assert.Null(timeline[1].Reason);
    }

    [Fact]
    public async Task A_reason_over_500_characters_is_400()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01", reason: new string('r', 501));

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("reason", Assert.Single(result.Errors!).Field);
    }

    // ---- corrections: backdating, returning from retirement, re-chaining ----

    [Fact]
    public async Task A_backdated_duty_in_the_middle_rechains_both_neighbours()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "1LT", "Trainee", "2020-01-01");
        await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-01-01");

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2022-01-01", reason: "Start date was recorded wrongly.");

        Assert.Equal(201, result.ResponseCode);
        var timeline = await TimelineAsync(db, personId);
        Assert.Equal(new[] { "Trainee", "Pilot", "Commander" }, timeline.Select(d => d.DutyTitle));
        Assert.Equal(new DateOnly?[] { new DateOnly(2021, 12, 31), new DateOnly(2023, 12, 31), null }, timeline.Select(d => d.DutyEndDate));
        Assert.Equal("Commander", (await DetailAsync(db, personId))!.CurrentDutyTitle);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task A_backdated_duty_before_all_others_moves_the_career_start()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2022-01-01");

        await AddAsync(db, "John Doe", "1LT", "Trainee", "2019-05-01", reason: "Earlier service was not recorded.");

        var detail = await DetailAsync(db, personId);
        Assert.Equal(new DateOnly(2019, 5, 1), detail!.CareerStartDate);
        Assert.Equal("Pilot", detail.CurrentDutyTitle);
        Assert.Equal(new DateOnly(2021, 12, 31), (await TimelineAsync(db, personId))[0].DutyEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Returning_from_retirement_with_a_reason_clears_the_career_end()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2020-01-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2022-01-01");
        Assert.Equal(new DateOnly(2021, 12, 31), (await DetailAsync(db, personId))!.CareerEndDate);

        var result = await AddAsync(db, "John Doe", "MAJ", "Instructor", "2023-01-01", reason: "Recalled to service.");

        Assert.Equal(201, result.ResponseCode);
        var detail = await DetailAsync(db, personId);
        Assert.Null(detail!.CareerEndDate);
        Assert.Equal("Instructor", detail.CurrentDutyTitle);
        var timeline = await TimelineAsync(db, personId);
        Assert.Equal(new DateOnly(2022, 12, 31), timeline[1].DutyEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Fact]
    public async Task Retire_return_retire_again_ends_with_the_last_career_end()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2020-01-01");
        await AddAsync(db, "John Doe", "CPT", DutyTitles.RetiredDutyTitle, "2021-01-01");
        await AddAsync(db, "John Doe", "MAJ", "Instructor", "2022-01-01", reason: "Recalled to service.");
        await AssertConsistentAsync(db, personId);

        await AddAsync(db, "John Doe", "MAJ", DutyTitles.RetiredDutyTitle, "2024-01-01");

        Assert.Equal(new DateOnly(2023, 12, 31), (await DetailAsync(db, personId))!.CareerEndDate);
        await AssertConsistentAsync(db, personId);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(8)]
    [InlineData(9)]
    [InlineData(10)]
    [InlineData(11)]
    [InlineData(12)]
    public async Task Any_insertion_order_leaves_no_gaps_no_overlaps_and_one_open_duty(int seed)
    {
        var random = new Random(seed);
        var starts = Enumerable.Range(0, 7)
            .Select(i => new DateOnly(2000, 1, 1).AddDays(i * 400 + random.Next(0, 300)))
            .OrderBy(_ => random.Next())
            .ToList();
        var titles = new[] { "Pilot", "Commander", DutyTitles.RetiredDutyTitle, "Mission Specialist" };

        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        foreach (var start in starts)
        {
            var result = await AddAsync(db, "John Doe", "CPT", titles[random.Next(titles.Length)], start.ToString("yyyy-MM-dd"), reason: "Property test.");

            Assert.Equal(201, result.ResponseCode);
            await AssertConsistentAsync(db, personId);
        }

        Assert.Equal(starts.OrderBy(s => s), (await TimelineAsync(db, personId)).Select(d => d.DutyStartDate));
    }

    // ---- audit trail ----

    [Fact]
    public async Task Every_successful_create_writes_exactly_one_audit_entry_with_the_actor_and_reason()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");

        var first = await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01", actor: "mission.control");
        var second = await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-09-01", reason: "Promoted.", actor: "flight.director");

        var entries = await AuditAsync(db);
        Assert.Equal(2, entries.Count);

        Assert.Equal(AuditEntityType.Duty, entries[0].EntityType);
        Assert.Equal(first.Id, entries[0].EntityId);
        Assert.Equal(AuditActions.Created, entries[0].Action);
        Assert.Equal("mission.control", entries[0].Actor);
        Assert.Null(entries[0].Reason);
        Assert.Null(entries[0].BeforeJson);

        Assert.Equal(second.Id, entries[1].EntityId);
        Assert.Equal("flight.director", entries[1].Actor);
        Assert.Equal("Promoted.", entries[1].Reason);
        Assert.Equal(2, (await TimelineAsync(db, personId)).Count);
    }

    [Fact]
    public async Task Failed_creates_write_no_audit_entry()
    {
        using var db = new TestDatabase();
        await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");

        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2023-03-01");
        await AddAsync(db, "John Doe", "", "Pilot", "2024-05-01");
        await AddAsync(db, "Nobody", "CPT", "Pilot", "2024-05-01");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-05-01", actor: null);

        Assert.Single(await AuditAsync(db));
    }

    [Fact]
    public async Task The_audit_entry_lists_the_rechained_neighbours_before_and_after()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "1LT", "Trainee", "2020-01-01");
        await AddAsync(db, "John Doe", "MAJ", "Commander", "2024-01-01");
        var timelineBefore = await TimelineAsync(db, personId);
        var trainee = timelineBefore[0];

        var result = await AddAsync(db, "John Doe", "CPT", "Pilot", "2022-01-01", reason: "Correction.");

        var entry = (await AuditAsync(db)).Last();
        Assert.Equal(result.Id, entry.EntityId);

        var before = JsonDocument.Parse(entry.BeforeJson!).RootElement.GetProperty("rechained");
        var change = Assert.Single(before.EnumerateArray());
        Assert.Equal(trainee.Id, change.GetProperty("dutyId").GetInt32());
        Assert.Equal("2023-12-31", change.GetProperty("dutyEndDate").GetString());

        var after = JsonDocument.Parse(entry.AfterJson!).RootElement;
        var rechained = Assert.Single(after.GetProperty("rechained").EnumerateArray());
        Assert.Equal(trainee.Id, rechained.GetProperty("dutyId").GetInt32());
        Assert.Equal("2021-12-31", rechained.GetProperty("dutyEndDate").GetString());
        Assert.Equal("2023-12-31", after.GetProperty("duty").GetProperty("dutyEndDate").GetString());
        Assert.Equal("Correction.", after.GetProperty("duty").GetProperty("reason").GetString());
    }

    [Fact]
    public async Task A_failure_while_writing_the_audit_entry_rolls_the_whole_create_back()
    {
        using var db = new TestDatabase();
        var personId = await AddPersonAsync(db, "John Doe");
        await AddAsync(db, "John Doe", "CPT", "Pilot", "2024-03-01");
        var before = await CountsAsync(db);
        using var context = db.CreateContext(new FailOnSecondSaveInterceptor());

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new CreateAstronautDutyHandler(context, new FixedActorProvider(), new FixedTimeProvider()).Handle(
                new CreateAstronautDuty { Name = "John Doe", Rank = "MAJ", DutyTitle = "Commander", DutyStartDate = "2024-09-01" },
                default));

        Assert.Equal(before, await CountsAsync(db));
        var timeline = await TimelineAsync(db, personId);
        Assert.Single(timeline);
        Assert.Null(timeline[0].DutyEndDate);
        Assert.Equal("Pilot", (await DetailAsync(db, personId))!.CurrentDutyTitle);
    }

    // ---- input, lookup and concurrency ----

    [Fact]
    public async Task An_unknown_person_is_404()
    {
        using var db = new TestDatabase();

        var result = await AddAsync(db, "Nobody Here", "CPT", "Pilot", "2024-03-01");

        Assert.Equal(404, result.ResponseCode);
        Assert.Equal((0, 0, 0), await CountsAsync(db));
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
        Assert.Equal((0, 0, 0), await CountsAsync(db));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("2024-02-30")]
    [InlineData("2024-3-1")]
    [InlineData("0001-01-01")]
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

        var result = await Outcome.Of(() => new CreateAstronautDutyHandler(context, new FixedActorProvider(), new FixedTimeProvider()).Handle(
            new CreateAstronautDuty { Name = "John Doe", Rank = "CPT", DutyTitle = "Pilot", DutyStartDate = "2024-03-01" },
            default));

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal((0, 0, 0), await CountsAsync(db));
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

    /// <summary>The first save (duties and detail) works; the second one (the audit entry) fails.</summary>
    private sealed class FailOnSecondSaveInterceptor : SaveChangesInterceptor
    {
        private int _saves;

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (++_saves == 2)
            {
                throw new InvalidOperationException("Simulated failure while saving the audit entry.");
            }

            return ValueTask.FromResult(result);
        }
    }
}
