using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using DashboardBackend.Data;
using System.Text.Json;

namespace DashboardBackend.Services
{
    /// <summary>
    /// Vardiya sonunda operatör performans snapshot'ları alan background service
    /// </summary>
    public class OperatorPerformanceSnapshotService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<OperatorPerformanceSnapshotService> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public OperatorPerformanceSnapshotService(
            IServiceProvider serviceProvider,
            ILogger<OperatorPerformanceSnapshotService> logger,
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
            _logger.LogInformation("OperatorPerformanceSnapshotService başlatıldı.");

            // İlk başlatmada 10 saniye bekle
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            // Her 1 dakikada bir kontrol et, vardiya bitmiş mi diye
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndTakeSnapshotsForAllMachines(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "OperatorPerformanceSnapshotService kontrolü sırasında hata oluştu.");
                }

                // Her 1 dakikada bir kontrol et
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task CheckAndTakeSnapshotsForAllMachines(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var dashboardContext = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
            var machineDatabaseService = scope.ServiceProvider.GetRequiredService<MachineDatabaseService>();

            try
            {
                var machines = await dashboardContext.MachineLists.ToListAsync(cancellationToken);

                foreach (var machine in machines)
                {
                    try
                    {
                        await CheckAndTakeSnapshotForMachine(machine, machineDatabaseService, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"{machine.MachineName} ({machine.TableName}) için snapshot kontrolü sırasında hata: {ex.Message}");
                        continue;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Tüm makineler için snapshot kontrolü sırasında hata: {ex.Message}");
            }
        }

        private async Task CheckAndTakeSnapshotForMachine(
            Models.MachineList machine,
            MachineDatabaseService machineDatabaseService,
            CancellationToken cancellationToken)
        {
            var tableName = machine.TableName;
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return;
            }

            var databaseName = !string.IsNullOrWhiteSpace(machine.DatabaseName)
                ? machine.DatabaseName
                : tableName;

            var connectionString = machineDatabaseService.GetConnectionString(databaseName);

            await using var conn = new SqlConnection(connectionString);
            await conn.OpenAsync(cancellationToken);
            await EnsureOperatorPerformanceTableAsync(conn, cancellationToken);

            // Son biten vardiyaları kontrol et (son 2 saat içinde biten)
            var now = DateTime.Now;
            var twoHoursAgo = now.AddHours(-2);

            var checkQuery = @"
                WITH ShiftWindows AS (
                    SELECT 
                        sa.id AS assignment_id,
                        sa.employee_id,
                        sa.template_id,
                        sa.shift_date,
                        sa.position,
                        e.name AS employee_name,
                        st.name AS template_name,
                        st.start_time,
                        st.end_time,
                        CASE 
                            WHEN st.end_time < st.start_time THEN
                                CASE 
                                    WHEN CAST(GETDATE() AS time) >= st.start_time THEN
                                        DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.start_time), CAST(sa.shift_date AS datetime))
                                    ELSE
                                        DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.start_time), DATEADD(DAY, -1, CAST(sa.shift_date AS datetime)))
                                END
                            ELSE
                                DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.start_time), CAST(sa.shift_date AS datetime))
                        END AS shift_start_datetime,
                        CASE 
                            WHEN st.end_time < st.start_time THEN
                                CASE 
                                    WHEN CAST(GETDATE() AS time) >= st.start_time THEN
                                        DATEADD(DAY, 1, DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.end_time), CAST(sa.shift_date AS datetime)))
                                    ELSE
                                        DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.end_time), CAST(sa.shift_date AS datetime))
                                END
                            ELSE
                                DATEADD(SECOND, DATEDIFF(SECOND, CAST('00:00:00' AS time), st.end_time), CAST(sa.shift_date AS datetime))
                        END AS shift_end_datetime
                    FROM shift_assignments sa
                    JOIN employees e ON sa.employee_id = e.id
                    JOIN shift_templates st ON sa.template_id = st.id
                    WHERE sa.shift_date >= DATEADD(DAY, -1, CAST(GETDATE() AS date))
                      AND sa.shift_date <= CAST(GETDATE() AS date)
                      AND sa.position = 'SORUMLU OPERATÖR'  -- Sadece sorumlu operatörler
                )
                SELECT 
                    sw.*
                FROM ShiftWindows sw
                WHERE sw.shift_end_datetime <= @now
                  AND sw.shift_end_datetime >= @twoHoursAgo
                  AND NOT EXISTS (
                      SELECT 1 
                      FROM OperatorPerformanceSnapshots ops
                      WHERE ops.employee_id = sw.employee_id
                        AND ops.shift_date = sw.shift_date
                        AND ops.template_id = sw.template_id
                  )
                ORDER BY sw.shift_end_datetime DESC";

            var checkCmd = new SqlCommand(checkQuery, conn);
            checkCmd.Parameters.AddWithValue("@now", now);
            checkCmd.Parameters.AddWithValue("@twoHoursAgo", twoHoursAgo);

            var shiftsToProcess = new List<ShiftInfo>();

            await using (var reader = await checkCmd.ExecuteReaderAsync(cancellationToken))
            {
                while (await reader.ReadAsync(cancellationToken))
                {
                    shiftsToProcess.Add(new ShiftInfo
                    {
                        AssignmentId = (int)reader["assignment_id"],
                        EmployeeId = (int)reader["employee_id"],
                        EmployeeName = (string)reader["employee_name"],
                        Position = reader["position"] != DBNull.Value ? (string)reader["position"] : null,
                        TemplateId = (int)reader["template_id"],
                        TemplateName = reader["template_name"] != DBNull.Value ? (string)reader["template_name"] : null,
                        ShiftDate = ((DateTime)reader["shift_date"]).Date,
                        ShiftStartTime = (TimeSpan)reader["start_time"],
                        ShiftEndTime = (TimeSpan)reader["end_time"],
                        ShiftStartDateTime = (DateTime)reader["shift_start_datetime"],
                        ShiftEndDateTime = (DateTime)reader["shift_end_datetime"]
                    });
                }
            }

            // Her biten vardiya için snapshot al
            foreach (var shift in shiftsToProcess)
            {
                try
                {
                    await TakeSnapshotForShift(conn, shift, tableName, cancellationToken);
                    _logger.LogInformation($"{machine.MachineName} - {shift.EmployeeName} vardiyası için snapshot alındı. Vardiya: {shift.ShiftDate:yyyy-MM-dd} {shift.ShiftStartTime:hh\\:mm}-{shift.ShiftEndTime:hh\\:mm}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"{machine.MachineName} - {shift.EmployeeName} vardiyası için snapshot alınırken hata: {ex.Message}");
                }
            }
        }

        private async Task TakeSnapshotForShift(
            SqlConnection connection,
            ShiftInfo shift,
            string tableName,
            CancellationToken cancellationToken)
        {
            // Vardiya süresince çalışılan işleri ve performans metriklerini hesapla
            var metrics = await CalculateShiftMetrics(connection, shift, cancellationToken);

            // Snapshot'ı kaydet
            var insertQuery = @"
                INSERT INTO OperatorPerformanceSnapshots (
                    employee_id, employee_name, position,
                    shift_date, template_id, template_name,
                    shift_start_time, shift_end_time,
                    shift_start_datetime, shift_end_datetime,
                    actual_production, total_stoppage_duration, stoppage_count,
                    wastage_before_die, wastage_after_die, wastage_ratio,
                    paper_consumption, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                    energy_consumption_kwh,
                    planned_time, run_time,
                    availability, performance, quality, oee,
                    average_speed, max_speed, min_speed,
                    jobs_worked, jobs_completed,
                    full_live_data
                ) VALUES (
                    @employeeId, @employeeName, @position,
                    @shiftDate, @templateId, @templateName,
                    @shiftStartTime, @shiftEndTime,
                    @shiftStartDateTime, @shiftEndDateTime,
                    @actualProduction, @totalStoppageDuration, @stoppageCount,
                    @wastageBeforeDie, @wastageAfterDie, @wastageRatio,
                    @paperConsumption, @ethylAlcoholConsumption, @ethylAcetateConsumption,
                    @energyConsumptionKwh,
                    @plannedTime, @runTime,
                    @availability, @performance, @quality, @oee,
                    @averageSpeed, @maxSpeed, @minSpeed,
                    @jobsWorked, @jobsCompleted,
                    @fullLiveData
                )";

            var insertCmd = new SqlCommand(insertQuery, connection);
            insertCmd.Parameters.AddWithValue("@employeeId", shift.EmployeeId);
            insertCmd.Parameters.AddWithValue("@employeeName", shift.EmployeeName);
            insertCmd.Parameters.AddWithValue("@position", shift.Position ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@shiftDate", shift.ShiftDate);
            insertCmd.Parameters.AddWithValue("@templateId", shift.TemplateId);
            insertCmd.Parameters.AddWithValue("@templateName", shift.TemplateName ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@shiftStartTime", shift.ShiftStartTime);
            insertCmd.Parameters.AddWithValue("@shiftEndTime", shift.ShiftEndTime);
            insertCmd.Parameters.AddWithValue("@shiftStartDateTime", shift.ShiftStartDateTime);
            insertCmd.Parameters.AddWithValue("@shiftEndDateTime", shift.ShiftEndDateTime);
            insertCmd.Parameters.AddWithValue("@actualProduction", metrics.ActualProduction ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@totalStoppageDuration", metrics.TotalStoppageDuration ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@stoppageCount", metrics.StoppageCount ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@wastageBeforeDie", metrics.WastageBeforeDie ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@wastageAfterDie", metrics.WastageAfterDie ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@wastageRatio", metrics.WastageRatio ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@paperConsumption", metrics.PaperConsumption ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@ethylAlcoholConsumption", metrics.EthylAlcoholConsumption ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@ethylAcetateConsumption", metrics.EthylAcetateConsumption ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@energyConsumptionKwh", metrics.EnergyConsumptionKwh ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@plannedTime", metrics.PlannedTime ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@runTime", metrics.RunTime ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@availability", metrics.Availability ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@performance", metrics.Performance ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@quality", metrics.Quality ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@oee", metrics.Oee ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@averageSpeed", metrics.AverageSpeed ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@maxSpeed", metrics.MaxSpeed ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@minSpeed", metrics.MinSpeed ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@jobsWorked", metrics.JobsWorked ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@jobsCompleted", metrics.JobsCompleted ?? (object)DBNull.Value);
            insertCmd.Parameters.AddWithValue("@fullLiveData", metrics.FullLiveData ?? (object)DBNull.Value);

            await insertCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        private async Task<ShiftMetrics> CalculateShiftMetrics(
            SqlConnection connection,
            ShiftInfo shift,
            CancellationToken cancellationToken)
        {
            var metrics = new ShiftMetrics();

            try
            {
                // Vardiya süresince biten işleri al
                var jobsQuery = @"
                    SELECT 
                        SUM(actual_production) as total_production,
                        SUM(total_stoppage_duration) as total_stoppage,
                        COUNT(*) as job_count,
                        SUM(CASE WHEN job_end_time IS NOT NULL THEN 1 ELSE 0 END) as completed_count,
                        SUM(wastage_before_die) as total_wastage_before,
                        SUM(wastage_after_die) as total_wastage_after,
                        SUM(paper_consumption) as total_paper,
                        SUM(ethyl_alcohol_consumption) as total_ethyl_alcohol,
                        SUM(ethyl_acetate_consumption) as total_ethyl_acetate,
                        SUM(energy_consumption_kwh) as total_energy
                    FROM JobEndReports
                    WHERE job_start_time >= @shiftStart
                      AND job_start_time < @shiftEnd
                      AND job_end_time IS NOT NULL";

                var jobsCmd = new SqlCommand(jobsQuery, connection);
                jobsCmd.Parameters.AddWithValue("@shiftStart", shift.ShiftStartDateTime);
                jobsCmd.Parameters.AddWithValue("@shiftEnd", shift.ShiftEndDateTime);

                await using (var reader = await jobsCmd.ExecuteReaderAsync(cancellationToken))
                {
                    if (await reader.ReadAsync(cancellationToken))
                    {
                        metrics.ActualProduction = reader["total_production"] != DBNull.Value ? (int?)reader["total_production"] : null;
                        metrics.TotalStoppageDuration = reader["total_stoppage"] != DBNull.Value ? (decimal?)reader["total_stoppage"] : null;
                        metrics.JobsWorked = reader["job_count"] != DBNull.Value ? (int?)reader["job_count"] : null;
                        metrics.JobsCompleted = reader["completed_count"] != DBNull.Value ? (int?)reader["completed_count"] : null;
                        metrics.WastageBeforeDie = reader["total_wastage_before"] != DBNull.Value ? (decimal?)reader["total_wastage_before"] : null;
                        metrics.WastageAfterDie = reader["total_wastage_after"] != DBNull.Value ? (decimal?)reader["total_wastage_after"] : null;
                        metrics.PaperConsumption = reader["total_paper"] != DBNull.Value ? (decimal?)reader["total_paper"] : null;
                        metrics.EthylAlcoholConsumption = reader["total_ethyl_alcohol"] != DBNull.Value ? (decimal?)reader["total_ethyl_alcohol"] : null;
                        metrics.EthylAcetateConsumption = reader["total_ethyl_acetate"] != DBNull.Value ? (decimal?)reader["total_ethyl_acetate"] : null;
                        metrics.EnergyConsumptionKwh = reader["total_energy"] != DBNull.Value ? (decimal?)reader["total_energy"] : null;
                    }
                }

                // Duruş sayısını hesapla
                var stoppageQuery = @"
                    SELECT COUNT(*) as stoppage_count
                    FROM stoppage_records
                    WHERE start_time >= @shiftStart
                      AND start_time < @shiftEnd";

                var stoppageCmd = new SqlCommand(stoppageQuery, connection);
                stoppageCmd.Parameters.AddWithValue("@shiftStart", shift.ShiftStartDateTime);
                stoppageCmd.Parameters.AddWithValue("@shiftEnd", shift.ShiftEndDateTime);

                var stoppageCount = await stoppageCmd.ExecuteScalarAsync(cancellationToken);
                metrics.StoppageCount = stoppageCount != null && stoppageCount != DBNull.Value ? (int?)stoppageCount : null;

                // Fire oranını hesapla
                if (metrics.ActualProduction.HasValue && metrics.ActualProduction.Value > 0 &&
                    metrics.WastageBeforeDie.HasValue && metrics.WastageAfterDie.HasValue)
                {
                    var totalWastage = metrics.WastageBeforeDie.Value + metrics.WastageAfterDie.Value;
                    var totalProduction = metrics.ActualProduction.Value + (int)totalWastage;
                    if (totalProduction > 0)
                    {
                        metrics.WastageRatio = (totalWastage / totalProduction) * 100;
                    }
                }

                // Hız metrikleri
                var speedQuery = @"
                    SELECT 
                        AVG(CAST(MachineSpeed AS FLOAT)) as avg_speed,
                        MAX(CAST(MachineSpeed AS FLOAT)) as max_speed,
                        MIN(CAST(MachineSpeed AS FLOAT)) as min_speed
                    FROM dataRecords
                    WHERE KayitZamani >= @shiftStart
                      AND KayitZamani < @shiftEnd
                      AND MachineSpeed >= 65";

                var speedCmd = new SqlCommand(speedQuery, connection);
                speedCmd.Parameters.AddWithValue("@shiftStart", shift.ShiftStartDateTime);
                speedCmd.Parameters.AddWithValue("@shiftEnd", shift.ShiftEndDateTime);

                await using (var reader = await speedCmd.ExecuteReaderAsync(cancellationToken))
                {
                    if (await reader.ReadAsync(cancellationToken))
                    {
                        metrics.AverageSpeed = reader["avg_speed"] != DBNull.Value ? (decimal?)reader["avg_speed"] : null;
                        metrics.MaxSpeed = reader["max_speed"] != DBNull.Value ? (decimal?)reader["max_speed"] : null;
                        metrics.MinSpeed = reader["min_speed"] != DBNull.Value ? (decimal?)reader["min_speed"] : null;
                    }
                }

                // Vardiya süresini hesapla (dakika)
                var shiftDuration = (shift.ShiftEndDateTime - shift.ShiftStartDateTime).TotalMinutes;
                metrics.PlannedTime = (decimal)shiftDuration;

                // Çalışma süresini hesapla (planlanan süre - duruş süresi)
                if (metrics.TotalStoppageDuration.HasValue)
                {
                    var stoppageMinutes = (decimal)(metrics.TotalStoppageDuration.Value / 1000 / 60); // milisaniye -> dakika
                    metrics.RunTime = metrics.PlannedTime.Value - stoppageMinutes;
                    if (metrics.RunTime < 0) metrics.RunTime = 0;
                }
                else
                {
                    metrics.RunTime = metrics.PlannedTime;
                }

                // OEE hesaplamaları (basitleştirilmiş)
                if (metrics.PlannedTime.HasValue && metrics.PlannedTime.Value > 0)
                {
                    // Availability = (Run Time / Planned Time) × 100
                    if (metrics.RunTime.HasValue)
                    {
                        metrics.Availability = (metrics.RunTime.Value / metrics.PlannedTime.Value) * 100;
                        metrics.Availability = Math.Max(0, Math.Min(100, metrics.Availability.Value));
                    }
                }

                // Performance ve Quality için daha detaylı hesaplamalar gerekebilir
                // Şimdilik basit değerler atıyoruz
                metrics.Performance = 100; // Varsayılan
                metrics.Quality = 100; // Varsayılan

                // OEE = Availability × Performance × Quality / 10000
                if (metrics.Availability.HasValue && metrics.Performance.HasValue && metrics.Quality.HasValue)
                {
                    metrics.Oee = (metrics.Availability.Value * metrics.Performance.Value * metrics.Quality.Value) / 10000;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Vardiya metrikleri hesaplanırken hata: {ex.Message}");
            }

            return metrics;
        }

        private async Task EnsureOperatorPerformanceTableAsync(SqlConnection connection, CancellationToken cancellationToken)
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
END";

            await using var command = new SqlCommand(ensureSql, connection);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }

        private class ShiftInfo
        {
            public int AssignmentId { get; set; }
            public int EmployeeId { get; set; }
            public string EmployeeName { get; set; } = string.Empty;
            public string? Position { get; set; }
            public int TemplateId { get; set; }
            public string? TemplateName { get; set; }
            public DateTime ShiftDate { get; set; }
            public TimeSpan ShiftStartTime { get; set; }
            public TimeSpan ShiftEndTime { get; set; }
            public DateTime ShiftStartDateTime { get; set; }
            public DateTime ShiftEndDateTime { get; set; }
        }

        private class ShiftMetrics
        {
            public int? ActualProduction { get; set; }
            public decimal? TotalStoppageDuration { get; set; }
            public int? StoppageCount { get; set; }
            public decimal? WastageBeforeDie { get; set; }
            public decimal? WastageAfterDie { get; set; }
            public decimal? WastageRatio { get; set; }
            public decimal? PaperConsumption { get; set; }
            public decimal? EthylAlcoholConsumption { get; set; }
            public decimal? EthylAcetateConsumption { get; set; }
            public decimal? EnergyConsumptionKwh { get; set; }
            public decimal? PlannedTime { get; set; }
            public decimal? RunTime { get; set; }
            public decimal? Availability { get; set; }
            public decimal? Performance { get; set; }
            public decimal? Quality { get; set; }
            public decimal? Oee { get; set; }
            public decimal? AverageSpeed { get; set; }
            public decimal? MaxSpeed { get; set; }
            public decimal? MinSpeed { get; set; }
            public int? JobsWorked { get; set; }
            public int? JobsCompleted { get; set; }
            public string? FullLiveData { get; set; }
        }
    }
}

