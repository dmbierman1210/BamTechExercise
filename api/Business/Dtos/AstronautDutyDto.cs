using System.Linq.Expressions;
using StargateAPI.Business.Data;

namespace StargateAPI.Business.Dtos
{
    public class AstronautDutyDto
    {
        public int Id { get; set; }

        public int PersonId { get; set; }

        public string Rank { get; set; } = string.Empty;

        public string DutyTitle { get; set; } = string.Empty;

        public DateOnly DutyStartDate { get; set; }

        public DateOnly? DutyEndDate { get; set; }

        // Part of the contract; there is no stored reason until the corrections story adds the column.
        public string? Reason { get; set; }

        public static readonly Expression<Func<AstronautDuty, AstronautDutyDto>> Projection = duty => new AstronautDutyDto
        {
            Id = duty.Id,
            PersonId = duty.PersonId,
            Rank = duty.Rank,
            DutyTitle = duty.DutyTitle,
            DutyStartDate = duty.DutyStartDate,
            DutyEndDate = duty.DutyEndDate,
        };
    }
}
