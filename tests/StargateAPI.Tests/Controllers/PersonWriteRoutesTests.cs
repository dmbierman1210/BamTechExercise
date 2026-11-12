using System.Reflection;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Data;
using StargateAPI.Controllers;

namespace StargateAPI.Tests.Controllers;

public class PersonWriteRoutesTests
{
    private static PersonController BuildController(TestDatabase db, string? actor, out IServiceScope scope)
    {
        var services = new ServiceCollection()
            .AddScoped(_ => db.CreateContext())
            .AddSingleton<IActorProvider>(new FixedActorProvider(actor))
            .AddSingleton(TimeProvider.System)
            .AddMediatR(cfg => cfg.RegisterServicesFromAssemblies(typeof(StargateContext).Assembly))
            .BuildServiceProvider();

        scope = services.CreateScope();
        return new PersonController(scope.ServiceProvider.GetRequiredService<IMediator>());
    }

    [Fact]
    public async Task Post_creates_a_person_and_answers_201()
    {
        using var db = new TestDatabase();
        var controller = BuildController(db, FixedActorProvider.DefaultActor, out var scope);
        using var _ = scope;

        var response = Assert.IsType<ObjectResult>(await controller.CreatePerson(new CreatePerson { Name = "John Doe" }));

        Assert.Equal(201, response.StatusCode);
        Assert.True(Assert.IsType<CreatePersonResult>(response.Value).Id > 0);
    }

    [Fact]
    public async Task Post_answers_400_without_an_actor_and_409_for_a_duplicate()
    {
        using var db = new TestDatabase();

        var noActor = BuildController(db, null, out var scope1);
        using (scope1)
        {
            var response = Assert.IsType<ObjectResult>(await noActor.CreatePerson(new CreatePerson { Name = "John Doe" }));
            Assert.Equal(400, response.StatusCode);
        }

        var controller = BuildController(db, FixedActorProvider.DefaultActor, out var scope2);
        using (scope2)
        {
            await controller.CreatePerson(new CreatePerson { Name = "John Doe" });
            var response = Assert.IsType<ObjectResult>(await controller.CreatePerson(new CreatePerson { Name = "john doe" }));
            Assert.Equal(409, response.StatusCode);
        }
    }

    [Fact]
    public async Task Put_renames_answers_404_for_unknown_and_409_when_taken()
    {
        using var db = new TestDatabase();
        var controller = BuildController(db, FixedActorProvider.DefaultActor, out var scope);
        using var _ = scope;
        await controller.CreatePerson(new CreatePerson { Name = "John Doe" });
        await controller.CreatePerson(new CreatePerson { Name = "Jane Doe" });

        Assert.Equal(200, Assert.IsType<ObjectResult>(await controller.RenamePerson("John Doe", new RenamePersonRequest { NewName = "Johnny Doe" })).StatusCode);
        Assert.Equal(404, Assert.IsType<ObjectResult>(await controller.RenamePerson("Nobody", new RenamePersonRequest { NewName = "Someone" })).StatusCode);
        Assert.Equal(409, Assert.IsType<ObjectResult>(await controller.RenamePerson("Johnny Doe", new RenamePersonRequest { NewName = "jane doe" })).StatusCode);
        Assert.Equal(400, Assert.IsType<ObjectResult>(await controller.RenamePerson("Johnny Doe", new RenamePersonRequest { NewName = " " })).StatusCode);
    }

    [Theory]
    [InlineData(nameof(PersonController.CreatePerson), new[] { 201, 400, 409 })]
    [InlineData(nameof(PersonController.RenamePerson), new[] { 200, 400, 404, 409 })]
    public void Write_routes_declare_every_status_code_for_swagger(string action, int[] expected)
    {
        var declared = typeof(PersonController).GetMethod(action)!
            .GetCustomAttributes<ProducesResponseTypeAttribute>()
            .Select(a => a.StatusCode);

        Assert.Equal(expected.OrderBy(c => c), declared.OrderBy(c => c));
    }
}
