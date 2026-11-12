using System.Reflection;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Data;
using StargateAPI.Controllers;

namespace StargateAPI.Tests.Controllers;

public class DutyWriteRouteTests
{
    private static AstronautDutyController BuildController(TestDatabase db, out IServiceScope scope)
    {
        var services = new ServiceCollection()
            .AddScoped(_ => db.CreateContext())
            .AddSingleton<IActorProvider>(new FixedActorProvider())
            .AddSingleton(TimeProvider.System)
            .AddMediatR(cfg => cfg.RegisterServicesFromAssemblies(typeof(StargateContext).Assembly))
            .BuildServiceProvider();

        scope = services.CreateScope();
        return new AstronautDutyController(scope.ServiceProvider.GetRequiredService<IMediator>());
    }

    [Fact]
    public async Task Post_answers_201_then_404_400_and_409()
    {
        using var db = new TestDatabase();
        using (var seed = db.CreateContext())
        {
            seed.People.Add(new Person { Name = "John Doe" });
            await seed.SaveChangesAsync();
        }

        var controller = BuildController(db, out var scope);
        using var _ = scope;

        static CreateAstronautDuty Request(string name, string date, string rank = "CPT") =>
            new() { Name = name, Rank = rank, DutyTitle = "Pilot", DutyStartDate = date };

        Assert.Equal(201, Assert.IsType<ObjectResult>(await controller.CreateAstronautDuty(Request("John Doe", "2024-03-01"))).StatusCode);
        Assert.Equal(404, Assert.IsType<ObjectResult>(await controller.CreateAstronautDuty(Request("Nobody", "2024-03-01"))).StatusCode);
        Assert.Equal(400, Assert.IsType<ObjectResult>(await controller.CreateAstronautDuty(Request("John Doe", "2024-03-02", rank: ""))).StatusCode);
        Assert.Equal(409, Assert.IsType<ObjectResult>(await controller.CreateAstronautDuty(Request("John Doe", "2024-03-01"))).StatusCode);
    }

    [Fact]
    public void Post_declares_every_status_code_for_swagger()
    {
        var declared = typeof(AstronautDutyController).GetMethod(nameof(AstronautDutyController.CreateAstronautDuty))!
            .GetCustomAttributes<ProducesResponseTypeAttribute>()
            .Select(a => a.StatusCode);

        Assert.Equal(new[] { 201, 400, 404, 409 }, declared.OrderBy(c => c));
    }
}
