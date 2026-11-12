using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Data;
using StargateAPI.Business.Queries;
using StargateAPI.Business.Validation;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Commands
{
    /// <summary>The body of <c>PUT /Person/{name}</c>.</summary>
    public class RenamePersonRequest
    {
        public string? NewName { get; set; }
    }

    public class RenamePerson : IRequest<RenamePersonResult>
    {
        public required string Name { get; set; }

        public string? NewName { get; set; }
    }

    public class RenamePersonHandler : IRequestHandler<RenamePerson, RenamePersonResult>
    {
        private readonly StargateContext _context;
        private readonly IActorProvider _actorProvider;
        private readonly TimeProvider _time;

        public RenamePersonHandler(StargateContext context, IActorProvider actorProvider, TimeProvider time)
        {
            _context = context;
            _actorProvider = actorProvider;
            _time = time;
        }

        public async Task<RenamePersonResult> Handle(RenamePerson request, CancellationToken cancellationToken)
        {
            var errors = new List<FieldError>();
            var newName = PersonNameRules.Validate(request.NewName, "newName", "new name", errors);
            var actor = ActorRules.Require(_actorProvider, errors);

            if (newName is null || actor is null)
            {
                return ResponseFactory.Invalid<RenamePersonResult>(errors);
            }

            var person = await (await _context.PeopleNamedAsync(request.Name, cancellationToken)).FirstOrDefaultAsync(cancellationToken);

            if (person is null)
            {
                return ResponseFactory.PersonNotFound<RenamePersonResult>();
            }

            // The very same name is a no-op; a change of letter case only is a real rename.
            if (string.Equals(person.Name, newName, StringComparison.Ordinal))
            {
                return new RenamePersonResult();
            }

            if (await PersonNameRules.IsTakenAsync(_context, newName, person.Id, cancellationToken))
            {
                return ResponseFactory.DuplicateName<RenamePersonResult>();
            }

            var before = JsonSerializer.Serialize(new { name = person.Name });
            person.Name = newName;

            _context.AuditEntries.Add(new AuditEntry
            {
                EntityType = AuditEntityType.Person,
                EntityId = person.Id,
                Action = AuditActions.Renamed,
                Actor = actor,
                TimestampUtc = _time.GetUtcNow().UtcDateTime,
                BeforeJson = before,
                AfterJson = JsonSerializer.Serialize(new { name = newName }),
            });

            try
            {
                // One SaveChanges is one transaction: the rename and its audit entry succeed or fail together.
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                return ResponseFactory.DuplicateName<RenamePersonResult>();
            }

            return new RenamePersonResult();
        }
    }

    public class RenamePersonResult : BaseResponse
    {
    }
}
