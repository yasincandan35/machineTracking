using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Services
{
    /// <summary>
    /// Makine bazlı dinamik veritabanı bağlantısı servisi
    /// Her makine için ayrı veritabanı (makine ismi = veritabanı ismi)
    /// </summary>
    public class MachineDatabaseService
    {
        private readonly IConfiguration _configuration;
        private readonly string _serverName;

        public MachineDatabaseService(IConfiguration configuration)
        {
            _configuration = configuration;
            _serverName = _configuration.GetConnectionString("MachineDatabaseServer") 
                ?? "DESKTOP-78GRV3R";
        }

        /// <summary>
        /// Makine ismine göre connection string oluştur
        /// </summary>
        public string GetConnectionString(string machineName)
        {
            return $"Server={_serverName};Database={machineName};Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";
        }

        /// <summary>
        /// Makine ismine göre SensorDbContext oluştur
        /// </summary>
        public SensorDbContext CreateDbContext(string machineName)
        {
            var connectionString = GetConnectionString(machineName);
            var optionsBuilder = new DbContextOptionsBuilder<SensorDbContext>();
            optionsBuilder.UseSqlServer(connectionString);
            return new SensorDbContext(optionsBuilder.Options);
        }

        /// <summary>
        /// Makine ismine göre DbContextOptions oluştur (DI için)
        /// </summary>
        public DbContextOptions<SensorDbContext> CreateDbContextOptions(string machineName)
        {
            var connectionString = GetConnectionString(machineName);
            var optionsBuilder = new DbContextOptionsBuilder<SensorDbContext>();
            optionsBuilder.UseSqlServer(connectionString);
            return optionsBuilder.Options;
        }
    }
}

