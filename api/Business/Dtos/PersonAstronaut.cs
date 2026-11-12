using System.Linq.Expressions;
using System.Text.Json.Serialization;
using StargateAPI.Business.Data;

namespace StargateAPI.Business.Dtos
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum AstronautStatus
    {
        None,
        Active,
        Retired
    }

    public class PersonAstronaut
    {
        public int PersonId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string? CurrentRank { get; set; }

        public string? CurrentDutyTitle { get; set; }

        public DateOnly? CareerStartDate { get; set; }

        public DateOnly? CareerEndDate { get; set; }

        public AstronautStatus AstronautStatus { get; set; }

        // ToUpper keeps the case-insensitive retired-title comparison translatable to SQL.
        public static readonly Expression<Func<Person, PersonAstronaut>> Projection = person => new PersonAstronaut
        {
            PersonId = person.Id,
            Name = person.Name,
            CurrentRank = person.AstronautDetail == null ? null : person.AstronautDetail.CurrentRank,
            CurrentDutyTitle = person.AstronautDetail == null ? null : person.AstronautDetail.CurrentDutyTitle,
            CareerStartDate = person.AstronautDetail == null ? null : person.AstronautDetail.CareerStartDate,
            CareerEndDate = person.AstronautDetail == null ? null : person.AstronautDetail.CareerEndDate,
            AstronautStatus = person.AstronautDetail == null
                ? AstronautStatus.None
                : person.AstronautDetail.CurrentDutyTitle.ToUpper() == DutyTitles.RetiredDutyTitle
                    ? AstronautStatus.Retired
                    : AstronautStatus.Active,
        };
    }
}
