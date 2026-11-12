using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;
using StargateAPI.Business.Dtos;
using StargateAPI.Business.Exceptions;
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
            var person = await (await _context.PeopleNamedAsync(request.Name, cancellationToken))
                .AsNoTracking()
                .Select(PersonAstronaut.Projection)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw NotFoundException.Person();

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
        public required PersonAstronaut Person { get; init; }

        public List<AstronautDutyDto> AstronautDuties { get; init; } = new();
    }
}
