using Microsoft.EntityFrameworkCore;
using DashboardBackend.Models;

namespace DashboardBackend.Data
{
    public class PLCConfigDbContext : DbContext
    {
        public PLCConfigDbContext(DbContextOptions<PLCConfigDbContext> options) : base(options)
        {
        }

        public DbSet<PLCConnection> PLCConnections { get; set; }
        public DbSet<PLCDataDefinition> PLCDataDefinitions { get; set; }
        public DbSet<SQLConnection> SQLConnections { get; set; }
        public DbSet<APISetting> APISettings { get; set; }
        public DbSet<SystemLog> SystemLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Tablo adlarını belirt
            modelBuilder.Entity<PLCConnection>().ToTable("plc_connections");
            modelBuilder.Entity<PLCDataDefinition>().ToTable("plc_data_definitions");
            modelBuilder.Entity<SQLConnection>().ToTable("sql_connections");
            modelBuilder.Entity<APISetting>().ToTable("api_settings");
            modelBuilder.Entity<SystemLog>().ToTable("system_logs");

            // PLC Data Definition -> PLC Connection relationship
            modelBuilder.Entity<PLCDataDefinition>()
                .HasOne(d => d.PLCConnection)
                .WithMany()
                .HasForeignKey(d => d.PLCConnectionId)
                .OnDelete(DeleteBehavior.Restrict);

            // APISetting unique constraint
            modelBuilder.Entity<APISetting>()
                .HasIndex(s => s.SettingKey)
                .IsUnique();
        }
    }
}
