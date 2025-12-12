using Microsoft.EntityFrameworkCore;
using DashboardBackend.Models;
using System.Collections.Generic;

namespace DashboardBackend.Data
{
    public class SensorDbContext : DbContext
    {
        public SensorDbContext(DbContextOptions<SensorDbContext> options) : base(options) { }
        public DbSet<MachineList> MachineLists { get; set; }
        public DbSet<SensorLog> SensorLogs { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserPreference> UserPreferences { get; set; }
        public DbSet<Feedback> Feedbacks { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<FeedbackReaction> FeedbackReactions { get; set; }
        public DbSet<MachineAnnouncement> MachineAnnouncements { get; set; }
        
        // PLC Configuration Tables
        public DbSet<PLCConnection> PLCConnections { get; set; }
        public DbSet<PLCDataDefinition> PLCDataDefinitions { get; set; }
        public DbSet<SQLConnection> SQLConnections { get; set; }
        public DbSet<SQLQueryDefinition> SQLQueryDefinitions { get; set; }
        public DbSet<APISetting> APISettings { get; set; }
        public DbSet<SystemLog> SystemLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Tablo adlarını mevcut veritabanı yapısına göre ayarla (küçük harf, alt çizgi)
            // PLCConnection kolon mapping'leri
            modelBuilder.Entity<PLCConnection>()
                .ToTable("plc_connections");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.Id)
                .HasColumnName("id")
                .ValueGeneratedOnAdd(); // IDENTITY kolon - Id = 0 olduğunda otomatik atlar
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.Name).HasColumnName("name");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.IpAddress).HasColumnName("ip_address");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.Port).HasColumnName("port");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.ReadIntervalMs).HasColumnName("read_interval_ms");
            // DisplayName ve SourceType kolonları (migration script çalıştırıldıktan sonra mevcut olacak)
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.DisplayName).HasColumnName("display_name");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.SourceType).HasColumnName("source_type");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.IsActive).HasColumnName("is_active");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.CreatedAt).HasColumnName("created_at");
            modelBuilder.Entity<PLCConnection>()
                .Property(p => p.UpdatedAt).HasColumnName("updated_at");

            // PLCDataDefinition kolon mapping'leri
            modelBuilder.Entity<PLCDataDefinition>()
                .ToTable("plc_data_definitions");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.Id)
                .HasColumnName("id")
                .UseIdentityColumn(); // SQL Server IDENTITY kolon
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.Name).HasColumnName("name");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.Description).HasColumnName("description");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.DataType).HasColumnName("data_type");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.RegisterAddress).HasColumnName("register_address");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.RegisterCount).HasColumnName("register_count");
            // ByteOrder kolonu (migration script çalıştırıldıktan sonra mevcut olacak)
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.ByteOrder).HasColumnName("byte_order");
            // WordSwap kolonu (migration script çalıştırıldıktan sonra mevcut olacak)
            // NULL değerleri 0 (false) olarak kabul et
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.WordSwap)
                .HasColumnName("word_swap")
                .HasDefaultValue(false);
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.OperationType).HasColumnName("operation_type");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.PLCConnectionId).HasColumnName("plc_connection_id");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.IsActive).HasColumnName("is_active");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.CreatedAt).HasColumnName("created_at");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.UpdatedAt).HasColumnName("updated_at");
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.ApiEndpoint).HasColumnName("api_endpoint");
            // SaveToDatabase kolonu mevcut tabloda yok, ignore et
            modelBuilder.Entity<PLCDataDefinition>()
                .Ignore(p => p.SaveToDatabase);
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.SaveTableName).HasColumnName("SaveTableName"); // PascalCase
            modelBuilder.Entity<PLCDataDefinition>()
                .Property(p => p.SaveColumnName).HasColumnName("SaveColumnName"); // PascalCase

            modelBuilder.Entity<SQLConnection>().ToTable("sql_connections");
            modelBuilder.Entity<SQLQueryDefinition>().ToTable("sql_query_definitions");
            modelBuilder.Entity<APISetting>().ToTable("api_settings");
            modelBuilder.Entity<SystemLog>().ToTable("system_logs");

            // MachineAnnouncements (makine bazlı DB'lerde)
            modelBuilder.Entity<MachineAnnouncement>()
                .ToTable("MachineAnnouncements");
        }
    }
}

