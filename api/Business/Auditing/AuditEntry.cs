using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace StargateAPI.Business.Auditing
{
    public enum AuditEntityType
    {
        Person,
        Duty
    }

    public static class AuditActions
    {
        public const string Created = "Created";
        public const string Renamed = "Renamed";
    }

    /// <summary>
    /// Append-only record of a change. The database refuses updates and deletes (triggers in the migration).
    /// </summary>
    [Table("AuditEntry")]
    public class AuditEntry
    {
        public int Id { get; set; }

        public AuditEntityType EntityType { get; set; }

        public int EntityId { get; set; }

        public string Action { get; set; } = string.Empty;

        public string Actor { get; set; } = string.Empty;

        public string? Reason { get; set; }

        public DateTime TimestampUtc { get; set; }

        public string? BeforeJson { get; set; }

        public string? AfterJson { get; set; }
    }

    public class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
    {
        public void Configure(EntityTypeBuilder<AuditEntry> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.EntityType).HasConversion<string>().HasMaxLength(20);
            builder.Property(x => x.Action).IsRequired().HasMaxLength(50);
            builder.Property(x => x.Actor).IsRequired().HasMaxLength(ActorRules.MaxLength);
            builder.Property(x => x.Reason).HasMaxLength(500);
            builder.HasIndex(x => new { x.EntityType, x.EntityId });
        }
    }
}
