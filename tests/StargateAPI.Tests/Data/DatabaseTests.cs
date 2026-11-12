using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Data;

namespace StargateAPI.Tests.Data;

public class DatabaseTests
{
    [Fact]
    public void Person_names_differing_only_by_case_cannot_both_be_inserted()
    {
        using var db = new TestDatabase();

        using (var context = db.CreateContext())
        {
            context.People.Add(new Person { Name = "John Doe" });
            context.SaveChanges();
        }

        using (var context = db.CreateContext())
        {
            context.People.Add(new Person { Name = "JOHN DOE" });
            Assert.Throws<DbUpdateException>(() => context.SaveChanges());
        }
    }

    [Fact]
    public void Dates_round_trip_as_date_only_values()
    {
        using var db = new TestDatabase();

        using (var context = db.CreateContext())
        {
            context.People.Add(new Person
            {
                Name = "Jane Doe",
                AstronautDetail = new AstronautDetail
                {
                    CurrentRank = "CPT",
                    CurrentDutyTitle = "Pilot",
                    CareerStartDate = new DateOnly(2020, 2, 29),
                },
            });
            context.SaveChanges();
        }

        using (var context = db.CreateContext())
        {
            var detail = context.AstronautDetails.Single();
            Assert.Equal(new DateOnly(2020, 2, 29), detail.CareerStartDate);
            Assert.Null(detail.CareerEndDate);
        }
    }
}
