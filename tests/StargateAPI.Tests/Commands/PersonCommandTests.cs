using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Data;
using StargateAPI.Business.Queries;
using StargateAPI.Controllers;

namespace StargateAPI.Tests.Commands;

public class PersonCommandTests
{
    private static Task<CreatePersonResult> CreateAsync(TestDatabase db, string? name, string? actor = FixedActorProvider.DefaultActor)
    {
        using var context = db.CreateContext();
        return new CreatePersonHandler(context, new FixedActorProvider(actor), TimeProvider.System)
            .Handle(new CreatePerson { Name = name }, default);
    }

    private static Task<RenamePersonResult> RenameAsync(TestDatabase db, string name, string? newName, string? actor = FixedActorProvider.DefaultActor)
    {
        using var context = db.CreateContext();
        return new RenamePersonHandler(context, new FixedActorProvider(actor), TimeProvider.System)
            .Handle(new RenamePerson { Name = name, NewName = newName }, default);
    }

    private static async Task<List<AuditEntry>> AuditAsync(TestDatabase db)
    {
        using var context = db.CreateContext();
        return await context.AuditEntries.AsNoTracking().OrderBy(a => a.Id).ToListAsync();
    }

    private static async Task<List<string>> NamesAsync(TestDatabase db)
    {
        using var context = db.CreateContext();
        return await context.People.AsNoTracking().OrderBy(p => p.Id).Select(p => p.Name).ToListAsync();
    }

    // ---- create ----

