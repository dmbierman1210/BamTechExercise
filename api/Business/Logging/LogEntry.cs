using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace StargateAPI.Business.Logging
{
    /// <summary>One process log line: a request outcome or any application log at Information and above.</summary>
    [Table("LogEntry")]
    public class LogEntry
    {
        public const int MaxMessageLength = 2000;
        public const int MaxExceptionLength = 8000;

        public int Id { get; set; }

        public DateTime TimestampUtc { get; set; }

        public LogLevel Level { get; set; }

        public string Category { get; set; } = string.Empty;

        /// <summary>The command or query name, for request outcome entries.</summary>
        public string? Operation { get; set; }

        public string Message { get; set; } = string.Empty;

        /// <summary>The full exception text including the stack trace.</summary>
        public string? Exception { get; set; }

        public string? TraceId { get; set; }

        public int? StatusCode { get; set; }

        public long? DurationMs { get; set; }

        /// <summary>The self-declared X-Actor of the request, when there was one.</summary>
        public string? Actor { get; set; }
    }

    public class LogEntryConfiguration : IEntityTypeConfiguration<LogEntry>
    {
        public void Configure(EntityTypeBuilder<LogEntry> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.Level).HasConversion<string>().HasMaxLength(20);
            builder.Property(x => x.Category).IsRequired().HasMaxLength(200);
            builder.Property(x => x.Operation).HasMaxLength(100);
            builder.Property(x => x.Message).IsRequired().HasMaxLength(LogEntry.MaxMessageLength);
            builder.Property(x => x.Exception).HasMaxLength(LogEntry.MaxExceptionLength);
            builder.Property(x => x.TraceId).HasMaxLength(100);
            builder.Property(x => x.Actor).HasMaxLength(Auditing.ActorRules.MaxLength);
            builder.HasIndex(x => x.TimestampUtc);
            builder.HasIndex(x => x.Level);
        }
    }
}
