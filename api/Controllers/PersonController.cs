using MediatR;
using Microsoft.AspNetCore.Mvc;
using StargateAPI.Business.Commands;
using StargateAPI.Business.Queries;

namespace StargateAPI.Controllers
{

    [ApiController]
    [Route("[controller]")]
    public class PersonController : ControllerBase
    {
        private readonly IMediator _mediator;
        public PersonController(IMediator mediator)
        {
            _mediator = mediator;
        }

        [HttpGet("")]
        [ProducesResponseType(typeof(GetPeopleResult), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ServerErrorResponse), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetPeople()
        {
            var result = await _mediator.Send(new GetPeople());

            return this.GetResponse(result);
        }

        [HttpGet("{name}")]
        [ProducesResponseType(typeof(GetPersonByNameResult), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(ServerErrorResponse), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetPersonByName(string name)
        {
            var result = await _mediator.Send(new GetPersonByName()
            {
                Name = name
            });

            return this.GetResponse(result);
        }

        [HttpPost("")]
        [ProducesResponseType(typeof(CreatePersonResult), StatusCodes.Status201Created)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status409Conflict)]
        [ProducesResponseType(typeof(ServerErrorResponse), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> CreatePerson([FromBody] CreatePerson request)
        {
            var result = await _mediator.Send(request);
            return this.GetResponse(result);
        }

        [HttpPut("{name}")]
        [ProducesResponseType(typeof(RenamePersonResult), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(BaseResponse), StatusCodes.Status409Conflict)]
        [ProducesResponseType(typeof(ServerErrorResponse), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> RenamePerson(string name, [FromBody] RenamePersonRequest request)
        {
            var result = await _mediator.Send(new RenamePerson
            {
                Name = name,
                NewName = request.NewName
            });
            return this.GetResponse(result);
        }
    }
}
