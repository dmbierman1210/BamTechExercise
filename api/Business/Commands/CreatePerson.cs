using System.Net;
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Data;
using StargateAPI.Business.Exceptions;
using StargateAPI.Business.Validation;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Commands
{
    public class CreatePerson : IRequest<CreatePersonResult>
    {
        // Nullable so that a missing or blank name is reported as a field error, not a binding failure.
        public string? Name { get; set; }
    }

    public class CreatePersonHandler : IRequestHandler<CreatePerson, CreatePersonResult>
    {
        private readonly StargateContext _context;
        private readonly IActorProvider _actorProvider;
        private readonly TimeProvider _time;

        public CreatePersonHandler(StargateContext context, IActorProvider actorProvider, TimeProvider time)
        {
            _context = context;
            _actorProvider = actorProvider;
            _time = time;
        }

        public async Task<CreatePersonResult> Handle(CreatePerson request, CancellationToken cancellationToken)
        {
            var errors = new List<FieldError>();
            var name = PersonNameRules.Validate(request.Name, "name", "name", errors);
            var actor = ActorRules.Require(_actorProvider, errors);

            if (name is null || actor is null)
            {
                throw new ValidationFailedException(errors);
            }

            using var writeGate = await WriteGate.EnterAsync(cancellationToken);

            if (await PersonNameRules.IsTakenAsync(_context, name, null, cancellationToken))
            {
                throw ConflictException.DuplicateName();
            }

            try
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

                var newPerson = new Person { Name = name };
                _context.People.Add(newPerson);
                await _context.SaveChangesAsync(cancellationToken);

                _context.AuditEntries.Add(new AuditEntry
                {
                    EntityType = AuditEntityType.Person,
                    EntityId = newPerson.Id,
                    Action = AuditActions.Created,
                    Actor = actor,
                    TimestampUtc = _time.GetUtcNow().UtcDateTime,
                    AfterJson = JsonSerializer.Serialize(new { id = newPerson.Id, name = newPerson.Name }),
                });
                await _context.SaveChangesAsync(cancellationToken);

                await transaction.CommitAsync(cancellationToken);

                return new CreatePersonResult
                {
                    Id = newPerson.Id,
                    ResponseCode = (int)HttpStatusCode.Created,
                };
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex, "Person.Name"))
            {
                // A concurrent request took the name between the check and the insert.
                throw ConflictException.DuplicateName();
            }
        }
    }

    public class CreatePersonResult : BaseResponse
    {
        public int Id { get; set; }
    }
}
