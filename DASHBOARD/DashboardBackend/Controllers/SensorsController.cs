using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using System.Globalization;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SensorsController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly MachineDatabaseService _machineDatabaseService;
        private const bool EnableVerboseLogging = false;
        private readonly DashboardDbContext _dashboardContext;

        public SensorsController(IConfiguration config, MachineDatabaseService machineDatabaseService, DashboardDbContext dashboardContext)
        {
            _config = config;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
        }

        // DİNAMİK TABLODAN SON KAYIT
        // GET: /api/sensors/last?machineId=lemanic3_tracking
        [HttpGet("last")]
        public async Task<IActionResult> GetLastSensorValues(string machineId)
        {
            if (string.IsNullOrEmpty(machineId))
                return BadRequest("Makine ID boş olamaz.");

            // MachineLists tablosundan makine bilgisini al
            string databaseName;
            string tableName;
            const string fallbackTableName = "dataRecords";
            
            var machine = await _dashboardContext.MachineLists
                .FirstOrDefaultAsync(m => m.TableName.ToLower() == machineId.ToLower());
            
            if (machine != null)
            {
                tableName = machine.TableName;
                var baseName = tableName.Replace("_tracking", "");
                if (char.IsDigit(baseName.LastOrDefault()))
                {
                    var lastDigit = baseName.Last();
                    databaseName = baseName.Substring(0, baseName.Length - 1) + "_" + lastDigit + "_tracking";
                }
                else
                {
                    databaseName = baseName + "_tracking";
                }
            }
            else
            {
                // Fallback
                if (machineId.Contains("_tracking"))
                {
                    var baseName = machineId.Replace("_tracking", "");
                    if (char.IsDigit(baseName.LastOrDefault()))
                    {
                        var lastDigit = baseName.Last();
                        databaseName = baseName.Substring(0, baseName.Length - 1) + "_" + lastDigit + "_tracking";
                    }
                    else
                    {
                        databaseName = baseName + "_tracking";
                    }
                    tableName = machineId;
                }
                else
                {
                    databaseName = machineId + "_tracking";
                    tableName = machineId.Replace("_", "") + "_tracking";
                }
            }

            if (EnableVerboseLogging)
            {
            Console.WriteLine($"🔍 GetLastSensorValues - machineId: {machineId}, databaseName: {databaseName}, tableName: {tableName}");
            }

            try
            {
                var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
                var query = $@"
                    SELECT TOP 1
                        [machineSpeed],
                        [dieSpeed],
                        [etilAsetat],
                        [etilAlkol],
                        [KayitZamani]
                    FROM [{tableName}]
                    ORDER BY [KayitZamani] DESC";

                if (EnableVerboseLogging)
                {
                Console.WriteLine($"📝 SQL Query: {query}");
                }

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    var result = new
                    {
                        machineSpeed = reader["machineSpeed"] != DBNull.Value ? Convert.ToDouble(reader["machineSpeed"]) : 0,
                        dieSpeed = reader["dieSpeed"] != DBNull.Value ? Convert.ToInt32(reader["dieSpeed"]) : 0,
                        etilAsetat = reader["etilAsetat"] != DBNull.Value ? Convert.ToDouble(reader["etilAsetat"]) : 0,
                        etilAlkol = reader["etilAlkol"] != DBNull.Value ? Convert.ToDouble(reader["etilAlkol"]) : 0,
                        time = reader["KayitZamani"] != DBNull.Value
                            ? Convert.ToDateTime(reader["KayitZamani"])
                            : DateTime.MinValue
                    };

                    return Ok(result);
                }

                return NotFound("Veri bulunamadı.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Sunucu hatası: {ex.Message}");
            }
        }

        // ZAMAN ARALIĞINA GÖRE VERİ ÇEKER (sabit SensorLogs değil, dinamik tablo)
        [HttpGet("period")]
        public async Task<IActionResult> GetByPeriod(
            [FromQuery] string? range = null,
            [FromQuery] DateTime? start = null,
            [FromQuery] DateTime? end = null,
            [FromQuery] int resolution = 60,
            [FromQuery] string machineId = "lemanic3_tracking")
        {
            // MachineLists tablosundan makine bilgisini al
            string databaseName;
            string tableName;
            const string fallbackTableName = "dataRecords";
            
            // machineId parametresi TableName olarak geliyor (örn: "lemanic3_tracking")
            // EF Core string.Equals with StringComparison translate edemiyor, bu yüzden ToLower() kullanıyoruz
            var machine = await _dashboardContext.MachineLists
                .FirstOrDefaultAsync(m => m.TableName.ToLower() == machineId.ToLower());
            
            if (machine != null)
            {
                // TableName ile veritabanı adı aynı olmalı
                tableName = machine.TableName;
                databaseName = tableName; // Veritabanı adı TableName ile aynı
            }
            else
            {
                // Fallback: machineId TableName olarak kullanılır
                if (machineId.Contains("_tracking"))
                {
                    tableName = machineId;
                    databaseName = machineId; // Veritabanı adı TableName ile aynı
                }
                else
                {
                    tableName = machineId + "_tracking";
                    databaseName = tableName; // Veritabanı adı TableName ile aynı
                }
            }

            // Makine bazlı veritabanı connection string'i al
            try
            {
                var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

                // 1. Geçerli tablo kontrolü - Tüm tabloları listele
                var validTables = new List<string>();
                var allTables = new List<string>();
                try
                {
                    using (var conn = new SqlConnection(connectionString))
                    {
                        await conn.OpenAsync();
                        
                        // Önce tüm tabloları listele (debug için)
                        var allTablesCmd = new SqlCommand(@"
                            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                            WHERE TABLE_TYPE = 'BASE TABLE'", conn);
                        
                        using var allTablesReader = await allTablesCmd.ExecuteReaderAsync();
                        while (await allTablesReader.ReadAsync())
                            allTables.Add(allTablesReader.GetString(0));
                        
                        await allTablesReader.CloseAsync();
                        
                        // Şimdi tracking tablolarını filtrele
                        var cmd = new SqlCommand(@"
                            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                            WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE '%_tracking'", conn);

                        using var reader = await cmd.ExecuteReaderAsync();
                        while (await reader.ReadAsync())
                            validTables.Add(reader.GetString(0));
                    }

                    // Tablo kontrolü - eğer tracking tabloları boşsa, fallback olarak dataRecords kullanılabilir
                    var tableExists = false;
                    if (validTables.Any(t => t.Equals(tableName, StringComparison.OrdinalIgnoreCase)))
                    {
                        tableExists = true;
                    }
                    else
                    {
                        // Direkt olarak tabloyu kontrol et
                        try
                        {
                            using (var conn = new SqlConnection(connectionString))
                            {
                                await conn.OpenAsync();
                                var checkCmd = new SqlCommand($@"
                                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                                    WHERE TABLE_NAME = @tblName", conn);
                                checkCmd.Parameters.AddWithValue("@tblName", tableName);
                                var count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                                tableExists = count > 0;
                            }
                        }
                        catch (Exception checkEx)
                        {
                            // Tablo kontrolü hatası - sessizce devam et
                        }
                        
                        if (!tableExists && allTables.Any(t => t.Equals(fallbackTableName, StringComparison.OrdinalIgnoreCase)))
                        {
                            tableName = fallbackTableName;
                            tableExists = true;
                        }
                    }
                }
                catch (Exception ex)
                {
                    var errorMsg = $"Veritabanı bağlantı hatası: {ex.Message}. Database: {databaseName}, Table: {tableName}";
                    Console.WriteLine($"❌ {errorMsg}");
                    Console.WriteLine($"❌ StackTrace: {ex.StackTrace}");
                    // Tablo kontrolü hatası olsa bile sorguyu deneyelim
                    Console.WriteLine($"⚠️ Tablo kontrolü hatası, ancak sorgu çalıştırılacak");
                }

            // 2. Tarih aralığı belirleme
            DateTime endTime = end ?? DateTime.Now;
            DateTime startTime;

            if (start.HasValue)
            {
                startTime = start.Value;
            }
            else if (!string.IsNullOrEmpty(range))
            {
                switch (range)
                {
                    case "1h": startTime = endTime.AddHours(-1); break;
                    case "6h": startTime = endTime.AddHours(-6); break;
                    case "12h": startTime = endTime.AddHours(-12); break;
                    case "24h": startTime = endTime.AddHours(-24); break;
                    case "1w": startTime = endTime.AddDays(-7); break;
                    case "1m": startTime = endTime.AddMonths(-1); break;
                    case "1y": startTime = endTime.AddYears(-1); break;
                    default: return BadRequest("Geçersiz zaman aralığı.");
                }
            }
            else
            {
                startTime = endTime.AddHours(-24); // Varsayılan 24 saat
            }

                // 3. Resolution'a göre gruplama - SANİYE bazlı!
                var results = new List<object>();
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();

                    string sql;
                
                if (resolution <= 1)
                {
                    // 1 saniye veya daha az: Tüm verileri döndür (gruplama yok) - Max 5000 kayıt
                    // dataRecords tablosunda sadece MachineSpeed, KayitZamani, activePowerW var
                    sql = $@"
                        SELECT TOP 5000
                            KayitZamani,
                            ISNULL(MachineSpeed, 0) AS machineSpeed,
                            CAST(0 AS FLOAT) AS dieSpeed,
                            CAST(0 AS FLOAT) AS etilAsetat,
                            CAST(0 AS FLOAT) AS etilAlkol,
                            ISNULL(activePowerW, 0) AS activePowerW
                        FROM [{tableName}]
                        WHERE KayitZamani BETWEEN @start AND @end
                        ORDER BY KayitZamani";
                }
                else if (resolution >= 60)
                {
                    // DAKİKA bazlı gruplama (overflow önlemek için)
                    int minuteGroup = resolution / 60;
                    if (minuteGroup < 1) minuteGroup = 1;
                    
                    // dataRecords tablosunda sadece MachineSpeed, KayitZamani, activePowerW var
                    sql = $@"
                        SELECT 
                            DATEADD(MINUTE, DATEDIFF(MINUTE, 0, KayitZamani) / {minuteGroup} * {minuteGroup}, 0) AS GroupedTime,
                            AVG(CAST(ISNULL(MachineSpeed, 0) AS FLOAT)) AS machineSpeed,
                            CAST(0 AS FLOAT) AS dieSpeed,
                            CAST(0 AS FLOAT) AS etilAsetat,
                            CAST(0 AS FLOAT) AS etilAlkol,
                            AVG(CAST(ISNULL(activePowerW, 0) AS FLOAT)) AS activePowerW
                        FROM [{tableName}]
                        WHERE KayitZamani BETWEEN @start AND @end
                        GROUP BY DATEADD(MINUTE, DATEDIFF(MINUTE, 0, KayitZamani) / {minuteGroup} * {minuteGroup}, 0)
                        ORDER BY GroupedTime";
                }
                else
                {
                    // SANİYE bazlı gruplama (1-59 saniye) - ROW_NUMBER ile overflow önlenir
                    // dataRecords tablosunda sadece MachineSpeed, KayitZamani, activePowerW var
                    sql = $@"
                        WITH NumberedRows AS (
                            SELECT 
                                KayitZamani,
                                ISNULL(MachineSpeed, 0) AS machineSpeed,
                                CAST(0 AS FLOAT) AS dieSpeed,
                                CAST(0 AS FLOAT) AS etilAsetat,
                                CAST(0 AS FLOAT) AS etilAlkol,
                                ISNULL(activePowerW, 0) AS activePowerW,
                                ROW_NUMBER() OVER (ORDER BY KayitZamani) as RowNum
                            FROM [{tableName}]
                            WHERE KayitZamani BETWEEN @start AND @end
                        )
                        SELECT 
                            MIN(KayitZamani) AS GroupedTime,
                            AVG(CAST(machineSpeed AS FLOAT)) AS machineSpeed,
                            CAST(0 AS FLOAT) AS dieSpeed,
                            CAST(0 AS FLOAT) AS etilAsetat,
                            CAST(0 AS FLOAT) AS etilAlkol,
                            AVG(CAST(activePowerW AS FLOAT)) AS activePowerW
                        FROM NumberedRows
                        GROUP BY (RowNum - 1) / {resolution}
                        ORDER BY MIN(KayitZamani)";
                }

                    var cmd = new SqlCommand(sql, conn);
                    cmd.Parameters.AddWithValue("@start", startTime);
                    cmd.Parameters.AddWithValue("@end", endTime);

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        results.Add(new
                        {
                            kayitZamani = reader.GetDateTime(0),
                            machineSpeed = reader.IsDBNull(1) ? 0f : Convert.ToSingle(reader.GetValue(1)),
                            dieSpeed = reader.IsDBNull(2) ? 0 : Convert.ToInt32(reader.GetValue(2)),
                            etilAsetat = reader.IsDBNull(3) ? 0f : Convert.ToSingle(reader.GetValue(3)),
                            etilAlkol = reader.IsDBNull(4) ? 0f : Convert.ToSingle(reader.GetValue(4)),
                            activePowerW = reader.IsDBNull(5) ? 0f : Convert.ToSingle(reader.GetValue(5))
                        });
                    }
                }

                return Ok(results);
            }
            catch (Exception ex)
            {
                var errorMsg = $"GetByPeriod genel hata: {ex.Message}";
                Console.WriteLine($"❌ {errorMsg}");
                Console.WriteLine($"❌ StackTrace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"❌ InnerException: {ex.InnerException.Message}");
                }
                return StatusCode(500, errorMsg);
            }
        }

        // SADECE DEĞİŞEN DEĞERLERİ DÖNDÜREN ENDPOINT
        [HttpGet("changes")]
        public async Task<IActionResult> GetChangedValues(
            [FromQuery] string range = "24h",
            [FromQuery] string machineId = "lemanic3_tracking",
            [FromQuery] string sensorType = "speed") // speed, ethylAcetate, ethylAlcohol, dieCounter
        {
            // MachineLists tablosundan makine bilgisini al
            string databaseName;
            string tableName;
            
            var machine = await _dashboardContext.MachineLists
                .FirstOrDefaultAsync(m => m.TableName.ToLower() == machineId.ToLower());
            
            if (machine != null)
            {
                // TableName ile veritabanı adı aynı olmalı
                tableName = machine.TableName;
                databaseName = tableName; // Veritabanı adı TableName ile aynı
            }
            else
            {
                // Fallback: machineId TableName olarak kullanılır
                if (machineId.Contains("_tracking"))
                {
                    tableName = machineId;
                    databaseName = machineId; // Veritabanı adı TableName ile aynı
                }
                else
                {
                    tableName = machineId + "_tracking";
                    databaseName = tableName; // Veritabanı adı TableName ile aynı
                }
            }

            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

            // Geçerli tablo kontrolü
            var validTables = new List<string>();
            try
            {
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    var cmd = new SqlCommand(@"
                        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE '%_tracking'", conn);

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                        validTables.Add(reader.GetString(0));
                }

                       if (!validTables.Any(t => t.ToLower() == tableName.ToLower()))
                    return BadRequest($"Geçersiz tablo adı: {tableName}");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Veritabanı bağlantı hatası: {ex.Message}");
            }

            // Tarih aralığı belirleme
            DateTime now = DateTime.Now;
            DateTime start;

            switch (range)
            {
                case "12h": start = now.AddHours(-12); break;
                case "24h": start = now.AddHours(-24); break;
                case "1w": start = now.AddDays(-7); break;
                case "1m": start = now.AddMonths(-1); break;
                case "1y": start = now.AddYears(-1); break;
                default: return BadRequest("Geçersiz zaman aralığı.");
            }

            // Sensor tipine göre kolon seçimi
            string columnName = sensorType switch
            {
                "speed" => "machineSpeed",
                "die" => "dieSpeed",
                "ethylAcetate" => "etilAsetat",
                "ethylAlcohol" => "etilAlkol",
                _ => "machineSpeed"
            };

            var results = new List<object>();
            using (var conn = new SqlConnection(connectionString))
            {
                await conn.OpenAsync();

                // Sadece değişen değerleri getiren SQL
                string sql = $@"
                    WITH RankedData AS (
                        SELECT 
                            {columnName},
                            KayitZamani,
                            LAG({columnName}) OVER (ORDER BY KayitZamani) as PrevValue
                        FROM [{tableName}]
                        WHERE KayitZamani BETWEEN @start AND @end
                    )
                    SELECT 
                        {columnName} as value,
                        KayitZamani as time
                    FROM RankedData
                    WHERE {columnName} != PrevValue OR PrevValue IS NULL
                    ORDER BY KayitZamani";

                var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@start", start);
                cmd.Parameters.AddWithValue("@end", now);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    results.Add(new
                    {
                        value = reader.IsDBNull(0) ? 0f : Convert.ToSingle(reader.GetValue(0)),
                        time = reader.GetDateTime(1)
                    });
                }
            }

                    return Ok(results);
    }

    // SABİT PERİYOTLARI DÖNDÜREN ENDPOINT
    [HttpGet("speed-periods")]
    public async Task<IActionResult> GetSpeedPeriods(
        [FromQuery] string range = "24h",
        [FromQuery] string machineId = "lemanic3_tracking",
        [FromQuery] string sensorType = "speed") // speed, die, ethylAcetate, ethylAlcohol
    {
        // MachineLists tablosundan makine bilgisini al
        string databaseName;
        string tableName;
        
        var machine = await _dashboardContext.MachineLists
            .FirstOrDefaultAsync(m => m.TableName.Equals(machineId, StringComparison.OrdinalIgnoreCase));
        
            if (machine != null)
            {
                // TableName ile veritabanı adı aynı olmalı
                tableName = machine.TableName;
                databaseName = tableName; // Veritabanı adı TableName ile aynı
            }
            else
            {
                // Fallback: machineId TableName olarak kullanılır
                if (machineId.Contains("_tracking"))
                {
                    tableName = machineId;
                    databaseName = machineId; // Veritabanı adı TableName ile aynı
                }
                else
                {
                    tableName = machineId + "_tracking";
                    databaseName = tableName; // Veritabanı adı TableName ile aynı
                }
            }

            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

        // Geçerli tablo kontrolü
        var validTables = new List<string>();
        try
        {
            using (var conn = new SqlConnection(connectionString))
            {
                await conn.OpenAsync();
                var cmd = new SqlCommand(@"
                    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME LIKE '%_tracking'", conn);

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    validTables.Add(reader.GetString(0));
            }

                       if (!validTables.Any(t => t.ToLower() == tableName.ToLower()))
                return BadRequest($"Geçersiz tablo adı: {tableName}");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Veritabanı bağlantı hatası: {ex.Message}");
        }

        // Tarih aralığı belirleme
        DateTime now = DateTime.Now;
        DateTime start;

        switch (range)
        {
            case "12h": start = now.AddHours(-12); break;
            case "24h": start = now.AddHours(-24); break;
            case "1w": start = now.AddDays(-7); break;
            case "1m": start = now.AddMonths(-1); break;
            case "1y": start = now.AddYears(-1); break;
            default: return BadRequest("Geçersiz zaman aralığı.");
        }

        // Sensor tipine göre kolon seçimi
        string columnName = sensorType switch
        {
            "speed" => "machineSpeed",
            "die" => "dieSpeed",
            "ethylAcetate" => "etilAsetat",
            "ethylAlcohol" => "etilAlkol",
            _ => "machineSpeed"
        };

        var results = new List<object>();
        using (var conn = new SqlConnection(connectionString))
        {
            await conn.OpenAsync();

            // Sabit periyotları getiren SQL
            string sql = $@"
                WITH SpeedChanges AS (
                    SELECT 
                        {columnName},
                        KayitZamani,
                        LAG({columnName}) OVER (ORDER BY KayitZamani) as PrevSpeed,
                        LAG(KayitZamani) OVER (ORDER BY KayitZamani) as PrevTime
                    FROM [{tableName}]
                    WHERE KayitZamani BETWEEN @start AND @end
                ),
                SpeedPeriods AS (
                    SELECT 
                        {columnName} as speed,
                        KayitZamani as startTime,
                        LEAD(KayitZamani) OVER (ORDER BY KayitZamani) as endTime
                    FROM SpeedChanges
                    WHERE {columnName} != PrevSpeed OR PrevSpeed IS NULL
                )
                SELECT 
                    speed,
                    startTime,
                    ISNULL(endTime, @end) as endTime
                FROM SpeedPeriods
                ORDER BY startTime";

            var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@start", start);
            cmd.Parameters.AddWithValue("@end", now);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                results.Add(new
                {
                    speed = reader.IsDBNull(0) ? 0f : Convert.ToSingle(reader.GetValue(0)),
                    startTime = reader.GetDateTime(1),
                    endTime = reader.GetDateTime(2),
                    sensorType = sensorType
                });
            }
        }

        return Ok(results);
    }
}
}
