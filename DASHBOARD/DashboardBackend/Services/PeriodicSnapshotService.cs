using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using DashboardBackend.Data;
using System.Net.Http;
using System.Text.Json;

namespace DashboardBackend.Services
{
    public class PeriodicSnapshotService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<PeriodicSnapshotService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public PeriodicSnapshotService(
            IServiceProvider serviceProvider,
            ILogger<PeriodicSnapshotService> logger,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("PeriodicSnapshotService başlatıldı.");

            // İlk başlatmada 10 saniye bekle (diğer servislerin hazır olması için)
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            // Her dakika kontrol et, snapshot zamanı gelmiş mi diye
            var lastSnapshotMinute = -1; // Son snapshot alınan dakikayı takip et
            
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var now = DateTime.Now;
                    
                    // Aynı dakikada birden fazla snapshot alınmasını önle
                    // 00:00:00'da snapshot al (sadece bir kez)
                    if (now.Hour == 0 && now.Minute == 0 && lastSnapshotMinute != 0)
                    {
                        lastSnapshotMinute = 0;
                        var snapshotTasks = new List<Task>();
                        
                        // Tüm snapshot'ları topla (aynı anda çalışacak)
                        // Günlük snapshot: Her gün 00:00:00
                        snapshotTasks.Add(TakeSnapshotsForAllMachines("daily", now.Date));
                        
                        // Haftalık snapshot: Her Pazartesi 00:00:00
                        if (now.DayOfWeek == DayOfWeek.Monday)
                        {
                            // Pazartesi günü ise, haftanın başlangıcı bugün
                            var weekStart = now.Date;
                            snapshotTasks.Add(TakeSnapshotsForAllMachines("weekly", weekStart));
                        }
                        
                        // Aylık snapshot: Her ayın 1'i 00:00:00
                        if (now.Day == 1)
                        {
                            snapshotTasks.Add(TakeSnapshotsForAllMachines("monthly", new DateTime(now.Year, now.Month, 1)));
                        }
                        
                        // Çeyreklik snapshot: Ocak, Nisan, Temmuz, Ekim 1'i 00:00:00
                        if ((now.Month == 1 || now.Month == 4 || now.Month == 7 || now.Month == 10) && now.Day == 1)
                        {
                            var quarterStart = new DateTime(now.Year, now.Month, 1);
                            snapshotTasks.Add(TakeSnapshotsForAllMachines("quarterly", quarterStart));
                        }
                        
                        // Yıllık snapshot: 1 Ocak 00:00:00
                        if (now.Month == 1 && now.Day == 1)
                        {
                            var yearStart = new DateTime(now.Year, 1, 1);
                            snapshotTasks.Add(TakeSnapshotsForAllMachines("yearly", yearStart));
                        }
                        
                        // Tüm snapshot'ları paralel olarak çalıştır
                        if (snapshotTasks.Count > 0)
                        {
                            _logger.LogInformation($"{snapshotTasks.Count} farklı snapshot tipi aynı anda alınıyor: {now:yyyy-MM-dd HH:mm:ss}");
                            await Task.WhenAll(snapshotTasks);
                            _logger.LogInformation("Tüm snapshot'lar tamamlandı.");
                            
                            // 1 dakika bekle, aynı dakikada tekrar çalışmasın
                            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                        }
                    }
                    else if (now.Minute != 0)
                    {
                        // 00:00 dışındaki dakikalarda lastSnapshotMinute'ı sıfırla
                        lastSnapshotMinute = -1;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "PeriodicSnapshotService kontrolü sırasında hata oluştu.");
                }

