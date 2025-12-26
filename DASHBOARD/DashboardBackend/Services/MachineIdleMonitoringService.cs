using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Services
{
    /// <summary>
    /// Makine boşta kalma (idle) durumunu takip eden background service
    /// İş sonu yapıldıktan sonra 10 saatten fazla süre geçtiyse ve yeni iş başlamadıysa kayıt oluşturur
    /// </summary>
    public class MachineIdleMonitoringService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MachineIdleMonitoringService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1); // Her saat kontrol et
        private readonly TimeSpan _idleThreshold = TimeSpan.FromHours(10); // 10 saatlik eşik
        private readonly TimeSpan _plcConnectionCheckWindow = TimeSpan.FromMinutes(5); // Son 5 dakikada veri varsa PLC bağlı

        public MachineIdleMonitoringService(
            IServiceProvider serviceProvider,
            ILogger<MachineIdleMonitoringService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🔄 MachineIdleMonitoringService başlatıldı.");

            // İlk başlatmada 30 saniye bekle (diğer servislerin hazır olması için)
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAllMachinesForIdleStatus();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Makine boşta kalma kontrolü sırasında hata oluştu.");
                }

                // Her saat kontrol et
                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task CheckAllMachinesForIdleStatus()
        {
            using var scope = _serviceProvider.CreateScope();
            var dashboardContext = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
            var machineDatabaseService = scope.ServiceProvider.GetRequiredService<MachineDatabaseService>();

            try
            {
                // Tüm aktif makineleri al
                var machines = await dashboardContext.MachineLists
                    .Where(m => m.IsActive)
                    .ToListAsync();

                _logger.LogInformation($"🔍 {machines.Count} makine için boşta kalma kontrolü yapılıyor...");

                foreach (var machine in machines)
                {
                    try
                    {
                        await CheckMachineIdleStatus(machine, machineDatabaseService);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"❌ {machine.MachineName} ({machine.TableName}) için kontrol sırasında hata: {ex.Message}");
                        // Bir makine hata verirse diğerlerine devam et
                        continue;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"❌ Tüm makineler için kontrol sırasında hata: {ex.Message}");
            }
        }

        private async Task CheckMachineIdleStatus(MachineList machine, MachineDatabaseService machineDatabaseService)
        {
            var tableName = machine.TableName;
            var databaseName = machine.DatabaseName;

            if (string.IsNullOrWhiteSpace(tableName) || string.IsNullOrWhiteSpace(databaseName))
            {
                _logger.LogWarning($"⚠️ {machine.MachineName} için tableName veya databaseName eksik, atlanıyor.");
                return;
            }

            var connectionString = machineDatabaseService.GetConnectionString(databaseName);
            if (string.IsNullOrEmpty(connectionString))
            {
                _logger.LogWarning($"⚠️ {machine.MachineName} için connection string bulunamadı, atlanıyor.");
                return;
            }

            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync();

            // Tabloyu oluştur (yoksa)
            await EnsureMachineIdleRecordsTableAsync(conn);

            // 1. Aktif iş var mı kontrol et
            var hasActiveJob = await HasActiveJobAsync(conn);
            if (hasActiveJob)
            {
                // Aktif iş varsa, aktif idle kaydı varsa bitir
                await CompleteActiveIdleRecordIfExistsAsync(conn);
                return;
            }

            // 2. Son iş bitiş zamanını al
            var lastJobEndInfo = await GetLastJobEndInfoAsync(conn);
            if (lastJobEndInfo == null)
            {
                // Hiç iş bitmemiş, kontrol etmeye gerek yok
                return;
            }

            var lastJobEndTime = lastJobEndInfo.Value.endTime;
            var lastJobOrderNumber = lastJobEndInfo.Value.orderNumber;
            var timeSinceLastJob = DateTime.Now - lastJobEndTime;

            // 3. 10 saatten fazla geçti mi kontrol et
            if (timeSinceLastJob < _idleThreshold)
            {
                // Henüz 10 saat geçmemiş
                return;
            }

            // 4. Zaten aktif idle kaydı var mı kontrol et
            var hasActiveIdleRecord = await HasActiveIdleRecordAsync(conn);
            if (hasActiveIdleRecord)
            {
                // Zaten kayıt var, güncelleme yapılabilir (duration güncellemesi için)
                await UpdateActiveIdleRecordDurationAsync(conn);
                return;
            }

            // 5. PLC bağlantısı ve makine durumunu kontrol et
            var (plcConnected, machineStopped) = await CheckPlcAndMachineStatusAsync(conn, tableName);

            // 6. Koşullar sağlanıyorsa idle kaydı oluştur
            // PLC bağlı olmalı (makine açık) ve makine durmuş olmalı
            if (plcConnected && machineStopped)
            {
                var idleStartTime = lastJobEndTime.Add(_idleThreshold); // İş sonu + 10 saat
                await CreateIdleRecordAsync(conn, idleStartTime, lastJobEndTime, lastJobOrderNumber, plcConnected, machineStopped);
                _logger.LogInformation($"✅ {machine.MachineName} için boşta kalma kaydı oluşturuldu. İş sonu: {lastJobEndTime:yyyy-MM-dd HH:mm:ss}, Boşta kalma başlangıcı: {idleStartTime:yyyy-MM-dd HH:mm:ss}");
            }
        }

        private async Task<bool> HasActiveJobAsync(SqlConnection conn)
        {
            var query = @"
                SELECT COUNT(*) 
                FROM JobCycleRecords 
                WHERE status = 'active'";

            await using var cmd = new SqlCommand(query, conn);
            var count = (int)await cmd.ExecuteScalarAsync();
            return count > 0;
        }

        private async Task<(DateTime endTime, string? orderNumber)?> GetLastJobEndInfoAsync(SqlConnection conn)
        {
            var query = @"
                SELECT TOP 1 
                    cycle_end_time, 
                    siparis_no
                FROM JobCycleRecords 
                WHERE status = 'completed' 
                    AND cycle_end_time IS NOT NULL
                ORDER BY cycle_end_time DESC";

            await using var cmd = new SqlCommand(query, conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var endTime = reader.GetDateTime(0);
                var orderNumber = reader.IsDBNull(1) ? null : reader.GetString(1);
                return (endTime, orderNumber);
            }

            return null;
        }

        private async Task<bool> HasActiveIdleRecordAsync(SqlConnection conn)
        {
            var query = @"
                SELECT COUNT(*) 
                FROM MachineIdleRecords 
                WHERE status = 'active'";

            await using var cmd = new SqlCommand(query, conn);
            var count = (int)await cmd.ExecuteScalarAsync();
            return count > 0;
        }

        private async Task<(bool plcConnected, bool machineStopped)> CheckPlcAndMachineStatusAsync(SqlConnection conn, string tableName)
        {
            // Tracking tablosundan son kayıt zamanını kontrol et
            // Son 5 dakikada kayıt varsa PLC bağlı demektir
            var query = $@"
                SELECT TOP 1 
                    KayitZamani,
                    machineStopped
                FROM [{tableName}]
                ORDER BY KayitZamani DESC";

            await using var cmd = new SqlCommand(query, conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                var lastRecordTime = reader.GetDateTime(0);
                var machineStopped = !reader.IsDBNull(1) && reader.GetBoolean(1);
                var plcConnected = (DateTime.Now - lastRecordTime) <= _plcConnectionCheckWindow;
                return (plcConnected, machineStopped);
            }

            // Hiç kayıt yoksa PLC bağlı değil
            return (false, true);
        }

        private async Task CreateIdleRecordAsync(
            SqlConnection conn,
            DateTime startTime,
            DateTime lastJobEndTime,
            string? lastJobOrderNumber,
            bool plcConnected,
            bool machineStopped)
        {
            var query = @"
                INSERT INTO MachineIdleRecords 
                (start_time, last_job_end_time, last_job_order_number, plc_connected, machine_stopped, status, reason, created_at, updated_at)
                VALUES 
                (@startTime, @lastJobEndTime, @lastJobOrderNumber, @plcConnected, @machineStopped, 'active', 'extended_idle_after_job_end', GETDATE(), GETDATE())";

            await using var cmd = new SqlCommand(query, conn);
            cmd.Parameters.AddWithValue("@startTime", startTime);
            cmd.Parameters.AddWithValue("@lastJobEndTime", lastJobEndTime);
            cmd.Parameters.AddWithValue("@lastJobOrderNumber", (object?)lastJobOrderNumber ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@plcConnected", plcConnected);
            cmd.Parameters.AddWithValue("@machineStopped", machineStopped);

            await cmd.ExecuteNonQueryAsync();
        }

        private async Task CompleteActiveIdleRecordIfExistsAsync(SqlConnection conn)
        {
            var query = @"
                UPDATE MachineIdleRecords 
                SET 
                    end_time = GETDATE(),
                    duration_seconds = DATEDIFF(SECOND, start_time, GETDATE()),
                    status = 'completed',
                    updated_at = GETDATE()
                WHERE status = 'active'";

            await using var cmd = new SqlCommand(query, conn);
            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            
            if (rowsAffected > 0)
            {
                _logger.LogInformation($"✅ Aktif boşta kalma kaydı tamamlandı. {rowsAffected} kayıt güncellendi.");
            }
        }

        private async Task UpdateActiveIdleRecordDurationAsync(SqlConnection conn)
        {
            var query = @"
                UPDATE MachineIdleRecords 
                SET 
                    duration_seconds = DATEDIFF(SECOND, start_time, GETDATE()),
                    updated_at = GETDATE()
                WHERE status = 'active'";

            await using var cmd = new SqlCommand(query, conn);
            await cmd.ExecuteNonQueryAsync();
        }

        private static async Task EnsureMachineIdleRecordsTableAsync(SqlConnection connection)
        {
            var createTableQuery = @"
IF OBJECT_ID(N'MachineIdleRecords', N'U') IS NULL
BEGIN
    CREATE TABLE MachineIdleRecords (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        start_time DATETIME2 NOT NULL,
        end_time DATETIME2 NULL,
        duration_seconds INT NULL,
        last_job_end_time DATETIME2 NOT NULL,
        last_job_order_number NVARCHAR(50) NULL,
        plc_connected BIT NOT NULL DEFAULT 1,
        machine_stopped BIT NOT NULL DEFAULT 1,
        status NVARCHAR(20) NOT NULL DEFAULT 'active',
        reason NVARCHAR(200) NULL DEFAULT 'extended_idle_after_job_end',
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_MachineIdleRecords_status ON MachineIdleRecords(status);
    CREATE INDEX IX_MachineIdleRecords_start_time ON MachineIdleRecords(start_time);
    CREATE INDEX IX_MachineIdleRecords_last_job_end_time ON MachineIdleRecords(last_job_end_time);
    CREATE INDEX IX_MachineIdleRecords_status_start_time ON MachineIdleRecords(status, start_time);
END";

            await using var cmd = new SqlCommand(createTableQuery, connection);
            await cmd.ExecuteNonQueryAsync();
        }
    }
}

