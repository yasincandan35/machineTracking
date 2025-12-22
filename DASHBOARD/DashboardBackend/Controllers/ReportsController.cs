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
                            average_speed, run_time_seconds,
                            total_wastage_package, total_wastage_meters,
                            wastage_after_quality_control,
                            wastage_after_quality_control_updated_by,
                            wastage_after_quality_control_updated_at,
                            job_start_time, job_end_time, created_at
                        FROM JobEndReports 
                        ORDER BY created_at DESC"
                    : @"
                        SELECT TOP 1000
                            id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                            bundle, silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                            paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                            wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                            energy_consumption_kwh,
                            average_speed, run_time_seconds,
                            total_wastage_package, total_wastage_meters,
                            wastage_after_quality_control,
                            wastage_after_quality_control_updated_by,
                            wastage_after_quality_control_updated_at,
                            job_start_time, job_end_time, created_at
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
                        averageSpeed = reader["average_speed"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader["average_speed"]),
                        runTimeSeconds = reader["run_time_seconds"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["run_time_seconds"]),
                        totalWastagePackage = reader["total_wastage_package"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader["total_wastage_package"]),
                        totalWastageMeters = reader["total_wastage_meters"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader["total_wastage_meters"]),
                        wastageAfterQualityControl = reader["wastage_after_quality_control"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader["wastage_after_quality_control"]),
                        wastageAfterQualityControlUpdatedBy = reader["wastage_after_quality_control_updated_by"] == DBNull.Value ? null : reader["wastage_after_quality_control_updated_by"]?.ToString(),
                        wastageAfterQualityControlUpdatedAt = reader["wastage_after_quality_control_updated_at"] == DBNull.Value ? (DateTime?)null : Convert.ToDateTime(reader["wastage_after_quality_control_updated_at"]),
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

        [HttpPut("wastage-after-quality-control/{reportId}")]
        public async Task<IActionResult> UpdateWastageAfterQualityControl(int reportId, [FromBody] UpdateWastageRequest request, [FromQuery] string? machine = null)
        {
            try
            {
                // Kullanıcı kontrolü
                var currentUser = await GetCurrentUserAsync();
                if (currentUser == null)
                {
                    return Unauthorized(new { success = false, error = "Kullanıcı bulunamadı" });
                }

                // Rol kontrolü - wastageAfterQualityControl giriş yetkisi
                var normalizedRole = currentUser.Role?.Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(normalizedRole))
                {
                    return StatusCode(403, new { success = false, error = "Kullanıcı rolü bulunamadı" });
                }

                var roleSetting = await _dashboardContext.RoleSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(r => r.Name == normalizedRole);

                if (roleSetting == null || !roleSetting.CanUpdateWastageAfterQualityControl)
                {
                    return StatusCode(403, new { success = false, error = "Bu işlem için yetkiniz bulunmamaktadır" });
                }
                
                var connectionInfo = await GetConnectionInfoAsync(machine);
                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                // Önce mevcut kaydı kontrol et ve gerekli değerleri al
                var checkQuery = @"
                    SELECT id, siparis_no, wastage_after_die, wastage_before_die, set_sayisi, silindir_cevresi, wastage_after_quality_control
                    FROM JobEndReports 
                    WHERE id = @reportId";
                using var checkCmd = new SqlCommand(checkQuery, connection);
                checkCmd.Parameters.AddWithValue("@reportId", reportId);
                
                decimal? oldWastageAfterQualityControl = null;
                decimal? wastageAfterDie = null;
                decimal? wastageBeforeDie = null;
                int? setSayisi = null;
                string? silindirCevresi = null;
                
                using var reader = await checkCmd.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    return NotFound(new { success = false, error = "Rapor bulunamadı" });
                }
                
                // Mevcut değerleri al
                if (reader["wastage_after_die"] != DBNull.Value)
                    wastageAfterDie = Convert.ToDecimal(reader["wastage_after_die"]);
                if (reader["wastage_before_die"] != DBNull.Value)
                    wastageBeforeDie = Convert.ToDecimal(reader["wastage_before_die"]);
                if (reader["set_sayisi"] != DBNull.Value)
                    setSayisi = Convert.ToInt32(reader["set_sayisi"]);
                if (reader["silindir_cevresi"] != DBNull.Value)
                    silindirCevresi = reader["silindir_cevresi"].ToString();
                if (reader["wastage_after_quality_control"] != DBNull.Value)
                    oldWastageAfterQualityControl = Convert.ToDecimal(reader["wastage_after_quality_control"]);
                
                reader.Close();

                // total_wastage_package'i hesapla
                // totalWastagePackage = wastageAfterDie + ((wastageBeforeDie*1000/silindir_cevresi)*set_sayisi) + wastageAfterQualityControl
                decimal? newTotalWastagePackage = null;
                if (wastageAfterDie.HasValue && wastageBeforeDie.HasValue && setSayisi.HasValue && setSayisi.Value > 0 && !string.IsNullOrEmpty(silindirCevresi))
                {
                    try
                    {
                        var silindirCevresiDecimal = decimal.Parse(silindirCevresi.Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                        if (silindirCevresiDecimal > 0)
                        {
                            var basePackage = wastageAfterDie.Value + ((wastageBeforeDie.Value * 1000 / silindirCevresiDecimal) * setSayisi.Value);
                            newTotalWastagePackage = basePackage + request.wastageAfterQualityControl;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "total_wastage_package hesaplanırken hata oluştu");
                    }
                }

                // Güncelleme sorgusu
                var updateQuery = @"
                    UPDATE JobEndReports 
                    SET wastage_after_quality_control = @wastageAfterQualityControl,
                        wastage_after_quality_control_updated_by = @updatedBy,
                        wastage_after_quality_control_updated_at = @updatedAt" +
                    (newTotalWastagePackage.HasValue ? ", total_wastage_package = @totalWastagePackage" : "") + @"
                    WHERE id = @reportId";

                using var updateCmd = new SqlCommand(updateQuery, connection);
                updateCmd.Parameters.AddWithValue("@reportId", reportId);
                updateCmd.Parameters.AddWithValue("@wastageAfterQualityControl", request.wastageAfterQualityControl);
                updateCmd.Parameters.AddWithValue("@updatedBy", currentUser.Username ?? "Unknown");
                updateCmd.Parameters.AddWithValue("@updatedAt", DateTime.UtcNow);
                if (newTotalWastagePackage.HasValue)
                {
                    updateCmd.Parameters.AddWithValue("@totalWastagePackage", newTotalWastagePackage.Value);
                }

                var rowsAffected = await updateCmd.ExecuteNonQueryAsync();

                if (rowsAffected > 0)
                {
                    return Ok(new
                    {
                        success = true,
                        message = "Kalite kontrol sonrası fire güncellendi",
                        data = new
                        {
                            reportId,
                            wastageAfterQualityControl = request.wastageAfterQualityControl,
                            updatedBy = currentUser.Username,
                            updatedAt = DateTime.UtcNow
                        }
                    });
                }
                else
                {
                    return BadRequest(new { success = false, error = "Güncelleme başarısız" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kalite kontrol sonrası fire güncelleme hatası: {ReportId}", reportId);
                return StatusCode(500, new
                {
                    success = false,
                    error = "Güncelleme sırasında hata oluştu",
                    message = ex.Message
                });
            }
        }

        public class UpdateWastageRequest
        {
            public decimal wastageAfterQualityControl { get; set; }
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
                        wastage_after_quality_control,
                        average_speed,
                        total_stoppage_duration,
                        planned_production_time,
                        setup,
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
                    var wastageAfterQualityControl = reader["wastage_after_quality_control"] == DBNull.Value ? 0m : decimal.Parse(reader["wastage_after_quality_control"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var totalStoppageDuration = decimal.Parse(reader["total_stoppage_duration"].ToString().Replace(",", "."), System.Globalization.CultureInfo.InvariantCulture);
                    var averageSpeed = reader["average_speed"] == DBNull.Value ? (decimal?)null : Convert.ToDecimal(reader["average_speed"]);
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
                    
                    // 1. Availability = (Runtime / Planned Production Time) × 100
                    // Runtime = Planned Production Time - Downtime
                    // NOT: Buradaki "Runtime" run_time_seconds ile KARIŞTIRILMAMALI!
                    // - run_time_seconds: 65 m/dk üstü çalışma süresi (saniye cinsinden, performans için)
                    // - Availability Runtime: Planlanan süre - Duruş süresi (dakika cinsinden, availability için)
                    // Planned Production Time = planlananSure (setup dahil, dakika cinsinden)
                    var plannedProductionTime = reader["planned_production_time"] == DBNull.Value 
                        ? (decimal?)null 
                        : Convert.ToDecimal(reader["planned_production_time"]);
                    
                    // Eğer planned_production_time yoksa hesapla (dakika cinsinden)
                    if (!plannedProductionTime.HasValue)
                    {
                        // Mevcut hesaplanacakMiktar, adim1, adim2, adim3 değerlerini kullan
                        var setup = reader["setup"] == DBNull.Value ? 0m : Convert.ToDecimal(reader["setup"]);
                        plannedProductionTime = planlananSure + setup; // Setup dahil, dakika cinsinden
                    }
                    
                    // Availability Runtime = Planned Production Time - Downtime (ikisi de dakika cinsinden)
                    var availabilityRuntime = plannedProductionTime.HasValue ? plannedProductionTime.Value - durusSuresiDakika : 0;
                    if (availabilityRuntime < 0) availabilityRuntime = 0;
                    var availability = plannedProductionTime.HasValue && plannedProductionTime.Value > 0 
                        ? (availabilityRuntime / plannedProductionTime.Value) * 100 
                        : 0;
                    
                    // 2. Performance = (Average Speed / Target Speed) × 100
                    // average_speed zaten hesaplanmış (65 m/dk üstü hızlardan, m/dk cinsinden)
                    // hedefHiz = target speed (m/dk cinsinden)
                    var performance = (averageSpeed.HasValue && averageSpeed.Value > 0 && hedefHiz > 0) 
                        ? (averageSpeed.Value / hedefHiz) * 100 
                        : 0;
                    if (performance > 100) performance = 100; // %100'ü geçemez
                    
                    // 3. Quality = Good Count / Total Count
                    // Total Count = Gerçek Üretim + Fireler (toplam üretilen adet)
                    // Good Count = Gerçek Üretim - Kalite Kontrol Sonrası Fire (wastageAfterQualityControl)
                    var totalCountForQuality = (decimal)actualProduction + hataliUretim; // Fireler dahil toplam üretim
                    var goodCount = (decimal)actualProduction - wastageAfterQualityControl; // Kalite kontrol sonrası fireler düşülmüş iyi üretim
                    if (goodCount < 0) goodCount = 0; // Negatif olamaz
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
                        averageSpeed = averageSpeed.HasValue ? Math.Round(averageSpeed.Value, 2) : (decimal?)null,
                        actualProduction = actualProduction,
                        wastageBeforeDie = wastageBeforeDie,
                        wastageAfterDie = wastageAfterDie,
                        wastageAfterQualityControl = wastageAfterQualityControl,
                        totalStoppageDuration = totalStoppageDuration,
                        
                        // Hesaplanan Değerler
                        planlananSure = Math.Round(planlananSure, 2),
                        plannedProductionTime = plannedProductionTime.HasValue ? Math.Round(plannedProductionTime.Value, 2) : (decimal?)null,
                        gercekCalismaSuresi = Math.Round(gercekCalismaSuresi, 2),
                        hedefUretim = hedefUretim,
                        dieOncesiAdet = Math.Round(dieOncesiAdet, 0),
                        hataliUretim = Math.Round(hataliUretim, 0),
                        availabilityRuntime = Math.Round(availabilityRuntime, 2),
                        durusSuresiDakika = Math.Round(durusSuresiDakika, 2),
                        totalCountForQuality = Math.Round(totalCountForQuality, 0),
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

                // Period'a göre start ve end tarihlerini (lokal zamana göre) belirle
                // Frontend'den gelen tarihler UTC olarak geliyor, bunları local time'a çevir
                var now = DateTime.Now;
                DateTime? startLocal = null;
                DateTime? endLocal = null;
                
                if (start.HasValue)
                {
                    // DateTime.Kind Unspecified ise UTC olarak kabul et
                    var startUtc = start.Value.Kind == DateTimeKind.Utc 
                        ? start.Value 
                        : DateTime.SpecifyKind(start.Value, DateTimeKind.Utc);
                    startLocal = startUtc.ToLocalTime();
                }
                
                if (end.HasValue)
                {
                    // DateTime.Kind Unspecified ise UTC olarak kabul et
                    var endUtc = end.Value.Kind == DateTimeKind.Utc 
                        ? end.Value 
                        : DateTime.SpecifyKind(end.Value, DateTimeKind.Utc);
                    endLocal = endUtc.ToLocalTime();
                }
                
                DateTime periodStart, periodEnd;

                switch (period.ToLower())
                {
                    case "daily":
                        periodStart = startLocal ?? now.Date;
                        periodEnd = endLocal ?? periodStart.AddDays(1).AddTicks(-1);
                        break;
                    case "weekly":
                        if (startLocal.HasValue)
                        {
                            // Haftanın başlangıcı (Pazartesi)
                            var daysToSubtract = (int)startLocal.Value.DayOfWeek - (int)DayOfWeek.Monday;
                            periodStart = startLocal.Value.Date.AddDays(-daysToSubtract);
                        }
                        else
                        {
                            // Bu haftanın başlangıcı (Pazartesi)
                            var daysToSubtract = (int)now.DayOfWeek - (int)DayOfWeek.Monday;
                            periodStart = now.Date.AddDays(-daysToSubtract);
                        }
                        periodEnd = endLocal ?? periodStart.AddDays(7).AddTicks(-1);
                        break;
                    case "monthly":
                        if (startLocal.HasValue)
                            periodStart = new DateTime(startLocal.Value.Year, startLocal.Value.Month, 1);
                        else
                            periodStart = new DateTime(now.Year, now.Month, 1);
                        periodEnd = endLocal ?? periodStart.AddMonths(1).AddTicks(-1);
                        break;
                    case "quarterly":
                        if (startLocal.HasValue)
                        {
                            var quarterMonth = ((startLocal.Value.Month - 1) / 3) * 3 + 1;
                            periodStart = new DateTime(startLocal.Value.Year, quarterMonth, 1);
                        }
                        else
                        {
                            var quarterMonth = ((now.Month - 1) / 3) * 3 + 1;
                            periodStart = new DateTime(now.Year, quarterMonth, 1);
                        }
                        periodEnd = endLocal ?? periodStart.AddMonths(3).AddTicks(-1);
                        break;
                    case "yearly":
                        if (startLocal.HasValue)
                            periodStart = new DateTime(startLocal.Value.Year, 1, 1);
                        else
                            periodStart = new DateTime(now.Year, 1, 1);
                        periodEnd = endLocal ?? periodStart.AddYears(1).AddTicks(-1);
                        break;
                    default:
                        periodStart = now.Date;
                        periodEnd = periodStart.AddDays(1).AddTicks(-1);
                        break;
                }

                await using var connection = new SqlConnection(connectionInfo.ConnectionString);
                await connection.OpenAsync();

                // Dönem başı snapshot'ını bul
                // Bugün için: Bugünün snapshot'ı varsa onu kullan, yoksa dünün son snapshot'ını kullan
                var snapshotStartDate = periodStart;
                var isTodayPeriod = period.ToLower() == "daily" && periodEnd.Date >= now.Date;
                
                var snapshotStartQuery = @"
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
                        cycle_start_time,
                        full_live_data
                    FROM PeriodicSnapshots
                    WHERE snapshot_type = @snapshotType AND snapshot_date <= @snapshotDate
                    ORDER BY snapshot_date DESC";

                using var snapshotStartCmd = new SqlCommand(snapshotStartQuery, connection);
                snapshotStartCmd.Parameters.AddWithValue("@snapshotType", period.ToLower());
                snapshotStartCmd.Parameters.AddWithValue("@snapshotDate", snapshotStartDate);

                decimal? snapshotStartProduction = null;
                decimal? snapshotStartStoppage = null;
                decimal? snapshotStartEnergy = null;
                decimal? snapshotStartWastageBefore = null;
                decimal? snapshotStartWastageAfter = null;
                decimal? snapshotStartPaper = null;
                decimal? snapshotStartEthylAlcohol = null;
                decimal? snapshotStartEthylAcetate = null;
                string? snapshotStartSiparisNo = null;
                DateTime? snapshotStartCycleStartTime = null;
                string? snapshotStartFullLiveData = null;

                using var snapshotStartReader = await snapshotStartCmd.ExecuteReaderAsync();
                if (await snapshotStartReader.ReadAsync())
                {
                    snapshotStartProduction = snapshotStartReader.IsDBNull(0) ? null : snapshotStartReader.GetDecimal(0);
                    snapshotStartStoppage = snapshotStartReader.IsDBNull(1) ? null : snapshotStartReader.GetDecimal(1);
                    snapshotStartEnergy = snapshotStartReader.IsDBNull(2) ? null : snapshotStartReader.GetDecimal(2);
                    snapshotStartWastageBefore = snapshotStartReader.IsDBNull(3) ? null : snapshotStartReader.GetDecimal(3);
                    snapshotStartWastageAfter = snapshotStartReader.IsDBNull(4) ? null : snapshotStartReader.GetDecimal(4);
                    snapshotStartPaper = snapshotStartReader.IsDBNull(5) ? null : snapshotStartReader.GetDecimal(5);
                    snapshotStartEthylAlcohol = snapshotStartReader.IsDBNull(6) ? null : snapshotStartReader.GetDecimal(6);
                    snapshotStartEthylAcetate = snapshotStartReader.IsDBNull(7) ? null : snapshotStartReader.GetDecimal(7);
                    snapshotStartSiparisNo = snapshotStartReader.IsDBNull(8) ? null : snapshotStartReader.GetString(8);
                    snapshotStartCycleStartTime = snapshotStartReader.IsDBNull(9) ? null : snapshotStartReader.GetDateTime(9);
                    snapshotStartFullLiveData = snapshotStartReader.IsDBNull(10) ? null : snapshotStartReader.GetString(10);
                }
                snapshotStartReader.Close();

                // Dönem sonu snapshot'ını bul (OEE hesaplaması için gerekli)
                // Not: Kapanış için periyot SONRASINDA alınan ilk snapshot'ı kullanıyoruz
                // Örn. günlük için: 14 Aralık günü -> 15 Aralık 00:00 snapshot'ı
                var snapshotEndDate = periodEnd;
                var snapshotEndQuery = @"
                    SELECT TOP 1 
                        CAST(COALESCE(actual_production, 0) AS DECIMAL(18,2)) AS actual_production,
                        CAST(COALESCE(total_stoppage_duration, 0) AS DECIMAL(18,2)) AS total_stoppage_duration,
                        CAST(COALESCE(energy_consumption_kwh, 0) AS DECIMAL(18,2)) AS energy_consumption_kwh,
                        CAST(COALESCE(wastage_before_die, 0) AS DECIMAL(18,2)) AS wastage_before_die,
                        CAST(COALESCE(wastage_after_die, 0) AS DECIMAL(18,2)) AS wastage_after_die,
                        siparis_no,
                        cycle_start_time,
                        full_live_data
                    FROM PeriodicSnapshots
                    WHERE snapshot_type = @snapshotType AND snapshot_date >= @snapshotDate
                    ORDER BY snapshot_date ASC";

                using var snapshotEndCmd = new SqlCommand(snapshotEndQuery, connection);
                snapshotEndCmd.Parameters.AddWithValue("@snapshotType", period.ToLower());
                snapshotEndCmd.Parameters.AddWithValue("@snapshotDate", snapshotEndDate);

                decimal? snapshotEndProduction = null;
                decimal? snapshotEndStoppage = null;
                decimal? snapshotEndEnergy = null;
                decimal? snapshotEndWastageBefore = null;
                decimal? snapshotEndWastageAfter = null;
                string? snapshotEndSiparisNo = null;
                DateTime? snapshotEndCycleStartTime = null;
                string? snapshotEndFullLiveData = null;

                using var snapshotEndReader = await snapshotEndCmd.ExecuteReaderAsync();
                if (await snapshotEndReader.ReadAsync())
                {
                    snapshotEndProduction = snapshotEndReader.IsDBNull(0) ? null : snapshotEndReader.GetDecimal(0);
                    snapshotEndStoppage = snapshotEndReader.IsDBNull(1) ? null : snapshotEndReader.GetDecimal(1);
                    snapshotEndEnergy = snapshotEndReader.IsDBNull(2) ? null : snapshotEndReader.GetDecimal(2);
                    snapshotEndWastageBefore = snapshotEndReader.IsDBNull(3) ? null : snapshotEndReader.GetDecimal(3);
                    snapshotEndWastageAfter = snapshotEndReader.IsDBNull(4) ? null : snapshotEndReader.GetDecimal(4);
                    snapshotEndSiparisNo = snapshotEndReader.IsDBNull(5) ? null : snapshotEndReader.GetString(5);
                    snapshotEndCycleStartTime = snapshotEndReader.IsDBNull(6) ? null : snapshotEndReader.GetDateTime(6);
                    snapshotEndFullLiveData = snapshotEndReader.IsDBNull(7) ? null : snapshotEndReader.GetString(7);
                }
                snapshotEndReader.Close();

                // Eski değişken isimlerini yeni isimlerle değiştir (geriye dönük uyumluluk için)
                var snapshotProduction = snapshotStartProduction;
                var snapshotStoppage = snapshotStartStoppage;
                var snapshotEnergy = snapshotStartEnergy;
                var snapshotWastageBefore = snapshotStartWastageBefore;
                var snapshotWastageAfter = snapshotStartWastageAfter;
                var snapshotPaper = snapshotStartPaper;
                var snapshotEthylAlcohol = snapshotStartEthylAlcohol;
                var snapshotEthylAcetate = snapshotStartEthylAcetate;
                var snapshotSiparisNo = snapshotStartSiparisNo;
                var snapshotCycleStartTime = snapshotStartCycleStartTime;

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

                // Toplam hesaplama - Snapshot bazlı
                // Mantık: Periyot içindeki toplam değerler = Periyot sonu snapshot'ı - Periyot başı snapshot'ı
                // Bugün için: Canlı veriler - Bugünün başındaki snapshot
                
                decimal totalProduction = 0;
                decimal totalStoppage = 0;
                decimal totalEnergy = 0;
                decimal totalWastageBefore = 0;
                decimal totalWastageAfter = 0;
                decimal totalPaper = 0;
                decimal totalEthylAlcohol = 0;
                decimal totalEthylAcetate = 0;
                
                // Bugün için özel durum: Her zaman canlı verilerden bugünün başındaki snapshot'ı çıkar
                bool isToday = period.ToLower() == "daily" && periodEnd.Date >= now.Date;
                bool liveDataFetched = false;
                
                if (isToday && snapshotStartProduction.HasValue && !string.IsNullOrEmpty(connectionInfo.TableName))
                {
                    // Bugün için: Canlı verilerden bugünün başındaki snapshot'ı çıkar
                    try
                    {
                        var httpClient = _httpClientFactory.CreateClient();
                        var apiBaseUrl = _configuration["ApiBaseUrl"] ?? "http://localhost:5199";
                        var url = $"{apiBaseUrl}/api/plcdata/data?machine={Uri.EscapeDataString(connectionInfo.TableName)}";
                        var response = await httpClient.GetAsync(url);
                        
                        if (response.IsSuccessStatusCode)
                        {
                            var jsonString = await response.Content.ReadAsStringAsync();
                            var jsonDoc = JsonDocument.Parse(jsonString);
                            var root = jsonDoc.RootElement;
                            
                            var liveProduction = root.TryGetProperty("actualProduction", out var prodEl) ? prodEl.GetInt32() : 0;
                            long liveStoppage = 0;
                            if (root.TryGetProperty("totalStoppageDuration", out var stopEl))
                            {
                                if (stopEl.ValueKind == System.Text.Json.JsonValueKind.Number)
                                {
                                    liveStoppage = stopEl.GetInt64();
                                }
                            }
                            var liveEnergy = root.TryGetProperty("totalEnergyKwh", out var energyEl) ? energyEl.GetDouble() : 0;
                            var liveWastageBefore = root.TryGetProperty("wastageBeforeDie", out var wbEl) ? wbEl.GetDouble() : 0;
                            var liveWastageAfter = root.TryGetProperty("wastageAfterDie", out var waEl) ? waEl.GetInt64() : 0;
                            
                            // İş değişimi kontrolü: JobCycleRecords'tan aktif işin siparis_no ve cycle_start_time'ını al
                            string? liveSiparisNo = null;
                            DateTime? liveCycleStartTime = null;
                            
                            var activeJobQuery = @"
                                SELECT TOP 1 siparis_no, cycle_start_time
                                FROM JobCycleRecords
                                WHERE status = 'active'
                                ORDER BY cycle_start_time DESC";
                            
                            using var activeJobCmd = new SqlCommand(activeJobQuery, connection);
                            using var activeJobReader = await activeJobCmd.ExecuteReaderAsync();
                            if (await activeJobReader.ReadAsync())
                            {
                                liveSiparisNo = activeJobReader.IsDBNull(0) ? null : activeJobReader.GetString(0);
                                liveCycleStartTime = activeJobReader.IsDBNull(1) ? null : activeJobReader.GetDateTime(1);
                            }
                            activeJobReader.Close();
                            
                            // İş değişimi kontrolü
                            bool isNewJob = false;
                            if (!string.IsNullOrEmpty(liveSiparisNo) && !string.IsNullOrEmpty(snapshotStartSiparisNo))
                            {
                                // Siparis no değiştiyse yeni iş
                                isNewJob = liveSiparisNo != snapshotStartSiparisNo;
                                _logger.LogInformation($"İş değişimi kontrolü - Live SiparisNo: {liveSiparisNo}, Snapshot SiparisNo: {snapshotStartSiparisNo}, isNewJob: {isNewJob}");
                            }
                            else if (liveCycleStartTime.HasValue && snapshotStartCycleStartTime.HasValue)
                            {
                                // Cycle start time değiştiyse yeni iş
                                isNewJob = liveCycleStartTime.Value != snapshotStartCycleStartTime.Value;
                                _logger.LogInformation($"İş değişimi kontrolü - Live CycleStart: {liveCycleStartTime}, Snapshot CycleStart: {snapshotStartCycleStartTime}, isNewJob: {isNewJob}");
                            }
                            else
                            {
                                _logger.LogWarning($"İş değişimi kontrolü - Eksik bilgi: Live SiparisNo: {liveSiparisNo}, Snapshot SiparisNo: {snapshotStartSiparisNo}, Live CycleStart: {liveCycleStartTime}, Snapshot CycleStart: {snapshotStartCycleStartTime}");
                            }
                            
                            if (isNewJob)
                            {
                                // Yeni iş başladı: Üretim ve fire sıfırlanmış, direkt canlı verileri al
                                totalProduction = liveProduction;
                                totalWastageBefore = (decimal)liveWastageBefore;
                                totalWastageAfter = liveWastageAfter;
                                
                                // Duruş ve enerji kontrolü: Yeni iş başladığında sıfırlanmış olabilir
                                // Eğer canlı değer snapshot'tan küçük veya çok yakınsa, sıfırlanmış demektir
                                var stoppageDiff = (decimal)liveStoppage - (snapshotStartStoppage ?? 0);
                                var energyDiff = (decimal)liveEnergy - (snapshotStartEnergy ?? 0);
                                
                                // Duruş: Eğer negatif veya çok küçük fark varsa, yeni iş başladığında sıfırlanmış
                                if (stoppageDiff < 0 || stoppageDiff < 60000) // 1 dakikadan az fark
                                {
                                    totalStoppage = (decimal)liveStoppage; // Yeni işin duruşu
                                    _logger.LogInformation($"Yeni iş başladı - Duruş sıfırlanmış: Live={liveStoppage} ms, Snapshot={snapshotStartStoppage} ms, Total={totalStoppage} ms");
                                }
                                else
                                {
                                    totalStoppage = stoppageDiff; // Kümülatif, snapshot'tan çıkar
                                    _logger.LogInformation($"Yeni iş başladı - Duruş kümülatif: Live={liveStoppage} ms, Snapshot={snapshotStartStoppage} ms, Diff={stoppageDiff} ms, Total={totalStoppage} ms");
                                }
                                
                                // Enerji: Eğer negatif veya çok küçük fark varsa, yeni iş başladığında sıfırlanmış olabilir
                                // Ama genelde enerji kümülatif olduğu için, sadece negatifse direkt al
                                if (energyDiff < 0)
                                {
                                    totalEnergy = (decimal)liveEnergy; // Yeni işin enerjisi
                                }
                                else
                                {
                                    totalEnergy = energyDiff; // Kümülatif, snapshot'tan çıkar
                                }
                            }
                            else
                            {
                                // Aynı iş devam ediyor: Snapshot'tan çıkar
                                totalProduction = Math.Max(0, (decimal)liveProduction - (snapshotStartProduction ?? 0));
                                totalStoppage = Math.Max(0, (decimal)liveStoppage - (snapshotStartStoppage ?? 0));
                                totalEnergy = Math.Max(0, (decimal)liveEnergy - (snapshotStartEnergy ?? 0));
                                totalWastageBefore = Math.Max(0, (decimal)liveWastageBefore - (snapshotStartWastageBefore ?? 0));
                                totalWastageAfter = Math.Max(0, (decimal)liveWastageAfter - (snapshotStartWastageAfter ?? 0));
                            }
                            
                            totalPaper = 0;
                            totalEthylAlcohol = 0;
                            totalEthylAcetate = 0;
                            liveDataFetched = true;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Bugün için canlı veri alınamadı, fallback kullanılıyor");
                    }
                }
                
                if (!liveDataFetched)
                {
                    if (snapshotEndProduction.HasValue && snapshotStartProduction.HasValue)
                    {
                        // Snapshot bazlı hesaplama (en doğru yöntem - geçmiş günler için)
                        totalProduction = Math.Max(0, snapshotEndProduction.Value - snapshotStartProduction.Value);
                        totalStoppage = Math.Max(0, (snapshotEndStoppage ?? 0) - (snapshotStartStoppage ?? 0));
                        totalEnergy = Math.Max(0, (snapshotEndEnergy ?? 0) - (snapshotStartEnergy ?? 0));
                        totalWastageBefore = Math.Max(0, (snapshotEndWastageBefore ?? 0) - (snapshotStartWastageBefore ?? 0));
                        totalWastageAfter = Math.Max(0, (snapshotEndWastageAfter ?? 0) - (snapshotStartWastageAfter ?? 0));
                        totalPaper = Math.Max(0, 0); // Paper snapshot'ta yok, JobEndReports'tan alınabilir
                        totalEthylAlcohol = Math.Max(0, 0); // EthylAlcohol snapshot'ta yok
                        totalEthylAcetate = Math.Max(0, 0); // EthylAcetate snapshot'ta yok
                    }
                    else
                    {
                        // Fallback: JobEndReports'tan hesapla (eski yöntem)
                        if (completedJobCount > 0)
                        {
                            totalProduction = (completedProduction ?? 0) - (snapshotStartProduction ?? 0) + (fullPeriodProduction ?? 0);
                            totalStoppage = (completedStoppage ?? 0) - (snapshotStartStoppage ?? 0) + (fullPeriodStoppage ?? 0);
                            totalEnergy = (completedEnergy ?? 0) + (fullPeriodEnergy ?? 0);
                            totalWastageBefore = (completedWastageBefore ?? 0) - (snapshotStartWastageBefore ?? 0) + (fullPeriodWastageBefore ?? 0);
                            totalWastageAfter = (completedWastageAfter ?? 0) - (snapshotStartWastageAfter ?? 0) + (fullPeriodWastageAfter ?? 0);
                            totalPaper = (completedPaper ?? 0) - (snapshotStartPaper ?? 0) + (fullPeriodPaper ?? 0);
                            totalEthylAlcohol = (completedEthylAlcohol ?? 0) - (snapshotStartEthylAlcohol ?? 0) + (fullPeriodEthylAlcohol ?? 0);
                            totalEthylAcetate = (completedEthylAcetate ?? 0) - (snapshotStartEthylAcetate ?? 0) + (fullPeriodEthylAcetate ?? 0);
                        }
                        else
                        {
                            totalProduction = (fullPeriodProduction ?? 0);
                            totalStoppage = (fullPeriodStoppage ?? 0);
                            totalEnergy = (fullPeriodEnergy ?? 0);
                            totalWastageBefore = (fullPeriodWastageBefore ?? 0);
                            totalWastageAfter = (fullPeriodWastageAfter ?? 0);
                            totalPaper = (fullPeriodPaper ?? 0);
                            totalEthylAlcohol = (fullPeriodEthylAlcohol ?? 0);
                            totalEthylAcetate = (fullPeriodEthylAcetate ?? 0);
                        }
                    }
                }
                
                // İş sayısı
                var totalJobCount = completedJobCount + fullPeriodJobCount;

                // Negatif değerleri sıfırla
                totalProduction = Math.Max(0, totalProduction);
                totalStoppage = Math.Max(0, totalStoppage);
                totalEnergy = Math.Max(0, totalEnergy);
                totalWastageBefore = Math.Max(0, totalWastageBefore);
                totalWastageAfter = Math.Max(0, totalWastageAfter);

                // Periyodik OEE hesaplama - Snapshot bazlı, her iş için ayrı ayrı hesaplayıp ortalamasını al
                double? calculatedAvailability = null;
                double? calculatedPerformance = null;
                double? calculatedQuality = null;
                double? calculatedOverallOEE = null;

                // OEE debug bilgileri (frontend doğrulama için)
                var oeeJobDetails = new List<object>();

                // Helper: full_live_data JSON'undan remaining_work parse et
                decimal? ParseRemainingWorkFromJson(string? jsonString)
                {
                    if (string.IsNullOrEmpty(jsonString)) return null;
                    try
                    {
                        var jsonDoc = System.Text.Json.JsonDocument.Parse(jsonString);
                        if (jsonDoc.RootElement.TryGetProperty("remainingWork", out var remainingWork))
                        {
                            if (remainingWork.ValueKind == System.Text.Json.JsonValueKind.Number)
                            {
                                return remainingWork.GetDecimal();
                            }
                        }
                    }
                    catch { }
                    return null;
                }

                // Periyot içinde çalışan işleri bul (3 kategori)
                // 1. Periyot başından önce başlayıp periyot içinde biten
                // 2. Periyot içinde başlayıp biten
                // 3. Periyot içinde başlayıp devam eden (periyot sonu snapshot'ından hesaplanacak)
                // JobEndReports'tan bitmiş işleri al
                var allJobsQuery = @"
                    SELECT 
                        id,
                        siparis_no,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(toplam_miktar, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS toplam_miktar,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(kalan_miktar, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS kalan_miktar,
                        set_sayisi,
                        COALESCE(TRY_CAST(REPLACE(COALESCE(silindir_cevresi, '0'), ',', '.') AS DECIMAL(18,2)), 0) AS silindir_cevresi,
                        hedef_hiz,
                        actual_production,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(wastage_before_die, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS wastage_before_die,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(wastage_after_die, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS wastage_after_die,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(wastage_after_quality_control, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS wastage_after_quality_control,
                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(total_stoppage_duration, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS total_stoppage_duration,
                        job_start_time,
                        job_end_time
                    FROM JobEndReports
                    WHERE (job_start_time < @periodEnd AND job_end_time > @periodStart) -- Periyot ile kesişen tüm işler
                    ORDER BY job_start_time";

                using var allJobsCmd = new SqlCommand(allJobsQuery, connection);
                allJobsCmd.Parameters.AddWithValue("@periodStart", periodStart);
                allJobsCmd.Parameters.AddWithValue("@periodEnd", periodEnd);

                var oeeValues = new List<(double availability, double performance, double quality, double overall)>();
                
                using var allJobsReader = await allJobsCmd.ExecuteReaderAsync();
                int foundJobCount = 0;
                while (await allJobsReader.ReadAsync())
                {
                    foundJobCount++;
                    try
                    {
                        // Temel iş bilgileri
                        int jobId = allJobsReader["id"] != DBNull.Value ? Convert.ToInt32(allJobsReader["id"]) : 0;
                        string? jobSiparisNo = allJobsReader["siparis_no"]?.ToString();
                        // İş parametrelerini parse et (SQL'de CAST edildiği için direkt okunabilir)
                        int setSayisi = allJobsReader["set_sayisi"] != DBNull.Value ? Convert.ToInt32(allJobsReader["set_sayisi"]) : 0;
                        decimal silindirCevresi = allJobsReader["silindir_cevresi"] != DBNull.Value ? Convert.ToDecimal(allJobsReader["silindir_cevresi"]) : 0;
                        int hedefHiz = allJobsReader["hedef_hiz"] != DBNull.Value ? Convert.ToInt32(allJobsReader["hedef_hiz"]) : 0;
                        
                        if (!DateTime.TryParse(allJobsReader["job_start_time"]?.ToString(), out var jobStartTime) ||
                            !DateTime.TryParse(allJobsReader["job_end_time"]?.ToString(), out var jobEndTime))
                            continue;

                        // İşin periyot içindeki kısmını belirle
                        bool isJobStartedBeforePeriod = jobStartTime < periodStart;
                        bool isJobEndedInPeriod = jobEndTime <= periodEnd;
                        
                        // Periyot içindeki değerleri hesapla (snapshot farklarından)
                        decimal periodProduction = 0;
                        decimal periodStoppage = 0;
                        decimal periodWastageBefore = 0;
                        decimal periodWastageAfter = 0;
                        decimal periodWastageAfterQualityControl = 0;
                        decimal periodRemainingWork = 0;

                        if (isJobStartedBeforePeriod && isJobEndedInPeriod)
                        {
                            // 1. iş: Periyot başından önce başlamış, periyot içinde bitmiş
                            // JobEndReports'taki değerler - Snapshot başındaki değerler
                            int jobActualProd = 0;
                            if (int.TryParse(allJobsReader["actual_production"]?.ToString(), out var actualProdParsed))
                                jobActualProd = actualProdParsed;
                            
                            decimal jobStoppage = 0;
                            if (decimal.TryParse(allJobsReader["total_stoppage_duration"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobStoppageParsed))
                                jobStoppage = jobStoppageParsed;
                            
                            decimal jobWastageBefore = 0;
                            if (decimal.TryParse(allJobsReader["wastage_before_die"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageBeforeParsed))
                                jobWastageBefore = jobWastageBeforeParsed;
                            
                            decimal jobWastageAfter = 0;
                            if (decimal.TryParse(allJobsReader["wastage_after_die"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageAfterParsed))
                                jobWastageAfter = jobWastageAfterParsed;

                            periodProduction = Math.Max(0, jobActualProd - (snapshotStartProduction ?? 0));
                            periodStoppage = Math.Max(0, jobStoppage - (snapshotStartStoppage ?? 0));
                            periodWastageBefore = Math.Max(0, jobWastageBefore - (snapshotStartWastageBefore ?? 0));
                            periodWastageAfter = Math.Max(0, jobWastageAfter - (snapshotStartWastageAfter ?? 0));
                            
                            // wastage_after_quality_control iş bitince girilen bir değer, iş bitmişse tüm değeri kullan
                            decimal jobWastageAfterQualityControl = 0;
                            if (decimal.TryParse(allJobsReader["wastage_after_quality_control"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageAfterQualityControlParsed))
                                jobWastageAfterQualityControl = jobWastageAfterQualityControlParsed;
                            periodWastageAfterQualityControl = jobWastageAfterQualityControl;
                            
                            // Kalan miktar: Snapshot başındaki remaining_work (JSON'dan)
                            periodRemainingWork = ParseRemainingWorkFromJson(snapshotStartFullLiveData) ?? 0;
                        }
                        else if (!isJobStartedBeforePeriod && isJobEndedInPeriod)
                        {
                            // 2. iş: Periyot içinde başlayıp bitmiş
                            // JobEndReports'tan direkt al
                            int jobActualProd = 0;
                            if (int.TryParse(allJobsReader["actual_production"]?.ToString(), out var actualProdParsed))
                                jobActualProd = actualProdParsed;
                            
                            decimal jobStoppage = 0;
                            if (decimal.TryParse(allJobsReader["total_stoppage_duration"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobStoppageParsed))
                                jobStoppage = jobStoppageParsed;
                            
                            decimal jobWastageBefore = 0;
                            if (decimal.TryParse(allJobsReader["wastage_before_die"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageBeforeParsed))
                                jobWastageBefore = jobWastageBeforeParsed;
                            
                            decimal jobWastageAfter = 0;
                            if (decimal.TryParse(allJobsReader["wastage_after_die"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageAfterParsed))
                                jobWastageAfter = jobWastageAfterParsed;
                            
                            decimal jobKalanMiktar = 0;
                            if (decimal.TryParse(allJobsReader["kalan_miktar"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobKalanMiktarParsed))
                                jobKalanMiktar = jobKalanMiktarParsed;

                            periodProduction = jobActualProd;
                            periodStoppage = jobStoppage;
                            periodWastageBefore = jobWastageBefore;
                            periodWastageAfter = jobWastageAfter;
                            
                            // wastage_after_quality_control iş bitince girilen bir değer, iş bitmişse tüm değeri kullan
                            decimal jobWastageAfterQualityControl = 0;
                            if (decimal.TryParse(allJobsReader["wastage_after_quality_control"]?.ToString()?.Replace(",", "."), 
                                System.Globalization.NumberStyles.Any, 
                                System.Globalization.CultureInfo.InvariantCulture, 
                                out var jobWastageAfterQualityControlParsed))
                                jobWastageAfterQualityControl = jobWastageAfterQualityControlParsed;
                            periodWastageAfterQualityControl = jobWastageAfterQualityControl;
                            
                            periodRemainingWork = jobKalanMiktar;
                        }
                        else
                        {
                            // 3. iş: Periyot içinde başlamış, periyot sonundan sonra bitmiş
                            // Snapshot sonu - Snapshot başı = periyot içindeki değerler
                            periodProduction = Math.Max(0, (snapshotEndProduction ?? 0) - (snapshotStartProduction ?? 0));
                            periodStoppage = Math.Max(0, (snapshotEndStoppage ?? 0) - (snapshotStartStoppage ?? 0));
                            periodWastageBefore = Math.Max(0, (snapshotEndWastageBefore ?? 0) - (snapshotStartWastageBefore ?? 0));
                            periodWastageAfter = Math.Max(0, (snapshotEndWastageAfter ?? 0) - (snapshotStartWastageAfter ?? 0));
                            
                            // Kalan miktar: Snapshot başındaki remaining_work (JSON'dan)
                            periodRemainingWork = ParseRemainingWorkFromJson(snapshotStartFullLiveData) ?? 0;
                        }

                        // İş parametreleri
                        decimal toplamMiktar = 0;
                        if (decimal.TryParse(allJobsReader["toplam_miktar"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var toplamMiktarParsed))
                            toplamMiktar = toplamMiktarParsed;
                        
                        decimal kalanMiktar = 0;
                        if (decimal.TryParse(allJobsReader["kalan_miktar"]?.ToString()?.Replace(",", "."), 
                            System.Globalization.NumberStyles.Any, 
                            System.Globalization.CultureInfo.InvariantCulture, 
                            out var kalanMiktarParsed))
                            kalanMiktar = kalanMiktarParsed;

                        // OEE Hesaplama (verdiğin formüllerle)
                        // Parametre kontrolü - 0 değerlerini kontrol et
                        if (setSayisi <= 0 || silindirCevresi <= 0 || hedefHiz <= 0)
                        {
                            _logger.LogWarning($"İş OEE hesaplanırken geçersiz parametreler: setSayisi={setSayisi}, silindirCevresi={silindirCevresi}, hedefHiz={hedefHiz}, siparis_no={allJobsReader["siparis_no"]}");
                            continue; // Bu işi atla
                        }

                        // 1. Availability = (Run Time / Planned Time) × 100
                        //    Planned Time = Periyot içinde üretilen miktarı hedef hızla üretmek için gereken süre
                        //    Run Time = Gerçek çalışma süresi (periyot süresi - duruş süresi)
                        //    Planned Time = (periodProduction / set_sayisi) * (silindir_cevresi / 1000) / hedef_hiz
                        if (periodProduction <= 0)
                        {
                            _logger.LogWarning($"İş OEE hesaplanırken periodProduction <= 0: {periodProduction}, siparis_no={allJobsReader["siparis_no"]}");
                            continue; // Bu işi atla
                        }
                        var adim1 = periodProduction / setSayisi;
                        var adim2 = silindirCevresi / 1000m; // mm -> m
                        var adim3 = adim2 / hedefHiz;
                        var planlananSure = adim1 * adim3; // dakika (periyot içinde üretilen miktarı hedef hızla üretmek için gereken süre)

                        // Gerçek çalışma süresi = Periyot süresi - Duruş süresi
                        var periyotSuresiDakika = (decimal)(periodEnd - periodStart).TotalMinutes;
                        var durusSuresiDakika = (periodStoppage / 1000m) / 60m; // ms -> dakika
                        var runTimeForAvailability = periyotSuresiDakika - durusSuresiDakika;
                        if (runTimeForAvailability < 0) runTimeForAvailability = 0;
                        var availability = planlananSure > 0 ? (double)((runTimeForAvailability / planlananSure) * 100) : 0;
                        availability = Math.Max(0, Math.Min(100, availability));

                        // 2. Performance = (Average Speed / Target Speed) × 100
                        //    average_speed: dataRecords'tan hesaplanır (MachineSpeed >= 65)
                        //    hedefHiz: Target speed (m/dk)
                        // İşin periyot içindeki zaman aralığını belirle
                        var periodStartForJob = isJobStartedBeforePeriod ? periodStart : jobStartTime;
                        var periodEndForJob = isJobEndedInPeriod ? jobEndTime : periodEnd;
                        
                        // dataRecords'tan average_speed hesapla (işin periyot içindeki kısmı için)
                        decimal? jobAverageSpeed = null;
                        try
                        {
                            var avgSpeedQuery = @"
                                SELECT AVG(CAST(MachineSpeed AS FLOAT)) AS average_speed
                                FROM dataRecords
                                WHERE KayitZamani >= @periodStartForJob 
                                  AND KayitZamani <= @periodEndForJob
                                  AND MachineSpeed >= 65";
                            
                            using var avgSpeedCmd = new SqlCommand(avgSpeedQuery, connection);
                            avgSpeedCmd.Parameters.AddWithValue("@periodStartForJob", periodStartForJob);
                            avgSpeedCmd.Parameters.AddWithValue("@periodEndForJob", periodEndForJob);
                            
                            using var avgSpeedReader = await avgSpeedCmd.ExecuteReaderAsync();
                            if (await avgSpeedReader.ReadAsync())
                            {
                                if (!avgSpeedReader.IsDBNull(0))
                                {
                                    jobAverageSpeed = Convert.ToDecimal(avgSpeedReader.GetDouble(0));
                                }
                            }
                            avgSpeedReader.Close();
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, $"İş için average_speed hesaplanırken hata: {jobSiparisNo}");
                        }
                        
                        // Performance = (Average Speed / Target Speed) × 100
                        var performance = (jobAverageSpeed.HasValue && jobAverageSpeed.Value > 0 && hedefHiz > 0) 
                            ? (double)((jobAverageSpeed.Value / hedefHiz) * 100) 
                            : 0;
                        performance = Math.Max(0, Math.Min(100, performance)); // %100'ü geçemez

                        // 3. Quality = (Good Count / Total Count) × 100
                        //    Good Count = actual_production - wastage_after_quality_control
                        //    Total Count = actual_production + wastage_before_die + wastage_after_die
                        var dieOncesiAdet = silindirCevresi > 0 ? (periodWastageBefore * 1000m / silindirCevresi) * setSayisi : 0;
                        var hataliUretim = dieOncesiAdet + periodWastageAfter;
                        var goodCount = (decimal)periodProduction - periodWastageAfterQualityControl;
                        if (goodCount < 0) goodCount = 0; // Negatif olamaz
                        var totalCountForQuality = (decimal)periodProduction + hataliUretim;
                        var quality = totalCountForQuality > 0 ? (double)((goodCount / totalCountForQuality) * 100) : 0;
                        quality = Math.Max(0, Math.Min(100, quality));

                        // 4. Overall OEE = (Availability × Performance × Quality) / 10000
                        var oee = (availability * performance * quality) / 10000.0;
                        oee = Math.Max(0, Math.Min(100, oee));

                        oeeValues.Add((availability, performance, quality, oee));

                        // Debug için iş bazlı detay ekle
                        oeeJobDetails.Add(new
                        {
                            jobId,
                            siparisNo = jobSiparisNo,
                            jobStartTime,
                            jobEndTime,
                            setSayisi,
                            silindirCevresi,
                            hedefHiz,
                            toplamMiktar,
                            periodProduction,
                            periodWastageBefore,
                            periodWastageAfter,
                            periodStoppage,
                            periodRemainingWork,
                            periodWastageAfterQualityControl,
                            // Performance için
                            averageSpeed = jobAverageSpeed.HasValue ? Math.Round(jobAverageSpeed.Value, 2) : (decimal?)null,
                            periodStartForJob,
                            periodEndForJob,
                            // Formül ara değerleri
                            plannedTimeMinutes = planlananSure,
                            runTimeAvailabilityMinutes = runTimeForAvailability,
                            durusSuresiDakika = durusSuresiDakika,
                            dieOncesiAdet = Math.Round(dieOncesiAdet, 0),
                            hataliUretim = Math.Round(hataliUretim, 0),
                            goodCountUnits = goodCount,
                            totalCountForQualityUnits = totalCountForQuality,
                            // Veri kaynakları
                            dataSource = new
                            {
                                remainingWorkSource = periodRemainingWork > 0 ? "PeriodicSnapshots.full_live_data (snapshotStart)" : "JobEndReports.toplam_miktar",
                                productionSource = isJobStartedBeforePeriod ? "JobEndReports.actual_production - snapshotStart.actual_production" : 
                                                   isJobEndedInPeriod ? "JobEndReports.actual_production" : 
                                                   "snapshotEnd.actual_production - snapshotStart.actual_production",
                                stoppageSource = isJobStartedBeforePeriod ? "JobEndReports.total_stoppage_duration - snapshotStart.total_stoppage_duration" :
                                                isJobEndedInPeriod ? "JobEndReports.total_stoppage_duration" :
                                                "snapshotEnd.total_stoppage_duration - snapshotStart.total_stoppage_duration",
                                wastageSource = isJobStartedBeforePeriod ? "JobEndReports.wastage - snapshotStart.wastage" :
                                              isJobEndedInPeriod ? "JobEndReports.wastage" :
                                              "snapshotEnd.wastage - snapshotStart.wastage",
                                averageSpeedSource = $"dataRecords (MachineSpeed >= 65, {periodStartForJob:yyyy-MM-dd HH:mm:ss} - {periodEndForJob:yyyy-MM-dd HH:mm:ss})",
                                wastageAfterQualityControlSource = "JobEndReports.wastage_after_quality_control (iş bitince girilen)"
                            },
                            // Sonuçlar
                            availability,
                            performance,
                            quality,
                            oee,
                            isActiveJob = false
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"İş OEE hesaplanırken hata oluştu, atlanıyor");
                    }
                }
                allJobsReader.Close();
                _logger.LogInformation($"Periyot içinde toplam {foundJobCount} iş bulundu (JobEndReports'tan). Period: {period}, Start: {periodStart}, End: {periodEnd}");

                // Periyot içinde başlayıp devam eden işler (SADECE GEÇMİŞ GÜNLER İÇİN)
                // Bugün için OEE hesaplanmaz, sadece geçmiş günler için hesaplanır
                // snapshotEnd yoksa bile, snapshotStart varsa ve aynı iş devam ediyorsa kontrol et
                if (!isTodayPeriod && snapshotStartFullLiveData != null)
                {
                    try
                    {
                        // Geçmiş günler için: Devam eden iş kontrolü
                        bool shouldCalculateActiveJob = false;
                        
                        if (snapshotEndFullLiveData != null)
                        {
                            // Snapshot sonu var: İş değişimi kontrolü yap
                            bool isSameJob = snapshotStartSiparisNo == snapshotEndSiparisNo && 
                                            snapshotStartCycleStartTime == snapshotEndCycleStartTime;
                            
                            shouldCalculateActiveJob = !isSameJob || (snapshotEndProduction.HasValue && snapshotStartProduction.HasValue && 
                                snapshotEndProduction.Value > snapshotStartProduction.Value);
                        }
                        else
                        {
                            // Snapshot sonu yok: Ama snapshot başı varsa, aynı iş devam ediyor olabilir
                            // JobCycleRecords'tan kontrol et
                            shouldCalculateActiveJob = true; // Kontrol et, eğer aktif iş varsa hesapla
                        }
                        
                        if (shouldCalculateActiveJob)
                        {
                            // Periyot içinde çalışan bir iş var (devam eden veya yeni başlayan)
                            // JobCycleRecords'tan aktif işin siparis_no'sunu al, sonra JobEndReports'tan aynı siparis_no için en son biten işin parametrelerini al
                            string? activeSiparisNo = null;
                            var activeJobCycleQuery = @"
                                SELECT TOP 1 siparis_no
                                FROM JobCycleRecords
                                WHERE status = 'active' AND cycle_start_time <= @periodEnd
                                ORDER BY cycle_start_time DESC";
                            
                            using var activeJobCycleCmd = new SqlCommand(activeJobCycleQuery, connection);
                            activeJobCycleCmd.Parameters.AddWithValue("@periodEnd", periodEnd);
                            
                            using var activeJobCycleReader = await activeJobCycleCmd.ExecuteReaderAsync();
                            if (await activeJobCycleReader.ReadAsync())
                            {
                                activeSiparisNo = activeJobCycleReader["siparis_no"]?.ToString();
                            }
                            activeJobCycleReader.Close();
                            
                            // JobEndReports'tan aynı siparis_no için en son biten işin parametrelerini al
                            // Eğer JobEndReports'ta yoksa, JobCycleRecords'tan job_info JSON'undan parse et
                            decimal silindirCevresi = 0;
                            decimal hedefHiz = 0;
                            int setSayisi = 0;
                            decimal toplamMiktar = 0;
                            bool jobParamsFound = false;
                            
                            if (!string.IsNullOrEmpty(activeSiparisNo))
                            {
                                // Önce JobEndReports'tan dene
                                var activeJobQuery = @"
                                    SELECT TOP 1 
                                        COALESCE(TRY_CAST(REPLACE(COALESCE(silindir_cevresi, '0'), ',', '.') AS DECIMAL(18,2)), 0) AS silindir_cevresi,
                                        COALESCE(TRY_CAST(hedef_hiz AS DECIMAL(18,2)), 0) AS hedef_hiz,
                                        COALESCE(TRY_CAST(set_sayisi AS INT), 0) AS set_sayisi,
                                        COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(toplam_miktar, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS toplam_miktar
                                    FROM JobEndReports
                                    WHERE siparis_no = @siparisNo
                                    ORDER BY job_end_time DESC";
                                
                                using var activeJobCmd = new SqlCommand(activeJobQuery, connection);
                                activeJobCmd.Parameters.AddWithValue("@siparisNo", activeSiparisNo);
                                
                                using var activeJobReader = await activeJobCmd.ExecuteReaderAsync();
                                if (await activeJobReader.ReadAsync())
                                {
                                    silindirCevresi = activeJobReader.GetDecimal(0);
                                    hedefHiz = activeJobReader.GetDecimal(1);
                                    setSayisi = activeJobReader.GetInt32(2);
                                    toplamMiktar = activeJobReader.GetDecimal(3);
                                    jobParamsFound = true;
                                }
                                activeJobReader.Close();
                                
                                // JobEndReports'ta yoksa, JobCycleRecords'tan job_info JSON'undan parse et
                                if (!jobParamsFound)
                                {
                                    var jobCycleQuery = @"
                                        SELECT TOP 1 job_info
                                        FROM JobCycleRecords
                                        WHERE siparis_no = @siparisNo AND job_info IS NOT NULL
                                        ORDER BY cycle_start_time DESC";
                                    
                                    using var jobCycleCmd = new SqlCommand(jobCycleQuery, connection);
                                    jobCycleCmd.Parameters.AddWithValue("@siparisNo", activeSiparisNo);
                                    
                                    using var jobCycleReader = await jobCycleCmd.ExecuteReaderAsync();
                                    if (await jobCycleReader.ReadAsync())
                                    {
                                        var jobInfoJson = jobCycleReader["job_info"]?.ToString();
                                        if (!string.IsNullOrEmpty(jobInfoJson))
                                        {
                                            try
                                            {
                                                var jsonDoc = System.Text.Json.JsonDocument.Parse(jobInfoJson);
                                                var root = jsonDoc.RootElement;
                                                
                                                // job_info JSON'undan parametreleri parse et
                                                if (root.TryGetProperty("silindir_cevresi", out var scEl))
                                                {
                                                    var scStr = scEl.GetString()?.Replace(",", ".");
                                                    if (decimal.TryParse(scStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var sc))
                                                        silindirCevresi = sc;
                                                }
                                                if (root.TryGetProperty("hedef_hiz", out var hhEl))
                                                {
                                                    if (hhEl.ValueKind == System.Text.Json.JsonValueKind.Number)
                                                        hedefHiz = hhEl.GetDecimal();
                                                }
                                                if (root.TryGetProperty("set_sayisi", out var ssEl))
                                                {
                                                    var ssStr = ssEl.GetString();
                                                    if (int.TryParse(ssStr, out var ss))
                                                        setSayisi = ss;
                                                }
                                                if (root.TryGetProperty("toplam_miktar", out var tmEl))
                                                {
                                                    if (tmEl.ValueKind == System.Text.Json.JsonValueKind.Number)
                                                        toplamMiktar = tmEl.GetDecimal();
                                                }
                                                
                                                jobParamsFound = (silindirCevresi > 0 && hedefHiz > 0 && setSayisi > 0 && toplamMiktar > 0);
                                            }
                                            catch { }
                                        }
                                    }
                                    jobCycleReader.Close();
                                }
                                
                                if (jobParamsFound && snapshotEndFullLiveData != null)
                                {
                                    // Geçmiş günler için: Snapshot sonu - Snapshot başı
                                    // Snapshot sonu var: Farkı hesapla
                                    decimal periodProduction = Math.Max(0, (snapshotEndProduction ?? 0) - (snapshotStartProduction ?? 0));
                                    decimal periodStoppage = Math.Max(0, (snapshotEndStoppage ?? 0) - (snapshotStartStoppage ?? 0));
                                    decimal periodWastageBefore = Math.Max(0, (snapshotEndWastageBefore ?? 0) - (snapshotStartWastageBefore ?? 0));
                                    decimal periodWastageAfter = Math.Max(0, (snapshotEndWastageAfter ?? 0) - (snapshotStartWastageAfter ?? 0));
                                    decimal periodWastageAfterQualityControl = 0; // Devam eden işler için 0 (iş henüz bitmemiş)
                                    decimal periodRemainingWork = ParseRemainingWorkFromJson(snapshotStartFullLiveData) ?? 0;

                                    // OEE hesapla (yukarıdaki mantıkla aynı)
                                    // periodRemainingWork > 0 ise: snapshot'tan gelen remainingWork kullan (devam eden iş)
                                    // periodRemainingWork <= 0 ise: JobEndReports.kalan_miktar kullan (iş daha önce basıldıysa kalan miktar)
                                    // Devam eden işler için kalan_miktar'ı JobEndReports'tan al
                                    decimal activeJobKalanMiktar = 0;
                                    if (!string.IsNullOrEmpty(activeSiparisNo))
                                    {
                                        var kalanMiktarQuery = @"
                                            SELECT TOP 1
                                                COALESCE(TRY_CAST(REPLACE(CAST(COALESCE(kalan_miktar, '0') AS NVARCHAR(MAX)), ',', '.') AS DECIMAL(18,2)), 0) AS kalan_miktar
                                            FROM JobEndReports
                                            WHERE siparis_no = @siparisNo
                                            ORDER BY job_end_time DESC";
                                        
                                        using var kalanMiktarCmd = new SqlCommand(kalanMiktarQuery, connection);
                                        kalanMiktarCmd.Parameters.AddWithValue("@siparisNo", activeSiparisNo);
                                        
                                        using var kalanMiktarReader = await kalanMiktarCmd.ExecuteReaderAsync();
                                        if (await kalanMiktarReader.ReadAsync())
                                        {
                                            activeJobKalanMiktar = kalanMiktarReader.GetDecimal(0);
                                        }
                                        kalanMiktarReader.Close();
                                    }
                                    
                                    var hesaplanacakMiktar = (periodRemainingWork > 0) ? periodRemainingWork : activeJobKalanMiktar;
                                    
                                    // Sıfır kontrolü - Geçersiz parametreler varsa OEE hesaplama
                                    if (setSayisi <= 0 || silindirCevresi <= 0 || hedefHiz <= 0 || hesaplanacakMiktar <= 0)
                                    {
                                        _logger.LogWarning($"Devam eden iş OEE hesaplama: Geçersiz parametreler - setSayisi={setSayisi}, silindirCevresi={silindirCevresi}, hedefHiz={hedefHiz}, hesaplanacakMiktar={hesaplanacakMiktar}");
                                    }
                                    else
                                    {
                                        var adim1 = hesaplanacakMiktar / setSayisi;
                                        var adim2 = silindirCevresi / 1000;
                                        var adim3 = adim2 / hedefHiz;
                                        var planlananSure = adim1 * adim3;
                                        
                                        _logger.LogInformation($"Devam eden iş OEE hesaplama - siparisNo={activeSiparisNo}, hesaplanacakMiktar={hesaplanacakMiktar}, setSayisi={setSayisi}, silindirCevresi={silindirCevresi}, hedefHiz={hedefHiz}, planlananSure={planlananSure}");

                                        // Gerçek çalışma süresi = Periyot süresi - Duruş süresi
                                        var periyotSuresiDakika = (decimal)(periodEnd - periodStart).TotalMinutes;
                                        var durusSuresiDakika = (periodStoppage / 1000) / 60;
                                        var runTimeForAvailability = periyotSuresiDakika - durusSuresiDakika;
                                        if (runTimeForAvailability < 0) runTimeForAvailability = 0;
                                        var availability = planlananSure > 0 ? (double)((runTimeForAvailability / planlananSure) * 100) : 0;
                                        availability = Math.Max(0, Math.Min(100, availability));

                                        // 2. Performance = (Average Speed / Target Speed) × 100
                                        //    average_speed: dataRecords'tan hesaplanır (MachineSpeed >= 65)
                                        //    hedefHiz: Target speed (m/dk)
                                        decimal? activeJobAverageSpeed = null;
                                        try
                                        {
                                            var avgSpeedQuery = @"
                                                SELECT AVG(CAST(MachineSpeed AS FLOAT)) AS average_speed
                                                FROM dataRecords
                                                WHERE KayitZamani >= @periodStart 
                                                  AND KayitZamani <= @periodEnd
                                                  AND MachineSpeed >= 65";
                                            
                                            using var avgSpeedCmd = new SqlCommand(avgSpeedQuery, connection);
                                            avgSpeedCmd.Parameters.AddWithValue("@periodStart", periodStart);
                                            avgSpeedCmd.Parameters.AddWithValue("@periodEnd", periodEnd);
                                            
                                            using var avgSpeedReader = await avgSpeedCmd.ExecuteReaderAsync();
                                            if (await avgSpeedReader.ReadAsync())
                                            {
                                                if (!avgSpeedReader.IsDBNull(0))
                                                {
                                                    activeJobAverageSpeed = Convert.ToDecimal(avgSpeedReader.GetDouble(0));
                                                }
                                            }
                                            avgSpeedReader.Close();
                                        }
                                        catch (Exception ex)
                                        {
                                            _logger.LogWarning(ex, $"Devam eden iş için average_speed hesaplanırken hata: {activeSiparisNo}");
                                        }
                                        
                                        // Performance = (Average Speed / Target Speed) × 100
                                        var performance = (activeJobAverageSpeed.HasValue && activeJobAverageSpeed.Value > 0 && hedefHiz > 0) 
                                            ? (double)((activeJobAverageSpeed.Value / hedefHiz) * 100) 
                                            : 0;
                                        performance = Math.Max(0, Math.Min(100, performance)); // %100'ü geçemez

                                        // Devam eden işler için wastage_after_quality_control yok (iş henüz bitmemiş)
                                        var dieOncesiAdetActive = (periodWastageBefore * 1000 / silindirCevresi) * setSayisi;
                                        var hataliUretimActive = dieOncesiAdetActive + periodWastageAfter;
                                        var goodCount = (decimal)periodProduction - periodWastageAfterQualityControl;
                                        if (goodCount < 0) goodCount = 0; // Negatif olamaz
                                        var totalCountForQuality = (decimal)periodProduction + hataliUretimActive;
                                        var quality = totalCountForQuality > 0 ? (double)((goodCount / totalCountForQuality) * 100) : 0;
                                        quality = Math.Max(0, Math.Min(100, quality));

                                        var oee = (availability * performance * quality) / 10000.0;
                                        oee = Math.Max(0, Math.Min(100, oee));

                                        oeeValues.Add((availability, performance, quality, oee));
                                        
                                        // Debug için iş bazlı detay ekle
                                        oeeJobDetails.Add(new
                                        {
                                            jobId = 0,
                                            siparisNo = activeSiparisNo,
                                            jobStartTime = snapshotStartCycleStartTime,
                                            jobEndTime = (DateTime?)null,
                                            setSayisi,
                                            silindirCevresi,
                                            hedefHiz,
                                            toplamMiktar,
                                            periodProduction,
                                            periodWastageBefore,
                                            periodWastageAfter,
                                            periodStoppage,
                                            periodRemainingWork,
                                            periodWastageAfterQualityControl,
                                            // Performance için
                                            averageSpeed = activeJobAverageSpeed.HasValue ? Math.Round(activeJobAverageSpeed.Value, 2) : (decimal?)null,
                                            periodStartForJob = periodStart,
                                            periodEndForJob = periodEnd,
                                            // Formül ara değerleri
                                            plannedTimeMinutes = planlananSure,
                                            runTimeAvailabilityMinutes = runTimeForAvailability,
                                            periyotSuresiDakika = periyotSuresiDakika,
                                            durusSuresiDakika = durusSuresiDakika,
                                            dieOncesiAdet = Math.Round(dieOncesiAdetActive, 0),
                                            hataliUretim = Math.Round(hataliUretimActive, 0),
                                            goodCountUnits = goodCount,
                                            totalCountForQualityUnits = totalCountForQuality,
                                            // Veri kaynakları
                                            dataSource = new
                                            {
                                                plannedTimeSource = "Periyot içinde üretilen miktar (periodProduction) üzerinden hesaplanır",
                                                productionSource = "snapshotEnd.actual_production - snapshotStart.actual_production",
                                                stoppageSource = "snapshotEnd.total_stoppage_duration - snapshotStart.total_stoppage_duration",
                                                wastageSource = "snapshotEnd.wastage - snapshotStart.wastage",
                                                averageSpeedSource = $"dataRecords (MachineSpeed >= 65, {periodStart:yyyy-MM-dd HH:mm:ss} - {periodEnd:yyyy-MM-dd HH:mm:ss})",
                                                wastageAfterQualityControlSource = "0 (devam eden iş, henüz QC fire girilmemiş)"
                                            },
                                            // Sonuçlar
                                            availability,
                                            performance,
                                            quality,
                                            oee,
                                            isActiveJob = true
                                        });
                                    } // else (geçerli parametreler)
                                } // if (jobParamsFound && snapshotEndFullLiveData != null)
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, $"Devam eden iş OEE hesaplanırken hata oluştu: {ex.Message}");
                    }
                }

                // Ortalama OEE değerlerini hesapla
                // Bugün için OEE hesaplanmaz, sadece geçmiş günler için log göster
                if (!isTodayPeriod)
                {
                    _logger.LogInformation($"OEE hesaplama: {oeeValues.Count} iş için OEE hesaplandı. Period: {period}, Start: {periodStart}, End: {periodEnd}");
                    if (oeeValues.Count > 0)
                    {
                        calculatedAvailability = oeeValues.Average(v => v.availability);
                        calculatedPerformance = oeeValues.Average(v => v.performance);
                        calculatedQuality = oeeValues.Average(v => v.quality);
                        calculatedOverallOEE = oeeValues.Average(v => v.overall);
                        _logger.LogInformation($"OEE sonuçları - Overall: {calculatedOverallOEE:F2}%, Availability: {calculatedAvailability:F2}%, Performance: {calculatedPerformance:F2}%, Quality: {calculatedQuality:F2}%");
                    }
                    else
                    {
                        _logger.LogWarning($"OEE hesaplama: Hiç iş bulunamadı veya OEE hesaplanamadı. Period: {period}, Start: {periodStart}, End: {periodEnd}");
                    }
                }
                else
                {
                    // Bugün için OEE hesaplanmaz, log gösterilmez
                    if (oeeValues.Count > 0)
                    {
                        calculatedAvailability = oeeValues.Average(v => v.availability);
                        calculatedPerformance = oeeValues.Average(v => v.performance);
                        calculatedQuality = oeeValues.Average(v => v.quality);
                        calculatedOverallOEE = oeeValues.Average(v => v.overall);
                    }
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
                    // OEE debug bilgileri - frontend doğrulama için
                    oeeDetails = oeeJobDetails,
                    snapshot = new
                    {
                        date = snapshotStartDate,
                        actualProduction = snapshotStartProduction.HasValue ? (long?)snapshotStartProduction.Value : null,
                        totalStoppageDuration = snapshotStartStoppage.HasValue ? (long?)snapshotStartStoppage.Value : null,
                        energyConsumptionKwh = snapshotStartEnergy.HasValue ? (double?)snapshotStartEnergy.Value : null
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