                // Her 30 saniyede bir kontrol et
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        private async Task TakeSnapshotsForAllMachines(string snapshotType, DateTime snapshotDate)
        {
            using var scope = _serviceProvider.CreateScope();
            var dashboardContext = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
            var machineDatabaseService = scope.ServiceProvider.GetRequiredService<MachineDatabaseService>();

            try
            {
                // Tüm makineleri al
                var machines = await dashboardContext.MachineLists.ToListAsync();
                _logger.LogInformation($"{snapshotType} snapshot alınıyor. Makine sayısı: {machines.Count}, Tarih: {snapshotDate:yyyy-MM-dd HH:mm:ss}");

                foreach (var machine in machines)
                {
                    try
                    {
                        await TakeSnapshotForMachine(machine, snapshotType, snapshotDate, machineDatabaseService);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"{machine.MachineName} ({machine.TableName}) için snapshot alınırken hata: {ex.Message}");
                        // Bir makine hata verirse diğerlerine devam et
                        continue;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Tüm makineler için snapshot alınırken hata: {ex.Message}");
            }
        }

        private async Task TakeSnapshotForMachine(
            Models.MachineList machine, 
            string snapshotType, 
            DateTime snapshotDate,
            MachineDatabaseService machineDatabaseService)
        {
            var tableName = machine.TableName;
            if (string.IsNullOrWhiteSpace(tableName))
            {
                _logger.LogWarning($"{machine.MachineName} için TableName tanımlı değil, snapshot atlanıyor.");
                return;
            }

            var databaseName = !string.IsNullOrWhiteSpace(machine.DatabaseName)
                ? machine.DatabaseName
                : tableName;

            var connectionString = machineDatabaseService.GetConnectionString(databaseName);

            // Önce tablo var mı kontrol et, yoksa oluştur
            await EnsurePeriodicSnapshotsTableAsync(connectionString);

            // Aktif işi kontrol et
            var (siparisNo, cycleStartTime) = await GetActiveJobInfoAsync(connectionString);

            // Canlı veriyi HTTP endpoint'inden çek
            var (liveData, fullJsonString) = await FetchLiveDataFromApiAsync(tableName);

            // Snapshot'ı kaydet
            await SaveSnapshotAsync(
                connectionString,
                snapshotType,
                snapshotDate,
                siparisNo,
                cycleStartTime,
                liveData,
                fullJsonString);

            _logger.LogInformation($"{machine.MachineName} için {snapshotType} snapshot kaydedildi. Tarih: {snapshotDate:yyyy-MM-dd HH:mm:ss}");
        }

        private async Task<(string? siparisNo, DateTime? cycleStartTime)> GetActiveJobInfoAsync(string connectionString)
        {
            try
            {
                await using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT TOP 1 siparis_no, cycle_start_time
                    FROM JobCycleRecords
                    WHERE status = 'active'
                    ORDER BY cycle_start_time DESC";

                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var siparisNo = reader["siparis_no"]?.ToString();
                    var cycleStartTime = reader.IsDBNull(reader.GetOrdinal("cycle_start_time"))
                        ? (DateTime?)null
                        : reader.GetDateTime(reader.GetOrdinal("cycle_start_time"));
                    
                    return (siparisNo, cycleStartTime);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Aktif iş bilgisi alınırken hata (JobCycleRecords tablosu olmayabilir): {Message}", ex.Message);
            }

            return (null, null);
        }

        private async Task<(Dictionary<string, object?> liveData, string? fullJsonString)> FetchLiveDataFromApiAsync(string tableName)
        {
            var liveData = new Dictionary<string, object?>();
            string? fullJsonString = null;

            try
            {
                // API base URL'i configuration'dan al veya varsayılan kullan
                var apiBaseUrl = _configuration["ApiBaseUrl"] ?? "http://localhost:5199";
                var url = $"{apiBaseUrl}/api/plcdata/data?machine={Uri.EscapeDataString(tableName)}";

                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(10);

                var response = await httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    fullJsonString = await response.Content.ReadAsStringAsync();
                    var jsonDoc = JsonDocument.Parse(fullJsonString);
                    var root = jsonDoc.RootElement;

                    // JSON'dan değerleri çıkar
                    if (root.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var prop in root.EnumerateObject())
                        {
                            // Null check
                            if (prop.Value.ValueKind == JsonValueKind.Null)
                            {
                                liveData[prop.Name] = null;
                            }
                            else
                            {
                                liveData[prop.Name] = prop.Value.ToString();
                            }
                        }
                    }
                }
                else
                {
                    _logger.LogWarning($"Canlı veri API'den alınamadı. Status: {response.StatusCode}, URL: {url}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Canlı veri API'den alınırken hata: {ex.Message}");
            }

            return (liveData, fullJsonString);
        }

        private async Task SaveSnapshotAsync(
            string connectionString,
            string snapshotType,
            DateTime snapshotDate,
            string? siparisNo,
            DateTime? cycleStartTime,
            Dictionary<string, object?> liveData,
            string? fullJsonString = null)
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            // Aynı type ve date için zaten snapshot varsa güncelle, yoksa yeni ekle
            var checkQuery = @"
                SELECT Id FROM PeriodicSnapshots
                WHERE snapshot_type = @snapshotType AND snapshot_date = @snapshotDate";

