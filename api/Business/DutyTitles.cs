namespace StargateAPI.Business
{
    public static class DutyTitles
    {
        public const string RetiredDutyTitle = "RETIRED";

        public static bool IsRetired(string? dutyTitle) =>
            string.Equals(dutyTitle, RetiredDutyTitle, StringComparison.OrdinalIgnoreCase);
    }
}
