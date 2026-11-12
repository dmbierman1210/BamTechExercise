using System.Globalization;
using System.Net;
using System.Text.Json;
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

        public string? Reason { get; set; }
    }

    /// <summary>
    /// Adds a duty to a person's timeline. All rules run on the person's whole timeline inside one transaction,
    /// so a rejected or failed call changes nothing. The timeline is always re-chained afterwards: every duty
    /// ends the day before the next one starts and only the latest has no end date.
    /// </summary>
    public class CreateAstronautDutyHandler : IRequestHandler<CreateAstronautDuty, CreateAstronautDutyResult>
    {
        public const int MaxRankLength = 100;
        public const int MaxDutyTitleLength = 100;
        public const int MaxReasonLength = 500;
        private const string DateFormat = "yyyy-MM-dd";

        private readonly StargateContext _context;
        private readonly IActorProvider _actorProvider;
        private readonly TimeProvider _time;

        public CreateAstronautDutyHandler(StargateContext context, IActorProvider actorProvider, TimeProvider time)
        {
            _context = context;
            _actorProvider = actorProvider;
            _time = time;
        }

        public async Task<CreateAstronautDutyResult> Handle(CreateAstronautDuty request, CancellationToken cancellationToken)
        {
            var errors = new List<FieldError>();
            var name = PersonNameRules.Validate(request.Name, "name", "name", errors);
            var rank = ValidateText(request.Rank, "rank", "rank", MaxRankLength, errors);
            var dutyTitle = ValidateText(request.DutyTitle, "dutyTitle", "duty title", MaxDutyTitleLength, errors);
            var startDate = ParseDate(request.DutyStartDate, errors);
            var reason = ValidateReason(request.Reason, errors);
            var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

            // Depends only on the request, so it is part of the first validation step (before 404 and 409).
            if (reason is null && startDate > today && !errors.Any(e => e.Field == "reason"))
            {
                errors.Add(new FieldError("reason", "A reason is required when the duty starts in the future."));
            }

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

                if (timeline.Any(d => d.DutyStartDate == startDate.Value))
                {
                    return Conflict("The person already has a duty starting on this date.");
                }

                var missingReason = reason is null ? HistoryReasonRequiredMessage(timeline, startDate.Value) : null;
                if (missingReason is not null)
                {
                    return ResponseFactory.Invalid<CreateAstronautDutyResult>(new List<FieldError> { new("reason", missingReason) });
                }

                var newDuty = new AstronautDuty
                {
                    PersonId = person.Id,
                    Rank = rank,
                    DutyTitle = dutyTitle,
                    DutyStartDate = startDate.Value,
                    Reason = reason,
                };
                _context.AstronautDuties.Add(newDuty);

                var ordered = timeline.Append(newDuty).OrderBy(d => d.DutyStartDate).ToList();
                var rechained = Rechain(ordered, newDuty);

                var detail = await _context.AstronautDetails.FirstOrDefaultAsync(d => d.PersonId == person.Id, cancellationToken);
                if (detail is null)
                {
                    detail = new AstronautDetail { PersonId = person.Id };
                    _context.AstronautDetails.Add(detail);
                }

                var latest = ordered[^1];
                detail.CurrentRank = latest.Rank;
                detail.CurrentDutyTitle = latest.DutyTitle;
                detail.CareerStartDate = ordered[0].DutyStartDate;
                detail.CareerEndDate = DutyTitles.IsRetired(latest.DutyTitle) ? latest.DutyStartDate.AddDays(-1) : null;

                await _context.SaveChangesAsync(cancellationToken);

                _context.AuditEntries.Add(new AuditEntry
                {
                    EntityType = AuditEntityType.Duty,
                    EntityId = newDuty.Id,
                    Action = AuditActions.Created,
                    Actor = actor,
                    Reason = reason,
                    TimestampUtc = _time.GetUtcNow().UtcDateTime,
                    BeforeJson = rechained.Count == 0
                        ? null
                        : JsonSerializer.Serialize(new { rechained = rechained.Select(r => new { dutyId = r.Duty.Id, dutyEndDate = r.Before }) }),
                    AfterJson = JsonSerializer.Serialize(new
                    {
                        duty = new
                        {
                            id = newDuty.Id,
                            personId = newDuty.PersonId,
                            rank = newDuty.Rank,
                            dutyTitle = newDuty.DutyTitle,
                            dutyStartDate = newDuty.DutyStartDate,
                            dutyEndDate = newDuty.DutyEndDate,
                            reason = newDuty.Reason,
                        },
                        rechained = rechained.Select(r => new { dutyId = r.Duty.Id, dutyEndDate = r.Duty.DutyEndDate }),
                    }),
                });
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

        /// <summary>
        /// Sets every duty's end date to the day before the next one starts (null for the latest) and returns
        /// the existing duties whose end date changed, with the value they had before.
        /// </summary>
        private static List<(AstronautDuty Duty, DateOnly? Before)> Rechain(List<AstronautDuty> ordered, AstronautDuty newDuty)
        {
            var changed = new List<(AstronautDuty, DateOnly?)>();

            for (var i = 0; i < ordered.Count; i++)
            {
                var duty = ordered[i];
                DateOnly? end = i + 1 < ordered.Count ? ordered[i + 1].DutyStartDate.AddDays(-1) : null;

                if (duty.DutyEndDate != end)
                {
                    if (!ReferenceEquals(duty, newDuty))
                    {
                        changed.Add((duty, duty.DutyEndDate));
                    }

                    duty.DutyEndDate = end;
                }
            }

            return changed;
        }

        /// <summary>The message for the missing reason when the duty history makes the new duty a correction, otherwise null.</summary>
        private static string? HistoryReasonRequiredMessage(List<AstronautDuty> timeline, DateOnly startDate)
        {
            if (timeline.Count > 0 && startDate < timeline[^1].DutyStartDate)
            {
                return "A reason is required when the duty starts before the person's latest duty.";
            }

            if (timeline.Count > 0 && DutyTitles.IsRetired(timeline[^1].DutyTitle))
            {
                return "A reason is required to add a duty after the person has retired.";
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

        /// <summary>Trimmed; blank becomes null. A reason that is not needed is still stored.</summary>
        private static string? ValidateReason(string? raw, List<FieldError> errors)
        {
            var value = raw?.Trim();

            if (string.IsNullOrEmpty(value))
            {
                return null;
            }

            if (value.Length > MaxReasonLength)
            {
                errors.Add(new FieldError("reason", $"The reason must be at most {MaxReasonLength} characters."));
                return null;
            }

            return value;
        }

        private static DateOnly? ParseDate(string? raw, List<FieldError> errors)
        {
            // The first day of the calendar cannot be a start date: the day before it does not exist.
            if (DateOnly.TryParseExact(raw?.Trim(), DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                && date > DateOnly.MinValue)
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