            using var checkCmd = new SqlCommand(checkQuery, connection);
            checkCmd.Parameters.AddWithValue("@snapshotType", snapshotType);
            checkCmd.Parameters.AddWithValue("@snapshotDate", snapshotDate);
            
            var existingId = await checkCmd.ExecuteScalarAsync();

            // Değerleri parse et
            var actualProduction = ParseInt(liveData.GetValueOrDefault("actualProduction"));
            var totalStoppageDuration = ParseDecimal(liveData.GetValueOrDefault("totalStoppageDuration"));
            var energyConsumptionKwh = ParseDecimal(liveData.GetValueOrDefault("energyConsumptionKwh") ?? 
                                                    liveData.GetValueOrDefault("totalEnergyKwh"));
            var wastageBeforeDie = ParseDecimal(liveData.GetValueOrDefault("wastageBeforeDie"));
            var wastageAfterDie = ParseDecimal(liveData.GetValueOrDefault("wastageAfterDie"));
            var paperConsumption = ParseDecimal(liveData.GetValueOrDefault("paperConsumption"));
            var ethylAlcoholConsumption = ParseDecimal(liveData.GetValueOrDefault("ethylAlcoholConsumption"));
            var ethylAcetateConsumption = ParseDecimal(liveData.GetValueOrDefault("ethylAcetateConsumption"));
            var plannedTime = ParseDecimal(liveData.GetValueOrDefault("plannedTime"));
            var runTime = ParseDecimal(liveData.GetValueOrDefault("runTime"));

