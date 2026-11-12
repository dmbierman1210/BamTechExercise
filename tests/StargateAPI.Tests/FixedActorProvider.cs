using StargateAPI.Business.Auditing;

namespace StargateAPI.Tests;

public sealed class FixedActorProvider : IActorProvider
{
    public const string DefaultActor = "flight.director";

    public FixedActorProvider(string? actor = DefaultActor)
    {
        Actor = actor;
    }

    public string? Actor { get; }
}
