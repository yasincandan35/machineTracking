using DashboardBackend.Models.MaintenanceErp;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Data
{
    public class MaintenanceErpDbContext : DbContext
    {
        public MaintenanceErpDbContext(DbContextOptions<MaintenanceErpDbContext> options) : base(options)
        {
        }

        public DbSet<MachineGroup> MachineGroups { get; set; }
        public DbSet<MaintenanceMachine> Machines { get; set; }
        public DbSet<MaintenanceOperator> Operators { get; set; }
        public DbSet<MaintenanceCategory> Categories { get; set; }
        public DbSet<MaintenanceCause> Causes { get; set; }
        public DbSet<MaintenanceGroup> Groups { get; set; }
        public DbSet<MaintenanceGroupMember> GroupMembers { get; set; }
        public DbSet<MaintenanceJob> Jobs { get; set; }
        public DbSet<MaintenanceJobPhoto> JobPhotos { get; set; }
        public DbSet<MaintenanceShift> Shifts { get; set; }
        public DbSet<MaintenanceRecord> MaintenanceRecords { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<MachineGroup>().ToTable("MachineGroups");
            modelBuilder.Entity<MaintenanceMachine>().ToTable("Machines");
            modelBuilder.Entity<MaintenanceOperator>().ToTable("Operators");
            modelBuilder.Entity<MaintenanceCategory>().ToTable("Categories");
            modelBuilder.Entity<MaintenanceCause>().ToTable("Causes");
            modelBuilder.Entity<MaintenanceGroup>().ToTable("MaintenanceGroups");
            modelBuilder.Entity<MaintenanceGroupMember>().ToTable("MaintenanceGroupMembers");
            modelBuilder.Entity<MaintenanceJob>().ToTable("MaintenanceJobs");
            modelBuilder.Entity<MaintenanceJobPhoto>().ToTable("MaintenanceJobPhotos");
            modelBuilder.Entity<MaintenanceShift>().ToTable("MaintenanceShifts");
            modelBuilder.Entity<MaintenanceRecord>().ToTable("maintenanceRecords");

            modelBuilder.Entity<MaintenanceGroupMember>()
                .HasKey(x => new { x.GroupId, x.UserId });
        }
    }
}

