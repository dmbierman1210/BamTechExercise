namespace StargateAPI.Business.Dtos
{
    public class PersonAstronaut
    {
        public int PersonId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string CurrentRank { get; set; } = string.Empty;

        public string CurrentDutyTitle { get; set; } = string.Empty;

        public DateOnly? CareerStartDate { get; set; }

        public DateOnly? CareerEndDate { get; set; }

    }
}
