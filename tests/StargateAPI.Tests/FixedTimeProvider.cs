namespace StargateAPI.Tests;

public sealed class FixedTimeProvider : TimeProvider
{
    public static readonly DateTimeOffset DefaultNow = new(2025, 6, 15, 12, 0, 0, TimeSpan.Zero);

    private readonly DateTimeOffset _now;

    public FixedTimeProvider(DateTimeOffset? now = null)
    {
        _now = now ?? DefaultNow;
    }

    public override DateTimeOffset GetUtcNow() => _now;
}
