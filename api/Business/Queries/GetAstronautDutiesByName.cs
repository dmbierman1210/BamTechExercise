using System.Net;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;
using StargateAPI.Business.Dtos;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Queries
{
    public class GetAstronautDutiesByName : IRequest<GetAstronautDutiesByNameResult>
    {
        public string Name { get; set; } = string.Empty;
    }

    public class GetAstronautDutiesByNameHandler : IRequestHandler<GetAstronautDutiesByName, GetAstronautDutiesByNameResult>
    {
        private readonly StargateContext _context;

        public GetAstronautDutiesByNameHandler(StargateContext context)
        {
            _context = context;
        }

        public async Task<GetAstronautDutiesByNameResult> Handle(GetAstronautDutiesByName request, CancellationToken cancellationToken)
        {
            var person = await _context.People
                .AsNoTracking()
                .WithName(request.Name)
                .Select(PersonAstronaut.Projection)
                .FirstOrDefaultAsync(cancellationToken);

            if (person is null)
            {
                return new GetAstronautDutiesByNameResult
                {
                    Success = false,
                    Message = "Person not found.",
                    ResponseCode = (int)HttpStatusCode.NotFound,
                };
            }

            var duties = await _context.AstronautDuties
                .AsNoTracking()
                .Where(d => d.PersonId == person.PersonId)
                .OrderByDescending(d => d.DutyStartDate)
                .Select(AstronautDutyDto.Projection)
                .ToListAsync(cancellationToken);

            return new GetAstronautDutiesByNameResult
            {
                Person = person,
                AstronautDuties = duties,
            };
        }
    }

    public class GetAstronautDutiesByNameResult : BaseResponse
    {
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public PersonAstronaut? Person { get; set; }

        // Null only for a 404, so the property is left out of the body.
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public List<AstronautDutyDto>? AstronautDuties { get; set; }
    }
}
