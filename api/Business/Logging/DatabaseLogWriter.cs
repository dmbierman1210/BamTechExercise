using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;

namespace StargateAPI.Business.Logging
{
    /// <summary>
    /// Stores queued log entries in batches. It takes the same <see cref="WriteGate"/> as the write commands, so a
    /// log write never overlaps a request's write and cannot cause "database is locked" for it. Every failure here
    /// is swallowed: losing log lines is better than failing a request.
    /// </summary>
    public sealed class DatabaseLogWriter : BackgroundService
    {
        private const int BatchSize = 100;
        private static readonly TimeSpan WriteTimeout = TimeSpan.FromSeconds(10);

        private readonly DatabaseLogQueue _queue;
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<DatabaseLogWriter> _logger;

        public DatabaseLogWriter(DatabaseLogQueue queue, IServiceScopeFactory scopes, ILogger<DatabaseLogWriter> logger)
        {
            _queue = queue;
            _scopes = scopes;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                while (await _queue.Reader.WaitToReadAsync(stoppingToken))
                {
                    await DrainAsync(CancellationToken.None);
                }
            }
            catch (OperationCanceledException)
            {
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            await base.StopAsync(cancellationToken);

            // Write what is still queued so shutdown does not lose the last entries.
            _queue.Complete();
            await DrainAsync(cancellationToken);
        }

        // A batch already taken from the queue is always written (or dropped on a failure or the timeout), even
        // while the host is stopping; only the caller's token ends the loop.
        private async Task DrainAsync(CancellationToken cancellationToken)
        {
            var batch = new List<LogEntry>(BatchSize);

            while (!cancellationToken.IsCancellationRequested)
            {
                batch.Clear();
                while (batch.Count < BatchSize && _queue.Reader.TryRead(out var entry))
                {
                    batch.Add(entry);
                }

                if (batch.Count == 0)
                {
                    return;
                }

                try
                {
                    using var timeout = new CancellationTokenSource(WriteTimeout);
                    await WriteAsync(batch, timeout.Token);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Dropped {Count} log entries because the log store could not be written.", batch.Count);
                }
                finally
                {
                    _queue.MarkHandled(batch.Count);
                }
            }
        }

        private async Task WriteAsync(List<LogEntry> batch, CancellationToken cancellationToken)
        {
            using var writeGate = await WriteGate.EnterAsync(cancellationToken);
            using var scope = _scopes.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<StargateContext>();

            context.LogEntries.AddRange(batch);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
