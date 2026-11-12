using System.Globalization;
using System.Net;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Data;
using StargateAPI.Business.Queries;
using StargateAPI.Business.Validation;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Commands
{
    public class CreateAstronautDuty : IRequest<CreateAstronautDutyResult>
    {
        // Everything is nullable (and the date a string) so that a missing or malformed value is reported
        // as a field error in the contract envelope instead of failing model binding.
        public string? Name { get; set; }

        public string? Rank { get; set; }

        public string? DutyTitle { get; set; }

        public string? DutyStartDate { get; set; }
    }

    /// <summary>
    /// Adds a duty to a person's timeline. All rules run on the person's whole timeline inside one transaction,
    /// so a rejected or failed call changes nothing.
    /// </summary>
    public class CreateAstronautDutyHandler : IRequestHandler<CreateAstronautDuty, CreateAstronautDutyResult>
    {
        public const int MaxRankLength = 100;
        public const int MaxDutyTitleLength = 100;
        private const string DateFormat = "yyyy-MM-dd";

        private readonly StargateContext _context;
        private readonly IActorProvider _actorProvider;

        public CreateAstronautDutyHandler(StargateContext context, IActorProvider actorProvider)
        {
            _context = context;
            _actorProvider = actorProvider;
        }

        public async Task<CreateAstronautDutyResult> Handle(CreateAstronautDuty request, CancellationToken cancellationToken)
        {
            var errors = new List<FieldError>();
            var name = PersonNameRules.Validate(request.Name, "name", "name", errors);
            var rank = ValidateText(request.Rank, "rank", "rank", MaxRankLength, errors);
            var dutyTitle = ValidateText(request.DutyTitle, "dutyTitle", "duty title", MaxDutyTitleLength, errors);
            var startDate = ParseDate(request.DutyStartDate, errors);
            var actor = ActorRules.Require(_actorProvider, errors);

            if (errors.Count > 0 || name is null || rank is null || dutyTitle is null || startDate is null || actor is null)
            {
                return ResponseFactory.Invalid<CreateAstronautDutyResult>(errors);
            }

            var person = await (await _context.PeopleNamedAsync(name, cancellationToken)).FirstOrDefaultAsync(cancellationToken);

            if (person is null)
            {
                return ResponseFactory.PersonNotFound<CreateAstronautDutyResult>();
            }

            try
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

                var timeline = await _context.AstronautDuties
                    .Where(d => d.PersonId == person.Id)
                    .OrderBy(d => d.DutyStartDate)
                    .ToListAsync(cancellationToken);

                var rejection = Check(timeline, startDate.Value);
                if (rejection is not null)
                {
                    return rejection;
                }

                // The previous open duty ends the day before the new one starts. Saved first so that a person
                // never has two open duties, even for a moment.
                var previous = timeline.LastOrDefault();
                if (previous is not null)
                {
                    previous.DutyEndDate = startDate.Value.AddDays(-1);
                    await _context.SaveChangesAsync(cancellationToken);
                }

                var newDuty = new AstronautDuty
                {
                    PersonId = person.Id,
                    Rank = rank,
                    DutyTitle = dutyTitle,
                    DutyStartDate = startDate.Value,
                    DutyEndDate = null,
                };
                _context.AstronautDuties.Add(newDuty);

                var detail = await _context.AstronautDetails.FirstOrDefaultAsync(d => d.PersonId == person.Id, cancellationToken);
                if (detail is null)
                {
                    detail = new AstronautDetail { PersonId = person.Id };
                    _context.AstronautDetails.Add(detail);
                }

                detail.CurrentRank = rank;
                detail.CurrentDutyTitle = dutyTitle;
                detail.CareerStartDate = timeline.Count > 0 ? timeline[0].DutyStartDate : startDate.Value;
                detail.CareerEndDate = DutyTitles.IsRetired(dutyTitle) ? startDate.Value.AddDays(-1) : null;

                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return new CreateAstronautDutyResult
                {
                    Id = newDuty.Id,
                    ResponseCode = (int)HttpStatusCode.Created,
                };
            }
            catch (DbUpdateException ex) when (DbErrors.IsUniqueViolation(ex))
            {
                // A concurrent request added a duty on the same date.
                return Conflict("The person already has a duty starting on this date.");
            }
        }

        /// <summary>The rules for the normal, forward-in-time case. Backdating and returning from retirement are not allowed yet.</summary>
        private static CreateAstronautDutyResult? Check(List<AstronautDuty> timeline, DateOnly startDate)
        {
            if (timeline.Count == 0)
            {
                return null;
            }

            if (timeline.Any(d => d.DutyStartDate == startDate))
            {
                return Conflict("The person already has a duty starting on this date.");
            }

            if (DutyTitles.IsRetired(timeline[^1].DutyTitle))
            {
                return Conflict("The person has retired; adding a duty after retirement is not supported yet.");
            }

            if (startDate < timeline[^1].DutyStartDate)
            {
                return Conflict("The duty starts before the person's latest duty; backdated duties are not supported yet.");
            }

            return null;
        }

        private static CreateAstronautDutyResult Conflict(string message) => new()
        {
            Success = false,
            Message = message,
            ResponseCode = (int)HttpStatusCode.Conflict,
        };

        private static string? ValidateText(string? raw, string field, string label, int maxLength, List<FieldError> errors)
        {
            var value = (raw ?? string.Empty).Trim();

            if (value.Length == 0)
            {
                errors.Add(new FieldError(field, $"The {label} is required."));
                return null;
            }

            if (value.Length > maxLength)
            {
                errors.Add(new FieldError(field, $"The {label} must be at most {maxLength} characters."));
                return null;
            }

            return value;
        }

        private static DateOnly? ParseDate(string? raw, List<FieldError> errors)
        {
            if (DateOnly.TryParseExact(raw?.Trim(), DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return date;
            }

            errors.Add(new FieldError("dutyStartDate", "The duty start date must be a date in the form yyyy-MM-dd."));
            return null;
        }
    }

    public class CreateAstronautDutyResult : BaseResponse
    {
        // Null on failure, so error bodies carry no id (as in the contract).
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
        public int? Id { get; set; }
    }
}
