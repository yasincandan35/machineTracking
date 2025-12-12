using Microsoft.AspNetCore.Mvc;
using DashboardBackend.Services.PLC;
using DashboardBackend.Services;
using DashboardBackend.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PLCDataController : ControllerBase
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;
        private readonly PrivacyService _privacyService;

        public PLCDataController(
            IServiceProvider serviceProvider,
            MachineDatabaseService machineDatabaseService,
            DashboardDbContext dashboardContext,
            PrivacyService privacyService)
        {
            _serviceProvider = serviceProvider;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
            _privacyService = privacyService;
        }

        /// <summary>
        /// PLCDataCollectorService'e erişim (BackgroundService olduğu için özel erişim)
        /// </summary>
        private PLCDataCollectorService? GetPLCDataCollectorService()
        {
            // BackgroundService'e erişim için hosted service'leri al
            var hostedServices = _serviceProvider.GetServices<Microsoft.Extensions.Hosting.IHostedService>();
            return hostedServices.OfType<PLCDataCollectorService>().FirstOrDefault();
        }

        private async Task<DashboardBackend.Models.User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId)) return null;
            if (!int.TryParse(userId, out var id)) return null;
            return await _dashboardContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }


        /// <summary>
        /// PLC durumunu kontrol et
        /// GET /api/plcdata/plc-status
        /// </summary>
        [HttpGet("plc-status")]
        public async Task<IActionResult> GetPLCStatus()
        {
            try
            {
                var service = GetPLCDataCollectorService();
                if (service == null)
                {
                    return Ok(new { success = false, connected = false, message = "PLC servisi başlatılmamış" });
                }

                var sqlProxy = service.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return Ok(new { success = false, connected = false, message = "SqlProxy başlatılmamış" });
                }

                var plcReader = service.GetPLCReader();
                if (plcReader == null)
                {
                    return Ok(new { success = false, connected = false, message = "PLC Reader başlatılmamış" });
                }

                var lastData = sqlProxy.GetLastData();
                var machineStopped = lastData?.machineStopped ?? false;

                return Ok(new
                {
                    success = true,
                    connected = plcReader.IsConnected,
                    machine_stopped = machineStopped,
                    ip_address = plcReader.IpAddress,
                    port = plcReader.Port
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// Canlı PLC verilerini al
        /// GET /api/plcdata/data?machine=lemanic3_tracking
        /// SqlProxy'nin HandleDataRequest mantığıyla uyumlu
        /// </summary>
        [HttpGet("data")]
        public async Task<IActionResult> GetData([FromQuery] string? machine = null)
        {
            try
            {
                // Machine parametresi verilmişse, önce cache'den kontrol et (aktif makine ise)
                if (!string.IsNullOrEmpty(machine))
                {
                    var plcService = GetPLCDataCollectorService();
                    var plcSqlProxy = plcService?.GetSqlProxy();
                    
                    // MachineLists tablosundan makine bilgisini al
                    var machineInfo = await _dashboardContext.MachineLists
                        .FirstOrDefaultAsync(m => m.TableName.ToLower() == machine.ToLower());
                    
                    if (machineInfo == null)
                    {
                        return BadRequest(new { error = $"Makine bulunamadı: {machine}" });
                    }

                    // DatabaseName kullan (eğer boşsa TableName'den hesapla)
                    var originalTableName = machineInfo.TableName;
                    var tableName = NormalizeTableName(originalTableName);
                    string databaseName;
                    
                    if (!string.IsNullOrEmpty(machineInfo.DatabaseName))
                    {
                        databaseName = machineInfo.DatabaseName;
                    }
                    else
                    {
                        // Fallback: TableName'den veritabanı adını çıkar
                        var baseName = originalTableName.Replace("_tracking", "");
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

                    // Aktif makine kontrolü - eğer istenen makine aktif makine ise cache'den al
                    if (plcService != null && plcSqlProxy != null)
                    {
                        var activeMachineName = plcService.GetCurrentMachineName();
                        
                        // Aktif makine kontrolü - DatabaseName veya TableName ile karşılaştır
                        bool isActiveMachine = false;
                        if (!string.IsNullOrEmpty(activeMachineName))
                        {
                            // DatabaseName veya TableName ile karşılaştır
                            isActiveMachine = activeMachineName.Equals(databaseName, StringComparison.OrdinalIgnoreCase) ||
                                            activeMachineName.Equals(tableName, StringComparison.OrdinalIgnoreCase) ||
                                            activeMachineName.Replace("_tracking", "").Equals(tableName.Replace("_tracking", ""), StringComparison.OrdinalIgnoreCase);
                        }
                        
                        if (isActiveMachine)
                        {
                            // Cache'den al - Dinamik mapping ile
                            var cachedData = plcSqlProxy.GetLastData();
                            if (cachedData != null)
                            {
                                // PLCDataDefinitions'dan dinamik mapping oluştur
                                using var cacheContext = _machineDatabaseService.CreateDbContext(databaseName);
                                var cacheDefinitions = await cacheContext.PLCDataDefinitions
                                    .Where(d => d.IsActive)
                                    .ToListAsync();
                                
                                // Name -> API endpoint adı mapping'i oluştur
                                var cacheNameMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                                foreach (var def in cacheDefinitions)
                                {
                                    // API endpoint adı: ApiEndpoint varsa onu kullan, yoksa Name'i camelCase'e çevir
                                    var apiName = !string.IsNullOrEmpty(def.ApiEndpoint) && def.ApiEndpoint != "/api/data"
                                        ? def.ApiEndpoint.TrimStart('/').Replace("/", "")
                                        : ToCamelCase(def.Name);
                                    
                                    cacheNameMapping[def.Name] = apiName;
                                }
                                
                                var cacheResult = new Dictionary<string, object>
                                {
                                    ["Timestamp"] = cachedData.Timestamp,
                                    ["machineDatabase"] = databaseName,
                                    ["machineTable"] = tableName,
                                    ["machineName"] = databaseName
                                };

                                // Data dictionary'sindeki değerleri dinamik mapping ile ekle
                                foreach (var kvp in cachedData.Data)
                                {
                                    // Eğer mapping varsa onu kullan, yoksa camelCase'e çevir
                                    var apiName = cacheNameMapping.ContainsKey(kvp.Key) 
                                        ? cacheNameMapping[kvp.Key] 
                                        : ToCamelCase(kvp.Key);
                                    
                                    cacheResult[apiName] = kvp.Value;
                                }

                                return Ok(cacheResult);
                            }
                        }
                    }

                    // Aktif makine değilse veya cache'de veri yoksa, veritabanından çek - Dinamik mapping ile
                    var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
                    
                    // PLCDataDefinitions'dan dinamik mapping oluştur
                    using var dbContext = _machineDatabaseService.CreateDbContext(databaseName);
                    var dbDefinitions = await dbContext.PLCDataDefinitions
                        .Where(d => d.IsActive)
                        .ToListAsync();
                    
                    // Kolon adı -> API endpoint adı mapping'i oluştur
                    var dbColumnMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var def in dbDefinitions)
                    {
                        // SaveColumnName varsa onu kullan, yoksa Name'i camelCase'e çevir
                        var dbColumnName = !string.IsNullOrEmpty(def.SaveColumnName) 
                            ? def.SaveColumnName 
                            : def.Name;
                        
                        // API endpoint adı: ApiEndpoint varsa onu kullan, yoksa Name'i camelCase'e çevir
                        var apiName = !string.IsNullOrEmpty(def.ApiEndpoint) && def.ApiEndpoint != "/api/data"
                            ? def.ApiEndpoint.TrimStart('/').Replace("/", "")
                            : ToCamelCase(def.Name);
                        
                        dbColumnMapping[dbColumnName] = apiName;
                    }
                    
                    // KayitZamani ve Timestamp için özel mapping
                    dbColumnMapping["KayitZamani"] = "timestamp";
                    dbColumnMapping["Timestamp"] = "timestamp";
                    
                    var query = $@"
                        SELECT TOP 1 *
                        FROM [{tableName}]
                        ORDER BY KayitZamani DESC";

                    var dbResult = new Dictionary<string, object>
                    {
                        ["Timestamp"] = DateTime.Now,
                        ["machineDatabase"] = databaseName,
                        ["machineTable"] = tableName,
                        ["machineName"] = databaseName
                    };

                    using var connection = new SqlConnection(connectionString);
                    await connection.OpenAsync();

                    using var command = new SqlCommand(query, connection);
                    using var reader = await command.ExecuteReaderAsync();

                    if (await reader.ReadAsync())
                    {
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var fieldName = reader.GetName(i);
                            var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                            
                            // Dinamik mapping kullan
                            var apiName = dbColumnMapping.ContainsKey(fieldName) 
                                ? dbColumnMapping[fieldName] 
                                : ToCamelCase(fieldName);
                            
                            dbResult[apiName] = value ?? 0;
                        }
                    }

                    return Ok(dbResult);
                }

                // Machine parametresi yoksa, PLCDataCollectorService'den veri çek - Dinamik mapping ile
                var defaultService = GetPLCDataCollectorService();
                var defaultSqlProxy = defaultService?.GetSqlProxy();
                if (defaultSqlProxy == null)
                {
                    return StatusCode(503, new { error = "PLC servisi başlatılmamış" });
                }

                var defaultMachineName = defaultService.GetCurrentMachineName();
                if (string.IsNullOrEmpty(defaultMachineName))
                {
                    return StatusCode(503, new { error = "Aktif makine bulunamadı" });
                }

                var defaultMachineInfo = await _dashboardContext.MachineLists
                    .FirstOrDefaultAsync(m =>
                        (!string.IsNullOrEmpty(m.DatabaseName) && m.DatabaseName.Equals(defaultMachineName, StringComparison.OrdinalIgnoreCase)) ||
                        (!string.IsNullOrEmpty(m.TableName) && m.TableName.Equals(defaultMachineName, StringComparison.OrdinalIgnoreCase))
                    );

                var defaultTableName = NormalizeTableName(defaultMachineInfo?.TableName);
                var defaultDatabaseName = !string.IsNullOrEmpty(defaultMachineInfo?.DatabaseName)
                    ? defaultMachineInfo.DatabaseName
                    : defaultMachineName;

                var defaultData = defaultSqlProxy.GetLastData();
                if (defaultData == null)
                {
                    return Ok(new Dictionary<string, object>
                    {
                        ["Timestamp"] = DateTime.Now,
                        ["machineDatabase"] = defaultDatabaseName,
                        ["machineTable"] = defaultTableName ?? defaultDatabaseName,
                        ["machineName"] = defaultDatabaseName
                    });
                }

                // PLCDataDefinitions'dan dinamik mapping oluştur
                using var defaultContext = _machineDatabaseService.CreateDbContext(defaultMachineName);
                var defaultDefinitions = await defaultContext.PLCDataDefinitions
                    .Where(d => d.IsActive)
                    .ToListAsync();
                
                // Name -> API endpoint adı mapping'i oluştur
                var defaultNameMapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var def in defaultDefinitions)
                {
                    // API endpoint adı: ApiEndpoint varsa onu kullan, yoksa Name'i camelCase'e çevir
                    var apiName = !string.IsNullOrEmpty(def.ApiEndpoint) && def.ApiEndpoint != "/api/data"
                        ? def.ApiEndpoint.TrimStart('/').Replace("/", "")
                        : ToCamelCase(def.Name);
                    
                    defaultNameMapping[def.Name] = apiName;
                }

                var defaultResult = new Dictionary<string, object>
                {
                    ["Timestamp"] = defaultData.Timestamp,
                    ["machineDatabase"] = defaultDatabaseName,
                    ["machineTable"] = defaultTableName ?? defaultDatabaseName,
                    ["machineName"] = defaultDatabaseName
                };

                // Data dictionary'sindeki değerleri dinamik mapping ile ekle
                foreach (var kvp in defaultData.Data)
                {
                    // Eğer mapping varsa onu kullan, yoksa camelCase'e çevir
                    var apiName = defaultNameMapping.ContainsKey(kvp.Key) 
                        ? defaultNameMapping[kvp.Key] 
                        : ToCamelCase(kvp.Key);
                    
                    defaultResult[apiName] = kvp.Value;
                }

                return Ok(defaultResult);
            }
            catch (Exception ex)
            {
                // Detaylı hata loglama
                var errorMessage = $"PLC Data çekme hatası: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" | Inner: {ex.InnerException.Message}";
                }
                errorMessage += $" | StackTrace: {ex.StackTrace}";
                
                Console.WriteLine($"❌ {errorMessage}");
                
                return StatusCode(500, new { 
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace
                });
            }
        }


        /// <summary>
        /// Aktif iş emri verilerini veritabanından oku
        /// GET /api/plcdata/active-job?machine=lemanic3_tracking
        /// </summary>
        [HttpGet("active-job")]
        public async Task<IActionResult> GetActiveJob([FromQuery] string? machine = null)
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();
                var privacy = _privacyService.GetPrivacy(currentUser);

                // Machine parametresi gerekli
                if (string.IsNullOrEmpty(machine))
                {
                    return BadRequest(new { success = false, error = "machine parametresi gerekli" });
                }

                // MachineLists tablosundan makine bilgisini al
                var machineInfo = await _dashboardContext.MachineLists
                    .FirstOrDefaultAsync(m => m.TableName.ToLower() == machine.ToLower());
                
                if (machineInfo == null)
                {
                    return BadRequest(new { success = false, error = $"Makine bulunamadı: {machine}" });
                }

                // DatabaseName kullan (eğer boşsa TableName'den hesapla)
                var originalTableName = machineInfo.TableName;
                string databaseName;
                
                if (!string.IsNullOrEmpty(machineInfo.DatabaseName))
                {
                    databaseName = machineInfo.DatabaseName;
                }
                else
                {
                    // Fallback: TableName'den veritabanı adını çıkar
                    var baseName = originalTableName.Replace("_tracking", "");
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

                // Veritabanından aktif job cycle kaydını oku
                var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
                
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                // JobCycleRecords tablosunun var olduğundan emin ol
                var ensureTableQuery = @"
IF OBJECT_ID(N'JobCycleRecords', N'U') IS NULL
BEGIN
    CREATE TABLE JobCycleRecords (
        id INT IDENTITY(1,1) PRIMARY KEY,
        status NVARCHAR(20) NOT NULL DEFAULT 'active',
        cycle_start_time DATETIME2 NOT NULL,
        cycle_end_time DATETIME2 NULL,
        siparis_no NVARCHAR(50) NULL,
        job_info NVARCHAR(MAX) NULL,
        initial_snapshot NVARCHAR(MAX) NULL,
        final_snapshot NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_JobCycleRecords_status ON JobCycleRecords(status);
    CREATE INDEX IX_JobCycleRecords_siparis_no ON JobCycleRecords(siparis_no);
END";
                
                using var ensureCmd = new SqlCommand(ensureTableQuery, connection);
                await ensureCmd.ExecuteNonQueryAsync();

                // Aktif job cycle kaydını oku
                var query = @"
                    SELECT TOP 1 job_info, siparis_no, cycle_start_time, cycle_end_time
                    FROM JobCycleRecords
                    WHERE status = 'active'
                    ORDER BY cycle_start_time DESC";
                
                using var cmd = new SqlCommand(query, connection);
                using var reader = await cmd.ExecuteReaderAsync();
                
                if (await reader.ReadAsync())
                {
                    var jobInfoStr = reader["job_info"]?.ToString();
                    var siparisNo = reader["siparis_no"]?.ToString();
                    var cycleStartTime = reader["cycle_start_time"] as DateTime?;
                    var cycleEndTime = reader["cycle_end_time"] as DateTime?;
                    
                    if (!string.IsNullOrEmpty(jobInfoStr))
                    {
                        try
                        {
                            // job_info JSON'unu parse et
                            var jobData = JsonSerializer.Deserialize<Dictionary<string, object>>(jobInfoStr);
                            
                            if (jobData != null && jobData.Count > 0)
                            {
                                // cycle_start_time'ı ekle (öncelikli kaynak)
                                if (cycleStartTime.HasValue)
                                {
                                    // ISO 8601 format - JavaScript'in parse edebilmesi için
                                    // DateTime'ı olduğu gibi gönder (lokal saat olarak)
                                    var cycleStartTimeStr = cycleStartTime.Value.ToString("yyyy-MM-ddTHH:mm:ss.fff");
                                    jobData["cycleStartTime"] = cycleStartTimeStr;
                                }
                                
                                // cycle_end_time'ı ekle (varsa)
                                if (cycleEndTime.HasValue)
                                {
                                    jobData["cycleEndTime"] = cycleEndTime.Value.ToString("O");
                                }
                                
                                // Privacy kontrolü
                                if (privacy.MaskJobCardSensitive)
                                {
                                    var cloned = new Dictionary<string, object>(jobData, StringComparer.OrdinalIgnoreCase);
                                    if (cloned.ContainsKey("siparis_no"))
                                    {
                                        cloned["siparis_no"] = "***";
                                    }
                                    if (cloned.ContainsKey("stok_adi"))
                                    {
                                        cloned["stok_adi"] = "***";
                                    }
                                    return Ok(new { success = true, data = cloned });
                                }
                                
                                return Ok(new { success = true, data = jobData });
                            }
                        }
                        catch (Exception ex)
                        {
                            // job_info parse hatası - sessizce devam et
                        }
                    }
                }

                // Aktif kayıt yoksa
                return Ok(new { success = false, message = "Aktif iş emri bulunamadı" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// İş emri verilerini sorgula (POST - veritabanından)
        /// POST /api/plcdata/job
        /// </summary>
        public class JobQueryRequest
        {
            public string? OrderNumber { get; set; }
        }

        [HttpPost("job")]
        public async Task<IActionResult> QueryJob([FromQuery] string? machine, [FromBody] JobQueryRequest request)
        {
            try
            {
                var currentUser = await GetCurrentUserAsync();
                var privacy = _privacyService.GetPrivacy(currentUser);

                var service = GetPLCDataCollectorService();
                var sqlProxy = service?.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return StatusCode(503, new { success = false, error = "PLC servisi başlatılmamış" });
                }

                var orderNumber = request?.OrderNumber?.Trim();
                if (string.IsNullOrEmpty(orderNumber))
                {
                    return BadRequest(new { success = false, error = "orderNumber gerekli" });
                }

                var jobData = await sqlProxy.QueryJobDataAsync(orderNumber);
                if (jobData == null || !jobData.ContainsKey("success") || !jobData["success"].Equals(true))
                {
                    return Ok(new { success = false, message = "İş emri bulunamadı" });
                }

                if (privacy.MaskJobCardSensitive && jobData.ContainsKey("data") && jobData["data"] is Dictionary<string, object> dict)
                {
                    var clone = new Dictionary<string, object>(dict, StringComparer.OrdinalIgnoreCase);
                    if (clone.ContainsKey("siparis_no"))
                    {
                        clone["siparis_no"] = "***";
                    }
                    if (clone.ContainsKey("stok_adi"))
                    {
                        clone["stok_adi"] = "***";
                    }
                    var wrapped = new Dictionary<string, object>(jobData, StringComparer.OrdinalIgnoreCase)
                    {
                        ["data"] = clone
                    };
                    return Ok(wrapped);
                }

                return Ok(jobData);
            }
            catch (Exception ex)
            {
                var detailedMessage = $"İş emri sorgusu sırasında hata oluştu. Makine: {machine ?? "belirtilmedi"}";
                Console.WriteLine($"❌ {detailedMessage} | Hata: {ex.Message} {(ex.InnerException != null ? "| Inner: " + ex.InnerException.Message : string.Empty)}");
                return StatusCode(500, new
                {
                    success = false,
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    context = detailedMessage
                });
            }
        }

        /// <summary>
        /// İş emri verilerini PLC'ye yaz
        /// POST /api/plcdata/job-write
        /// </summary>
        [HttpPost("job-write")]
        public async Task<IActionResult> WriteJob([FromBody] dynamic jobData)
        {
            try
            {
                var service = GetPLCDataCollectorService();
                var sqlProxy = service?.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return StatusCode(503, new { success = false, error = "PLC servisi başlatılmamış" });
                }

                var jobDict = JsonSerializer.Deserialize<Dictionary<string, object>>(jobData.ToString());
                var result = await sqlProxy.WriteJobDataAsync(jobDict ?? new Dictionary<string, object>());

                return Ok(new { success = result, message = result ? "İş emri PLC'ye yazıldı" : "İş emri yazılamadı" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// İş sonu sinyali gönder
        /// POST /api/plcdata/job-end
        /// </summary>
        [HttpPost("job-end")]
        public async Task<IActionResult> EndJob([FromBody] dynamic request)
        {
            try
            {
                var service = GetPLCDataCollectorService();
                var sqlProxy = service?.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return StatusCode(503, new { success = false, error = "PLC servisi başlatılmamış" });
                }

                var requestDict = JsonSerializer.Deserialize<Dictionary<string, object>>(request.ToString());
                var orderNumber = requestDict?.ContainsKey("orderNumber") ? requestDict["orderNumber"]?.ToString() : null;
                
                object? totalEnergyKwhStart = null;
                if (requestDict != null && requestDict.ContainsKey("totalEnergyKwhStart"))
                {
                    var value = requestDict["totalEnergyKwhStart"];
                    // JsonElement ise değerini al
                    if (value is System.Text.Json.JsonElement jsonElement)
                    {
                        if (jsonElement.ValueKind != System.Text.Json.JsonValueKind.Null && jsonElement.ValueKind != System.Text.Json.JsonValueKind.Undefined)
                        {
                            totalEnergyKwhStart = jsonElement;
                        }
                    }
                    else if (value != null)
                    {
                        totalEnergyKwhStart = value;
                    }
                }

                if (string.IsNullOrEmpty(orderNumber))
                {
                    return BadRequest(new { success = false, error = "orderNumber gerekli" });
                }

                var result = await sqlProxy.EndJobAsync(orderNumber, totalEnergyKwhStart);
                
                return Ok(new { success = result, message = result ? "İş sonu işlemi tamamlandı" : "İş sonu işlemi başarısız" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// <summary>
        /// Aktif (henüz kaydedilmemiş) duruş sebebini getir
        /// GET /api/plcdata/current-stoppage-reason
        /// </summary>
        [HttpGet("current-stoppage-reason")]
        public IActionResult GetCurrentStoppageReason()
        {
            try
            {
                var service = GetPLCDataCollectorService();
                var dataProcessor = service?.GetDataProcessor();
                if (dataProcessor == null)
                {
                    return StatusCode(503, new { error = "PLC servisi başlatılmamış" });
                }

                var (categoryId, reasonId, stoppageStartTime) = dataProcessor.GetCurrentStoppageReason();
                
                return Ok(new 
                { 
                    categoryId,
                    reasonId,
                    stoppageStartTime,
                    hasReason = categoryId > 0 && reasonId > 0,
                    isStopped = stoppageStartTime.HasValue
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Duruş sebebi kaydet
        /// POST /api/plcdata/stoppage-reason
        /// </summary>
        [HttpPost("stoppage-reason")]
        public async Task<IActionResult> SaveStoppageReason([FromBody] dynamic request)
        {
            try
            {
                var service = GetPLCDataCollectorService();
                var sqlProxy = service?.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return StatusCode(503, new { success = false, error = "PLC servisi başlatılmamış" });
                }

                var requestDict = JsonSerializer.Deserialize<Dictionary<string, object>>(request.ToString());
                var categoryId = requestDict != null ? GetIntFromRequest(requestDict, "categoryId") : 0;
                var reasonId = requestDict != null ? GetIntFromRequest(requestDict, "reasonId") : 0;

                if (categoryId == 0 || reasonId == 0)
                {
                    return BadRequest(new { success = false, error = "categoryId ve reasonId gerekli" });
                }

                var result = await sqlProxy.SaveStoppageReasonAsync(categoryId, reasonId);
                return Ok(new { success = result, message = result ? "Duruş sebebi kaydedildi" : "Duruş sebebi kaydedilemedi" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// Aktif duruşu paylaşımlı duruş olarak böler (mevcut segmenti kaydeder, yeni segment başlatır)
        /// POST /api/plcdata/split-stoppage
        /// </summary>
        [HttpPost("split-stoppage")]
        public async Task<IActionResult> SplitStoppage([FromBody] JsonElement request)
        {
            try
            {
                var service = GetPLCDataCollectorService();
                var sqlProxy = service?.GetSqlProxy();
                if (sqlProxy == null)
                {
                    return StatusCode(503, new { success = false, error = "PLC servisi başlatılmamış" });
                }

                var requestDict = JsonSerializer.Deserialize<Dictionary<string, object>>(request.GetRawText());
                var categoryId = requestDict != null ? GetIntFromRequest(requestDict, "categoryId") : 0;
                var reasonId = requestDict != null ? GetIntFromRequest(requestDict, "reasonId") : 0;

                var splitTimeUtc = DateTime.UtcNow;
                var result = await sqlProxy.SplitActiveStoppageAsync(splitTimeUtc, categoryId == 0 ? null : categoryId, reasonId == 0 ? null : reasonId);

                if (!result.success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = result.error
                    });
                }

                return Ok(new
                {
                    success = true,
                    newStartTime = result.newStartTime,
                    savedDurationSeconds = result.savedDurationSeconds
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        private string NormalizeTableName(string? tableName)
        {
            if (string.IsNullOrWhiteSpace(tableName))
            {
                return tableName ?? string.Empty;
            }

            if (tableName.Equals("lemanic3_tracking", StringComparison.OrdinalIgnoreCase))
            {
                return "dataRecords";
            }

            return tableName;
        }

        private int GetIntFromRequest(Dictionary<string, object> requestDict, string key)
        {
            if (!requestDict.TryGetValue(key, out var rawValue) || rawValue == null)
            {
                return 0;
            }

            if (rawValue is JsonElement jsonElement)
            {
                return jsonElement.ValueKind switch
                {
                    JsonValueKind.Number => jsonElement.TryGetInt32(out var numberValue) ? numberValue : 0,
                    JsonValueKind.String => int.TryParse(jsonElement.GetString(), out var parsed) ? parsed : 0,
                    JsonValueKind.True => 1,
                    JsonValueKind.False => 0,
                    _ => 0
                };
            }

            try
            {
                return Convert.ToInt32(rawValue);
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// PascalCase veya snake_case'i camelCase'e çevir
        /// </summary>
        private string ToCamelCase(string input)
        {
            if (string.IsNullOrEmpty(input))
                return input;

            // Eğer zaten camelCase ise (ilk harf küçük), olduğu gibi döndür
            if (char.IsLower(input[0]))
                return input;

            // PascalCase -> camelCase
            if (input.Length > 1 && char.IsUpper(input[0]) && char.IsLower(input[1]))
            {
                return char.ToLowerInvariant(input[0]) + input.Substring(1);
            }

            // snake_case -> camelCase
            if (input.Contains('_'))
            {
                var parts = input.Split('_');
                var result = parts[0].ToLowerInvariant();
                for (int i = 1; i < parts.Length; i++)
                {
                    if (!string.IsNullOrEmpty(parts[i]))
                    {
                        result += char.ToUpperInvariant(parts[i][0]) + parts[i].Substring(1).ToLowerInvariant();
                    }
                }
                return result;
            }

            // Diğer durumlar için ilk harfi küçült
            return char.ToLowerInvariant(input[0]) + input.Substring(1);
        }
    }
}

