using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using Microsoft.Data.SqlClient;
using System.Linq;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MachinesController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly IConfiguration _configuration;

        public MachinesController(
            DashboardDbContext context,
            MachineDatabaseService machineDatabaseService,
            IConfiguration configuration)
        {
            _context = context;
            _machineDatabaseService = machineDatabaseService;
            _configuration = configuration;
        }

        // GET: api/machines
        [HttpGet]
        public async Task<ActionResult<IEnumerable<MachineList>>> GetMachines()
        {
            var machines = await _context.MachineLists.ToListAsync();
            return Ok(machines);
        }

        // GET: api/machines/5
        [HttpGet("{id}")]
        public async Task<ActionResult<MachineList>> GetMachine(int id)
        {
            var machine = await _context.MachineLists.FindAsync(id);

            if (machine == null)
            {
                return NotFound(new { message = "Makina bulunamadı" });
            }

            return Ok(machine);
        }

        // POST: api/machines
        [HttpPost]
        public async Task<ActionResult<MachineList>> PostMachine([FromBody] MachineList machine)
        {
            try
            {
                // Makina adı kontrolü
                if (string.IsNullOrWhiteSpace(machine.MachineName))
                {
                    return BadRequest(new { message = "Makine adı boş olamaz" });
                }

                if (await _context.MachineLists.AnyAsync(m => m.MachineName == machine.MachineName))
                {
                    return BadRequest(new { message = "Bu makina adı zaten kullanılıyor" });
                }

                // Table name kontrolü
                if (string.IsNullOrWhiteSpace(machine.TableName))
                {
                    return BadRequest(new { message = "Tablo adı boş olamaz" });
                }

                if (await _context.MachineLists.AnyAsync(m => m.TableName == machine.TableName))
                {
                    return BadRequest(new { message = "Bu tablo adı zaten kullanılıyor" });
                }

                // TableName'den veritabanı adını belirle
                var tableName = machine.TableName;
                string databaseName = tableName; // TableName ile aynı isimde veritabanı kullan
                
                // CreatedAt, UpdatedAt ve IsActive set et
                machine.CreatedAt = DateTime.Now;
                machine.UpdatedAt = DateTime.Now;
                machine.IsActive = true; // Yeni eklenen makineler aktif olsun

                // ModelState'i güncelle (DatabaseName set edildikten sonra)
                ModelState.Clear();
                TryValidateModel(machine);

                // Model validation kontrolü (DatabaseName set edildikten sonra)
                if (!ModelState.IsValid)
                {
                    var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage);
                    return BadRequest(new { message = "Model validation hatası", errors = errors.ToList() });
                }

                // Veritabanının var olup olmadığını kontrol et veya oluştur
                var serverName = _configuration.GetConnectionString("MachineDatabaseServer") ?? "DESKTOP-78GRV3R";
                var masterConnectionString = $"Server={serverName};Database=master;Trusted_Connection=True;TrustServerCertificate=True;";
                
                using (var connection = new SqlConnection(masterConnectionString))
                {
                    await connection.OpenAsync();
                    
                    // TableName ile aynı isimde veritabanı kontrol et (örn: "lemanic3_tracking")
                    bool dbExists = await CheckDatabaseExistsAsync(connection, databaseName);
                    
                    // Yoksa TableName ile aynı isimde yeni veritabanı oluştur
                    if (!dbExists)
                    {
                        // Veritabanını oluştur
                        var createDbCmd = new SqlCommand(
                            $@"CREATE DATABASE [{databaseName}]",
                            connection);
                        await createDbCmd.ExecuteNonQueryAsync();
                    }
                }
                
                // DatabaseName'i set et
                machine.DatabaseName = databaseName;

                // Tablonun var olup olmadığını kontrol et ve gerekli tabloları oluştur
                try
                {
                    var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
                    using (var connection = new SqlConnection(connectionString))
                    {
                        await connection.OpenAsync();
                        
                        // Tracking tablosunu kontrol et ve oluştur
                        var checkTableCmd = new SqlCommand(
                            $"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '{tableName}'",
                            connection);
                        var tableExists = (int)await checkTableCmd.ExecuteScalarAsync() > 0;
                        
                        if (!tableExists)
                        {
                            // Tablo yoksa oluştur (standart kolonlarla)
                            await CreateTrackingTableAsync(databaseName, tableName);
                        }
                        
                        // PLC Config tablolarını oluştur
                        await CreatePLCConfigTablesAsync(connection);
                    }
                }
                catch (Exception ex)
                {
                    // Tablo kontrolü başarısız olursa devam et (kullanıcı daha sonra oluşturabilir)
                    // Sadece log'la, hata verme
                    Console.WriteLine($"⚠️ Tablo kontrolü başarısız: {ex.Message}");
                }

                // MachineLists tablosuna ekle
                _context.MachineLists.Add(machine);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetMachine), new { id = machine.Id }, new
                {
                    machine,
                    message = $"Makine başarıyla eklendi. Veritabanı: {databaseName}, Tablo: {tableName}"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Makine eklenirken hata oluştu: {ex.Message}" });
            }
        }


        /// <summary>
        /// Tracking tablosunu oluştur (standart kolonlarla)
        /// </summary>
        private async Task CreateTrackingTableAsync(string databaseName, string tableName)
        {
            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);

            using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync();

            // Tablo var mı kontrol et
            var checkTableCmd = new SqlCommand(
                $"SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '{tableName}'",
                connection);
            var tableExists = (int)await checkTableCmd.ExecuteScalarAsync() > 0;

            if (!tableExists)
            {
                // Standart tracking tablosunu oluştur
                var createTableCmd = new SqlCommand($@"
                    CREATE TABLE [{tableName}] (
                        Id INT IDENTITY(1,1) PRIMARY KEY,
                        KayitZamani DATETIME DEFAULT GETDATE(),
                        machineSpeed REAL NULL,
                        dieSpeed INT NULL,
                        machineDieCounter INT NULL,
                        ethylAcetateConsumption REAL NULL,
                        ethylAlcoholConsumption REAL NULL,
                        paperConsumption REAL NULL,
                        actualProduction INT NULL,
                        remainingWork INT NULL,
                        estimatedTime INT NULL,
                        totalStops INT NULL,
                        setupStops INT NULL,
                        faultStops INT NULL,
                        qualityStops INT NULL,
                        wastageBeforeDie REAL NULL,
                        wastageAfterDie INT NULL,
                        wastageRatio REAL NULL,
                        totalStoppageDuration REAL NULL,
                        overProduction INT NULL,
                        completionPercentage REAL NULL,
                        overallOEE REAL NULL,
                        availability REAL NULL,
                        performance REAL NULL,
                        quality REAL NULL,
                        uretimHizAdetDakika REAL NULL,
                        hedefUretimHizAdetDakika REAL NULL,
                        plannedTime REAL NULL,
                        machineStopped BIT NULL,
                        machineStatus INT NULL,
                        lastStopEpoch INT NULL,
                        stoppageDuration REAL NULL,
                        lastStopTime REAL NULL,
                        MTBFValue REAL NULL,
                        activePowerW REAL NULL,
                        voltageL1 REAL NULL,
                        voltageL2 REAL NULL,
                        voltageL3 REAL NULL,
                        currentL1 REAL NULL,
                        currentL2 REAL NULL,
                        currentL3 REAL NULL,
                        totalEnergyKwh REAL NULL
                    )", connection);
                await createTableCmd.ExecuteNonQueryAsync();
            }
        }

        // PUT: api/machines/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutMachine(int id, MachineList machine)
        {
            if (id != machine.Id)
            {
                return BadRequest(new { message = "ID uyuşmuyor" });
            }

            _context.Entry(machine).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!MachineExists(id))
                {
                    return NotFound(new { message = "Makina bulunamadı" });
                }
                else
                {
                    throw;
                }
            }

            return Ok(new { message = "Makina güncellendi", machine });
        }

        // DELETE: api/machines/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMachine(int id)
        {
            var machine = await _context.MachineLists.FindAsync(id);
            if (machine == null)
            {
                return NotFound(new { message = "Makina bulunamadı" });
            }

            _context.MachineLists.Remove(machine);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Makina silindi" });
        }

        private bool MachineExists(int id)
        {
            return _context.MachineLists.Any(e => e.Id == id);
        }

        /// <summary>
        /// Veritabanının var olup olmadığını kontrol et
        /// </summary>
        private async Task<bool> CheckDatabaseExistsAsync(SqlConnection connection, string databaseName)
        {
            var checkDbCmd = new SqlCommand(
                $"SELECT COUNT(*) FROM sys.databases WHERE name = '{databaseName}'",
                connection);
            return (int)await checkDbCmd.ExecuteScalarAsync() > 0;
        }

        /// <summary>
        /// PLC Config tablolarını oluştur (plc_connections, plc_data_definitions, vb.)
        /// </summary>
        private async Task CreatePLCConfigTablesAsync(SqlConnection connection)
        {
            // plc_connections tablosu (mevcut veritabanı yapısına uygun)
            var checkPLCConnectionsCmd = new SqlCommand(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'plc_connections'",
                connection);
            var plcConnectionsExists = (int)await checkPLCConnectionsCmd.ExecuteScalarAsync() > 0;

            if (!plcConnectionsExists)
            {
                var createPLCConnectionsCmd = new SqlCommand(@"
                    CREATE TABLE [plc_connections] (
                        [Id] INT IDENTITY(1,1) PRIMARY KEY,
                        [Name] NVARCHAR(100) NOT NULL,
                        [IpAddress] NVARCHAR(15) NOT NULL,
                        [Port] INT NOT NULL DEFAULT 502,
                        [ReadIntervalMs] INT NOT NULL DEFAULT 200,
                        [IsActive] BIT NOT NULL DEFAULT 1,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
                    )", connection);
                await createPLCConnectionsCmd.ExecuteNonQueryAsync();
            }

            // plc_data_definitions tablosu (mevcut veritabanı yapısına uygun)
            var checkPLCDataDefinitionsCmd = new SqlCommand(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'plc_data_definitions'",
                connection);
            var plcDataDefinitionsExists = (int)await checkPLCDataDefinitionsCmd.ExecuteScalarAsync() > 0;

            if (!plcDataDefinitionsExists)
            {
                var createPLCDataDefinitionsCmd = new SqlCommand(@"
                    CREATE TABLE [plc_data_definitions] (
                        [Id] INT IDENTITY(1,1) PRIMARY KEY,
                        [Name] NVARCHAR(100) NOT NULL,
                        [Description] NVARCHAR(500) NULL,
                        [DataType] NVARCHAR(20) NOT NULL,
                        [RegisterAddress] INT NOT NULL,
                        [RegisterCount] INT NOT NULL DEFAULT 1,
                        [ByteOrder] NVARCHAR(20) NULL DEFAULT 'HighToLow',
                        [OperationType] NVARCHAR(10) NOT NULL,
                        [PLCConnectionId] INT NOT NULL,
                        [IsActive] BIT NOT NULL DEFAULT 1,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                        [ApiEndpoint] NVARCHAR(200) NULL DEFAULT '/api/data',
                        [SaveToDatabase] INT NULL,
                        [SaveTableName] NVARCHAR(200) NULL,
                        [SaveColumnName] NVARCHAR(200) NULL,
                        FOREIGN KEY ([PLCConnectionId]) REFERENCES [plc_connections]([Id])
                    )", connection);
                await createPLCDataDefinitionsCmd.ExecuteNonQueryAsync();
            }

            // SQLConnections tablosu
            var checkSQLConnectionsCmd = new SqlCommand(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'sql_connections'",
                connection);
            var sqlConnectionsExists = (int)await checkSQLConnectionsCmd.ExecuteScalarAsync() > 0;

            if (!sqlConnectionsExists)
            {
                var createSQLConnectionsCmd = new SqlCommand(@"
                    CREATE TABLE [sql_connections] (
                        [Id] INT IDENTITY(1,1) PRIMARY KEY,
                        [Name] NVARCHAR(100) NOT NULL,
                        [Server] NVARCHAR(200) NOT NULL,
                        [Database] NVARCHAR(200) NOT NULL,
                        [Username] NVARCHAR(100) NULL,
                        [Password] NVARCHAR(200) NULL,
                        [ConnectionTimeout] INT NOT NULL DEFAULT 30,
                        [IsActive] BIT NOT NULL DEFAULT 1,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
                    )", connection);
                await createSQLConnectionsCmd.ExecuteNonQueryAsync();
            }

            // APISettings tablosu
            var checkAPISettingsCmd = new SqlCommand(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'api_settings'",
                connection);
            var apiSettingsExists = (int)await checkAPISettingsCmd.ExecuteScalarAsync() > 0;

            if (!apiSettingsExists)
            {
                var createAPISettingsCmd = new SqlCommand(@"
                    CREATE TABLE [api_settings] (
                        [Id] INT IDENTITY(1,1) PRIMARY KEY,
                        [SettingKey] NVARCHAR(100) NOT NULL UNIQUE,
                        [SettingValue] NVARCHAR(500) NOT NULL,
                        [Description] NVARCHAR(500) NULL,
                        [IsActive] BIT NOT NULL DEFAULT 1,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
                    )", connection);
                await createAPISettingsCmd.ExecuteNonQueryAsync();
            }

            // SystemLogs tablosu
            var checkSystemLogsCmd = new SqlCommand(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'system_logs'",
                connection);
            var systemLogsExists = (int)await checkSystemLogsCmd.ExecuteScalarAsync() > 0;

            if (!systemLogsExists)
            {
                var createSystemLogsCmd = new SqlCommand(@"
                    CREATE TABLE [system_logs] (
                        [Id] INT IDENTITY(1,1) PRIMARY KEY,
                        [LogLevel] NVARCHAR(20) NOT NULL,
                        [Component] NVARCHAR(100) NULL,
                        [Message] NVARCHAR(MAX) NOT NULL,
                        [Details] NVARCHAR(MAX) NULL,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
                    )", connection);
                await createSystemLogsCmd.ExecuteNonQueryAsync();
            }
        }
    }
}

