using System.Diagnostics;
using MediatR;
using StargateAPI.Business.Exceptions;
using StargateAPI.Controllers;

namespace StargateAPI.Business.Logging
{
    /// <summary>
    /// Logs the outcome of every command and query: its name, how long it took and whether it succeeded. Only the
    /// request type's name is logged, never its payload.
    /// </summary>
    public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
        where TRequest : notnull
    {
        private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

        public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
        {
            _logger = logger;
        }

        public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
        {
            var operation = typeof(TRequest).Name;
            var started = Stopwatch.GetTimestamp();

            try
            {
                var response = await next();

                _logger.LogInformation(
                    "{Operation} succeeded in {DurationMs} ms.", operation, ElapsedMs(started));
                return response;
            }
            catch (DomainException domain)
            {
                var status = ErrorResponses.From(domain).ResponseCode;
                _logger.LogWarning(
                    "{Operation} failed with {StatusCode} in {DurationMs} ms: {Reason}",
                    operation, status, ElapsedMs(started), domain.Message);
                throw;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // The global exception handler logs the exception itself with its stack trace and trace id; this
                // entry only adds which operation failed and how long it ran.
                _logger.LogError(
                    "{Operation} failed unexpectedly with {StatusCode} in {DurationMs} ms.",
                    operation, StatusCodes.Status500InternalServerError, ElapsedMs(started));
                throw;
            }
        }

        private static long ElapsedMs(long started) => (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds;
    }
}
