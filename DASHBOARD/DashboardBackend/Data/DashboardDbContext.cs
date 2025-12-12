using Microsoft.EntityFrameworkCore;
using DashboardBackend.Models;

namespace DashboardBackend.Data
{
    public class DashboardDbContext : DbContext
    {
        public DashboardDbContext(DbContextOptions<DashboardDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; }
        public DbSet<UserPreference> UserPreferences { get; set; }
        public DbSet<MachineList> MachineLists { get; set; }
        public DbSet<Feedback> Feedbacks { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<FeedbackReaction> FeedbackReactions { get; set; }
        public DbSet<RoleSetting> RoleSettings { get; set; }
        public DbSet<MaintenanceRequest> MaintenanceRequests { get; set; }
        public DbSet<MaintenanceAssignment> MaintenanceAssignments { get; set; }
        public DbSet<MaintenanceComment> MaintenanceComments { get; set; }
        public DbSet<MaintenancePhoto> MaintenancePhotos { get; set; }
        public DbSet<MaintenanceSchedule> MaintenanceSchedules { get; set; }
        public DbSet<DeviceToken> DeviceTokens { get; set; }
        public DbSet<MaintenanceNotificationRecipient> MaintenanceNotificationRecipients { get; set; }
        public DbSet<UserNotificationSetting> UserNotificationSettings { get; set; }
        public DbSet<MachineAnnouncement> MachineAnnouncements { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Tablolar SQL Server'da zaten var, sadece mapping
            modelBuilder.Entity<User>().ToTable("Users");
            modelBuilder.Entity<UserPreference>().ToTable("UserPreferences");
            
            // MachineList için Id'nin IDENTITY olduğunu belirt
            modelBuilder.Entity<MachineList>()
                .ToTable("MachineLists")
                .Property(m => m.Id)
                .ValueGeneratedOnAdd();
            
            modelBuilder.Entity<Feedback>().ToTable("Feedbacks");
            modelBuilder.Entity<Comment>().ToTable("Comments");
            modelBuilder.Entity<FeedbackReaction>().ToTable("FeedbackReactions");
            modelBuilder.Entity<RoleSetting>().ToTable("RoleSettings");
            modelBuilder.Entity<MaintenanceRequest>().ToTable("MaintenanceRequests");
            modelBuilder.Entity<MaintenanceAssignment>().ToTable("MaintenanceAssignments");
            modelBuilder.Entity<MaintenanceComment>().ToTable("MaintenanceComments");
            modelBuilder.Entity<MaintenancePhoto>().ToTable("MaintenancePhotos");
            modelBuilder.Entity<MaintenanceSchedule>().ToTable("MaintenanceSchedules");
            modelBuilder.Entity<DeviceToken>().ToTable("DeviceTokens");
            modelBuilder.Entity<MaintenanceNotificationRecipient>().ToTable("MaintenanceNotificationRecipients");
            modelBuilder.Entity<UserNotificationSetting>().ToTable("UserNotificationSettings");
            modelBuilder.Entity<MachineAnnouncement>().ToTable("MachineAnnouncements");
        }
    }
}

