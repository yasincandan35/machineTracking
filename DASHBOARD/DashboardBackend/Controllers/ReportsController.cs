using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System;
using System.Text.Json;
using System.Linq;
using DashboardBackend.Services;
using DashboardBackend.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Net.Http;
using System.Net.Http.Json;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;
        private readonly ILogger<ReportsController> _logger;
        private readonly PrivacyService _privacyService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IServiceProvider _serviceProvider;

        private static async Task<bool> HasEnergyTotalsAsync(SqlConnection connection)
        {
            const string checkSql = @"
                SELECT CASE WHEN EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('JobEndReports') 
                      AND name = 'total_energy_kwh_start'
                ) AND EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('JobEndReports') 
                      AND name = 'total_energy_kwh_end'
                ) THEN 1 ELSE 0 END";

            await using var cmd = new SqlCommand(checkSql, connection);
            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result) == 1;
        }

        public ReportsController(
            IConfiguration configuration,
            ILogger<ReportsController> logger,
            MachineDatabaseService machineDatabaseService,
            DashboardDbContext dashboardContext,
            PrivacyService privacyService,
            IHttpClientFactory httpClientFactory,
            IServiceProvider serviceProvider)
        {
            _configuration = configuration;
            _logger = logger;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
            _privacyService = privacyService;
            _httpClientFactory = httpClientFactory;
        }

        private record ConnectionInfo(string ConnectionString, string? DatabaseName, string? TableName, bool IsDefault);

        private async Task<DashboardBackend.Models.User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId))
            {
                return null;
            }
            if (!int.TryParse(userId, out var id))
            {
                return null;
            }
            return await _dashboardContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }

        private string NormalizeTableName(string? tableName)
        {
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return tableName ?? string.Empty;
            }
            // Bazı makinelerde veritabanı adı tablo yerine gelebiliyor; hız verisi için gerçek tablo 'dataRecords'
            if (tableName.Equals("lemanic3_tracking", StringComparison.OrdinalIgnoreCase))
            {
                return "dataRecords";
            }
            return tableName;
        }

        private async Task<ConnectionInfo> GetConnectionInfoAsync(string? machine)
        {
            if (string.IsNullOrWhiteSpace(machine))
            {
                var defaultConnection = _configuration.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yapılandırılmamış");

                return new ConnectionInfo(defaultConnection, null, null, true);
            }

            var machineLower = machine.ToLowerInvariant();
            var machineInfo = await _dashboardContext.MachineLists
                .FirstOrDefaultAsync(m =>
                    (!string.IsNullOrEmpty(m.TableName) && m.TableName.ToLower() == machineLower) ||
                    (!string.IsNullOrEmpty(m.DatabaseName) && m.DatabaseName.ToLower() == machineLower) ||
                    (!string.IsNullOrEmpty(m.MachineName) && m.MachineName.ToLower() == machineLower)
                );

            if (machineInfo == null)
            {
                throw new InvalidOperationException($"Makine bulunamadı: {machine}");
            }

            var databaseName = !string.IsNullOrWhiteSpace(machineInfo.DatabaseName)
                ? machineInfo.DatabaseName
                : machineInfo.TableName;

            if (string.IsNullOrWhiteSpace(databaseName))
            {
                throw new InvalidOperationException($"Makine için veritabanı adı tanımlı değil: {machine}");
            }

            if (string.IsNullOrWhiteSpace(machineInfo.TableName))
            {
                throw new InvalidOperationException($"Makine için tablo adı tanımlı değil: {machine}");
            }

            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

            return new ConnectionInfo(connectionString, databaseName, machineInfo.TableName, false);
        }

        [HttpGet]
        public async Task<IActionResult> GetReports([FromQuery] string? machine = null)
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();
                var privacy = _privacyService.GetPrivacy(currentUser);

                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var hasEnergyTotals = await HasEnergyTotalsAsync(connection);

                var query = hasEnergyTotals
                    ? @"
                        SELECT TOP 1000
                            id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                            bundle, silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                            paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                            wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                            COALESCE(
                                energy_consumption_kwh,
                                CASE 
                                    WHEN total_energy_kwh_end IS NOT NULL AND total_energy_kwh_start IS NOT NULL 
                                    THEN total_energy_kwh_end - total_energy_kwh_start 
                                    ELSE NULL 
                                END
                            ) AS energy_consumption_kwh,
                            total_energy_kwh_start,
                            total_energy_kwh_end,
                            job_start_time, job_end_time, created_at
                        FROM JobEndReports 
                        ORDER BY created_at DESC"
                    : @"
                        SELECT TOP 1000
                            id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                            bundle, silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                            paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                            wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                            energy_consumption_kwh, job_start_time, job_end_time, created_at
                        FROM JobEndReports 
                        ORDER BY created_at DESC";

                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                var reports = new List<object>();

                while (await reader.ReadAsync())
                {
                    var siparisNo = reader["siparis_no"]?.ToString();
                    var stokAdi = reader["stok_adi"]?.ToString();
                    if (privacy.MaskReportsJobFields)
                    {
                        siparisNo = _privacyService.MaskString(siparisNo, 0);
                        stokAdi = _privacyService.MaskString(stokAdi, 0);
                    }

                    var report = new
                    {
                        id = reader["id"],
                        siparis_no = siparisNo,
                        toplam_miktar = reader["toplam_miktar"],
                        kalan_miktar = reader["kalan_miktar"],
                        set_sayisi = reader["set_sayisi"],
                        uretim_tipi = reader["uretim_tipi"],
                        stok_adi = stokAdi,
                        bundle = reader["bundle"],
                        silindir_cevresi = reader["silindir_cevresi"],
                        hedef_hiz = reader["hedef_hiz"],
                        ethylAlcoholConsumption = reader["ethyl_alcohol_consumption"],
                        ethylAcetateConsumption = reader["ethyl_acetate_consumption"],
                        paperConsumption = reader["paper_consumption"],
                        actualProduction = reader["actual_production"],
                        remainingWork = reader["remaining_work"],
                        wastageBeforeDie = reader["wastage_before_die"],
                        wastageAfterDie = reader["wastage_after_die"],
                        wastageRatio = reader["wastage_ratio"],
                        totalStoppageDuration = reader["total_stoppage_duration"],
                        overProduction = reader["over_production"],
                        completionPercentage = reader["completion_percentage"],
                        energyConsumptionKwh = reader["energy_consumption_kwh"],
                        totalEnergyKwhStart = hasEnergyTotals ? reader["total_energy_kwh_start"] : null,
                        totalEnergyKwhEnd = hasEnergyTotals ? reader["total_energy_kwh_end"] : null,
                        jobStartTime = reader["job_start_time"],
                        jobEndTime = reader["job_end_time"],
                        createdAt = reader["created_at"]
                    };
                    reports.Add(report);
                }

                return Ok(new
                {
                    success = true,
                    data = reports,
                    count = reports.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Raporlar getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Raporlar getirilemedi",
                    message = ex.Message
                });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetReport(int id, [FromQuery] string? machine = null)
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();
                var privacy = _privacyService.GetPrivacy(currentUser);

                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var hasEnergyTotals = await HasEnergyTotalsAsync(connection);

                var query = hasEnergyTotals
                    ? @"
                        SELECT 
                            id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                            bundle, silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                            paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                            wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                            COALESCE(
                                energy_consumption_kwh,
                                CASE 
                                    WHEN total_energy_kwh_end IS NOT NULL AND total_energy_kwh_start IS NOT NULL 
                                    THEN total_energy_kwh_end - total_energy_kwh_start 
                                    ELSE NULL 
                                END
                            ) AS energy_consumption_kwh,
                            total_energy_kwh_start,
                            total_energy_kwh_end,
                            job_start_time, job_end_time, created_at
                        FROM JobEndReports 
                        WHERE id = @id"
                    : @"
                        SELECT 
                            id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                            bundle, silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                            paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                            wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                            energy_consumption_kwh, job_start_time, job_end_time, created_at
                        FROM JobEndReports 
                        WHERE id = @id";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@id", id);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var siparisNo = reader["siparis_no"]?.ToString();
                    var stokAdi = reader["stok_adi"]?.ToString();
                    if (privacy.MaskReportsJobFields)
                    {
                        siparisNo = _privacyService.MaskString(siparisNo, 0);
                        stokAdi = _privacyService.MaskString(stokAdi, 0);
                    }

                    var report = new
                    {
                        id = reader["id"],
                        siparis_no = siparisNo,
                        toplam_miktar = reader["toplam_miktar"],
                        kalan_miktar = reader["kalan_miktar"],
                        set_sayisi = reader["set_sayisi"],
                        uretim_tipi = reader["uretim_tipi"],
                        stok_adi = stokAdi,
                        bundle = reader["bundle"],
                        silindir_cevresi = reader["silindir_cevresi"],
                        hedef_hiz = reader["hedef_hiz"],
                        ethylAlcoholConsumption = reader["ethyl_alcohol_consumption"],
                        ethylAcetateConsumption = reader["ethyl_acetate_consumption"],
                        paperConsumption = reader["paper_consumption"],
                        actualProduction = reader["actual_production"],
                        remainingWork = reader["remaining_work"],
                        wastageBeforeDie = reader["wastage_before_die"],
                        wastageAfterDie = reader["wastage_after_die"],
                        wastageRatio = reader["wastage_ratio"],
                        totalStoppageDuration = reader["total_stoppage_duration"],
                        overProduction = reader["over_production"],
                        completionPercentage = reader["completion_percentage"],
                        energyConsumptionKwh = reader["energy_consumption_kwh"],
                        totalEnergyKwhStart = hasEnergyTotals ? reader["total_energy_kwh_start"] : null,
                        totalEnergyKwhEnd = hasEnergyTotals ? reader["total_energy_kwh_end"] : null,
                        jobStartTime = reader["job_start_time"],
                        jobEndTime = reader["job_end_time"],
                        createdAt = reader["created_at"]
                    };

                    return Ok(new
                    {
                        success = true,
                        data = report
                    });
                }
                else
                {
                    return NotFound(new
                    {
                        success = false,
                        error = "Rapor bulunamadı"
                    });
                }
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Rapor getirilirken hata oluştu: {Id}", id);
                return StatusCode(500, new
                {
                    success = false,
                    error = "Rapor getirilemedi",
                    message = ex.Message
                });
            }
        }

        [HttpGet("test-tables")]
        public async Task<IActionResult> TestTables([FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT 
                        t.name as table_name,
                        CASE WHEN t.name IS NOT NULL THEN 'EXISTS' ELSE 'NOT EXISTS' END as status
                    FROM (
                        SELECT 'stoppage_records' as name
                        UNION ALL SELECT 'stoppage_categories'
                        UNION ALL SELECT 'stoppage_reasons'
                        UNION ALL SELECT 'dataRecords'
                    ) t
                    LEFT JOIN sys.tables st ON t.name = st.name";

                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                var tables = new List<object>();

                while (await reader.ReadAsync())
                {
                    var table = new
                    {
                        tableName = reader["table_name"]?.ToString(),
                        status = reader["status"]?.ToString()
                    };
                    tables.Add(table);
                }

                return Ok(new
                {
                    success = true,
                    data = tables
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tablo kontrolü sırasında hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Tablo kontrolü başarısız",
                    message = ex.Message
                });
            }
        }

        [HttpGet("speed-data")]
        public async Task<IActionResult> GetSpeedData([FromQuery] DateTime? start, [FromQuery] DateTime? end, [FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                string query;

                if (connectionInfo.IsDefault)
                {
                    query = @"
                        SELECT 
                            [KayitZamani],
                            [MachineSpeed]
                        FROM [SensorDB].[dbo].[dataRecords]
                        WHERE (@start IS NULL OR [KayitZamani] >= @start)
                          AND (@end IS NULL OR [KayitZamani] <= @end)
                          AND [MachineSpeed] IS NOT NULL
                        ORDER BY [KayitZamani] ASC";
                }
                else
                {
                    var tableName = connectionInfo.TableName 
                        ?? throw new InvalidOperationException("Makine için tablo adı tanımlı değil");
                    tableName = NormalizeTableName(tableName);

                    query = $@"
                        SELECT 
                            [KayitZamani],
                            [MachineSpeed]
                        FROM [{tableName}]
                        WHERE (@start IS NULL OR [KayitZamani] >= @start)
                          AND (@end IS NULL OR [KayitZamani] <= @end)
                          AND [MachineSpeed] IS NOT NULL
                        ORDER BY [KayitZamani] ASC";
                }

                await using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@start", start ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@end", end ?? (object)DBNull.Value);
                await using var reader = await command.ExecuteReaderAsync();

                var speedData = new List<object>();

                while (await reader.ReadAsync())
                {
                    var dataPoint = new
                    {
                        timestamp = reader["KayitZamani"],
                        machineSpeed = reader["MachineSpeed"]
                    };
                    speedData.Add(dataPoint);
                }

                return Ok(new
                {
                    success = true,
                    data = speedData,
                    count = speedData.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Hız verileri getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Hız verileri getirilemedi",
                    message = ex.Message
                });
            }
        }

        [HttpGet("oee-calculation/{reportId}")]
        public async Task<IActionResult> GetOEECalculation(int reportId, [FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT 
                        siparis_no,
                        toplam_miktar,
                        kalan_miktar,
                        set_sayisi,
                        silindir_cevresi,
                        hedef_hiz,
                        actual_production,
                        wastage_before_die,
                        wastage_after_die,
                        total_stoppage_duration,
                        job_start_time,
                        job_end_time
                    FROM JobEndReports 
                    WHERE id = @reportId";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@reportId", reportId);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    // Verileri al - Tüm decimal değerleri InvariantCulture ile parse et
                    var kalanMiktar = decimal.Parse(reader["kalan_miktar"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var setSayisi = Convert.ToInt32(reader["set_sayisi"]);
                    var silindirCevresi = decimal.Parse(reader["silindir_cevresi"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var hedefHiz = Convert.ToInt32(reader["hedef_hiz"]);
                    var actualProduction = Convert.ToInt32(reader["actual_production"]);
                    var wastageBeforeDie = decimal.Parse(reader["wastage_before_die"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var wastageAfterDie = decimal.Parse(reader["wastage_after_die"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var totalStoppageDuration = decimal.Parse(reader["total_stoppage_duration"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var jobStartTime = Convert.ToDateTime(reader["job_start_time"]);
                    var jobEndTime = Convert.ToDateTime(reader["job_end_time"]);

                    // OEE Hesaplamaları
                    
                    // Toplam miktarı parse et
                    var toplamMiktar = decimal.Parse(reader["toplam_miktar"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    
                    // 1. Planlanan Üretim Süresi (dakika)
                    // silindirCevresi mm, hedefHiz m/dk -> silindirCevresi/1000 ile metreye çevir
                    // Kalan miktar 0 veya negatif ise toplam miktarı kullan
                    var hesaplanacakMiktar = (kalanMiktar <= 0) ? toplamMiktar : kalanMiktar;
                    
                    var adim1 = hesaplanacakMiktar / setSayisi;
                    var adim2 = silindirCevresi / 1000; // 527.45 -> 0.52745 m
                    var adim3 = adim2 / hedefHiz;
                    var planlananSure = adim1 * adim3;
                    
                    // 2. Gerçek Çalışma Süresi (dakika)
                    var gercekCalismaSuresi = (decimal)(jobEndTime - jobStartTime).TotalMinutes;
                    
                    // 3. Hedef Üretim Miktarı
                    var hedefUretim = hesaplanacakMiktar;
                    
                    // 4. Hatalı Üretim Miktarı
                    // wastageBeforeDie metre, silindirCevresi mm -> wastageBeforeDie*1000/silindirCevresi ile adet hesapla
                    var dieOncesiAdet = (wastageBeforeDie * 1000 / silindirCevresi) * setSayisi;
                    var hataliUretim = dieOncesiAdet + wastageAfterDie;
                    
                    // 5. OEE Bileşenleri
                    // totalStoppageDuration milisaniye olarak geliyor, önce saniyeye sonra dakikaya çevir
                    var durusSuresiDakika = (totalStoppageDuration / 1000) / 60; // milisaniye -> saniye -> dakika
                    
                    // Duruş süresi iş süresinden fazla olamaz, maksimum iş süresinin %80'i kadar kabul et
                    if (durusSuresiDakika > gercekCalismaSuresi * 0.8m)
                    {
                        durusSuresiDakika = gercekCalismaSuresi * 0.8m;
                    }
                    
                    // OEE Bileşenleri - Standart OEE Formülleri
                    
                    // 1. Availability = Run Time / Planned Production Time
                    // Run Time (Availability için) = Planned Production Time - Downtime
                    var runTimeForAvailability = planlananSure - durusSuresiDakika;
                    if (runTimeForAvailability < 0) runTimeForAvailability = 0;
                    var availability = planlananSure > 0 ? (runTimeForAvailability / planlananSure) * 100 : 0;
                    
                    // 2. Performance = (Ideal Cycle Time × Total Count) / Run Time
                    // Run Time (Performance için) = Actual Operating Time - Downtime
                    // Ideal Cycle Time = (Silindir Çevresi / 1000) / (Hedef Hız × Set Sayısı)
                    // Total Count = Gerçek Üretim + Fireler (toplam üretilen adet)
                    var runTimeForPerformance = gercekCalismaSuresi - durusSuresiDakika;
                    if (runTimeForPerformance < 0) runTimeForPerformance = 0;
                    var idealCycleTime = (silindirCevresi / 1000) / (hedefHiz * setSayisi);
                    var totalCount = (decimal)actualProduction + hataliUretim; // Fireler dahil toplam üretim
                    var performance = runTimeForPerformance > 0 ? (idealCycleTime * totalCount) / runTimeForPerformance * 100 : 0;
                    
                    // 3. Quality = Good Count / Total Count
                    // Total Count = Gerçek Üretim + Fireler (toplam üretilen adet)
                    // Good Count = Gerçek Üretim (fireler hariç)
                    var totalCountForQuality = (decimal)actualProduction + hataliUretim; // Fireler dahil toplam üretim
                    var goodCount = (decimal)actualProduction; // Fireler hariç iyi üretim
                    var quality = totalCountForQuality > 0 ? (goodCount / totalCountForQuality) * 100 : 0;
                    
                    // 4. Genel OEE
                    var oee = (availability * performance * quality) / 10000;

                    var oeeData = new
                    {
                        // Temel Veriler
                        kalanMiktar = kalanMiktar,
                        setSayisi = setSayisi,
                        silindirCevresi = silindirCevresi,
                        hedefHiz = hedefHiz,
                        actualProduction = actualProduction,
                        wastageBeforeDie = wastageBeforeDie,
                        wastageAfterDie = wastageAfterDie,
                        totalStoppageDuration = totalStoppageDuration,
                        
                        // Hesaplanan Değerler
                        planlananSure = Math.Round(planlananSure, 2),
                        gercekCalismaSuresi = Math.Round(gercekCalismaSuresi, 2),
                        hedefUretim = hedefUretim,
                        dieOncesiAdet = Math.Round(dieOncesiAdet, 0),
                        hataliUretim = Math.Round(hataliUretim, 0),
                        runTimeForAvailability = Math.Round(runTimeForAvailability, 2),
                        runTimeForPerformance = Math.Round(runTimeForPerformance, 2),
                        idealCycleTime = Math.Round(idealCycleTime, 8),
                        durusSuresiDakika = Math.Round(durusSuresiDakika, 2),
                        totalCount = Math.Round(totalCount, 0),
                        goodCount = Math.Round(goodCount, 0),
                        
                        // OEE Bileşenleri
                        availability = Math.Round(availability, 2),
                        performance = Math.Round(performance, 2),
                        quality = Math.Round(quality, 2),
                        oee = Math.Round(oee, 2)
                    };

                    return Ok(new
                    {
                        success = true,
                        data = oeeData
                    });
                }
                else
                {
                    return NotFound(new
                    {
                        success = false,
                        error = "Rapor bulunamadı"
                    });
                }
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OEE hesaplama sırasında hata oluştu: {ReportId}", reportId);
                return StatusCode(500, new
                {
                    success = false,
                    error = "OEE hesaplanamadı",
                    message = ex.Message
                });
            }
        }

        [HttpGet("table-structure")]
        public async Task<IActionResult> GetTableStructure([FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT 
                        COLUMN_NAME,
                        DATA_TYPE,
                        IS_NULLABLE,
                        CHARACTER_MAXIMUM_LENGTH
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'stoppage_records'
                    ORDER BY ORDINAL_POSITION";

                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                var columns = new List<object>();

                while (await reader.ReadAsync())
                {
                    var column = new
                    {
                        columnName = reader["COLUMN_NAME"]?.ToString(),
                        dataType = reader["DATA_TYPE"]?.ToString(),
                        isNullable = reader["IS_NULLABLE"]?.ToString(),
                        maxLength = reader["CHARACTER_MAXIMUM_LENGTH"]
                    };
                    columns.Add(column);
                }

                return Ok(new
                {
                    success = true,
                    data = columns
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tablo yapısı kontrolü sırasında hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Tablo yapısı kontrolü başarısız",
                    message = ex.Message
                });
            }
        }

        [HttpGet("stoppages")]
        public async Task<IActionResult> GetStoppages([FromQuery] DateTime? start, [FromQuery] DateTime? end, [FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                var query = @"
                    SELECT 
                        sr.id,
                        sr.start_time,
                        sr.end_time,
                        sr.duration_seconds,
                        sc.display_name as category_name,
                        sr.category_id,
                        sre.reason_name,
                        sr.reason_id,
                        sr.created_at
                    FROM stoppage_records sr
                    LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
                    LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
                    WHERE (@start IS NULL OR sr.start_time >= @start)
                      AND (@end IS NULL OR sr.end_time <= @end)
                    ORDER BY sr.start_time DESC";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@start", start ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@end", end ?? (object)DBNull.Value);
                using var reader = await command.ExecuteReaderAsync();

                var stoppages = new List<object>();

                while (await reader.ReadAsync())
                {
                    var stoppage = new
                    {
                        id = reader["id"],
                        startTime = reader["start_time"],
                        endTime = reader["end_time"],
                        durationSeconds = reader["duration_seconds"],
                        categoryName = reader["category_name"]?.ToString(),
                        categoryId = reader["category_id"],
                        reasonName = reader["reason_name"]?.ToString(),
                        reasonId = reader["reason_id"],
                        createdAt = reader["created_at"]
                    };
                    stoppages.Add(stoppage);
                }

                return Ok(new
                {
                    success = true,
                    data = stoppages,
                    count = stoppages.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Duruş verileri getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Duruş verileri getirilemedi",
                    message = ex.Message
                });
            }
        }

        [HttpGet("stoppage-summary")]
        public async Task<IActionResult> GetStoppageSummary([FromQuery] DateTime? start, [FromQuery] DateTime? end, [FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                // Eğer start parametresi yoksa, aktif işin cycle_start_time'ını kullan
                // Aktif iş yoksa son 24 saati göster
                DateTime? actualStart = start;
                if (!actualStart.HasValue)
                {
                    var activeJobQuery = @"
                        SELECT TOP 1 cycle_start_time
                        FROM JobCycleRecords
                        WHERE status = 'active'
                        ORDER BY cycle_start_time DESC";
                    
                    using var activeJobCmd = new SqlCommand(activeJobQuery, connection);
                    var activeJobResult = await activeJobCmd.ExecuteScalarAsync();
                    
                    if (activeJobResult != null && activeJobResult != DBNull.Value)
                    {
                        actualStart = activeJobResult as DateTime?;
                    }
                    else
                    {
                        // Aktif iş yoksa son 24 saati göster
                        actualStart = DateTime.Now.AddHours(-24);
                    }
                }

                var query = @"
                    SELECT 
                        COALESCE(sc.display_name, 'Bilinmeyen') as category_name,
                        COALESCE(sre.reason_name, 'Bilinmeyen Sebep') as reason_name,
                        SUM(sr.duration_seconds) as total_duration_seconds,
                        COUNT(*) as count
                    FROM stoppage_records sr
                    LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
                    LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
                    WHERE (@start IS NULL OR sr.end_time >= @start)
                      AND (@end IS NULL OR sr.start_time <= @end)
                    GROUP BY sc.display_name, sre.reason_name, sr.category_id, sr.reason_id
                    ORDER BY total_duration_seconds DESC";

                using var command = new SqlCommand(query, connection);
                var startParam = actualStart ?? (object)DBNull.Value;
                var endParam = end ?? (object)DBNull.Value;
                command.Parameters.AddWithValue("@start", startParam);
                command.Parameters.AddWithValue("@end", endParam);
                
                using var reader = await command.ExecuteReaderAsync();

                var summary = new List<object>();

                while (await reader.ReadAsync())
                {
                    var item = new
                    {
                        categoryName = reader["category_name"]?.ToString() ?? "Bilinmeyen",
                        reasonName = reader["reason_name"]?.ToString() ?? "Bilinmeyen Sebep",
                        totalDurationSeconds = reader["total_duration_seconds"],
                        count = reader["count"]
                    };
                    summary.Add(item);
                }

                return Ok(new
                {
                    success = true,
                    data = summary,
                    count = summary.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Duruş özeti getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Duruş özeti getirilemedi",
                    message = ex.Message
                });
            }
        }


        [HttpGet("operator-summary")]
        public async Task<IActionResult> GetOperatorSummary([FromQuery] DateTime? start, [FromQuery] DateTime? end, [FromQuery] string? machine = null)
        {
            try
            {
                var connectionInfo = await GetConnectionInfoAsync(machine);

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                // Operatör çalışma sürelerini gerçek tablolardan hesapla
                var query = @"
                    WITH ShiftWindows AS (
                        SELECT 
                            sa.id AS assignment_id,
                            e.name AS operator_name,
                            st.name AS shift_name,
                            -- Vardiya başlangıç/bitiş datetime'larını hesapla (geceye sarkan vardiya destekli)
                            DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.start_time), CAST(sa.shift_date AS datetime)) AS shift_start,
                            CASE 
                                WHEN st.end_time > st.start_time THEN 
                                    DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.end_time), CAST(sa.shift_date AS datetime))
                                ELSE 
                                    DATEADD(DAY, 1, DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.end_time), CAST(sa.shift_date AS datetime)))
                            END AS shift_end
                        FROM shift_assignments sa
                        JOIN employees e ON sa.employee_id = e.id
                        JOIN shift_templates st ON sa.template_id = st.id
                    )
                    SELECT 
                        sw.operator_name,
                        sw.shift_name,
                        SUM(
                            CASE 
                                WHEN j.job_end_time <= sw.shift_start OR j.job_start_time >= sw.shift_end THEN 0
                                ELSE DATEDIFF(SECOND,
                                    CASE WHEN j.job_start_time > sw.shift_start THEN j.job_start_time ELSE sw.shift_start END,
                                    CASE WHEN j.job_end_time < sw.shift_end THEN j.job_end_time ELSE sw.shift_end END
                                )
                            END
                        ) AS total_work_seconds,
                        COUNT(DISTINCT j.id) AS job_count
                    FROM JobEndReports j
                    JOIN ShiftWindows sw 
                        ON j.job_end_time > sw.shift_start 
                       AND j.job_start_time < sw.shift_end
                    WHERE (@start IS NULL OR j.job_start_time >= @start)
                      AND (@end IS NULL OR j.job_end_time <= @end)
                    GROUP BY sw.operator_name, sw.shift_name
                    ORDER BY total_work_seconds DESC";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@start", start ?? (object)DBNull.Value);
                command.Parameters.AddWithValue("@end", end ?? (object)DBNull.Value);
                using var reader = await command.ExecuteReaderAsync();

                var summary = new List<object>();

                while (await reader.ReadAsync())
                {
                    var item = new
                    {
                        operatorName = reader["operator_name"]?.ToString(),
                        shiftName = reader["shift_name"]?.ToString(),
                        totalWorkSeconds = reader["total_work_seconds"],
                        jobCount = reader["job_count"]
                    };
                    summary.Add(item);
                }

                return Ok(new
                {
                    success = true,
                    data = summary,
                    count = summary.Count
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Operatör özeti getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Operatör özeti getirilemedi",
                    message = ex.Message
                });
            }
        }

        [HttpGet("periodic-summary")]
        public async Task<IActionResult> GetPeriodicSummary(
            [FromQuery] string period, // 'daily' | 'monthly' | 'quarterly' | 'yearly'
            [FromQuery] DateTime? start = null,
            [FromQuery] DateTime? end = null,
            [FromQuery] string? machine = null)
        {
            try
            {
                // Period validasyonu
                var validPeriods = new[] { "daily", "weekly", "monthly", "quarterly", "yearly" };
                if (string.IsNullOrEmpty(period) || !validPeriods.Contains(period.ToLower()))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "Geçersiz period. 'daily', 'weekly', 'monthly', 'quarterly' veya 'yearly' olmalı."
                    });
                }

                var connectionInfo = await GetConnectionInfoAsync(machine);

                // Period'a göre start ve end tarihlerini belirle
                var now = DateTime.Now;
                DateTime periodStart, periodEnd;

                switch (period.ToLower())
                {
                    case "daily":
                        periodStart = start ?? now.Date;
                        periodEnd = end ?? periodStart.AddDays(1).AddTicks(-1);
                        break;
                    case "weekly":
                        if (start.HasValue)
                        {
                            // Haftanın başlangıcı (Pazartesi)
                            var daysToSubtract = (int)start.Value.DayOfWeek - (int)DayOfWeek.Monday;
                            periodStart = start.Value.Date.AddDays(-daysToSubtract);
                        }
                        else
                        {
                            // Bu haftanın başlangıcı (Pazartesi)
                            var daysToSubtract = (int)now.DayOfWeek - (int)DayOfWeek.Monday;
                            periodStart = now.Date.AddDays(-daysToSubtract);
                        }
                        periodEnd = end ?? periodStart.AddDays(7).AddTicks(-1);
                        break;
                    case "monthly":
                        if (start.HasValue)
                            periodStart = new DateTime(start.Value.Year, start.Value.Month, 1);
                        else
                            periodStart = new DateTime(now.Year, now.Month, 1);
                        periodEnd = end ?? periodStart.AddMonths(1).AddTicks(-1);
                        break;
                    case "quarterly":
                        if (start.HasValue)
                        {
                            var quarterMonth = ((start.Value.Month - 1) / 3) * 3 + 1;
                            periodStart = new DateTime(start.Value.Year, quarterMonth, 1);
                        }
                        else
                        {
                            var quarterMonth = ((now.Month - 1) / 3) * 3 + 1;
                            periodStart = new DateTime(now.Year, quarterMonth, 1);
                        }
                        periodEnd = end ?? periodStart.AddMonths(3).AddTicks(-1);
                        break;
                    case "yearly":
                        if (start.HasValue)
                            periodStart = new DateTime(start.Value.Year, 1, 1);
                        else
                            periodStart = new DateTime(now.Year, 1, 1);
                        periodEnd = end ?? periodStart.AddYears(1).AddTicks(-1);
                        break;
                    default:
                        periodStart = now.Date;
                        periodEnd = periodStart.AddDays(1).AddTicks(-1);
                        break;
                }

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                // Dönem başı snapshot'ını bul
                var snapshotDate = periodStart;
                var snapshotQuery = @"
                    SELECT TOP 1 
                        CAST(COALESCE(actual_production, 0) AS DECIMAL(18,2)) AS actual_production,
                        CAST(COALESCE(total_stoppage_duration, 0) AS DECIMAL(18,2)) AS total_stoppage_duration,
                        CAST(COALESCE(energy_consumption_kwh, 0) AS DECIMAL(18,2)) AS energy_consumption_kwh,
                        CAST(COALESCE(wastage_before_die, 0) AS DECIMAL(18,2)) AS wastage_before_die,
                        CAST(COALESCE(wastage_after_die, 0) AS DECIMAL(18,2)) AS wastage_after_die,
                        CAST(COALESCE(paper_consumption, 0) AS DECIMAL(18,2)) AS paper_consumption,
                        CAST(COALESCE(ethyl_alcohol_consumption, 0) AS DECIMAL(18,2)) AS ethyl_alcohol_consumption,
                        CAST(COALESCE(ethyl_acetate_consumption, 0) AS DECIMAL(18,2)) AS ethyl_acetate_consumption,
                        siparis_no,
                        cycle_start_time
                    FROM PeriodicSnapshots
                    WHERE snapshot_type = @snapshotType AND snapshot_date <= @snapshotDate
                    ORDER BY snapshot_date DESC";

                using var snapshotCmd = new SqlCommand(snapshotQuery, connection);
                snapshotCmd.Parameters.AddWithValue("@snapshotType", period.ToLower());
                snapshotCmd.Parameters.AddWithValue("@snapshotDate", snapshotDate);

                decimal? snapshotProduction = null;
                decimal? snapshotStoppage = null;
                decimal? snapshotEnergy = null;
                decimal? snapshotWastageBefore = null;
                decimal? snapshotWastageAfter = null;
                decimal? snapshotPaper = null;
                decimal? snapshotEthylAlcohol = null;
                decimal? snapshotEthylAcetate = null;
                string? snapshotSiparisNo = null;
                DateTime? snapshotCycleStartTime = null;

                using var snapshotReader = await snapshotCmd.ExecuteReaderAsync();
                if (await snapshotReader.ReadAsync())
                {
                    snapshotProduction = snapshotReader.IsDBNull(0) ? null : snapshotReader.GetDecimal(0);
                    snapshotStoppage = snapshotReader.IsDBNull(1) ? null : snapshotReader.GetDecimal(1);
                    snapshotEnergy = snapshotReader.IsDBNull(2) ? null : snapshotReader.GetDecimal(2);
                    snapshotWastageBefore = snapshotReader.IsDBNull(3) ? null : snapshotReader.GetDecimal(3);
                    snapshotWastageAfter = snapshotReader.IsDBNull(4) ? null : snapshotReader.GetDecimal(4);
                    snapshotPaper = snapshotReader.IsDBNull(5) ? null : snapshotReader.GetDecimal(5);
                    snapshotEthylAlcohol = snapshotReader.IsDBNull(6) ? null : snapshotReader.GetDecimal(6);
                    snapshotEthylAcetate = snapshotReader.IsDBNull(7) ? null : snapshotReader.GetDecimal(7);
                    snapshotSiparisNo = snapshotReader.IsDBNull(8) ? null : snapshotReader.GetString(8);
                    snapshotCycleStartTime = snapshotReader.IsDBNull(9) ? null : snapshotReader.GetDateTime(9);
                }
                snapshotReader.Close();

                // Dönem içinde biten işleri al (Performance hesaplaması için hedef_hiz de gerekli)
                var completedJobsQuery = @"
                    SELECT 
                        COUNT(*) AS job_count,
                        CAST(SUM(CAST(actual_production AS BIGINT)) AS DECIMAL(18,2)) AS total_production,
                        CAST(SUM(CAST(total_stoppage_duration AS BIGINT)) AS DECIMAL(18,2)) AS total_stoppage,
                        SUM(CAST(COALESCE(energy_consumption_kwh, 0) AS DECIMAL(18,2))) AS total_energy,
                        SUM(CAST(COALESCE(wastage_before_die, 0) AS DECIMAL(18,2))) AS total_wastage_before,
                        SUM(CAST(COALESCE(wastage_after_die, 0) AS DECIMAL(18,2))) AS total_wastage_after,
                        SUM(CAST(COALESCE(paper_consumption, 0) AS DECIMAL(18,2))) AS total_paper,
                        SUM(CAST(COALESCE(ethyl_alcohol_consumption, 0) AS DECIMAL(18,2))) AS total_ethyl_alcohol,
                        SUM(CAST(COALESCE(ethyl_acetate_consumption, 0) AS DECIMAL(18,2))) AS total_ethyl_acetate,
                        CAST(SUM(CAST(DATEDIFF(MILLISECOND, @periodStart, job_end_time) AS BIGINT)) AS BIGINT) AS total_duration_ms,
                        AVG(COALESCE(TRY_CAST(hedef_hiz AS DECIMAL(18,2)), 0)) AS avg_target_speed,
                        AVG(COALESCE(TRY_CAST(set_sayisi AS DECIMAL(18,2)), 0)) AS avg_set_count,
                        AVG(COALESCE(TRY_CAST(silindir_cevresi AS DECIMAL(18,2)), 0)) AS avg_cylinder_circumference,
                        SUM(COALESCE(TRY_CAST(toplam_miktar AS DECIMAL(18,2)), 0)) AS total_planned_quantity
                    FROM JobEndReports
                    WHERE job_end_time >= @periodStart AND job_end_time <= @periodEnd
                      AND job_start_time < @periodStart";

                using var completedCmd = new SqlCommand(completedJobsQuery, connection);
                completedCmd.Parameters.AddWithValue("@periodStart", periodStart);
                completedCmd.Parameters.AddWithValue("@periodEnd", periodEnd);

                int completedJobCount = 0;
                decimal? completedProduction = null;
                decimal? completedStoppage = null;
                decimal? completedEnergy = null;
                decimal? completedWastageBefore = null;
                decimal? completedWastageAfter = null;
                decimal? completedPaper = null;
                decimal? completedEthylAlcohol = null;
                decimal? completedEthylAcetate = null;
                long? completedDuration = null;
                decimal? completedAvgTargetSpeed = null;
                decimal? completedAvgSetCount = null;
                decimal? completedAvgCylinderCircumference = null;
                decimal? completedTotalPlannedQuantity = null;

                using var completedReader = await completedCmd.ExecuteReaderAsync();
                if (await completedReader.ReadAsync())
                {
                    completedJobCount = completedReader.IsDBNull(0) ? 0 : completedReader.GetInt32(0);
                    completedProduction = completedReader.IsDBNull(1) ? null : completedReader.GetDecimal(1);
                    completedStoppage = completedReader.IsDBNull(2) ? null : completedReader.GetDecimal(2);
                    completedEnergy = completedReader.IsDBNull(3) ? null : completedReader.GetDecimal(3);
                    completedWastageBefore = completedReader.IsDBNull(4) ? null : completedReader.GetDecimal(4);
                    completedWastageAfter = completedReader.IsDBNull(5) ? null : completedReader.GetDecimal(5);
                    completedPaper = completedReader.IsDBNull(6) ? null : completedReader.GetDecimal(6);
                    completedEthylAlcohol = completedReader.IsDBNull(7) ? null : completedReader.GetDecimal(7);
                    completedEthylAcetate = completedReader.IsDBNull(8) ? null : completedReader.GetDecimal(8);
                    completedDuration = completedReader.IsDBNull(9) ? null : (long?)Convert.ToInt64(completedReader.GetValue(9));
                    completedAvgTargetSpeed = completedReader.IsDBNull(10) ? null : completedReader.GetDecimal(10);
                    completedAvgSetCount = completedReader.IsDBNull(11) ? null : completedReader.GetDecimal(11);
                    completedAvgCylinderCircumference = completedReader.IsDBNull(12) ? null : completedReader.GetDecimal(12);
                    completedTotalPlannedQuantity = completedReader.IsDBNull(13) ? null : completedReader.GetDecimal(13);
                }
                completedReader.Close();

                // Dönem içinde başlayıp biten işleri al (OEE hesaplaması için ek bilgiler)
                var fullPeriodJobsQuery = @"
                    SELECT 
                        COUNT(*) AS job_count,
                        CAST(SUM(CAST(actual_production AS BIGINT)) AS DECIMAL(18,2)) AS total_production,
                        CAST(SUM(CAST(total_stoppage_duration AS BIGINT)) AS DECIMAL(18,2)) AS total_stoppage,
                        SUM(CAST(COALESCE(energy_consumption_kwh, 0) AS DECIMAL(18,2))) AS total_energy,
                        SUM(CAST(COALESCE(wastage_before_die, 0) AS DECIMAL(18,2))) AS total_wastage_before,
                        SUM(CAST(COALESCE(wastage_after_die, 0) AS DECIMAL(18,2))) AS total_wastage_after,
                        SUM(CAST(COALESCE(paper_consumption, 0) AS DECIMAL(18,2))) AS total_paper,
                        SUM(CAST(COALESCE(ethyl_alcohol_consumption, 0) AS DECIMAL(18,2))) AS total_ethyl_alcohol,
                        SUM(CAST(COALESCE(ethyl_acetate_consumption, 0) AS DECIMAL(18,2))) AS total_ethyl_acetate,
                        CAST(SUM(CAST(DATEDIFF(MILLISECOND, job_start_time, job_end_time) AS BIGINT)) AS BIGINT) AS total_duration_ms,
                        AVG(COALESCE(TRY_CAST(hedef_hiz AS DECIMAL(18,2)), 0)) AS avg_target_speed,
                        AVG(COALESCE(TRY_CAST(set_sayisi AS DECIMAL(18,2)), 0)) AS avg_set_count,
                        AVG(COALESCE(TRY_CAST(silindir_cevresi AS DECIMAL(18,2)), 0)) AS avg_cylinder_circumference,
                        SUM(COALESCE(TRY_CAST(toplam_miktar AS DECIMAL(18,2)), 0)) AS total_planned_quantity
                    FROM JobEndReports
                    WHERE job_start_time >= @periodStart AND job_end_time <= @periodEnd";

                using var fullPeriodCmd = new SqlCommand(fullPeriodJobsQuery, connection);
                fullPeriodCmd.Parameters.AddWithValue("@periodStart", periodStart);
                fullPeriodCmd.Parameters.AddWithValue("@periodEnd", periodEnd);

                int fullPeriodJobCount = 0;
                decimal? fullPeriodProduction = null;
                decimal? fullPeriodStoppage = null;
                decimal? fullPeriodEnergy = null;
                decimal? fullPeriodWastageBefore = null;
                decimal? fullPeriodWastageAfter = null;
                decimal? fullPeriodPaper = null;
                decimal? fullPeriodEthylAlcohol = null;
                decimal? fullPeriodEthylAcetate = null;
                long? fullPeriodDuration = null;
                decimal? fullPeriodAvgTargetSpeed = null;
                decimal? fullPeriodAvgSetCount = null;
                decimal? fullPeriodAvgCylinderCircumference = null;
                decimal? fullPeriodTotalPlannedQuantity = null;

                using var fullPeriodReader = await fullPeriodCmd.ExecuteReaderAsync();
                if (await fullPeriodReader.ReadAsync())
                {
                    fullPeriodJobCount = fullPeriodReader.IsDBNull(0) ? 0 : fullPeriodReader.GetInt32(0);
                    fullPeriodProduction = fullPeriodReader.IsDBNull(1) ? null : fullPeriodReader.GetDecimal(1);
                    fullPeriodStoppage = fullPeriodReader.IsDBNull(2) ? null : fullPeriodReader.GetDecimal(2);
                    fullPeriodEnergy = fullPeriodReader.IsDBNull(3) ? null : fullPeriodReader.GetDecimal(3);
                    fullPeriodWastageBefore = fullPeriodReader.IsDBNull(4) ? null : fullPeriodReader.GetDecimal(4);
                    fullPeriodWastageAfter = fullPeriodReader.IsDBNull(5) ? null : fullPeriodReader.GetDecimal(5);
                    fullPeriodPaper = fullPeriodReader.IsDBNull(6) ? null : fullPeriodReader.GetDecimal(6);
                    fullPeriodEthylAlcohol = fullPeriodReader.IsDBNull(7) ? null : fullPeriodReader.GetDecimal(7);
                    fullPeriodEthylAcetate = fullPeriodReader.IsDBNull(8) ? null : fullPeriodReader.GetDecimal(8);
                    fullPeriodDuration = fullPeriodReader.IsDBNull(9) ? null : (long?)Convert.ToInt64(fullPeriodReader.GetValue(9));
                    fullPeriodAvgTargetSpeed = fullPeriodReader.IsDBNull(10) ? null : fullPeriodReader.GetDecimal(10);
                    fullPeriodAvgSetCount = fullPeriodReader.IsDBNull(11) ? null : fullPeriodReader.GetDecimal(11);
                    fullPeriodAvgCylinderCircumference = fullPeriodReader.IsDBNull(12) ? null : fullPeriodReader.GetDecimal(12);
                    fullPeriodTotalPlannedQuantity = fullPeriodReader.IsDBNull(13) ? null : fullPeriodReader.GetDecimal(13);
                }
                fullPeriodReader.Close();

                // Canlı veriyi çek (devam eden işler için)
                decimal? liveProduction = null;
                decimal? liveStoppage = null;
                decimal? liveEnergy = null;
                decimal? liveWastageBefore = null;
                decimal? liveWastageAfter = null;
                double? liveOverallOEE = null;
                double? liveAvailability = null;
                double? livePerformance = null;
                double? liveQuality = null;
                
                if (!string.IsNullOrEmpty(machine))
                {
                    try
                    {
                        var httpClient = _httpClientFactory.CreateClient();
                        var baseUrl = $"{Request.Scheme}://{Request.Host}";
                        var liveDataUrl = $"{baseUrl}/api/plcdata/data?machine={Uri.EscapeDataString(machine)}";
                        
                        var response = await httpClient.GetAsync(liveDataUrl);
                        if (response.IsSuccessStatusCode)
                        {
                            var liveData = await response.Content.ReadFromJsonAsync<JsonElement>();
                            
                            // Aktif işin siparis_no ve cycle_start_time'ını kontrol et (yeni iş başladı mı?)
                            string? liveSiparisNo = null;
                            DateTime? liveCycleStartTime = null;
                            
                            try
                            {
                                var jobQuery = @"SELECT TOP 1 siparis_no, cycle_start_time FROM JobCycleRecords WHERE status = 'active' ORDER BY cycle_start_time DESC";
                                using var jobCmd = new SqlCommand(jobQuery, connection);
                                using var jobReader = await jobCmd.ExecuteReaderAsync();
                                if (await jobReader.ReadAsync())
                                {
                                    liveSiparisNo = jobReader["siparis_no"]?.ToString();
                                    var cycleStartOrdinal = jobReader.GetOrdinal("cycle_start_time");
                                    liveCycleStartTime = jobReader.IsDBNull(cycleStartOrdinal) ? null : jobReader.GetDateTime(cycleStartOrdinal);
                                }
                                jobReader.Close();
                            }
                            catch
                            {
                                // JobCycleRecords yoksa devam et
                            }
                            
                            // Yeni iş başladı mı kontrol et
                            bool isNewJob = false;
                            if (!string.IsNullOrEmpty(snapshotSiparisNo) && !string.IsNullOrEmpty(liveSiparisNo))
                            {
                                // Siparis_no farklıysa yeni iş başlamış
                                isNewJob = snapshotSiparisNo != liveSiparisNo;
                            }
                            else if (snapshotCycleStartTime.HasValue && liveCycleStartTime.HasValue)
                            {
                                // cycle_start_time farklıysa yeni iş başlamış
                                isNewJob = snapshotCycleStartTime.Value != liveCycleStartTime.Value;
                            }
                            
                            // Canlı veriden snapshot'a kadar olan farkı hesapla
                            if (liveData.TryGetProperty("actualProduction", out var liveProd) && liveProd.ValueKind == JsonValueKind.Number)
                            {
                                var currentProduction = liveProd.GetDecimal();
                                
                                // Eğer yeni iş başladıysa, snapshot'tan çıkarma yapma (yeni işin üretimi direkt kullanılır)
                                if (isNewJob)
                                {
                                    liveProduction = Math.Max(0, currentProduction);
                                }
                                else
                                {
                                    liveProduction = Math.Max(0, currentProduction - (snapshotProduction ?? 0));
                                }
                            }
                            
                            if (liveData.TryGetProperty("totalStoppageDuration", out var liveStop) && liveStop.ValueKind == JsonValueKind.Number)
                            {
                                var currentStoppage = liveStop.GetInt64();
                                // Yeni iş başladıysa snapshot'tan çıkarma
                                liveStoppage = isNewJob ? Math.Max(0, currentStoppage) : Math.Max(0, currentStoppage - (snapshotStoppage ?? 0));
                            }
                            
                            // Enerji kümülatif olduğu için canlı veriden snapshot'ı çıkar
                            decimal? currentEnergy = null;
                            if (liveData.TryGetProperty("totalEnergyKwh", out var liveEngTotal) && liveEngTotal.ValueKind == JsonValueKind.Number)
                            {
                                currentEnergy = liveEngTotal.GetDecimal();
                            }
                            else if (liveData.TryGetProperty("energyConsumptionKwh", out var liveEng) && liveEng.ValueKind == JsonValueKind.Number)
                            {
                                currentEnergy = liveEng.GetDecimal();
                            }
                            
                            if (currentEnergy.HasValue)
                            {
                                // Enerji her zaman kümülatif, snapshot'tan çıkar
                                liveEnergy = Math.Max(0, currentEnergy.Value - (snapshotEnergy ?? 0));
                            }
                            
                            if (liveData.TryGetProperty("wastageBeforeDie", out var liveWastBefore) && liveWastBefore.ValueKind == JsonValueKind.Number)
                            {
                                var currentWastBefore = liveWastBefore.GetDecimal();
                                liveWastageBefore = isNewJob ? Math.Max(0, currentWastBefore) : Math.Max(0, currentWastBefore - (snapshotWastageBefore ?? 0));
                            }
                            
                            if (liveData.TryGetProperty("wastageAfterDie", out var liveWastAfter) && liveWastAfter.ValueKind == JsonValueKind.Number)
                            {
                                var currentWastAfter = liveWastAfter.GetDecimal();
                                liveWastageAfter = isNewJob ? Math.Max(0, currentWastAfter) : Math.Max(0, currentWastAfter - (snapshotWastageAfter ?? 0));
                            }
                            
                            // OEE değerlerini al
                            if (liveData.TryGetProperty("overallOEE", out var liveOEE) && liveOEE.ValueKind == JsonValueKind.Number)
                            {
                                liveOverallOEE = liveOEE.GetDouble();
                            }
                            if (liveData.TryGetProperty("availability", out var liveAvail) && liveAvail.ValueKind == JsonValueKind.Number)
                            {
                                liveAvailability = liveAvail.GetDouble();
                            }
                            if (liveData.TryGetProperty("performance", out var livePerf) && livePerf.ValueKind == JsonValueKind.Number)
                            {
                                livePerformance = livePerf.GetDouble();
                            }
                            if (liveData.TryGetProperty("quality", out var liveQual) && liveQual.ValueKind == JsonValueKind.Number)
                            {
                                liveQuality = liveQual.GetDouble();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Canlı veri çekilirken hata oluştu, devam eden işler için veri eklenmeyecek");
                    }
                }

                // Toplam hesaplama
                // Mantık:
                // 1. completedProduction: Dönem başından ÖNCE başlayıp dönem içinde BİTEN işlerin TOPLAM üretimi
                //    Bu işlerin snapshot'taki değerini çıkarmalıyız (çünkü snapshot dönem başındaki kümülatif değer)
                // 2. fullPeriodProduction: Dönem içinde başlayıp biten işler, snapshot'tan çıkarma yapmayız
                // 3. liveProduction: Devam eden iş için (canlı - snapshot) zaten hesaplanmış
                
                // ÖNEMLİ: Eğer completedJobCount = 0 ise, snapshot'tan çıkarma yapmamalıyız!
                // Çünkü snapshot sadece devam eden işin başlangıç değerini içerir
                var totalJobCount = completedJobCount + fullPeriodJobCount + (liveProduction.HasValue && liveProduction.Value > 0 ? 1 : 0);
                
                decimal totalProduction;
                if (completedJobCount > 0)
                {
                    // Dönem içinde biten iş var: Toplam üretimden snapshot'taki üretimi çıkar
                    totalProduction = (completedProduction ?? 0) - (snapshotProduction ?? 0) + (fullPeriodProduction ?? 0) + (liveProduction ?? 0);
                }
                else
                {
                    // Dönem içinde biten iş yok: Sadece devam eden iş varsa liveProduction'ı kullan
                    totalProduction = (fullPeriodProduction ?? 0) + (liveProduction ?? 0);
                }
                decimal totalStoppage;
                if (completedJobCount > 0)
                {
                    totalStoppage = (completedStoppage ?? 0) - (snapshotStoppage ?? 0) + (fullPeriodStoppage ?? 0) + (liveStoppage ?? 0);
                }
                else
                {
                    totalStoppage = (fullPeriodStoppage ?? 0) + (liveStoppage ?? 0);
                }
                
                // Enerji: JobEndReports'taki işlerin enerjisi + (Canlı enerji - Snapshot enerji)
                var totalEnergy = (completedEnergy ?? 0) + (fullPeriodEnergy ?? 0) + (liveEnergy ?? 0);
                
                // Fire (Wastage) hesaplama
                decimal totalWastageBefore;
                decimal totalWastageAfter;
                if (completedJobCount > 0)
                {
                    totalWastageBefore = (completedWastageBefore ?? 0) - (snapshotWastageBefore ?? 0) + (fullPeriodWastageBefore ?? 0) + (liveWastageBefore ?? 0);
                    totalWastageAfter = (completedWastageAfter ?? 0) - (snapshotWastageAfter ?? 0) + (fullPeriodWastageAfter ?? 0) + (liveWastageAfter ?? 0);
                }
                else
                {
                    totalWastageBefore = (fullPeriodWastageBefore ?? 0) + (liveWastageBefore ?? 0);
                    totalWastageAfter = (fullPeriodWastageAfter ?? 0) + (liveWastageAfter ?? 0);
                }
                
                decimal totalPaper;
                decimal totalEthylAlcohol;
                decimal totalEthylAcetate;
                if (completedJobCount > 0)
                {
                    totalPaper = (completedPaper ?? 0) - (snapshotPaper ?? 0) + (fullPeriodPaper ?? 0);
                    totalEthylAlcohol = (completedEthylAlcohol ?? 0) - (snapshotEthylAlcohol ?? 0) + (fullPeriodEthylAlcohol ?? 0);
                    totalEthylAcetate = (completedEthylAcetate ?? 0) - (snapshotEthylAcetate ?? 0) + (fullPeriodEthylAcetate ?? 0);
                }
                else
                {
                    totalPaper = (fullPeriodPaper ?? 0);
                    totalEthylAlcohol = (fullPeriodEthylAlcohol ?? 0);
                    totalEthylAcetate = (fullPeriodEthylAcetate ?? 0);
                }

                // Negatif değerleri sıfırla
                totalProduction = Math.Max(0, totalProduction);
                totalStoppage = Math.Max(0, totalStoppage);
                totalEnergy = Math.Max(0, totalEnergy);
                totalWastageBefore = Math.Max(0, totalWastageBefore);
                totalWastageAfter = Math.Max(0, totalWastageAfter);

                // Periyodik OEE hesaplama - Her iş için ayrı ayrı hesaplayıp ortalamasını al
                double? calculatedAvailability = null;
                double? calculatedPerformance = null;
                double? calculatedQuality = null;
                double? calculatedOverallOEE = null;

                // Tüm işleri al (dönem içinde biten + dönem içinde başlayıp biten)
                var allJobsQuery = @"
                    SELECT 
                        id,
                        toplam_miktar,
                        kalan_miktar,
                        set_sayisi,
                        silindir_cevresi,
                        hedef_hiz,
                        actual_production,
                        wastage_before_die,
                        wastage_after_die,
                        total_stoppage_duration,
                        job_start_time,
                        job_end_time
                    FROM JobEndReports
                    WHERE (job_end_time >= @periodStart AND job_end_time <= @periodEnd AND job_start_time < @periodStart)
                       OR (job_start_time >= @periodStart AND job_end_time <= @periodEnd)";

                using var allJobsCmd = new SqlCommand(allJobsQuery, connection);
                allJobsCmd.Parameters.AddWithValue("@periodStart", periodStart);
                allJobsCmd.Parameters.AddWithValue("@periodEnd", periodEnd);

                var oeeValues = new List<(double availability, double performance, double quality, double overall)>();
                
                using var allJobsReader = await allJobsCmd.ExecuteReaderAsync();
                while (await allJobsReader.ReadAsync())
                {
                    try
                    {
                        // Her iş için OEE hesapla - GetOEECalculation mantığı
                        // Güvenli parse işlemleri (NVARCHAR değerler için)
                        decimal kalanMiktar = 0;
                        if (decimal.TryParse(allJobsReader["kalan_miktar"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var kalanMiktarParsed))
                        {
                            kalanMiktar = kalanMiktarParsed;
                        }
                        
                        int setSayisi = 0;
                        if (int.TryParse(allJobsReader["set_sayisi"]?.ToString(), out var setSayisiParsed))
                        {
                            setSayisi = setSayisiParsed;
                        }
                        
                        decimal silindirCevresi = 0;
                        if (decimal.TryParse(allJobsReader["silindir_cevresi"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var silindirCevresiParsed))
                        {
                            silindirCevresi = silindirCevresiParsed;
                        }
                        
                        int hedefHiz = 0;
                        if (int.TryParse(allJobsReader["hedef_hiz"]?.ToString(), out var hedefHizParsed))
                        {
                            hedefHiz = hedefHizParsed;
                        }
                        
                        int actualProd = 0;
                        if (int.TryParse(allJobsReader["actual_production"]?.ToString(), out var actualProdParsed))
                        {
                            actualProd = actualProdParsed;
                        }
                        
                        decimal wastageBefore = 0;
                        if (decimal.TryParse(allJobsReader["wastage_before_die"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var wastageBeforeParsed))
                        {
                            wastageBefore = wastageBeforeParsed;
                        }
                        
                        decimal wastageAfter = 0;
                        if (decimal.TryParse(allJobsReader["wastage_after_die"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var wastageAfterParsed))
                        {
                            wastageAfter = wastageAfterParsed;
                        }
                        
                        decimal jobTotalStoppage = 0;
                        if (decimal.TryParse(allJobsReader["total_stoppage_duration"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var jobTotalStoppageParsed))
                        {
                            jobTotalStoppage = jobTotalStoppageParsed;
                        }
                        
                        if (!DateTime.TryParse(allJobsReader["job_start_time"]?.ToString(), out var jobStartTime) ||
                            !DateTime.TryParse(allJobsReader["job_end_time"]?.ToString(), out var jobEndTime))
                        {
                            continue; // Tarih parse edilemezse bu işi atla
                        }
                        
                        decimal toplamMiktar = 0;
                        if (decimal.TryParse(allJobsReader["toplam_miktar"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var toplamMiktarParsed))
                        {
                            toplamMiktar = toplamMiktarParsed;
                        }

                        // Planlanan Süre
                        var hesaplanacakMiktar = (kalanMiktar <= 0) ? toplamMiktar : kalanMiktar;
                        var adim1 = hesaplanacakMiktar / setSayisi;
                        var adim2 = silindirCevresi / 1000; // mm -> m
                        var adim3 = adim2 / hedefHiz;
                        var planlananSure = adim1 * adim3;

                        // Gerçek Çalışma Süresi
                        var gercekCalismaSuresi = (decimal)(jobEndTime - jobStartTime).TotalMinutes;

                        // Duruş Süresi
                        var durusSuresiDakika = (jobTotalStoppage / 1000) / 60; // ms -> dakika
                        if (durusSuresiDakika > gercekCalismaSuresi * 0.8m)
                        {
                            durusSuresiDakika = gercekCalismaSuresi * 0.8m;
                        }

                        // Hatalı Üretim
                        var dieOncesiAdet = (wastageBefore * 1000 / silindirCevresi) * setSayisi;
                        var hataliUretim = dieOncesiAdet + wastageAfter;
                        var totalCount = (decimal)actualProd + hataliUretim;

                        // OEE Bileşenleri
                        var runTimeForAvailability = planlananSure - durusSuresiDakika;
                        if (runTimeForAvailability < 0) runTimeForAvailability = 0;
                        var availability = planlananSure > 0 ? (double)((runTimeForAvailability / planlananSure) * 100) : 0;
                        availability = Math.Max(0, Math.Min(100, availability));

                        var runTimeForPerformance = gercekCalismaSuresi - durusSuresiDakika;
                        if (runTimeForPerformance < 0) runTimeForPerformance = 0;
                        var idealCycleTime = (silindirCevresi / 1000) / (hedefHiz * setSayisi);
                        var performance = runTimeForPerformance > 0 ? (double)((idealCycleTime * totalCount) / runTimeForPerformance * 100) : 0;
                        performance = Math.Max(0, Math.Min(100, performance));

                        var totalCountForQuality = (decimal)actualProd + hataliUretim;
                        var goodCount = (decimal)actualProd;
                        var quality = totalCountForQuality > 0 ? (double)((goodCount / totalCountForQuality) * 100) : 0;
                        quality = Math.Max(0, Math.Min(100, quality));

                        var oee = (availability * performance * quality) / 10000.0;
                        oee = Math.Max(0, Math.Min(100, oee));

                        oeeValues.Add((availability, performance, quality, oee));
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"İş OEE hesaplanırken hata oluştu, atlanıyor");
                    }
                }
                allJobsReader.Close();

                // Devam eden iş varsa canlı veriden OEE değerlerini ekle
                if (liveProduction.HasValue && liveProduction.Value > 0 && 
                    liveOverallOEE.HasValue && liveAvailability.HasValue && 
                    livePerformance.HasValue && liveQuality.HasValue)
                {
                    oeeValues.Add((
                        liveAvailability.Value,
                        livePerformance.Value,
                        liveQuality.Value,
                        liveOverallOEE.Value
                    ));
                }

                // Ortalama OEE değerlerini hesapla
                if (oeeValues.Count > 0)
                {
                    calculatedAvailability = oeeValues.Average(v => v.availability);
                    calculatedPerformance = oeeValues.Average(v => v.performance);
                    calculatedQuality = oeeValues.Average(v => v.quality);
                    calculatedOverallOEE = oeeValues.Average(v => v.overall);
                }

                return Ok(new
                {
                    success = true,
                    period = period.ToLower(),
                    startDate = periodStart,
                    endDate = periodEnd,
                    machine = machine,
                    summary = new
                    {
                        jobCount = totalJobCount,
                        actualProduction = (long)totalProduction,
                        totalStoppageDuration = (long)totalStoppage, // ms
                        energyConsumptionKwh = Math.Round((double)totalEnergy, 2),
                        wastageBeforeDie = Math.Round((double)totalWastageBefore, 2),
                        wastageAfterDie = Math.Round((double)totalWastageAfter, 2),
                        paperConsumption = Math.Round((double)totalPaper, 2),
                        ethylAlcoholConsumption = Math.Round((double)totalEthylAlcohol, 2),
                        ethylAcetateConsumption = Math.Round((double)totalEthylAcetate, 2),
                        // Periyodik OEE (periyodun kendi verilerinden hesaplanan)
                        overallOEE = calculatedOverallOEE.HasValue ? Math.Round(calculatedOverallOEE.Value, 2) : (double?)null,
                        availability = calculatedAvailability.HasValue ? Math.Round(calculatedAvailability.Value, 2) : (double?)null,
                        performance = calculatedPerformance.HasValue ? Math.Round(calculatedPerformance.Value, 2) : (double?)null,
                        quality = calculatedQuality.HasValue ? Math.Round(calculatedQuality.Value, 2) : (double?)null
                    },
                    snapshot = new
                    {
                        date = snapshotDate,
                        actualProduction = snapshotProduction.HasValue ? (long?)snapshotProduction.Value : null,
                        totalStoppageDuration = snapshotStoppage.HasValue ? (long?)snapshotStoppage.Value : null,
                        energyConsumptionKwh = snapshotEnergy.HasValue ? (double?)snapshotEnergy.Value : null
                    }
                });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new
                {
                    success = false,
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Periodic summary getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Periodic summary getirilemedi",
                    message = ex.Message
                });
            }
        }

        // POST: api/reports/manual-snapshot?snapshotType=daily
        // Test için manuel snapshot tetikleme endpoint'i
        [HttpPost("manual-snapshot")]
        public async Task<IActionResult> TriggerManualSnapshot([FromQuery] string? snapshotType = "daily")
        {
            try
            {
                // Test için bugünün tarihini kullan
                var snapshotDate = DateTime.Now.Date;
                
                var machines = await _dashboardContext.MachineLists.ToListAsync();
                var results = new List<object>();

                foreach (var machine in machines)
                {
                    try
                    {
                        var tableName = machine.TableName;
                        if (string.IsNullOrWhiteSpace(tableName))
                        {
                            results.Add(new { machine = machine.MachineName, status = "skipped", reason = "TableName yok" });
                            continue;
                        }

                        var databaseName = !string.IsNullOrWhiteSpace(machine.DatabaseName)
                            ? machine.DatabaseName
                            : tableName;

                        var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

                        // Tablo var mı kontrol et, yoksa oluştur
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
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_PeriodicSnapshots_type_date ON PeriodicSnapshots(snapshot_type, snapshot_date);
    CREATE INDEX IX_PeriodicSnapshots_siparis_no ON PeriodicSnapshots(siparis_no);
    CREATE INDEX IX_PeriodicSnapshots_cycle_start ON PeriodicSnapshots(cycle_start_time);
    CREATE INDEX IX_PeriodicSnapshots_snapshot_date ON PeriodicSnapshots(snapshot_date);
END";

                        using var createCmd = new SqlCommand(createTableQuery, connection);
                        await createCmd.ExecuteNonQueryAsync();

                        // Canlı veriyi çek
                        var apiBaseUrl = _configuration["ApiBaseUrl"] ?? "http://localhost:5199";
                        var url = $"{apiBaseUrl}/api/plcdata/data?machine={Uri.EscapeDataString(tableName)}";
                        var httpClient = _httpClientFactory.CreateClient();
                        httpClient.Timeout = TimeSpan.FromSeconds(10);
                        var response = await httpClient.GetAsync(url);

                        if (!response.IsSuccessStatusCode)
                        {
                            results.Add(new { machine = machine.MachineName, status = "error", error = $"API'den veri alınamadı: {response.StatusCode}" });
                            continue;
                        }

                        var fullJsonString = await response.Content.ReadAsStringAsync();
                        var jsonDoc = JsonDocument.Parse(fullJsonString);
                        var root = jsonDoc.RootElement;

                        // Aktif iş bilgisini al
                        string? siparisNo = null;
                        DateTime? cycleStartTime = null;
                        try
                        {
                            var jobQuery = @"SELECT TOP 1 siparis_no, cycle_start_time FROM JobCycleRecords WHERE status = 'active' ORDER BY cycle_start_time DESC";
                            using var jobCmd = new SqlCommand(jobQuery, connection);
                            using var jobReader = await jobCmd.ExecuteReaderAsync();
                            if (await jobReader.ReadAsync())
                            {
                                siparisNo = jobReader["siparis_no"]?.ToString();
                                var cycleStartTimeOrdinal = jobReader.GetOrdinal("cycle_start_time");
                                cycleStartTime = jobReader.IsDBNull(cycleStartTimeOrdinal) ? null : jobReader.GetDateTime(cycleStartTimeOrdinal);
                            }
                            jobReader.Close();
                        }
                        catch
                        {
                            // JobCycleRecords yoksa devam et
                        }

                        // Tüm değerleri parse et (PeriodicSnapshotService mantığıyla aynı)
                        int? actualProd = null;
                        if (root.TryGetProperty("actualProduction", out var prod))
                        {
                            actualProd = prod.ValueKind == JsonValueKind.Number ? prod.GetInt32() : null;
                        }

                        decimal? totalStoppageDuration = null;
                        if (root.TryGetProperty("totalStoppageDuration", out var stop))
                        {
                            totalStoppageDuration = stop.ValueKind == JsonValueKind.Number ? stop.GetDecimal() : null;
                        }

                        decimal? energy = null;
                        if (root.TryGetProperty("totalEnergyKwh", out var engTotal))
                        {
                            energy = engTotal.ValueKind == JsonValueKind.Number ? engTotal.GetDecimal() : null;
                        }
                        else if (root.TryGetProperty("energyConsumptionKwh", out var eng))
                        {
                            energy = eng.ValueKind == JsonValueKind.Number ? eng.GetDecimal() : null;
                        }

                        decimal? wastageBeforeDie = null;
                        if (root.TryGetProperty("wastageBeforeDie", out var wastBefore))
                        {
                            wastageBeforeDie = wastBefore.ValueKind == JsonValueKind.Number ? wastBefore.GetDecimal() : null;
                        }

                        decimal? wastageAfterDie = null;
                        if (root.TryGetProperty("wastageAfterDie", out var wastAfter))
                        {
                            wastageAfterDie = wastAfter.ValueKind == JsonValueKind.Number ? wastAfter.GetDecimal() : null;
                        }

                        decimal? paperConsumption = null;
                        if (root.TryGetProperty("paperConsumption", out var paper))
                        {
                            paperConsumption = paper.ValueKind == JsonValueKind.Number ? paper.GetDecimal() : null;
                        }

                        decimal? ethylAlcoholConsumption = null;
                        if (root.TryGetProperty("ethylAlcoholConsumption", out var ethyl))
                        {
                            ethylAlcoholConsumption = ethyl.ValueKind == JsonValueKind.Number ? ethyl.GetDecimal() : null;
                        }

                        decimal? ethylAcetateConsumption = null;
                        if (root.TryGetProperty("ethylAcetateConsumption", out var acetate))
                        {
                            ethylAcetateConsumption = acetate.ValueKind == JsonValueKind.Number ? acetate.GetDecimal() : null;
                        }

                        decimal? plannedTime = null;
                        if (root.TryGetProperty("plannedTime", out var planned))
                        {
                            plannedTime = planned.ValueKind == JsonValueKind.Number ? planned.GetDecimal() : null;
                        }

                        decimal? runTime = null;
                        if (root.TryGetProperty("runTime", out var run))
                        {
                            runTime = run.ValueKind == JsonValueKind.Number ? run.GetDecimal() : null;
                        }

                        // Snapshot kaydet - tüm alanları kaydet
                        var checkQuery = "SELECT Id FROM PeriodicSnapshots WHERE snapshot_type = @snapshotType AND snapshot_date = @snapshotDate";
                        using var checkCmd = new SqlCommand(checkQuery, connection);
                        checkCmd.Parameters.AddWithValue("@snapshotType", snapshotType);
                        checkCmd.Parameters.AddWithValue("@snapshotDate", snapshotDate);
                        var existingId = await checkCmd.ExecuteScalarAsync();

                        if (existingId != null && existingId != DBNull.Value)
                        {
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
                            updateCmd.Parameters.AddWithValue("@siparisNo", siparisNo ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@cycleStartTime", cycleStartTime ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@actualProduction", actualProd ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@totalStoppageDuration", totalStoppageDuration ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@energyConsumptionKwh", energy ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@wastageBeforeDie", wastageBeforeDie ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@wastageAfterDie", wastageAfterDie ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@paperConsumption", paperConsumption ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@ethylAlcoholConsumption", ethylAlcoholConsumption ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@ethylAcetateConsumption", ethylAcetateConsumption ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@plannedTime", plannedTime ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@runTime", runTime ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@fullLiveData", fullJsonString ?? (object)DBNull.Value);
                            updateCmd.Parameters.AddWithValue("@id", existingId);
                            await updateCmd.ExecuteNonQueryAsync();
                        }
                        else
                        {
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
                            insertCmd.Parameters.AddWithValue("@snapshotType", snapshotType);
                            insertCmd.Parameters.AddWithValue("@snapshotDate", snapshotDate);
                            insertCmd.Parameters.AddWithValue("@siparisNo", siparisNo ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@cycleStartTime", cycleStartTime ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@actualProduction", actualProd ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@totalStoppageDuration", totalStoppageDuration ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@energyConsumptionKwh", energy ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@wastageBeforeDie", wastageBeforeDie ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@wastageAfterDie", wastageAfterDie ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@paperConsumption", paperConsumption ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@ethylAlcoholConsumption", ethylAlcoholConsumption ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@ethylAcetateConsumption", ethylAcetateConsumption ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@plannedTime", plannedTime ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@runTime", runTime ?? (object)DBNull.Value);
                            insertCmd.Parameters.AddWithValue("@fullLiveData", fullJsonString ?? (object)DBNull.Value);
                            await insertCmd.ExecuteNonQueryAsync();
                        }

                        results.Add(new { machine = machine.MachineName, status = "success", date = snapshotDate });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"{machine.MachineName} için snapshot alınırken hata");
                        results.Add(new { machine = machine.MachineName, status = "error", error = ex.Message });
                    }
                }

                return Ok(new
                {
                    success = true,
                    message = $"{snapshotType} snapshot tetiklendi",
                    snapshotType = snapshotType,
                    snapshotDate = snapshotDate,
                    results = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Manuel snapshot tetiklenirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
