using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;

namespace StargateAPI.Business.Queries
{
    public static class PersonLookup
    {
        /// <summary>
        /// People whose name matches the given one, trimmed and ignoring case. The Name column is NOCASE, which
        /// SQLite applies to ASCII only, so a name with other characters is first resolved to the stored spelling
        /// in memory.
        /// </summary>
        public static async Task<IQueryable<Person>> PeopleNamedAsync(this StargateContext context, string? name, CancellationToken cancellationToken)
        {
            var trimmed = (name ?? string.Empty).Trim();

            if (!trimmed.All(char.IsAscii))
            {
                var stored = await context.People.AsNoTracking().Select(p => p.Name).ToListAsync(cancellationToken);
                trimmed = stored.FirstOrDefault(s => string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase)) ?? trimmed;
            }

            return context.People.Where(p => p.Name == trimmed);
        }
    }
}
