using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System;
using System.Text.Json;
using System.Linq;
using DashboardBackend.Services;
using DashboardBackend.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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
            PrivacyService privacyService)
        {
            _configuration = configuration;
            _logger = logger;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
            _privacyService = privacyService;
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
    }
}
