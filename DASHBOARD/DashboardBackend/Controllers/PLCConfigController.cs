using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using System.Text.Json;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PLCConfigController : ControllerBase
    {
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;

        public PLCConfigController(MachineDatabaseService machineDatabaseService, DashboardDbContext dashboardContext)
        {
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
        }

        /// <summary>
        /// Makine TableName'ine göre SensorDbContext oluştur
        /// machine parametresi TableName olarak geliyor (örn: "lemanic3_tracking")
        /// </summary>
        private SensorDbContext GetMachineContext(string? machine = null)
        {
            // Eğer machine verilmemişse, query parameter'dan al
            if (string.IsNullOrEmpty(machine))
            {
                machine = Request.Query["machine"].FirstOrDefault();
            }

            string databaseName;

            // Eğer machine parametresi TableName ise (örn: "lemanic3_tracking"), DatabaseName'e çevir
            if (!string.IsNullOrEmpty(machine))
            {
                // MachineLists tablosundan makine bilgisini al
                var machineInfo = _dashboardContext.MachineLists
                    .FirstOrDefault(m => m.TableName.ToLower() == machine.ToLower());
                
                if (machineInfo != null)
                {
                    // DatabaseName'i kullan
                    databaseName = machineInfo.DatabaseName;
                }
                else
                {
                    // Fallback: TableName ile aynı isimde veritabanı kullan (artık böyle çalışıyor)
                    databaseName = machine;
                }
            }
            else
            {
                // Hala yoksa, Dashboard DB'den ilk aktif makineyi al
                var firstMachine = _dashboardContext.MachineLists
                    .Where(m => m.IsActive)
                    .FirstOrDefault() 
                    ?? _dashboardContext.MachineLists.FirstOrDefault();
                
                if (firstMachine != null)
                {
                    databaseName = firstMachine.DatabaseName;
                    // Eğer DatabaseName boşsa, TableName'i kullan
                    if (string.IsNullOrEmpty(databaseName))
                    {
                        databaseName = firstMachine.TableName;
                    }
                }
                else
                {
                    databaseName = "lemanic3_tracking"; // Varsayılan (artık TableName ile aynı)
                }
            }

            return _machineDatabaseService.CreateDbContext(databaseName);
        }

        #region PLC Connections

        [HttpGet("connections")]
        public async Task<ActionResult<IEnumerable<PLCConnection>>> GetPLCConnections([FromQuery] string? machine = null)
        {
            try
            {
                using var context = GetMachineContext(machine);
                
                // Önce NULL değerleri düzelt
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"
                        UPDATE [plc_connections]
                        SET [display_name] = [name]
                        WHERE [display_name] IS NULL;
                        
                        UPDATE [plc_connections]
                        SET [source_type] = 'ModbusTCP'
                        WHERE [source_type] IS NULL;
                    ");
                }
                catch
                {
                    // Kolonlar yoksa veya hata varsa devam et
                }
                
                // Normal query ile çek (NULL değerler artık düzeltildi)
                var connections = await context.PLCConnections.ToListAsync();
                
                // NULL değerleri varsayılan değerlerle doldur
                foreach (var conn in connections)
                {
                    if (string.IsNullOrEmpty(conn.DisplayName))
                        conn.DisplayName = conn.Name;
                    if (string.IsNullOrEmpty(conn.SourceType))
                        conn.SourceType = "ModbusTCP";
                }
                
                return connections;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Veri kaynakları yüklenemedi: {ex.Message}" });
            }
        }

        [HttpGet("connections/{id}")]
        public async Task<ActionResult<PLCConnection>> GetPLCConnection(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var connection = await context.PLCConnections.FindAsync(id);
            if (connection == null)
                return NotFound();

            return connection;
        }

        [HttpPost("connections")]
        public async Task<ActionResult<PLCConnection>> CreatePLCConnection([FromBody] dynamic request, [FromQuery] string? machine = null)
        {
            // Body'den machine parametresini al (eğer varsa)
            string? machineFromBody = null;
            try
            {
                if (request is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
                {
                    if (jsonElement.TryGetProperty("machine", out var machineProp) && 
                        machineProp.ValueKind != JsonValueKind.Null)
                    {
                        machineFromBody = machineProp.GetString();
                    }
                }
            }
            catch
            {
                // Ignore
            }
            
            // Önce body'den, sonra query'den, sonra varsayılan
            machine = machineFromBody ?? machine;

            using var context = GetMachineContext(machine);
            
            // JsonElement'ten güvenli değer okuma
            JsonElement jsonRequest;
            if (request is JsonElement je)
            {
                jsonRequest = je;
            }
            else
            {
                var jsonString = JsonSerializer.Serialize(request);
                jsonRequest = JsonSerializer.Deserialize<JsonElement>(jsonString);
            }
            
            // Güvenli property okuma helper'ları
            string GetStringPropertySafe(JsonElement element, string propertyName, string defaultValue = "")
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetString() ?? defaultValue;
                return defaultValue;
            }
            
            string? GetNullableStringPropertySafe(JsonElement element, string propertyName)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetString();
                return null;
            }
            
            int GetIntPropertySafe(JsonElement element, string propertyName, int defaultValue = 0)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetInt32();
                return defaultValue;
            }
            
            bool GetBoolPropertySafe(JsonElement element, string propertyName, bool defaultValue = false)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetBoolean();
                return defaultValue;
            }
            
            var connection = new PLCConnection
            {
                Id = 0, // Entity Framework IDENTITY kolon için 0 değerini atlar
                Name = GetStringPropertySafe(jsonRequest, "name"),
                DisplayName = GetNullableStringPropertySafe(jsonRequest, "displayName"),
                IpAddress = GetStringPropertySafe(jsonRequest, "ipAddress"),
                Port = GetIntPropertySafe(jsonRequest, "port", 502),
                ReadIntervalMs = GetIntPropertySafe(jsonRequest, "readIntervalMs", 200),
                SourceType = GetStringPropertySafe(jsonRequest, "sourceType", "ModbusTCP"),
                IsActive = GetBoolPropertySafe(jsonRequest, "isActive", true),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            
            context.PLCConnections.Add(connection);
            await context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPLCConnection), new { id = connection.Id, machine = machine }, connection);
        }

        [HttpPut("connections/{id}")]
        public async Task<IActionResult> UpdatePLCConnection(int id, [FromBody] dynamic request, [FromQuery] string? machine = null)
        {
            // Body'den machine parametresini al (eğer varsa)
            string? machineFromBody = null;
            try
            {
                if (request is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
                {
                    if (jsonElement.TryGetProperty("machine", out var machineProp) && 
                        machineProp.ValueKind != JsonValueKind.Null && machineProp.ValueKind != JsonValueKind.Undefined)
                    {
                        machineFromBody = machineProp.GetString();
                    }
                }
            }
            catch
            {
                // Ignore
            }
            
            // Önce body'den, sonra query'den, sonra varsayılan
            machine = machineFromBody ?? machine;

            using var context = GetMachineContext(machine);
            
            var connection = await context.PLCConnections.FindAsync(id);
            if (connection == null)
                return NotFound();

            // JsonElement'ten güvenli değer okuma
            JsonElement jsonRequest;
            if (request is JsonElement je)
            {
                jsonRequest = je;
            }
            else
            {
                var jsonString = JsonSerializer.Serialize(request);
                jsonRequest = JsonSerializer.Deserialize<JsonElement>(jsonString);
            }

            // Güncelleme - Güvenli property okuma
            if (jsonRequest.TryGetProperty("name", out var nameProp) && nameProp.ValueKind != JsonValueKind.Null && nameProp.ValueKind != JsonValueKind.Undefined)
                connection.Name = nameProp.GetString() ?? connection.Name;
            if (jsonRequest.TryGetProperty("displayName", out var displayNameProp) && displayNameProp.ValueKind != JsonValueKind.Null && displayNameProp.ValueKind != JsonValueKind.Undefined)
                connection.DisplayName = displayNameProp.GetString();
            if (jsonRequest.TryGetProperty("ipAddress", out var ipProp) && ipProp.ValueKind != JsonValueKind.Null && ipProp.ValueKind != JsonValueKind.Undefined)
                connection.IpAddress = ipProp.GetString() ?? connection.IpAddress;
            if (jsonRequest.TryGetProperty("port", out var portProp) && portProp.ValueKind != JsonValueKind.Null && portProp.ValueKind != JsonValueKind.Undefined)
                connection.Port = portProp.GetInt32();
            if (jsonRequest.TryGetProperty("readIntervalMs", out var intervalProp) && intervalProp.ValueKind != JsonValueKind.Null && intervalProp.ValueKind != JsonValueKind.Undefined)
                connection.ReadIntervalMs = intervalProp.GetInt32();
            if (jsonRequest.TryGetProperty("sourceType", out var sourceTypeProp) && sourceTypeProp.ValueKind != JsonValueKind.Null && sourceTypeProp.ValueKind != JsonValueKind.Undefined)
                connection.SourceType = sourceTypeProp.GetString() ?? connection.SourceType;
            if (jsonRequest.TryGetProperty("isActive", out var activeProp) && activeProp.ValueKind != JsonValueKind.Null && activeProp.ValueKind != JsonValueKind.Undefined)
                connection.IsActive = activeProp.GetBoolean();
            connection.UpdatedAt = DateTime.Now;

            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await PLCConnectionExists(id, machine))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        [HttpDelete("connections/{id}")]
        public async Task<IActionResult> DeletePLCConnection(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var connection = await context.PLCConnections.FindAsync(id);
            if (connection == null)
                return NotFound();

            context.PLCConnections.Remove(connection);
            await context.SaveChangesAsync();

            return NoContent();
        }

        #endregion

        #region PLC Data Definitions

        [HttpGet("data-definitions")]
        public async Task<ActionResult<IEnumerable<PLCDataDefinition>>> GetPLCDataDefinitions([FromQuery] string? machine = null)
        {
            try
            {
                using var context = GetMachineContext(machine);
                
                // Önce NULL word_swap değerlerini düzelt
                try
                {
                    await context.Database.ExecuteSqlRawAsync(@"
                        UPDATE [plc_data_definitions]
                        SET [word_swap] = 0
                        WHERE [word_swap] IS NULL;
                    ");
                }
                catch
                {
                    // Kolon yoksa veya hata varsa devam et
                }
                
                // Normal query ile çek (NULL değerler artık düzeltildi)
                var definitions = await context.PLCDataDefinitions
                    .Include(d => d.PLCConnection)
                    .Where(d => d.IsActive)
                    .ToListAsync();
                
                // NULL değerleri varsayılan değerlerle doldur
                foreach (var def in definitions)
                {
                    if (string.IsNullOrEmpty(def.ByteOrder))
                        def.ByteOrder = "HighToLow";
                }
                
                return definitions;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Veri tanımları yüklenemedi: {ex.Message}" });
            }
        }

        [HttpGet("data-definitions/{id}")]
        public async Task<ActionResult<PLCDataDefinition>> GetPLCDataDefinition(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var definition = await context.PLCDataDefinitions
                .Include(d => d.PLCConnection)
                .FirstOrDefaultAsync(d => d.Id == id);
            
            if (definition == null)
                return NotFound();

            return definition;
        }

        [HttpPost("data-definitions")]
        public async Task<ActionResult<PLCDataDefinition>> CreatePLCDataDefinition([FromBody] dynamic request, [FromQuery] string? machine = null)
        {
            // Body'den machine parametresini al (eğer varsa)
            string? machineFromBody = null;
            try
            {
                if (request is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
                {
                    if (jsonElement.TryGetProperty("machine", out var machineProp) && 
                        machineProp.ValueKind != JsonValueKind.Null)
                    {
                        machineFromBody = machineProp.GetString();
                    }
                }
            }
            catch
            {
                // Ignore
            }
            
            // Önce body'den, sonra query'den, sonra varsayılan
            machine = machineFromBody ?? machine;

            using var context = GetMachineContext(machine);
            
            // JsonElement'ten güvenli değer okuma
            JsonElement jsonRequest;
            if (request is JsonElement je)
            {
                jsonRequest = je;
            }
            else
            {
                var jsonString = JsonSerializer.Serialize(request);
                jsonRequest = JsonSerializer.Deserialize<JsonElement>(jsonString);
            }
            
            // Güvenli property okuma helper'ları
            string GetStringProperty(JsonElement element, string propertyName, string defaultValue = "")
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetString() ?? defaultValue;
                return defaultValue;
            }
            
            string? GetNullableStringProperty(JsonElement element, string propertyName)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetString();
                return null;
            }
            
            int GetIntProperty(JsonElement element, string propertyName, int defaultValue = 0)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetInt32();
                return defaultValue;
            }
            
            bool GetBoolProperty(JsonElement element, string propertyName, bool defaultValue = false)
            {
                if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind != JsonValueKind.Null && prop.ValueKind != JsonValueKind.Undefined)
                    return prop.GetBoolean();
                return defaultValue;
            }
            
            var definition = new PLCDataDefinition
            {
                Id = 0, // Entity Framework IDENTITY kolon için 0 değerini atlar
                Name = GetStringProperty(jsonRequest, "name"),
                Description = GetNullableStringProperty(jsonRequest, "description"),
                DataType = GetStringProperty(jsonRequest, "dataType"),
                RegisterAddress = GetIntProperty(jsonRequest, "registerAddress"),
                RegisterCount = GetIntProperty(jsonRequest, "registerCount", 1),
                ByteOrder = GetStringProperty(jsonRequest, "byteOrder", "HighToLow"),
                WordSwap = GetBoolProperty(jsonRequest, "wordSwap", false),
                OperationType = GetStringProperty(jsonRequest, "operationType", "READ"),
                PLCConnectionId = GetIntProperty(jsonRequest, "plcConnectionId"),
                IsActive = GetBoolProperty(jsonRequest, "isActive", true),
                ApiEndpoint = GetStringProperty(jsonRequest, "apiEndpoint"),
                SaveToDatabase = ExtractNullableIntFromJson(jsonRequest, "saveToDatabase"),
                SaveTableName = GetNullableStringProperty(jsonRequest, "saveTableName"),
                SaveColumnName = GetNullableStringProperty(jsonRequest, "saveColumnName"),
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };
            
            context.PLCDataDefinitions.Add(definition);
            await context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetPLCDataDefinition), new { id = definition.Id, machine = machine }, definition);
        }

        [HttpPut("data-definitions/{id}")]
        public async Task<IActionResult> UpdatePLCDataDefinition(int id, [FromBody] dynamic request, [FromQuery] string? machine = null)
        {
            // Body'den machine parametresini al (eğer varsa)
            string? machineFromBody = null;
            try
            {
                if (request is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.Object)
                {
                    if (jsonElement.TryGetProperty("machine", out var machineProp) && 
                        machineProp.ValueKind != JsonValueKind.Null)
                    {
                        machineFromBody = machineProp.GetString();
                    }
                }
            }
            catch
            {
                // Ignore
            }
            
            // Önce body'den, sonra query'den, sonra varsayılan
            machine = machineFromBody ?? machine;

            using var context = GetMachineContext(machine);
            
            var definition = await context.PLCDataDefinitions.FindAsync(id);
            if (definition == null)
                return NotFound();

            // JsonElement'ten güvenli değer okuma
            JsonElement jsonRequest;
            if (request is JsonElement je)
            {
                jsonRequest = je;
            }
            else
            {
                var jsonString = JsonSerializer.Serialize(request);
                jsonRequest = JsonSerializer.Deserialize<JsonElement>(jsonString);
            }

            // Güncelleme - Güvenli property okuma
            if (jsonRequest.TryGetProperty("name", out var nameProp) && nameProp.ValueKind != JsonValueKind.Null && nameProp.ValueKind != JsonValueKind.Undefined)
                definition.Name = nameProp.GetString() ?? definition.Name;
            if (jsonRequest.TryGetProperty("description", out var descProp) && descProp.ValueKind != JsonValueKind.Null && descProp.ValueKind != JsonValueKind.Undefined)
                definition.Description = descProp.GetString();
            if (jsonRequest.TryGetProperty("dataType", out var dataTypeProp) && dataTypeProp.ValueKind != JsonValueKind.Null && dataTypeProp.ValueKind != JsonValueKind.Undefined)
                definition.DataType = dataTypeProp.GetString() ?? definition.DataType;
            if (jsonRequest.TryGetProperty("registerAddress", out var regAddrProp) && regAddrProp.ValueKind != JsonValueKind.Null && regAddrProp.ValueKind != JsonValueKind.Undefined)
                definition.RegisterAddress = regAddrProp.GetInt32();
            if (jsonRequest.TryGetProperty("registerCount", out var regCountProp) && regCountProp.ValueKind != JsonValueKind.Null && regCountProp.ValueKind != JsonValueKind.Undefined)
                definition.RegisterCount = regCountProp.GetInt32();
            if (jsonRequest.TryGetProperty("byteOrder", out var byteOrderProp) && byteOrderProp.ValueKind != JsonValueKind.Null && byteOrderProp.ValueKind != JsonValueKind.Undefined)
                definition.ByteOrder = byteOrderProp.GetString() ?? definition.ByteOrder;
            if (jsonRequest.TryGetProperty("wordSwap", out var wordSwapProp) && wordSwapProp.ValueKind != JsonValueKind.Null && wordSwapProp.ValueKind != JsonValueKind.Undefined)
                definition.WordSwap = wordSwapProp.GetBoolean();
            if (jsonRequest.TryGetProperty("operationType", out var opTypeProp) && opTypeProp.ValueKind != JsonValueKind.Null && opTypeProp.ValueKind != JsonValueKind.Undefined)
                definition.OperationType = opTypeProp.GetString() ?? definition.OperationType;
            if (jsonRequest.TryGetProperty("plcConnectionId", out var plcConnProp) && plcConnProp.ValueKind != JsonValueKind.Null && plcConnProp.ValueKind != JsonValueKind.Undefined)
                definition.PLCConnectionId = plcConnProp.GetInt32();
            if (jsonRequest.TryGetProperty("isActive", out var activeProp) && activeProp.ValueKind != JsonValueKind.Null && activeProp.ValueKind != JsonValueKind.Undefined)
                definition.IsActive = activeProp.GetBoolean();
            if (jsonRequest.TryGetProperty("apiEndpoint", out var apiProp) && apiProp.ValueKind != JsonValueKind.Null && apiProp.ValueKind != JsonValueKind.Undefined)
                definition.ApiEndpoint = apiProp.GetString() ?? definition.ApiEndpoint;
            if (jsonRequest.TryGetProperty("saveTableName", out var saveTableProp) && saveTableProp.ValueKind != JsonValueKind.Null && saveTableProp.ValueKind != JsonValueKind.Undefined)
                definition.SaveTableName = saveTableProp.GetString();
            if (jsonRequest.TryGetProperty("saveColumnName", out var saveColProp) && saveColProp.ValueKind != JsonValueKind.Null && saveColProp.ValueKind != JsonValueKind.Undefined)
                definition.SaveColumnName = saveColProp.GetString();
            if (jsonRequest.TryGetProperty("saveToDatabase", out var saveDbProp) && saveDbProp.ValueKind != JsonValueKind.Undefined)
            {
                if (saveDbProp.ValueKind == JsonValueKind.Null)
                {
                    definition.SaveToDatabase = null;
                }
                else
                {
                    var parsedValue = ConvertJsonValueToNullableInt(saveDbProp);
                    if (parsedValue.HasValue)
                    {
                        definition.SaveToDatabase = parsedValue.Value;
                    }
                }
            }
            definition.UpdatedAt = DateTime.Now;

            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await PLCDataDefinitionExists(id, machine))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        [HttpDelete("data-definitions/{id}")]
        public async Task<IActionResult> DeletePLCDataDefinition(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var definition = await context.PLCDataDefinitions.FindAsync(id);
            if (definition == null)
                return NotFound();

            context.PLCDataDefinitions.Remove(definition);
            await context.SaveChangesAsync();

            return NoContent();
        }

        #endregion

        #region SQL Connections

        [HttpGet("sql-connections")]
        public async Task<ActionResult<IEnumerable<SQLConnection>>> GetSQLConnections([FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.SQLConnections.ToListAsync();
        }

        [HttpGet("sql-connections/{id}")]
        public async Task<ActionResult<SQLConnection>> GetSQLConnection(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var connection = await context.SQLConnections.FindAsync(id);
            if (connection == null)
                return NotFound();

            return connection;
        }

        [HttpPost("sql-connections")]
        public async Task<ActionResult<SQLConnection>> CreateSQLConnection(SQLConnection connection, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            connection.CreatedAt = DateTime.Now;
            connection.UpdatedAt = DateTime.Now;
            
            context.SQLConnections.Add(connection);
            await context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSQLConnection), new { id = connection.Id, machine = machine }, connection);
        }

        [HttpPut("sql-connections/{id}")]
        public async Task<IActionResult> UpdateSQLConnection(int id, SQLConnection connection, [FromQuery] string? machine = null)
        {
            if (id != connection.Id)
                return BadRequest();

            using var context = GetMachineContext(machine);
            connection.UpdatedAt = DateTime.Now;
            context.Entry(connection).State = EntityState.Modified;

            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await SQLConnectionExists(id, machine))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        [HttpDelete("sql-connections/{id}")]
        public async Task<IActionResult> DeleteSQLConnection(int id, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var connection = await context.SQLConnections.FindAsync(id);
            if (connection == null)
                return NotFound();

            context.SQLConnections.Remove(connection);
            await context.SaveChangesAsync();

            return NoContent();
        }

        #endregion

        #region API Settings

        [HttpGet("api-settings")]
        public async Task<ActionResult<IEnumerable<APISetting>>> GetAPISettings([FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.APISettings.ToListAsync();
        }

        [HttpGet("api-settings/{key}")]
        public async Task<ActionResult<APISetting>> GetAPISetting(string key, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var setting = await context.APISettings
                .FirstOrDefaultAsync(s => s.SettingKey == key);
            
            if (setting == null)
                return NotFound();

            return setting;
        }

        [HttpPost("api-settings")]
        public async Task<ActionResult<APISetting>> CreateAPISetting(APISetting setting, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            setting.CreatedAt = DateTime.Now;
            setting.UpdatedAt = DateTime.Now;
            
            context.APISettings.Add(setting);
            await context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAPISetting), new { key = setting.SettingKey, machine = machine }, setting);
        }

        [HttpPut("api-settings/{key}")]
        public async Task<IActionResult> UpdateAPISetting(string key, APISetting setting, [FromQuery] string? machine = null)
        {
            if (key != setting.SettingKey)
                return BadRequest();

            using var context = GetMachineContext(machine);
            setting.UpdatedAt = DateTime.Now;
            context.Entry(setting).State = EntityState.Modified;

            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await APISettingExists(key, machine))
                    return NotFound();
                else
                    throw;
            }

            return NoContent();
        }

        [HttpDelete("api-settings/{key}")]
        public async Task<IActionResult> DeleteAPISetting(string key, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            var setting = await context.APISettings
                .FirstOrDefaultAsync(s => s.SettingKey == key);
            
            if (setting == null)
                return NotFound();

            context.APISettings.Remove(setting);
            await context.SaveChangesAsync();

            return NoContent();
        }

        #endregion

        #region System Logs

        [HttpGet("system-logs")]
        public async Task<ActionResult<IEnumerable<SystemLog>>> GetSystemLogs(
            [FromQuery] string? machine = null,
            [FromQuery] string? level = null,
            [FromQuery] string? component = null,
            [FromQuery] int limit = 100)
        {
            using var context = GetMachineContext(machine);
            var query = context.SystemLogs.AsQueryable();

            if (!string.IsNullOrEmpty(level))
                query = query.Where(l => l.LogLevel == level);

            if (!string.IsNullOrEmpty(component))
                query = query.Where(l => l.Component == component);

            return await query
                .OrderByDescending(l => l.CreatedAt)
                .Take(limit)
                .ToListAsync();
        }

        [HttpPost("system-logs")]
        public async Task<ActionResult<SystemLog>> CreateSystemLog(SystemLog log, [FromQuery] string? machine = null)
        {
            using var context = GetMachineContext(machine);
            log.CreatedAt = DateTime.Now;
            
            context.SystemLogs.Add(log);
            await context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSystemLogs), new { id = log.Id, machine = machine }, log);
        }

        #endregion

        #region System Management

        [HttpPost("restart")]
        public async Task<IActionResult> RestartPLCDataCollector([FromQuery] string? machine = null)
        {
            try
            {
                using var context = GetMachineContext(machine);
                // Bu endpoint PLC Data Collector'ı yeniden başlatmak için kullanılır
                // Gerçek implementasyon için Windows Service veya Process management gerekebilir
                
                // Şimdilik sadece log ekleyelim
                var logEntry = new SystemLog
                {
                    LogLevel = "INFO",
                    Component = "AdminPanel",
                    Message = "PLC Data Collector yeniden başlatma komutu alındı",
                    Details = "Admin panel üzerinden restart komutu gönderildi"
                };
                
                context.SystemLogs.Add(logEntry);
                await context.SaveChangesAsync();
                
                return Ok(new { message = "PLC Data Collector yeniden başlatma komutu gönderildi" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        #endregion

        #region Helper Methods

        private async Task<bool> PLCConnectionExists(int id, string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.PLCConnections.AnyAsync(e => e.Id == id);
        }

        private async Task<bool> PLCDataDefinitionExists(int id, string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.PLCDataDefinitions.AnyAsync(e => e.Id == id);
        }

        private async Task<bool> SQLConnectionExists(int id, string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.SQLConnections.AnyAsync(e => e.Id == id);
        }

        private async Task<bool> APISettingExists(string key, string? machine = null)
        {
            using var context = GetMachineContext(machine);
            return await context.APISettings.AnyAsync(e => e.SettingKey == key);
        }

        private int? ExtractNullableIntFromJson(JsonElement element, string propertyName)
        {
            if (element.ValueKind != JsonValueKind.Object)
                return null;

            if (!element.TryGetProperty(propertyName, out var prop) || prop.ValueKind == JsonValueKind.Undefined || prop.ValueKind == JsonValueKind.Null)
                return null;

            return ConvertJsonValueToNullableInt(prop);
        }

        private int? ConvertJsonValueToNullableInt(JsonElement value)
        {
            return value.ValueKind switch
            {
                JsonValueKind.Number => value.GetInt32(),
                JsonValueKind.True => 1,
                JsonValueKind.False => 0,
                JsonValueKind.String => int.TryParse(value.GetString(), out var parsed) ? parsed : (int?)null,
                _ => null
            };
        }

        #endregion
    }
}
