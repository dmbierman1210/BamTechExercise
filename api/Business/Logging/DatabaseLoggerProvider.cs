using System.Diagnostics;
using StargateAPI.Business.Auditing;

namespace StargateAPI.Business.Logging
{
    /// <summary>Writes ILogger entries at Information and above to the LogEntry table through <see cref="DatabaseLogQueue"/>.</summary>
    [ProviderAlias("Database")]
    public sealed class DatabaseLoggerProvider : ILoggerProvider
    {
        private readonly DatabaseLogQueue _queue;
        private readonly IHttpContextAccessor _accessor;
        private readonly TimeProvider _time;

        public DatabaseLoggerProvider(DatabaseLogQueue queue, IHttpContextAccessor accessor, TimeProvider time)
        {
            _queue = queue;
            _accessor = accessor;
            _time = time;
        }

        public ILogger CreateLogger(string categoryName) =>
            // The writer's own messages must never loop back into the table.
            categoryName == typeof(DatabaseLogWriter).FullName
                ? Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance
                : new DatabaseLogger(categoryName, _queue, _accessor, _time);

        public void Dispose()
        {
        }

        private sealed class DatabaseLogger : ILogger
        {
            private readonly string _category;
            private readonly DatabaseLogQueue _queue;
            private readonly IHttpContextAccessor _accessor;
            private readonly TimeProvider _time;

            public DatabaseLogger(string category, DatabaseLogQueue queue, IHttpContextAccessor accessor, TimeProvider time)
            {
                _category = category;
                _queue = queue;
                _accessor = accessor;
                _time = time;
            }

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Information && logLevel != LogLevel.None;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                if (!IsEnabled(logLevel))
                {
                    return;
                }

                // A logging problem must never reach the request that caused the entry.
                try
                {
                    var entry = new LogEntry
                    {
                        TimestampUtc = _time.GetUtcNow().UtcDateTime,
                        Level = logLevel,
                        Category = Truncate(_category, 200)!,
                        Message = Truncate(formatter(state, exception), LogEntry.MaxMessageLength) ?? string.Empty,
                        Exception = Truncate(exception?.ToString(), LogEntry.MaxExceptionLength),
                        TraceId = Truncate(Activity.Current?.Id ?? _accessor.HttpContext?.TraceIdentifier, 100),
                        Actor = Truncate(new HeaderActorProvider(_accessor).Actor, ActorRules.MaxLength),
                    };

                    if (state is IEnumerable<KeyValuePair<string, object?>> values)
                    {
                        foreach (var (key, value) in values)
                        {
                            switch (key)
                            {
                                case LogFields.Operation:
                                    entry.Operation = Truncate(value?.ToString(), 100);
                                    break;
                                case LogFields.StatusCode when value is int status:
                                    entry.StatusCode = status;
                                    break;
                                case LogFields.DurationMs when value is long ms:
                                    entry.DurationMs = ms;
                                    break;
                            }
                        }
                    }

                    _queue.TryEnqueue(entry);
                }
                catch
                {
                }
            }

            private static string? Truncate(string? value, int max) =>
                value is not null && value.Length > max ? value[..max] : value;
        }
    }

    /// <summary>The structured-log property names the provider turns into columns.</summary>
    public static class LogFields
    {
        public const string Operation = "Operation";
        public const string StatusCode = "StatusCode";
        public const string DurationMs = "DurationMs";
    }
}
