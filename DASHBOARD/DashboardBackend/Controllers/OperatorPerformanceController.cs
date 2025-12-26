using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using DashboardBackend.Services;
using DashboardBackend.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OperatorPerformanceController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;
        private readonly ILogger<OperatorPerformanceController> _logger;

        public OperatorPerformanceController(
            IConfiguration configuration,
            MachineDatabaseService machineDatabaseService,
            DashboardDbContext dashboardContext,
            ILogger<OperatorPerformanceController> logger)
        {
            _configuration = configuration;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
            _logger = logger;
        }

        private async Task<(string ConnectionString, string? DatabaseName)> GetConnectionStringAsync(string? machine)
        {
            if (string.IsNullOrWhiteSpace(machine))
            {
                var defaultConnection = _configuration.GetConnectionString("DefaultConnection");
                if (string.IsNullOrWhiteSpace(defaultConnection))
                {
                    throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yapılandırılmamış");
                }
                return (defaultConnection, null);
            }

            var machineInfo = await _dashboardContext.MachineLists
                .FirstOrDefaultAsync(m =>
                    (!string.IsNullOrEmpty(m.TableName) && m.TableName.ToLower() == machine.ToLower()) ||
                    (!string.IsNullOrEmpty(m.DatabaseName) && m.DatabaseName.ToLower() == machine.ToLower()) ||
                    (!string.IsNullOrEmpty(m.MachineName) && m.MachineName.ToLower() == machine.ToLower())
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

            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
            return (connectionString, databaseName);
        }

        private async Task EnsureOperatorPerformanceTableAsync(SqlConnection connection)
        {
            var ensureSql = @"
IF OBJECT_ID(N'OperatorPerformanceSnapshots', N'U') IS NULL
BEGIN
    CREATE TABLE OperatorPerformanceSnapshots (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        employee_id INT NOT NULL,
        employee_name NVARCHAR(200) NOT NULL,
        position NVARCHAR(200) NULL,
        shift_date DATE NOT NULL,
        template_id INT NOT NULL,
        template_name NVARCHAR(200) NULL,
        shift_start_time TIME NOT NULL,
        shift_end_time TIME NOT NULL,
        shift_start_datetime DATETIME2 NOT NULL,
        shift_end_datetime DATETIME2 NOT NULL,
        actual_production INT NULL DEFAULT 0,
        total_stoppage_duration DECIMAL(18,2) NULL DEFAULT 0,
        stoppage_count INT NULL DEFAULT 0,
        wastage_before_die DECIMAL(18,2) NULL DEFAULT 0,
        wastage_after_die DECIMAL(18,2) NULL DEFAULT 0,
        wastage_ratio DECIMAL(18,4) NULL DEFAULT 0,
        paper_consumption DECIMAL(18,2) NULL DEFAULT 0,
        ethyl_alcohol_consumption DECIMAL(18,2) NULL DEFAULT 0,
        ethyl_acetate_consumption DECIMAL(18,2) NULL DEFAULT 0,
        energy_consumption_kwh DECIMAL(18,2) NULL DEFAULT 0,
        planned_time DECIMAL(18,2) NULL DEFAULT 0,
        run_time DECIMAL(18,2) NULL DEFAULT 0,
        availability DECIMAL(18,4) NULL DEFAULT 0,
        performance DECIMAL(18,4) NULL DEFAULT 0,
        quality DECIMAL(18,4) NULL DEFAULT 0,
        oee DECIMAL(18,4) NULL DEFAULT 0,
        average_speed DECIMAL(18,2) NULL DEFAULT 0,
        max_speed DECIMAL(18,2) NULL DEFAULT 0,
        min_speed DECIMAL(18,2) NULL DEFAULT 0,
        jobs_worked INT NULL DEFAULT 0,
        jobs_completed INT NULL DEFAULT 0,
        full_live_data NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OperatorPerformanceSnapshots_employee_date ON OperatorPerformanceSnapshots(employee_id, shift_date);
    CREATE INDEX IX_OperatorPerformanceSnapshots_shift_date ON OperatorPerformanceSnapshots(shift_date);
    CREATE INDEX IX_OperatorPerformanceSnapshots_template ON OperatorPerformanceSnapshots(template_id);
    CREATE INDEX IX_OperatorPerformanceSnapshots_shift_datetime ON OperatorPerformanceSnapshots(shift_start_datetime, shift_end_datetime);
END
ELSE
BEGIN
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'stoppage_count') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD stoppage_count INT NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'wastage_ratio') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD wastage_ratio DECIMAL(18,4) NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'average_speed') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD average_speed DECIMAL(18,2) NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD max_speed DECIMAL(18,2) NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD min_speed DECIMAL(18,2) NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'jobs_worked') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD jobs_worked INT NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD jobs_completed INT NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'updated_at') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
    END