            if (existingId != null && existingId != DBNull.Value)
            {
                // Güncelle
                var updateQuery = @"
                    UPDATE PeriodicSnapshots SET
                        siparis_no = @siparisNo,
                        cycle_start_time = @cycleStartTime,
                        actual_production = @actualProduction,
                        total_stoppage_duration = @totalStoppageDuration,
                        energy_consumption_kwh = @energyConsumptionKwh,
                        wastage_before_die = @wastageBeforeDie,
                        wastage_after_die = @wastageAfterDie,
                        paper_consumption = @paperConsumption,
                        ethyl_alcohol_consumption = @ethylAlcoholConsumption,
                        ethyl_acetate_consumption = @ethylAcetateConsumption,
                        planned_time = @plannedTime,
                        run_time = @runTime,
                        full_live_data = @fullLiveData
                    WHERE Id = @id";

                using var updateCmd = new SqlCommand(updateQuery, connection);
                AddSnapshotParameters(updateCmd, snapshotType, snapshotDate, siparisNo, cycleStartTime,
                    actualProduction, totalStoppageDuration, energyConsumptionKwh,
                    wastageBeforeDie, wastageAfterDie, paperConsumption,
                    ethylAlcoholConsumption, ethylAcetateConsumption, plannedTime, runTime, fullJsonString);
                updateCmd.Parameters.AddWithValue("@id", existingId);
                await updateCmd.ExecuteNonQueryAsync();
            }
            else
            {
                // Yeni ekle
                var insertQuery = @"
                    INSERT INTO PeriodicSnapshots (
                        snapshot_type, snapshot_date, siparis_no, cycle_start_time,
                        actual_production, total_stoppage_duration, energy_consumption_kwh,
                        wastage_before_die, wastage_after_die, paper_consumption,
                        ethyl_alcohol_consumption, ethyl_acetate_consumption,
                        planned_time, run_time, full_live_data
                    ) VALUES (
                        @snapshotType, @snapshotDate, @siparisNo, @cycleStartTime,
                        @actualProduction, @totalStoppageDuration, @energyConsumptionKwh,
                        @wastageBeforeDie, @wastageAfterDie, @paperConsumption,
                        @ethylAlcoholConsumption, @ethylAcetateConsumption,
                        @plannedTime, @runTime, @fullLiveData
                    )";

                using var insertCmd = new SqlCommand(insertQuery, connection);
                AddSnapshotParameters(insertCmd, snapshotType, snapshotDate, siparisNo, cycleStartTime,
                    actualProduction, totalStoppageDuration, energyConsumptionKwh,
                    wastageBeforeDie, wastageAfterDie, paperConsumption,
                    ethylAlcoholConsumption, ethylAcetateConsumption, plannedTime, runTime, fullJsonString);
                await insertCmd.ExecuteNonQueryAsync();
            }
        }

        private void AddSnapshotParameters(
            SqlCommand cmd,
            string snapshotType,
            DateTime snapshotDate,
            string? siparisNo,
            DateTime? cycleStartTime,
            int? actualProduction,
            decimal? totalStoppageDuration,
            decimal? energyConsumptionKwh,
            decimal? wastageBeforeDie,
            decimal? wastageAfterDie,
            decimal? paperConsumption,
            decimal? ethylAlcoholConsumption,
            decimal? ethylAcetateConsumption,
            decimal? plannedTime,
            decimal? runTime,
            string? fullLiveDataJson = null)
        {
            cmd.Parameters.AddWithValue("@snapshotType", snapshotType);
            cmd.Parameters.AddWithValue("@snapshotDate", snapshotDate);
            cmd.Parameters.AddWithValue("@siparisNo", siparisNo ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@cycleStartTime", cycleStartTime ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@actualProduction", actualProduction ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@totalStoppageDuration", totalStoppageDuration ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@energyConsumptionKwh", energyConsumptionKwh ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@wastageBeforeDie", wastageBeforeDie ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@wastageAfterDie", wastageAfterDie ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@paperConsumption", paperConsumption ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@ethylAlcoholConsumption", ethylAlcoholConsumption ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@ethylAcetateConsumption", ethylAcetateConsumption ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@plannedTime", plannedTime ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@runTime", runTime ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@fullLiveData", fullLiveDataJson ?? (object)DBNull.Value);
        }

        private async Task EnsurePeriodicSnapshotsTableAsync(string connectionString)
        {
            try
            {
                await using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                var createTableQuery = @"
IF OBJECT_ID(N'PeriodicSnapshots', N'U') IS NULL
BEGIN
    CREATE TABLE PeriodicSnapshots (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        snapshot_type NVARCHAR(20) NOT NULL,
        snapshot_date DATETIME2 NOT NULL,
        siparis_no NVARCHAR(50) NULL,
        cycle_start_time DATETIME2 NULL,
        actual_production INT NULL,
        total_stoppage_duration DECIMAL(18,2) NULL,
        energy_consumption_kwh DECIMAL(18,2) NULL,
        wastage_before_die DECIMAL(18,2) NULL,
        wastage_after_die DECIMAL(18,2) NULL,
        paper_consumption DECIMAL(18,2) NULL,
        ethyl_alcohol_consumption DECIMAL(18,2) NULL,
        ethyl_acetate_consumption DECIMAL(18,2) NULL,
        planned_time DECIMAL(18,2) NULL,
        run_time DECIMAL(18,2) NULL,
        full_live_data NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_PeriodicSnapshots_type_date ON PeriodicSnapshots(snapshot_type, snapshot_date);
    CREATE INDEX IX_PeriodicSnapshots_siparis_no ON PeriodicSnapshots(siparis_no);
    CREATE INDEX IX_PeriodicSnapshots_cycle_start ON PeriodicSnapshots(cycle_start_time);
    CREATE INDEX IX_PeriodicSnapshots_snapshot_date ON PeriodicSnapshots(snapshot_date);
END
ELSE
BEGIN
    -- Mevcut tabloya full_live_data kolonunu ekle (yoksa)
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PeriodicSnapshots') AND name = 'full_live_data')
    BEGIN
        ALTER TABLE PeriodicSnapshots ADD full_live_data NVARCHAR(MAX) NULL;
    END
END";

                using var cmd = new SqlCommand(createTableQuery, connection);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PeriodicSnapshots tablosu oluşturulurken hata: {Message}", ex.Message);
                throw;
            }
        }

        private int? ParseInt(object? value)
        {
            if (value == null || value == DBNull.Value) return null;
            if (value is int i) return i;
            if (int.TryParse(value.ToString(), out var result)) return result;
            return null;
        }

        private decimal? ParseDecimal(object? value)
        {
            if (value == null || value == DBNull.Value) return null;
            if (value is decimal d) return d;
            if (decimal.TryParse(value.ToString()?.Replace(",", "."), 
                System.Globalization.NumberStyles.Any, 
                System.Globalization.CultureInfo.InvariantCulture, 
                out var result)) return result;
            return null;
        }
    }
}

