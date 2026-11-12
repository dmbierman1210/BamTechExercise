using System.Threading.Channels;

namespace StargateAPI.Business.Logging
{
    /// <summary>
    /// Hands log entries from request threads to the background writer. It is bounded and never blocks: when the
    /// writer falls behind or the store is broken, new entries are dropped rather than slowing a request.
    /// </summary>
    public sealed class DatabaseLogQueue
    {
        public const int DefaultCapacity = 5000;

        private readonly Channel<LogEntry> _channel;
        private int _pending;

        public DatabaseLogQueue(int capacity = DefaultCapacity)
        {
            _channel = Channel.CreateBounded<LogEntry>(new BoundedChannelOptions(capacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
            });
        }

        internal ChannelReader<LogEntry> Reader => _channel.Reader;

        /// <summary>Entries queued or being written and not yet stored or dropped.</summary>
        public int Pending => Volatile.Read(ref _pending);

        /// <summary>Returns false (and drops the entry) when the queue is full or closed.</summary>
        public bool TryEnqueue(LogEntry entry)
        {
            Interlocked.Increment(ref _pending);

            if (_channel.Writer.TryWrite(entry))
            {
                return true;
            }

            Interlocked.Decrement(ref _pending);
            return false;
        }

        internal void MarkHandled(int count) => Interlocked.Add(ref _pending, -count);

        internal void Complete() => _channel.Writer.TryComplete();

        /// <summary>Waits until every queued entry has been written or dropped.</summary>
        public async Task<bool> WaitUntilIdleAsync(TimeSpan timeout)
        {
            var deadline = DateTime.UtcNow + timeout;

            while (Pending > 0)
            {
                if (DateTime.UtcNow >= deadline)
                {
                    return false;
                }

                await Task.Delay(10);
            }

            return true;
        }
    }
}
