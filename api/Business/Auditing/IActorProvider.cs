using StargateAPI.Controllers;

namespace StargateAPI.Business.Auditing
{
    /// <summary>Who is making the current change. Self-declared until login exists.</summary>
    public interface IActorProvider
    {
        /// <summary>The trimmed actor, or null when none was supplied.</summary>
        string? Actor { get; }
    }

    public class HeaderActorProvider : IActorProvider
    {
        public const string HeaderName = "X-Actor";

        private readonly IHttpContextAccessor _accessor;

        public HeaderActorProvider(IHttpContextAccessor accessor)
        {
            _accessor = accessor;
        }

        public string? Actor
        {
            get
            {
                var value = _accessor.HttpContext?.Request.Headers[HeaderName].ToString().Trim();
                return string.IsNullOrEmpty(value) ? null : value;
            }
        }
    }

    public static class ActorRules
    {
        public const int MaxLength = 100;

        /// <summary>Returns the actor, or adds a field error on X-Actor and returns null.</summary>
        public static string? Require(IActorProvider provider, List<FieldError> errors)
        {
            var actor = provider.Actor?.Trim();

            if (string.IsNullOrEmpty(actor))
            {
                errors.Add(new FieldError(HeaderActorProvider.HeaderName, "The X-Actor header is required."));
                return null;
            }

            if (actor.Length > MaxLength)
            {
                errors.Add(new FieldError(HeaderActorProvider.HeaderName, $"The X-Actor header must be at most {MaxLength} characters."));
                return null;
            }

            return actor;
        }
    }
}