    [Fact]
    public async Task Create_returns_201_with_the_id_and_stores_the_trimmed_name()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "  John Doe  ");

        Assert.True(result.Success);
        Assert.Equal(201, result.ResponseCode);
        Assert.True(result.Id > 0);
        Assert.Equal(new[] { "John Doe" }, await NamesAsync(db));
    }

    [Fact]
    public async Task Create_accepts_a_name_of_exactly_200_characters()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, new string('a', 200));

        Assert.Equal(201, result.ResponseCode);
    }

    [Theory]
    [InlineData("John Doe", "John Doe")]
    [InlineData("John Doe", "JOHN DOE")]
    [InlineData("John Doe", "  john doe ")]
    [InlineData("ZOË QUINN", "Zoë Quinn")]
    public async Task Create_rejects_a_duplicate_name_whatever_its_case(string existing, string duplicate)
    {
        using var db = new TestDatabase();
        await CreateAsync(db, existing);
        var before = await AuditAsync(db);

        var result = await CreateAsync(db, duplicate);

        Assert.False(result.Success);
        Assert.Equal(409, result.ResponseCode);
        Assert.Single(await NamesAsync(db));
        Assert.Equal(before.Count, (await AuditAsync(db)).Count);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_rejects_a_missing_or_blank_name(string? name)
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, name);

        Assert.Equal(400, result.ResponseCode);
        var error = Assert.Single(result.Errors!);
        Assert.Equal("name", error.Field);
        Assert.Equal("The name is required.", error.Message);
        Assert.Empty(await NamesAsync(db));
        Assert.Empty(await AuditAsync(db));
    }

    [Fact]
    public async Task Create_rejects_a_name_longer_than_200_characters()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, new string('a', 201));

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("The name must be at most 200 characters.", Assert.Single(result.Errors!).Message);
        Assert.Empty(await NamesAsync(db));
    }

    [Fact]
    public async Task Create_rejects_control_characters()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "John\u0007Doe");

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("name", Assert.Single(result.Errors!).Field);
    }

    [Fact]
    public async Task Create_writes_exactly_one_audit_entry_with_the_actor()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "John Doe", "mission.control");

        var entry = Assert.Single(await AuditAsync(db));
        Assert.Equal(AuditEntityType.Person, entry.EntityType);
        Assert.Equal(result.Id, entry.EntityId);
        Assert.Equal(AuditActions.Created, entry.Action);
        Assert.Equal("mission.control", entry.Actor);
        Assert.Null(entry.BeforeJson);
        Assert.Equal("John Doe", JsonDocument.Parse(entry.AfterJson!).RootElement.GetProperty("name").GetString());
        Assert.InRange(entry.TimestampUtc, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddMinutes(1));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_without_an_actor_is_400_and_writes_nothing(string? actor)
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "John Doe", actor);

        Assert.Equal(400, result.ResponseCode);
        var error = Assert.Single(result.Errors!);
        Assert.Equal("X-Actor", error.Field);
        Assert.Equal("The X-Actor header is required.", error.Message);
        Assert.Empty(await NamesAsync(db));
        Assert.Empty(await AuditAsync(db));
    }

    [Fact]
    public async Task Create_with_an_actor_over_100_characters_is_400()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "John Doe", new string('x', 101));

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("X-Actor", Assert.Single(result.Errors!).Field);
    }

    [Fact]
    public async Task Create_reports_both_a_bad_name_and_a_missing_actor()
    {
        using var db = new TestDatabase();

        var result = await CreateAsync(db, "", null);

        Assert.Equal(new[] { "name", "X-Actor" }, result.Errors!.Select(e => e.Field));
    }

    [Fact]
    public async Task Create_maps_a_unique_index_race_to_409_and_writes_nothing()
    {
        using var db = new TestDatabase();
        using var context = db.CreateContext(new RivalInsertInterceptor("John Doe"));

        var result = await new CreatePersonHandler(context, new FixedActorProvider(), TimeProvider.System)
            .Handle(new CreatePerson { Name = "John Doe" }, default);

        Assert.Equal(409, result.ResponseCode);
        Assert.Empty(await NamesAsync(db));
        Assert.Empty(await AuditAsync(db));
    }

    // ---- rename ----

    [Fact]
    public async Task Rename_changes_the_name_and_keeps_the_duties_linked()
    {
        using var db = new TestDatabase();
        using (var seed = db.CreateContext())
        {
            await DevelopmentDataSeeder.SeedAsync(seed);
        }

        var result = await RenameAsync(db, "Jack Rourke", "  Jonathan Rourke ");

        Assert.True(result.Success);
        Assert.Equal(200, result.ResponseCode);

        using var context = db.CreateContext();
        var renamed = await new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Jonathan Rourke" }, default);
        Assert.Equal(3, renamed.AstronautDuties!.Count);
        Assert.Equal("Commander", renamed.Person!.CurrentDutyTitle);

        var old = await new GetAstronautDutiesByNameHandler(context)
            .Handle(new GetAstronautDutiesByName { Name = "Jack Rourke" }, default);
        Assert.Equal(404, old.ResponseCode);
    }

    [Fact]
    public async Task Rename_of_an_unknown_person_is_404()
    {
        using var db = new TestDatabase();

        var result = await RenameAsync(db, "Nobody Here", "Somebody Else");

        Assert.Equal(404, result.ResponseCode);
        Assert.Empty(await AuditAsync(db));
    }

    [Theory]
    [InlineData("Jane Doe")]
    [InlineData("JANE DOE")]
    public async Task Rename_onto_another_persons_name_is_409_and_changes_nothing(string target)
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");
        await CreateAsync(db, "Jane Doe");
        var auditBefore = (await AuditAsync(db)).Count;

        var result = await RenameAsync(db, "John Doe", target);

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal(new[] { "John Doe", "Jane Doe" }, await NamesAsync(db));
        Assert.Equal(auditBefore, (await AuditAsync(db)).Count);
    }

    [Fact]
    public async Task Rename_onto_a_non_ascii_name_that_differs_only_by_case_is_409()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "ZOË QUINN");
        await CreateAsync(db, "John Doe");

        var result = await RenameAsync(db, "John Doe", "Zoë Quinn");

        Assert.Equal(409, result.ResponseCode);
    }

    [Fact]
    public async Task Rename_to_the_same_name_is_a_no_op_that_writes_no_audit_entry()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");

        var result = await RenameAsync(db, "John Doe", " John Doe ");

        Assert.Equal(200, result.ResponseCode);
        Assert.Equal(new[] { "John Doe" }, await NamesAsync(db));
        Assert.Single(await AuditAsync(db));
    }

    [Fact]
    public async Task Rename_that_only_changes_letter_case_is_applied()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "john doe");

        var result = await RenameAsync(db, "JOHN DOE", "John Doe");

        Assert.Equal(200, result.ResponseCode);
        Assert.Equal(new[] { "John Doe" }, await NamesAsync(db));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public async Task Rename_rejects_a_blank_new_name(string? newName)
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");

        var result = await RenameAsync(db, "John Doe", newName);

        Assert.Equal(400, result.ResponseCode);
        var error = Assert.Single(result.Errors!);
        Assert.Equal("newName", error.Field);
        Assert.Equal("The new name is required.", error.Message);
    }

    [Fact]
    public async Task Rename_rejects_a_too_long_new_name_and_control_characters()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");

        Assert.Equal(400, (await RenameAsync(db, "John Doe", new string('a', 201))).ResponseCode);
        Assert.Equal(400, (await RenameAsync(db, "John Doe", "Jo\nhn")).ResponseCode);
        Assert.Equal(new[] { "John Doe" }, await NamesAsync(db));
    }

    [Fact]
    public async Task Rename_writes_exactly_one_audit_entry_that_keeps_the_old_name()
    {
        using var db = new TestDatabase();
        var created = await CreateAsync(db, "John Doe");

        await RenameAsync(db, "John Doe", "Johnathan Doe", "mission.control");

        var entries = await AuditAsync(db);
        Assert.Equal(2, entries.Count);
        var entry = entries[1];
        Assert.Equal(AuditEntityType.Person, entry.EntityType);
        Assert.Equal(created.Id, entry.EntityId);
        Assert.Equal(AuditActions.Renamed, entry.Action);
        Assert.Equal("mission.control", entry.Actor);
        Assert.Equal("John Doe", JsonDocument.Parse(entry.BeforeJson!).RootElement.GetProperty("name").GetString());
        Assert.Equal("Johnathan Doe", JsonDocument.Parse(entry.AfterJson!).RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Rename_without_an_actor_is_400_and_changes_nothing()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");

        var result = await RenameAsync(db, "John Doe", "Johnathan Doe", null);

        Assert.Equal(400, result.ResponseCode);
        Assert.Equal("X-Actor", Assert.Single(result.Errors!).Field);
        Assert.Equal(new[] { "John Doe" }, await NamesAsync(db));
        Assert.Single(await AuditAsync(db));
    }

    [Fact]
    public async Task Rename_maps_a_unique_index_race_to_409_and_writes_no_audit_entry()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");
        using var context = db.CreateContext(new RivalInsertInterceptor("Johnathan Doe"));

        var result = await new RenamePersonHandler(context, new FixedActorProvider(), TimeProvider.System)
            .Handle(new RenamePerson { Name = "John Doe", NewName = "Johnathan Doe" }, default);

        Assert.Equal(409, result.ResponseCode);
        Assert.Equal(new[] { "John Doe", "Johnathan Doe" }, await NamesAsync(db));
        Assert.Single(await AuditAsync(db));
    }

    // ---- audit trail and actor ----

    [Fact]
    public async Task Response_bodies_match_the_contract_shape()
    {
        using var db = new TestDatabase();
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        var created = JsonSerializer.Serialize(await CreateAsync(db, "John Doe"), web);
        var duplicate = JsonSerializer.Serialize(await CreateAsync(db, "john doe"), web);
        var invalid = JsonSerializer.Serialize(await CreateAsync(db, ""), web);

        Assert.Contains("\"id\":", created);
        Assert.DoesNotContain("errors", created);
        Assert.DoesNotContain("\"id\"", duplicate);
        Assert.DoesNotContain("errors", duplicate);
        Assert.DoesNotContain("\"id\"", invalid);
        Assert.Contains("\"errors\":[{\"field\":\"name\",\"message\":\"The name is required.\"}]", invalid);
    }

    [Fact]
    public async Task Audit_entries_cannot_be_updated_or_deleted()
    {
        using var db = new TestDatabase();
        await CreateAsync(db, "John Doe");

        using (var context = db.CreateContext())
        {
            var entry = await context.AuditEntries.SingleAsync();
            entry.Actor = "someone.else";
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }

        using (var context = db.CreateContext())
        {
            context.AuditEntries.Remove(await context.AuditEntries.SingleAsync());
            await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
        }

        Assert.Equal(FixedActorProvider.DefaultActor, Assert.Single(await AuditAsync(db)).Actor);
    }

    [Theory]
    [InlineData("  flight.director ", "flight.director")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void Header_actor_provider_reads_the_trimmed_header(string? header, string? expected)
    {
        var http = new DefaultHttpContext();
        if (header is not null)
        {
            http.Request.Headers[HeaderActorProvider.HeaderName] = header;
        }

        var provider = new HeaderActorProvider(new HttpContextAccessor { HttpContext = http });

        Assert.Equal(expected, provider.Actor);
    }

    /// <summary>Inserts a row with the given name just before the first save, as a concurrent request would.</summary>
    private sealed class RivalInsertInterceptor : SaveChangesInterceptor
    {
        private readonly string _name;
        private bool _done;

        public RivalInsertInterceptor(string name) => _name = name;

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (!_done)
            {
                _done = true;
                await eventData.Context!.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO Person (Name) VALUES ({_name})", cancellationToken);
            }

            return result;
        }
    }
}
