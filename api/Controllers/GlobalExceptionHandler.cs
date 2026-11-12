using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using StargateAPI.Business.Exceptions;

namespace StargateAPI.Controllers
{
    /// <summary>The one place that turns an exception into a response body.</summary>
    public sealed class GlobalExceptionHandler : IExceptionHandler
    {
        private readonly ILogger<GlobalExceptionHandler> _logger;

        public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
        {
            _logger = logger;
        }

        public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
        {
            BaseResponse body;

            if (exception is DomainException domain)
            {
                body = ErrorResponses.From(domain);
            }
            else
            {
                var traceId = Activity.Current?.Id ?? httpContext.TraceIdentifier;
                _logger.LogError(exception, "Unhandled exception (trace id {TraceId})", traceId);
                body = ErrorResponses.Unexpected(traceId);
            }

            httpContext.Response.StatusCode = body.ResponseCode;
            await httpContext.Response.WriteAsJsonAsync(body, body.GetType(), options: null, contentType: null, cancellationToken);

            return true;
        }
    }

    public static class ApiErrorBehavior
    {
        /// <summary>Automatic model-state 400s (malformed JSON, missing body) use the contract envelope.</summary>
        public static IActionResult ModelStateResponse(ActionContext context)
        {
            var errors = new List<FieldError>();
            var bodyProblem = false;

            foreach (var (key, entry) in context.ModelState)
            {
                if (entry.ValidationState != ModelValidationState.Invalid)
                {
                    continue;
                }

                var field = FieldName(key);
                if (field is null)
                {
                    bodyProblem = true;
                }
                else if (!errors.Any(e => e.Field == field))
                {
                    // The framework's own text can name internal types, so it is never returned.
                    errors.Add(new FieldError(field, $"The {field} value is not valid."));
                }
            }

            var body = ErrorResponses.Malformed(errors, bodyProblem && errors.Count == 0);
            return new ObjectResult(body) { StatusCode = body.ResponseCode };
        }

        // "$.dutyStartDate" -> "dutyStartDate"; "$" and the parameter name mean the body as a whole.
        private static string? FieldName(string key)
        {
            var name = key.TrimStart('$', '.');
            if (name.Length == 0 || name == "request" || name.Contains('['))
            {
                return null;
            }

            return char.ToLowerInvariant(name[0]) + name[1..];
        }
    }
}
