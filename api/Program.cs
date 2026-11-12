using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Data;
using StargateAPI.Controllers;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = ApiErrorBehavior.ModelStateResponse;
        // Leave bare client-error results (such as 415) empty so the status-code handler below gives them the envelope.
        options.SuppressMapClientErrors = true;
    });
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<StargateContext>(options => 
    options.UseSqlite(builder.Configuration.GetConnectionString("StarbaseApiDatabase")));

builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssemblies(typeof(Program).Assembly);
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IActorProvider, HeaderActorProvider>();
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<StargateContext>();
    await context.Database.MigrateAsync();

    if (app.Environment.IsDevelopment())
    {
        await DevelopmentDataSeeder.SeedAsync(context);
    }
}

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// Responses the framework produces without a body (unknown route, wrong method, non-JSON body) use the same envelope.
app.UseStatusCodePages(async context =>
{
    var response = context.HttpContext.Response;
    var body = response.StatusCode == StatusCodes.Status415UnsupportedMediaType
        ? ErrorResponses.Malformed(Array.Empty<FieldError>(), bodyProblem: true)
        : ErrorResponses.ForStatus(response.StatusCode);

    response.StatusCode = body.ResponseCode;
    await response.WriteAsJsonAsync(body, body.GetType());
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Lets the integration tests start the API in memory.
public partial class Program;