END";

            await using var command = new SqlCommand(ensureSql, connection);
            await command.ExecuteNonQueryAsync();
        }

        // GET: /api/operatorperformance/list
        // Operatör performans listesini getir
        [HttpGet("list")]
        public async Task<IActionResult> GetOperatorPerformanceList(
            [FromQuery] string? machine = null,
            [FromQuery] int? employeeId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureOperatorPerformanceTableAsync(conn);

                var whereClauses = new List<string>();
                var parameters = new List<SqlParameter>();

                if (employeeId.HasValue)
                {
                    whereClauses.Add("employee_id = @employeeId");
                    parameters.Add(new SqlParameter("@employeeId", employeeId.Value));
                }

                if (startDate.HasValue)
                {
                    whereClauses.Add("shift_date >= @startDate");
                    parameters.Add(new SqlParameter("@startDate", startDate.Value.Date));
                }

                if (endDate.HasValue)
                {
                    whereClauses.Add("shift_date <= @endDate");
                    parameters.Add(new SqlParameter("@endDate", endDate.Value.Date));
                }

                // Sadece SORUMLU OPERATÖR kayıtlarını göster
                whereClauses.Add("position = 'SORUMLU OPERATÖR'");
                var whereClause = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";

                // Toplam kayıt sayısı
                var countQuery = $"SELECT COUNT(*) FROM OperatorPerformanceSnapshots {whereClause}";
                var countCmd = new SqlCommand(countQuery, conn);
                countCmd.Parameters.AddRange(parameters.ToArray());
                var totalCount = (int)await countCmd.ExecuteScalarAsync();

                // Sayfalama ile veri çek
                var offset = (page - 1) * pageSize;
                var dataQuery = $@"
                    SELECT 
                        Id,
                        employee_id,
                        employee_name,
                        position,
                        shift_date,
                        template_id,
                        template_name,
                        shift_start_time,
                        shift_end_time,
                        shift_start_datetime,
                        shift_end_datetime,
                        actual_production,
                        total_stoppage_duration,
                        stoppage_count,
                        wastage_before_die,
                        wastage_after_die,
                        wastage_ratio,
                        paper_consumption,
                        ethyl_alcohol_consumption,
                        ethyl_acetate_consumption,
                        energy_consumption_kwh,
                        planned_time,
                        run_time,
                        availability,
                        performance,
                        quality,
                        oee,
                        average_speed,
                        max_speed,
                        min_speed,
                        jobs_worked,
                        jobs_completed,
                        created_at,
                        updated_at
                    FROM OperatorPerformanceSnapshots
                    {whereClause}
                    ORDER BY shift_date DESC, shift_start_datetime DESC
                    OFFSET @offset ROWS
                    FETCH NEXT @pageSize ROWS ONLY";

                var dataCmd = new SqlCommand(dataQuery, conn);
                dataCmd.Parameters.AddRange(parameters.ToArray());
                dataCmd.Parameters.Add(new SqlParameter("@offset", offset));
                dataCmd.Parameters.Add(new SqlParameter("@pageSize", pageSize));

                var results = new List<object>();

                await using (var reader = await dataCmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        results.Add(new
                        {
                            id = (int)reader["Id"],
                            employeeId = (int)reader["employee_id"],
                            employeeName = (string)reader["employee_name"],
                            position = reader["position"] != DBNull.Value ? (string)reader["position"] : null,
                            shiftDate = ((DateTime)reader["shift_date"]).ToString("yyyy-MM-dd"),
                            templateId = (int)reader["template_id"],
                            templateName = reader["template_name"] != DBNull.Value ? (string)reader["template_name"] : null,
                            shiftStartTime = ((TimeSpan)reader["shift_start_time"]).ToString(@"hh\:mm"),
                            shiftEndTime = ((TimeSpan)reader["shift_end_time"]).ToString(@"hh\:mm"),
                            shiftStartDateTime = ((DateTime)reader["shift_start_datetime"]).ToString("yyyy-MM-ddTHH:mm:ss"),
                            shiftEndDateTime = ((DateTime)reader["shift_end_datetime"]).ToString("yyyy-MM-ddTHH:mm:ss"),
                            actualProduction = reader["actual_production"] != DBNull.Value ? (int?)reader["actual_production"] : null,
                            totalStoppageDuration = reader["total_stoppage_duration"] != DBNull.Value ? (decimal?)reader["total_stoppage_duration"] : null,
                            stoppageCount = reader["stoppage_count"] != DBNull.Value ? (int?)reader["stoppage_count"] : null,
                            wastageBeforeDie = reader["wastage_before_die"] != DBNull.Value ? (decimal?)reader["wastage_before_die"] : null,
                            wastageAfterDie = reader["wastage_after_die"] != DBNull.Value ? (decimal?)reader["wastage_after_die"] : null,
                            wastageRatio = reader["wastage_ratio"] != DBNull.Value ? (decimal?)reader["wastage_ratio"] : null,
                            paperConsumption = reader["paper_consumption"] != DBNull.Value ? (decimal?)reader["paper_consumption"] : null,
                            ethylAlcoholConsumption = reader["ethyl_alcohol_consumption"] != DBNull.Value ? (decimal?)reader["ethyl_alcohol_consumption"] : null,
                            ethylAcetateConsumption = reader["ethyl_acetate_consumption"] != DBNull.Value ? (decimal?)reader["ethyl_acetate_consumption"] : null,
                            energyConsumptionKwh = reader["energy_consumption_kwh"] != DBNull.Value ? (decimal?)reader["energy_consumption_kwh"] : null,
                            plannedTime = reader["planned_time"] != DBNull.Value ? (decimal?)reader["planned_time"] : null,
                            runTime = reader["run_time"] != DBNull.Value ? (decimal?)reader["run_time"] : null,
                            availability = reader["availability"] != DBNull.Value ? (decimal?)reader["availability"] : null,
                            performance = reader["performance"] != DBNull.Value ? (decimal?)reader["performance"] : null,
                            quality = reader["quality"] != DBNull.Value ? (decimal?)reader["quality"] : null,
                            oee = reader["oee"] != DBNull.Value ? (decimal?)reader["oee"] : null,
                            averageSpeed = reader["average_speed"] != DBNull.Value ? (decimal?)reader["average_speed"] : null,
                            maxSpeed = reader["max_speed"] != DBNull.Value ? (decimal?)reader["max_speed"] : null,
                            minSpeed = reader["min_speed"] != DBNull.Value ? (decimal?)reader["min_speed"] : null,
                            jobsWorked = reader["jobs_worked"] != DBNull.Value ? (int?)reader["jobs_worked"] : null,
                            jobsCompleted = reader["jobs_completed"] != DBNull.Value ? (int?)reader["jobs_completed"] : null,
                            createdAt = ((DateTime)reader["created_at"]).ToString("yyyy-MM-ddTHH:mm:ss"),
                            updatedAt = ((DateTime)reader["updated_at"]).ToString("yyyy-MM-ddTHH:mm:ss")
                        });
                    }
                }

                return Ok(new
                {
                    success = true,
                    data = results,
                    pagination = new
                    {
                        page = page,
                        pageSize = pageSize,
                        totalCount = totalCount,
                        totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
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
                _logger.LogError(ex, "Operatör performans listesi getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Operatör performans listesi getirilemedi",
                    message = ex.Message
                });
            }
        }

        // GET: /api/operatorperformance/summary
        // Operatör performans özeti (toplu istatistikler)
        [HttpGet("summary")]
        public async Task<IActionResult> GetOperatorPerformanceSummary(
            [FromQuery] string? machine = null,
            [FromQuery] int? employeeId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureOperatorPerformanceTableAsync(conn);

                var whereClauses = new List<string>();
                var parameters = new List<SqlParameter>();

                if (employeeId.HasValue)
                {
                    whereClauses.Add("employee_id = @employeeId");
                    parameters.Add(new SqlParameter("@employeeId", employeeId.Value));
                }

                if (startDate.HasValue)
                {
                    whereClauses.Add("shift_date >= @startDate");
                    parameters.Add(new SqlParameter("@startDate", startDate.Value.Date));
                }

                if (endDate.HasValue)
                {
                    whereClauses.Add("shift_date <= @endDate");
                    parameters.Add(new SqlParameter("@endDate", endDate.Value.Date));
                }

                // Sadece SORUMLU OPERATÖR kayıtlarını göster
                whereClauses.Add("position = 'SORUMLU OPERATÖR'");
                var whereClause = whereClauses.Count > 0 ? "WHERE " + string.Join(" AND ", whereClauses) : "";

                var summaryQuery = $@"
                    SELECT 
                        COUNT(*) as total_shifts,
                        COUNT(DISTINCT employee_id) as total_operators,
                        SUM(actual_production) as total_production,
                        SUM(total_stoppage_duration) as total_stoppage_duration,
                        SUM(stoppage_count) as total_stoppage_count,
                        AVG(wastage_ratio) as avg_wastage_ratio,
                        SUM(paper_consumption) as total_paper_consumption,
                        SUM(energy_consumption_kwh) as total_energy_consumption,
                        AVG(oee) as avg_oee,
                        AVG(availability) as avg_availability,
                        AVG(performance) as avg_performance,
                        AVG(quality) as avg_quality,
                        AVG(average_speed) as avg_speed,
                        SUM(jobs_worked) as total_jobs_worked,
                        SUM(jobs_completed) as total_jobs_completed
                    FROM OperatorPerformanceSnapshots
                    {whereClause}";

                var summaryCmd = new SqlCommand(summaryQuery, conn);
                summaryCmd.Parameters.AddRange(parameters.ToArray());

                await using var reader = await summaryCmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return Ok(new
                    {
                        success = true,
                        data = new
                        {
                            totalShifts = reader["total_shifts"] != DBNull.Value ? (int)reader["total_shifts"] : 0,
                            totalOperators = reader["total_operators"] != DBNull.Value ? (int)reader["total_operators"] : 0,
                            totalProduction = reader["total_production"] != DBNull.Value ? (long?)reader["total_production"] : null,
                            totalStoppageDuration = reader["total_stoppage_duration"] != DBNull.Value ? (decimal?)reader["total_stoppage_duration"] : null,
                            totalStoppageCount = reader["total_stoppage_count"] != DBNull.Value ? (long?)reader["total_stoppage_count"] : null,
                            avgWastageRatio = reader["avg_wastage_ratio"] != DBNull.Value ? (decimal?)reader["avg_wastage_ratio"] : null,
                            totalPaperConsumption = reader["total_paper_consumption"] != DBNull.Value ? (decimal?)reader["total_paper_consumption"] : null,
                            totalEnergyConsumption = reader["total_energy_consumption"] != DBNull.Value ? (decimal?)reader["total_energy_consumption"] : null,
                            avgOee = reader["avg_oee"] != DBNull.Value ? (decimal?)reader["avg_oee"] : null,
                            avgAvailability = reader["avg_availability"] != DBNull.Value ? (decimal?)reader["avg_availability"] : null,
                            avgPerformance = reader["avg_performance"] != DBNull.Value ? (decimal?)reader["avg_performance"] : null,
                            avgQuality = reader["avg_quality"] != DBNull.Value ? (decimal?)reader["avg_quality"] : null,
                            avgSpeed = reader["avg_speed"] != DBNull.Value ? (decimal?)reader["avg_speed"] : null,
                            totalJobsWorked = reader["total_jobs_worked"] != DBNull.Value ? (long?)reader["total_jobs_worked"] : null,
                            totalJobsCompleted = reader["total_jobs_completed"] != DBNull.Value ? (long?)reader["total_jobs_completed"] : null
                        }
                    });
                }

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        totalShifts = 0,
                        totalOperators = 0,
                        totalProduction = (long?)null,
                        totalStoppageDuration = (decimal?)null,
                        totalStoppageCount = (long?)null,
                        avgWastageRatio = (decimal?)null,
                        totalPaperConsumption = (decimal?)null,
                        totalEnergyConsumption = (decimal?)null,
                        avgOee = (decimal?)null,
                        avgAvailability = (decimal?)null,
                        avgPerformance = (decimal?)null,
                        avgQuality = (decimal?)null,
                        avgSpeed = (decimal?)null,
                        totalJobsWorked = (long?)null,
                        totalJobsCompleted = (long?)null
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
                _logger.LogError(ex, "Operatör performans özeti getirilirken hata oluştu");
                return StatusCode(500, new
                {
                    success = false,
                    error = "Operatör performans özeti getirilemedi",
                    message = ex.Message
                });
            }
        }
    }
}

