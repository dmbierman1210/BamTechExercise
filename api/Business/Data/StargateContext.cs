using Microsoft.EntityFrameworkCore;
using StargateAPI.Business.Auditing;
using StargateAPI.Business.Logging;

namespace StargateAPI.Business.Data
{
    public class StargateContext : DbContext
    {
        public DbSet<Person> People { get; set; }
        public DbSet<AstronautDetail> AstronautDetails { get; set; }
        public DbSet<AstronautDuty> AstronautDuties { get; set; }
        public DbSet<AuditEntry> AuditEntries { get; set; }
        public DbSet<LogEntry> LogEntries { get; set; }

        public StargateContext(DbContextOptions<StargateContext> options)
        : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(StargateContext).Assembly);

            base.OnModelCreating(modelBuilder);
        }
    }
}
