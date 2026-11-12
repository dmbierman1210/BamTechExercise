using Microsoft.EntityFrameworkCore;

namespace StargateAPI.Business.Data
{
    /// <summary>
    /// Idempotent sample data for local development. People are matched by name,
    /// so running it again never duplicates or overwrites anything.
    /// </summary>
    public static class DevelopmentDataSeeder
    {
        private sealed record SeedDuty(string Rank, string DutyTitle, DateOnly Start, string? Reason = null);

        private sealed record SeedPerson(string Name, SeedDuty[] Duties);

        private static readonly SeedPerson[] People =
        [
            new("Ellen Voss", []),
            new("Marcus Hale", []),
            new("Nadia Okafor",
            [
                new("1LT", "Flight Engineer", new DateOnly(2021, 4, 12)),
            ]),
            new("Jack Rourke",
            [
                new("1LT", "Pilot", new DateOnly(2014, 8, 1)),
                new("CPT", "Mission Specialist", new DateOnly(2018, 2, 15)),
                new("MAJ", "Commander", new DateOnly(2022, 9, 5)),
            ]),
            new("Samuel Whitaker",
            [
                new("CPT", "Pilot", new DateOnly(2003, 5, 19)),
                new("MAJ", "Commander", new DateOnly(2009, 1, 12)),
                new("MAJ", DutyTitles.RetiredDutyTitle, new DateOnly(2015, 7, 1)),
            ]),
            new("Priya Raman",
            [
                new("CPT", "Mission Specialist", new DateOnly(2005, 3, 1)),
                new("MAJ", DutyTitles.RetiredDutyTitle, new DateOnly(2011, 6, 15)),
                new("LTC", "Flight Engineer", new DateOnly(2016, 2, 1), "Returned to flight status after medical clearance."),
            ]),
        ];

        public static async Task SeedAsync(StargateContext context, CancellationToken cancellationToken = default)
        {
            var existing = await context.People
                .Select(p => p.Name.ToLower())
                .ToListAsync(cancellationToken);

            foreach (var seed in People.Where(s => !existing.Contains(s.Name.ToLower())))
            {
                context.People.Add(Build(seed));
            }

            await context.SaveChangesAsync(cancellationToken);
        }

        private static Person Build(SeedPerson seed)
        {
            var person = new Person { Name = seed.Name };

            if (seed.Duties.Length == 0)
            {
                return person;
            }

            for (var i = 0; i < seed.Duties.Length; i++)
            {
                var duty = seed.Duties[i];
                var next = i + 1 < seed.Duties.Length ? seed.Duties[i + 1] : null;

                person.AstronautDuties.Add(new AstronautDuty
                {
                    Rank = duty.Rank,
                    DutyTitle = duty.DutyTitle,
                    DutyStartDate = duty.Start,
                    DutyEndDate = next?.Start.AddDays(-1),
                    Reason = duty.Reason,
                });
            }

            var first = seed.Duties[0];
            var latest = seed.Duties[^1];

            person.AstronautDetail = new AstronautDetail
            {
                CurrentRank = latest.Rank,
                CurrentDutyTitle = latest.DutyTitle,
                CareerStartDate = first.Start,
                CareerEndDate = DutyTitles.IsRetired(latest.DutyTitle)
                    ? latest.Start.AddDays(-1)
                    : null,
            };

            return person;
        }
    }
}
