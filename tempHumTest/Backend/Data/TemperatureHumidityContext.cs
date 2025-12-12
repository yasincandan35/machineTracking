using Microsoft.EntityFrameworkCore;
using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Data
{
    public class TemperatureHumidityContext : DbContext
    {
        public TemperatureHumidityContext(DbContextOptions<TemperatureHumidityContext> options) : base(options)
        {
        }

        public DbSet<Device> Devices { get; set; }
        public DbSet<SensorData> SensorData { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Device configuration
            modelBuilder.Entity<Device>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
                entity.Property(e => e.Location).HasMaxLength(100).IsRequired();
                entity.Property(e => e.DeviceId).IsRequired(); // int, HasMaxLength yok
                entity.HasIndex(e => e.DeviceId).IsUnique(); // DeviceId unique olmalı (HasPrincipalKey için)
                entity.Property(e => e.IpAddress).HasMaxLength(15).IsRequired();
                entity.Property(e => e.CreatedDate).HasDefaultValueSql("GETDATE()");
            });

            // SensorData configuration
            // SensorData.DeviceId artık Device.DeviceId'ye referans veriyor (Device.Id'ye değil)
            modelBuilder.Entity<SensorData>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Temperature).HasColumnType("decimal(5,2)");
                entity.Property(e => e.Humidity).HasColumnType("decimal(5,2)");
                entity.Property(e => e.Timestamp).HasDefaultValueSql("GETDATE()");
                
                // SensorData.DeviceId = Device.DeviceId (int) olacak şekilde ilişki
                entity.HasOne(d => d.Device)
                      .WithMany()
                      .HasForeignKey(d => d.DeviceId)
                      .HasPrincipalKey(d => d.DeviceId) // Device.DeviceId'ye referans
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
