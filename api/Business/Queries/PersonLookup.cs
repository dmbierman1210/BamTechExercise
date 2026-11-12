using StargateAPI.Business.Data;

namespace StargateAPI.Business.Queries
{
    public static class PersonLookup
    {
        /// <summary>Names are matched trimmed and case-insensitively (the Name column is NOCASE).</summary>
        public static IQueryable<Person> WithName(this IQueryable<Person> people, string? name)
        {
            var trimmed = (name ?? string.Empty).Trim();
            return people.Where(p => p.Name == trimmed);
        }
    }
}
