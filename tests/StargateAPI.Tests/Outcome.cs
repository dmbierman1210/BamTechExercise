using StargateAPI.Business.Exceptions;
using StargateAPI.Controllers;

namespace StargateAPI.Tests;

public static class Outcome
{
    /// <summary>
    /// Runs a handler and, when it rejects the request with a domain exception, returns the body the API would send
    /// for it, so tests can assert on the status code and the errors of both outcomes the same way.
    /// </summary>
    public static async Task<T> Of<T>(Func<Task<T>> handle) where T : BaseResponse, new()
    {
        try
        {
            return await handle();
        }
        catch (DomainException exception)
        {
            var body = ErrorResponses.From(exception);
            return new T
            {
                Success = body.Success,
                Message = body.Message,
                ResponseCode = body.ResponseCode,
                Errors = body.Errors,
            };
        }
    }
}
