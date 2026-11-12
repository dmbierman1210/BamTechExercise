using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;

namespace StargateAPI.Business.Data
{
    [Table("AstronautDuty")]
    public class AstronautDuty
    {
        public int Id { get; set; }

        public int PersonId { get; set; }

        public string Rank { get; set; } = string.Empty;

        public string DutyTitle { get; set; } = string.Empty;

        public DateOnly DutyStartDate { get; set; }

        public DateOnly? DutyEndDate { get; set; }

        public virtual Person Person { get; set; } = null!;
    }

    public class AstronautDutyConfiguration : IEntityTypeConfiguration<AstronautDuty>
    {
        public void Configure(EntityTypeBuilder<AstronautDuty> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedOnAdd();
            builder.Property(x => x.Rank).IsRequired().HasMaxLength(100);
            builder.Property(x => x.DutyTitle).IsRequired().HasMaxLength(100);
            builder.HasIndex(x => new { x.PersonId, x.DutyStartDate }).IsUnique();
        }
    }
}
