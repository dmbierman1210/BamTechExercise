using StargateAPI.Controllers;

namespace StargateAPI.Business.Exceptions
{
    /// <summary>A failure the caller can fix or must know about; the API maps each kind to one status code.</summary>
    public abstract class DomainException : Exception
    {
        protected DomainException(string message) : base(message)
        {
        }
    }

    /// <summary>The request is invalid (400). Carries one entry per invalid field.</summary>
    public sealed class ValidationFailedException : DomainException
    {
        public ValidationFailedException(IEnumerable<FieldError> errors) : base("Validation failed.")
        {
            Errors = errors.ToList();
        }

        public IReadOnlyList<FieldError> Errors { get; }
    }

    /// <summary>The thing the request names does not exist (404).</summary>
    public sealed class NotFoundException : DomainException
    {
        public NotFoundException(string message) : base(message)
        {
        }

        public static NotFoundException Person() => new("Person not found.");
    }

    /// <summary>The request clashes with the current state (409).</summary>
    public sealed class ConflictException : DomainException
    {
        public ConflictException(string message) : base(message)
        {
        }

        public static ConflictException DuplicateName() => new("A person with this name already exists.");

        public static ConflictException DutyStartDateTaken() => new("The person already has a duty starting on this date.");
    }
}
