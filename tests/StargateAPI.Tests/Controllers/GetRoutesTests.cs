using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using StargateAPI.Business.Data;
using StargateAPI.Business.Queries;
using StargateAPI.Controllers;

namespace StargateAPI.Tests.Controllers;

public class GetRoutesTests
{
    private static async Task<(TestDatabase Db, ServiceProvider Services)> BuildAsync()
    {
        var db = new TestDatabase();
        using (var context = db.CreateContext())
        {
            await DevelopmentDataSeeder.SeedAsync(context);
        }

        var services = new ServiceCollection()
            .AddScoped(_ => db.CreateContext())
            .AddMediatR(cfg => cfg.RegisterServicesFromAssemblies(typeof(StargateContext).Assembly))
            .BuildServiceProvider();

        return (db, services);
    }

    [Fact]
    public async Task Duties_route_returns_the_duties_of_the_named_person()
    {
        var (db, services) = await BuildAsync();
        using var _ = db;
        using var scope = services.CreateScope();
        var controller = new AstronautDutyController(scope.ServiceProvider.GetRequiredService<IMediator>());

        var response = Assert.IsType<ObjectResult>(await controller.GetAstronautDutiesByName("Jack Rourke"));

        Assert.Equal(200, response.StatusCode);
        var body = Assert.IsType<GetAstronautDutiesByNameResult>(response.Value);
        Assert.Equal(3, body.AstronautDuties!.Count);
    }

    [Fact]
    public async Task Duties_route_returns_404_for_an_unknown_person()
    {
        var (db, services) = await BuildAsync();
        using var _ = db;
        using var scope = services.CreateScope();
        var controller = new AstronautDutyController(scope.ServiceProvider.GetRequiredService<IMediator>());

        var response = Assert.IsType<ObjectResult>(await controller.GetAstronautDutiesByName("Nobody Here"));

        Assert.Equal(404, response.StatusCode);
    }

    [Fact]
    public async Task Person_route_returns_404_for_an_unknown_person()
    {
        var (db, services) = await BuildAsync();
        using var _ = db;
        using var scope = services.CreateScope();
        var controller = new PersonController(scope.ServiceProvider.GetRequiredService<IMediator>());

        var response = Assert.IsType<ObjectResult>(await controller.GetPersonByName("Nobody Here"));

        Assert.Equal(404, response.StatusCode);
    }
}
