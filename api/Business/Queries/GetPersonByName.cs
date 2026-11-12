using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;
using StargateAPI.Business.Dtos;
using StargateAPI.Business.Exceptions;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Queries
{
    public class GetPersonByName : IRequest<GetPersonByNameResult>
    {
        public required string Name { get; set; } = string.Empty;
    }

    public class GetPersonByNameHandler : IRequestHandler<GetPersonByName, GetPersonByNameResult>
    {
        private readonly StargateContext _context;
        public GetPersonByNameHandler(StargateContext context)
        {
            _context = context;
        }

        public async Task<GetPersonByNameResult> Handle(GetPersonByName request, CancellationToken cancellationToken)
        {
            var person = await (await _context.PeopleNamedAsync(request.Name, cancellationToken))
                .AsNoTracking()
                .Select(PersonAstronaut.Projection)
                .FirstOrDefaultAsync(cancellationToken);

            return new GetPersonByNameResult { Person = person ?? throw NotFoundException.Person() };
        }
    }

    public class GetPersonByNameResult : BaseResponse
    {
        public required PersonAstronaut Person { get; init; }
    }
}
