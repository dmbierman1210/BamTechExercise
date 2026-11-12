using System.Net;
using StargateAPI.Business.Exceptions;

namespace StargateAPI.Controllers
{
    /// <summary>Body of a 500: generic text plus an id that can be found in the logs.</summary>
    public class ServerErrorResponse : BaseResponse
    {
        public string TraceId { get; set; } = string.Empty;
    }

    public static class ErrorResponses
    {
        public const string UnexpectedErrorMessage = "An unexpected error occurred.";

        /// <summary>The contract body and status for a domain exception.</summary>
        public static BaseResponse From(DomainException exception) => exception switch
        {
            ValidationFailedException invalid => new BaseResponse
            {
                Success = false,
                Message = invalid.Message,
                ResponseCode = (int)HttpStatusCode.BadRequest,
                Errors = invalid.Errors.ToList(),
            },
            NotFoundException notFound => new BaseResponse
            {
                Success = false,
                Message = notFound.Message,
                ResponseCode = (int)HttpStatusCode.NotFound,
            },
            ConflictException conflict => new BaseResponse
            {
                Success = false,
                Message = conflict.Message,
                ResponseCode = (int)HttpStatusCode.Conflict,
            },
            _ => throw new ArgumentOutOfRangeException(nameof(exception), exception.GetType().Name, "Unmapped domain exception."),
        };

        public static ServerErrorResponse Unexpected(string traceId) => new()
        {
            Success = false,
            Message = UnexpectedErrorMessage,
            ResponseCode = (int)HttpStatusCode.InternalServerError,
            TraceId = traceId,
        };

        public static BaseResponse Malformed(IEnumerable<FieldError> errors, bool bodyProblem) => new()
        {
            Success = false,
            Message = bodyProblem ? "The request body is missing or is not valid." : "Validation failed.",
            ResponseCode = (int)HttpStatusCode.BadRequest,
            Errors = errors.Any() ? errors.ToList() : null,
        };

        public static BaseResponse ForStatus(int statusCode) => new()
        {
            Success = false,
            ResponseCode = statusCode,
            Message = statusCode switch
            {
                (int)HttpStatusCode.NotFound => "Not found.",
                (int)HttpStatusCode.MethodNotAllowed => "Method not allowed.",
                (int)HttpStatusCode.BadRequest => "The request is not valid.",
                _ => "The request could not be processed.",
            },
        };
    }
}
