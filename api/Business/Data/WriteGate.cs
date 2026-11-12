namespace StargateAPI.Business.Data
{
    /// <summary>
    /// Lets one write command at a time run its read-check-write sequence. SQLite has a single writer and cannot
    /// upgrade a read lock that another connection also holds, so two overlapping requests would otherwise fail with
    /// "database is locked", and the name checks that SQLite cannot enforce (non-ASCII case) would race.
    /// </summary>
    public static class WriteGate
    {
        private static readonly SemaphoreSlim Gate = new(1, 1);

        public static async Task<IDisposable> EnterAsync(CancellationToken cancellationToken)
        {
            await Gate.WaitAsync(cancellationToken);
            return new Releaser();
        }

        private sealed class Releaser : IDisposable
        {
            private int _released;

            public void Dispose()
            {
                if (Interlocked.Exchange(ref _released, 1) == 0)
                {
                    Gate.Release();
                }
            }
        }
    }
}
