using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using DashboardBackend.Data;
using DashboardBackend.Services;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StoppageReasonsController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;
        private const bool EnableVerboseLogging = false;

        public StoppageReasonsController(
            IConfiguration config,
            MachineDatabaseService machineDatabaseService,
            DashboardDbContext dashboardContext)
        {
            _config = config;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
        }

        // GET: /api/stoppagereasons/categories
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories([FromQuery] string? machine = null)
        {
            try
            {
                var categories = new List<object>();
                string connectionString;

                string? machineConnection = null;
                string? lastConnectionUsed = null;

                if (!string.IsNullOrWhiteSpace(machine))
                {
                    var (connString, _, _) = await GetConnectionStringAsync(machine);
                    machineConnection = connString;
                    if (EnableVerboseLogging)
                    {
                        var builderMachine = new SqlConnectionStringBuilder(machineConnection);
                        Console.WriteLine($"[StoppageReasons] Machine-specific connection selected. Machine={machine} Server={builderMachine.DataSource} Database={builderMachine.InitialCatalog}");
                    }
                    await EnsureMachineTablesAsync(machineConnection);
                    await using (var machineConn = new SqlConnection(machineConnection))
                    {
                        await machineConn.OpenAsync();
                        await EnsureStoppageTablesAsync(machineConn);

                        var machineCmd = new SqlCommand("SELECT id, category_code, display_name, created_at, created_by FROM stoppage_categories ORDER BY id", machineConn);
                        using var machineReader = await machineCmd.ExecuteReaderAsync();
                        while (await machineReader.ReadAsync())
                        {
                            categories.Add(new
                            {
                                id = (int)machineReader["id"],
                                categoryCode = (string)machineReader["category_code"],
                                displayName = (string)machineReader["display_name"],
                                createdAt = machineReader.IsDBNull(machineReader.GetOrdinal("created_at")) ? (DateTime?)null : machineReader.GetDateTime(machineReader.GetOrdinal("created_at")),
                                createdBy = machineReader.IsDBNull(machineReader.GetOrdinal("created_by")) ? null : machineReader.GetString(machineReader.GetOrdinal("created_by")),
                                source = "machine"
                            });
                        }
                    }

                    lastConnectionUsed = machineConnection;
                }

                if (machineConnection == null || categories.Count == 0)
                {
                    connectionString = _config.GetConnectionString("DefaultConnection")
                        ?? throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yok");

                    using var conn = new SqlConnection(connectionString);
                    await conn.OpenAsync();

                    await EnsureStoppageTablesAsync(conn);

                    var cmd = new SqlCommand("SELECT id, category_code, display_name, created_at, created_by FROM stoppage_categories ORDER BY id", conn);

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        categories.Add(new
                        {
                            id = (int)reader["id"],
                            categoryCode = (string)reader["category_code"],
                            displayName = (string)reader["display_name"],
                            createdAt = reader.IsDBNull(reader.GetOrdinal("created_at")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("created_at")),
                            createdBy = reader.IsDBNull(reader.GetOrdinal("created_by")) ? null : reader.GetString(reader.GetOrdinal("created_by")),
                            source = machineConnection == null ? "default" : "fallback"
                        });
                    }

                    lastConnectionUsed = connectionString;
                }

                var connectionForLog = lastConnectionUsed ?? _config.GetConnectionString("DefaultConnection") ?? "Server=.;Database=master;Trusted_Connection=True;";
                if (EnableVerboseLogging)
                {
                    var builder = new SqlConnectionStringBuilder(connectionForLog);
                    Console.WriteLine($"[StoppageReasons] Categories fetched. Machine={machine ?? "default"} Server={builder.DataSource} Database={builder.InitialCatalog} Count={categories.Count}");
                }

                return Ok(categories);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Kategoriler alınırken hata: {ex.Message}");
            }
        }

        // GET: /api/stoppagereasons/reasons/{categoryId}
        [HttpGet("reasons/{categoryId}")]
        public async Task<IActionResult> GetReasons(int categoryId, [FromQuery] string? machine = null)
        {
            try
            {
                var reasons = new List<object>();
                string? machineConnection = null;
                string? lastConnectionUsed = null;

                if (!string.IsNullOrWhiteSpace(machine))
                {
                    var (connString, _, _) = await GetConnectionStringAsync(machine);
                    machineConnection = connString;
                    if (EnableVerboseLogging)
                    {
                        var builderMachine = new SqlConnectionStringBuilder(machineConnection);
                        Console.WriteLine($"[StoppageReasons] Machine-specific connection selected. Machine={machine} Server={builderMachine.DataSource} Database={builderMachine.InitialCatalog}");
                    }
                    await EnsureMachineTablesAsync(machineConnection);
                    await using (var machineConn = new SqlConnection(machineConnection))
                    {
                        await machineConn.OpenAsync();
                        await EnsureStoppageTablesAsync(machineConn);

                        var machineCmd = new SqlCommand("SELECT id, reason_name, sort_order, created_at, created_by FROM stoppage_reasons WHERE category_id = @categoryId ORDER BY sort_order, id", machineConn);
                        machineCmd.Parameters.AddWithValue("@categoryId", categoryId);

                        using var machineReader = await machineCmd.ExecuteReaderAsync();
                        while (await machineReader.ReadAsync())
                        {
                            reasons.Add(new
                            {
                                id = (int)machineReader["id"],
                                reasonName = (string)machineReader["reason_name"],
                                sortOrder = machineReader["sort_order"] == DBNull.Value ? 0 : (int)machineReader["sort_order"],
                                createdAt = machineReader.IsDBNull(machineReader.GetOrdinal("created_at")) ? (DateTime?)null : machineReader.GetDateTime(machineReader.GetOrdinal("created_at")),
                                createdBy = machineReader.IsDBNull(machineReader.GetOrdinal("created_by")) ? null : machineReader.GetString(machineReader.GetOrdinal("created_by")),
                                source = "machine"
                            });
                        }
                    }

                    lastConnectionUsed = machineConnection;
                }

                if (machineConnection == null || reasons.Count == 0)
                {
                    var defaultConnection = _config.GetConnectionString("DefaultConnection")
                        ?? throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yok");
                    lastConnectionUsed = defaultConnection;

                    using var conn = new SqlConnection(defaultConnection);
                    await conn.OpenAsync();

                    await EnsureStoppageTablesAsync(conn);

                    var cmd = new SqlCommand("SELECT id, reason_name, sort_order, created_at, created_by FROM stoppage_reasons WHERE category_id = @categoryId ORDER BY sort_order, id", conn);
                    cmd.Parameters.AddWithValue("@categoryId", categoryId);

                    using var reader = await cmd.ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        reasons.Add(new
                        {
                            id = (int)reader["id"],
                            reasonName = (string)reader["reason_name"],
                            sortOrder = reader["sort_order"] == DBNull.Value ? 0 : (int)reader["sort_order"],
                            createdAt = reader.IsDBNull(reader.GetOrdinal("created_at")) ? (DateTime?)null : reader.GetDateTime(reader.GetOrdinal("created_at")),
                            createdBy = reader.IsDBNull(reader.GetOrdinal("created_by")) ? null : reader.GetString(reader.GetOrdinal("created_by")),
                            source = machineConnection == null ? "default" : "fallback"
                        });
                    }
                }

                var connectionForLog = lastConnectionUsed ?? _config.GetConnectionString("DefaultConnection") ?? "Server=.;Database=master;Trusted_Connection=True;";
                if (EnableVerboseLogging)
                {
                    var builder = new SqlConnectionStringBuilder(connectionForLog);
                    Console.WriteLine($"[StoppageReasons] Reasons fetched. Machine={machine ?? "default"} Server={builder.DataSource} Database={builder.InitialCatalog} CategoryId={categoryId} Count={reasons.Count}");
                }

                return Ok(reasons);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Sebepler alınırken hata: {ex.Message}");
            }
        }

        // POST: /api/stoppagereasons/categories
        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request)
        {
            if (string.IsNullOrEmpty(request.CategoryCode) || string.IsNullOrEmpty(request.DisplayName))
            {
                return BadRequest("Kategori kodu ve görünen ad zorunludur");
            }

            if (string.IsNullOrWhiteSpace(request.Machine))
            {
                return BadRequest("Makine bilgisi zorunludur");
            }

            try
            {
                var (connectionString, databaseName, _) = await GetConnectionStringAsync(request.Machine);
                var normalizedCode = request.CategoryCode.Trim().ToLowerInvariant();
                var normalizedDisplay = request.DisplayName.Trim();
                var createdBy = GetCurrentUserName();
                var createdAt = DateTime.UtcNow;

                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                await EnsureStoppageTablesAsync(conn);

                var checkCmd = new SqlCommand("SELECT COUNT(*) FROM stoppage_categories WHERE LOWER(category_code) = @code OR LOWER(display_name) = @display", conn);
                checkCmd.Parameters.AddWithValue("@code", normalizedCode);
                checkCmd.Parameters.AddWithValue("@display", normalizedDisplay.ToLowerInvariant());
                var exists = (int)await checkCmd.ExecuteScalarAsync() > 0;
                if (exists)
                {
                    return Conflict(new { message = "Bu duruş kategorisi daha önce eklendi." });
                }

                var cmd = new SqlCommand("INSERT INTO stoppage_categories (category_code, display_name, created_by, created_at) VALUES (@categoryCode, @displayName, @createdBy, @createdAt); SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);
                cmd.Parameters.AddWithValue("@categoryCode", request.CategoryCode);
                cmd.Parameters.AddWithValue("@displayName", request.DisplayName);
                cmd.Parameters.AddWithValue("@createdBy", createdBy);
                cmd.Parameters.AddWithValue("@createdAt", createdAt);

                var newId = (int)await cmd.ExecuteScalarAsync();

                return Ok(new { id = newId, message = "Kategori başarıyla oluşturuldu", machine = databaseName, createdBy, createdAt });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Kategori oluşturulurken hata: {ex.Message}");
            }
        }

        // POST: /api/stoppagereasons/reasons
        [HttpPost("reasons")]
        public async Task<IActionResult> CreateReason([FromBody] CreateReasonRequest request)
        {
            if (string.IsNullOrEmpty(request.ReasonName) || request.CategoryId <= 0)
            {
                return BadRequest("Sebep adı ve kategori ID zorunludur");
            }

            if (string.IsNullOrWhiteSpace(request.Machine))
            {
                return BadRequest("Makine bilgisi zorunludur");
            }

            try
            {
                var (connectionString, databaseName, _) = await GetConnectionStringAsync(request.Machine);
                var reasonNormalized = request.ReasonName.Trim().ToLowerInvariant();
                var createdBy = GetCurrentUserName();
                var createdAt = DateTime.UtcNow;

                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                await EnsureStoppageTablesAsync(conn);

                var checkCmd = new SqlCommand("SELECT COUNT(*) FROM stoppage_reasons WHERE category_id = @categoryId AND LOWER(reason_name) = @reasonName", conn);
                checkCmd.Parameters.AddWithValue("@categoryId", request.CategoryId);
                checkCmd.Parameters.AddWithValue("@reasonName", reasonNormalized);
                var exists = (int)await checkCmd.ExecuteScalarAsync() > 0;
                if (exists)
                {
                    return Conflict(new { message = "Bu duruş sebebi daha önce eklendi." });
                }

                var cmd = new SqlCommand("INSERT INTO stoppage_reasons (category_id, reason_name, sort_order, created_by, created_at) VALUES (@categoryId, @reasonName, @sortOrder, @createdBy, @createdAt); SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);
                cmd.Parameters.AddWithValue("@categoryId", request.CategoryId);
                cmd.Parameters.AddWithValue("@reasonName", request.ReasonName);
                cmd.Parameters.AddWithValue("@sortOrder", request.SortOrder ?? 0);
                cmd.Parameters.AddWithValue("@createdBy", createdBy);
                cmd.Parameters.AddWithValue("@createdAt", createdAt);

                var newId = (int)await cmd.ExecuteScalarAsync();

                return Ok(new { id = newId, message = "Sebep başarıyla oluşturuldu", machine = databaseName, createdBy, createdAt });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Sebep oluşturulurken hata: {ex.Message}");
            }
        }

        // DELETE: /api/stoppagereasons/categories/{id}
        [HttpDelete("categories/{id}")]
        public async Task<IActionResult> DeleteCategory(int id, [FromQuery] bool force = false, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, _, connectionPool) = await GetConnectionStringAsync(machine);

                foreach (var connString in connectionPool)
                {
                    using var conn = new SqlConnection(connString);
                    await conn.OpenAsync();

                    using var tx = (SqlTransaction)await conn.BeginTransactionAsync();
                    try
                    {
                        await EnsureStoppageTablesAsync(conn, tx);

                        if (force)
                        {
                            var deleteRecordsCmd = new SqlCommand(@"
                                IF OBJECT_ID('stoppage_records', 'U') IS NOT NULL
                                BEGIN
                                    DELETE FROM stoppage_records
                                    WHERE category_id = @categoryId
                                       OR reason_id IN (SELECT id FROM stoppage_reasons WHERE category_id = @categoryId);
                                END", conn, tx);
                            deleteRecordsCmd.Parameters.AddWithValue("@categoryId", id);
                            await deleteRecordsCmd.ExecuteNonQueryAsync();
                        }

                        var deleteReasonsCmd = new SqlCommand("DELETE FROM stoppage_reasons WHERE category_id = @categoryId", conn, tx);
                        deleteReasonsCmd.Parameters.AddWithValue("@categoryId", id);
                        await deleteReasonsCmd.ExecuteNonQueryAsync();

                        var deleteCategoryCmd = new SqlCommand("DELETE FROM stoppage_categories WHERE id = @id", conn, tx);
                        deleteCategoryCmd.Parameters.AddWithValue("@id", id);
                        var rowsAffected = await deleteCategoryCmd.ExecuteNonQueryAsync();

                        if (rowsAffected == 0)
                        {
                            await tx.RollbackAsync();
                            continue;
                        }

                        await tx.CommitAsync();
                        return Ok(new { message = "Kategori ve alt sebepleri başarıyla silindi" });
                    }
                    catch (SqlException sqlEx) when (sqlEx.Number == 547)
                    {
                        await tx.RollbackAsync();
                        return Conflict(new { message = "Bu kategori veya alt sebepleri başka kayıtlar tarafından kullanılıyor. Önce ilişkili kayıtları silin veya 'force=true' ile zorla silin." });
                    }
                    catch
                    {
                        await tx.RollbackAsync();
                        throw;
                    }
                }

                return NotFound("Kategori bulunamadı");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Kategori silinirken hata: {ex.Message}");
            }
        }

        // DELETE: /api/stoppagereasons/reasons/{id}
        [HttpDelete("reasons/{id}")]
        public async Task<IActionResult> DeleteReason(int id, [FromQuery] bool force = false, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, _, connectionPool) = await GetConnectionStringAsync(machine);

                foreach (var connString in connectionPool)
                {
                    using var conn = new SqlConnection(connString);
                    await conn.OpenAsync();

                    using var tx = (SqlTransaction)await conn.BeginTransactionAsync();
                    try
                    {
                        await EnsureStoppageTablesAsync(conn, tx);

                        if (force)
                        {
                            var deleteRecordsCmd = new SqlCommand(@"
                                IF OBJECT_ID('stoppage_records', 'U') IS NOT NULL
                                BEGIN
                                    DELETE FROM stoppage_records WHERE reason_id = @id;
                                END", conn, tx);
                            deleteRecordsCmd.Parameters.AddWithValue("@id", id);
                            await deleteRecordsCmd.ExecuteNonQueryAsync();
                        }

                        var cmd = new SqlCommand("DELETE FROM stoppage_reasons WHERE id = @id", conn, tx);
                        cmd.Parameters.AddWithValue("@id", id);
                        var rowsAffected = await cmd.ExecuteNonQueryAsync();

                        if (rowsAffected == 0)
                        {
                            await tx.RollbackAsync();
                            continue;
                        }

                        await tx.CommitAsync();
                        return Ok(new { message = "Sebep başarıyla silindi" });
                    }
                    catch (SqlException sqlEx) when (sqlEx.Number == 547)
                    {
                        await tx.RollbackAsync();
                        return Conflict(new { message = "Bu sebep başka kayıtlar tarafından kullanılıyor. Önce ilişkili kayıtları silin veya 'force=true' ile zorla silin." });
                    }
                    catch
                    {
                        await tx.RollbackAsync();
                        throw;
                    }
                }

                return NotFound("Sebep bulunamadı");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Sebep silinirken hata: {ex.Message}");
            }
        }

        private async Task<(string ConnectionString, string? DatabaseName, List<string> AllConnections)> GetConnectionStringAsync(string? machine)
        {
            if (string.IsNullOrWhiteSpace(machine))
            {
                var defaultConnection = _config.GetConnectionString("DefaultConnection");
                if (string.IsNullOrWhiteSpace(defaultConnection))
                {
                    throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yapılandırılmamış");
                }

                return (defaultConnection, null, new List<string> { defaultConnection });
            }

            var (databaseName, _) = await ResolveMachineAsync(machine);
            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
            var connections = new List<string> { connectionString };
            var defaultConn = _config.GetConnectionString("DefaultConnection");
            if (!string.IsNullOrWhiteSpace(defaultConn))
            {
                connections.Add(defaultConn);
            }
            return (connectionString, databaseName, connections);
        }

        private async Task<(string DatabaseName, string TableName)> ResolveMachineAsync(string machine)
        {
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

            return (databaseName, machineInfo.TableName);
        }

        private string GetCurrentUserName()
        {
            if (User?.Identity?.IsAuthenticated == true)
            {
                var name = User?.FindFirst(ClaimTypes.Name)?.Value
                    ?? User?.FindFirst("username")?.Value
                    ?? User?.FindFirst("name")?.Value
                    ?? User?.Identity?.Name;

                if (!string.IsNullOrWhiteSpace(name))
                {
                    return name;
                }
            }

            return "system";
        }

        private async Task EnsureMachineTablesAsync(string connectionString)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureStoppageTablesAsync(conn);
                var countCmd = new SqlCommand("SELECT COUNT(*) FROM stoppage_categories", conn);
                var count = (int)await countCmd.ExecuteScalarAsync();
                if (EnableVerboseLogging)
                {
                    var builder = new SqlConnectionStringBuilder(connectionString);
                    Console.WriteLine($"[StoppageReasons] Machine DB check: Server={builder.DataSource} Database={builder.InitialCatalog} CategoryCount={count}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[StoppageReasons] Machine DB ensure failed: {ex.Message}");
            }
        }

        private async Task EnsureStoppageTablesAsync(SqlConnection connection, SqlTransaction? transaction = null)
        {
            var ensureSql = @"
                IF OBJECT_ID('stoppage_categories', 'U') IS NULL
                BEGIN
                    CREATE TABLE stoppage_categories (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        category_code NVARCHAR(100) NOT NULL UNIQUE,
                        display_name NVARCHAR(200) NOT NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        created_by NVARCHAR(100) NULL
                    );
                END;
                ELSE IF COLUMNPROPERTY(OBJECT_ID('stoppage_categories'), 'id', 'IsIdentity') <> 1
                BEGIN
                    SELECT category_code, display_name, ISNULL(created_at, GETDATE()) AS created_at INTO #tmp_stoppage_categories FROM stoppage_categories;
                    DROP TABLE stoppage_categories;
                    CREATE TABLE stoppage_categories (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        category_code NVARCHAR(100) NOT NULL UNIQUE,
                        display_name NVARCHAR(200) NOT NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        created_by NVARCHAR(100) NULL
                    );
                    INSERT INTO stoppage_categories (category_code, display_name, created_at)
                    SELECT category_code, display_name, created_at FROM #tmp_stoppage_categories;
                    DROP TABLE #tmp_stoppage_categories;
                END;

                IF OBJECT_ID('stoppage_reasons', 'U') IS NULL
                BEGIN
                    CREATE TABLE stoppage_reasons (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        category_id INT NOT NULL,
                        reason_name NVARCHAR(200) NOT NULL,
                        sort_order INT NULL DEFAULT 0,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        created_by NVARCHAR(100) NULL,
                        FOREIGN KEY (category_id) REFERENCES stoppage_categories(id) ON DELETE CASCADE
                    );
                END;
                ELSE IF COLUMNPROPERTY(OBJECT_ID('stoppage_reasons'), 'id', 'IsIdentity') <> 1
                BEGIN
                    SELECT category_id, reason_name, sort_order, ISNULL(created_at, GETDATE()) AS created_at INTO #tmp_stoppage_reasons FROM stoppage_reasons;
                    DROP TABLE stoppage_reasons;
                    CREATE TABLE stoppage_reasons (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        category_id INT NOT NULL,
                        reason_name NVARCHAR(200) NOT NULL,
                        sort_order INT NULL DEFAULT 0,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        created_by NVARCHAR(100) NULL,
                        FOREIGN KEY (category_id) REFERENCES stoppage_categories(id) ON DELETE CASCADE
                    );
                    INSERT INTO stoppage_reasons (category_id, reason_name, sort_order, created_at)
                    SELECT category_id, reason_name, sort_order, created_at FROM #tmp_stoppage_reasons;
                    DROP TABLE #tmp_stoppage_reasons;
                END;

                IF COL_LENGTH('stoppage_reasons', 'sort_order') IS NULL
                BEGIN
                    ALTER TABLE stoppage_reasons ADD sort_order INT NULL DEFAULT 0;
                END;

                IF COL_LENGTH('stoppage_reasons', 'created_at') IS NULL
                BEGIN
                    ALTER TABLE stoppage_reasons ADD created_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF COL_LENGTH('stoppage_categories', 'created_at') IS NULL
                BEGIN
                    ALTER TABLE stoppage_categories ADD created_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;";

            ensureSql += @"
                IF COL_LENGTH('stoppage_categories', 'created_by') IS NULL
                BEGIN
                    ALTER TABLE stoppage_categories ADD created_by NVARCHAR(100) NULL;
                END;

                IF COL_LENGTH('stoppage_reasons', 'created_by') IS NULL
                BEGIN
                    ALTER TABLE stoppage_reasons ADD created_by NVARCHAR(100) NULL;
                END;";

            using var cmd = new SqlCommand(ensureSql, connection);
            if (transaction != null)
            {
                cmd.Transaction = transaction;
            }

            await cmd.ExecuteNonQueryAsync();

            // Eğer tablolar yeni oluşturulduysa veya boşsa, varsayılan (merkezi) verilerden seed et
            var countCmd = new SqlCommand("SELECT COUNT(*) FROM stoppage_categories", connection, transaction);
            var existingCount = (int)await countCmd.ExecuteScalarAsync();
            if (existingCount == 0)
            {
                await SeedStoppageTablesAsync(connection, transaction);
            }
        }

        private async Task SeedStoppageTablesAsync(SqlConnection targetConnection, SqlTransaction? transaction)
        {
            if (transaction != null && (transaction.Connection?.ConnectionString?.Contains("Database=Dashboard") ?? false))
            {
                return; // Dashboard veritabanına seed etmeye çalışma
            }

            var defaultConnectionString = _config.GetConnectionString("DefaultConnection");
            if (string.IsNullOrWhiteSpace(defaultConnectionString))
            {
                return;
            }

            var targetBuilder = new SqlConnectionStringBuilder(targetConnection.ConnectionString);
            var defaultBuilder = new SqlConnectionStringBuilder(defaultConnectionString);

            // Aynı veritabanına seed etmeye çalışmayalım
            if (string.Equals(targetBuilder.InitialCatalog, defaultBuilder.InitialCatalog, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var defaultCategories = new List<(string Code, string DisplayName)>();
            var defaultReasons = new List<(string CategoryCode, string Name, int? SortOrder)>();

            using (var sourceConnection = new SqlConnection(defaultConnectionString))
            {
                await sourceConnection.OpenAsync();

                // Kategorileri oku
                using (var categoryCmd = new SqlCommand("SELECT id, category_code, display_name FROM stoppage_categories ORDER BY id", sourceConnection))
                using (var reader = await categoryCmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        defaultCategories.Add((
                            reader.GetString(reader.GetOrdinal("category_code")),
                            reader.GetString(reader.GetOrdinal("display_name"))
                        ));
                    }
                }

                // Sebepleri oku
                using (var reasonCmd = new SqlCommand(@"
                    SELECT sc.category_code, sr.reason_name, sr.sort_order
                    FROM stoppage_reasons sr
                    JOIN stoppage_categories sc ON sr.category_id = sc.id
                    ORDER BY sc.category_code, sr.sort_order, sr.id", sourceConnection))
                using (var reader = await reasonCmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        defaultReasons.Add((
                            reader.GetString(reader.GetOrdinal("category_code")),
                            reader.GetString(reader.GetOrdinal("reason_name")),
                            reader.IsDBNull(reader.GetOrdinal("sort_order")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("sort_order"))
                        ));
                    }
                }
            }

            if (defaultCategories.Count == 0)
            {
                return;
            }

            var categoryMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            // Kategorileri ekle
            foreach (var category in defaultCategories)
            {
                var insertCategoryCmd = new SqlCommand(
                    "INSERT INTO stoppage_categories (category_code, display_name) VALUES (@code, @displayName); SELECT CAST(SCOPE_IDENTITY() AS INT);",
                    targetConnection,
                    transaction
                );
                insertCategoryCmd.Parameters.Add(new SqlParameter("@code", SqlDbType.NVarChar, 100) { Value = category.Code });
                insertCategoryCmd.Parameters.Add(new SqlParameter("@displayName", SqlDbType.NVarChar, 200) { Value = category.DisplayName });

                var newId = (int)(await insertCategoryCmd.ExecuteScalarAsync());
                categoryMap[category.Code] = newId;
            }

            // Sebepleri ekle
            foreach (var reason in defaultReasons)
            {
                if (!categoryMap.TryGetValue(reason.CategoryCode, out var newCategoryId))
                {
                    continue;
                }

                var insertReasonCmd = new SqlCommand(
                    "INSERT INTO stoppage_reasons (category_id, reason_name, sort_order) VALUES (@categoryId, @reasonName, @sortOrder);",
                    targetConnection,
                    transaction
                );
                insertReasonCmd.Parameters.Add(new SqlParameter("@categoryId", SqlDbType.Int) { Value = newCategoryId });
                insertReasonCmd.Parameters.Add(new SqlParameter("@reasonName", SqlDbType.NVarChar, 200) { Value = reason.Name });
                insertReasonCmd.Parameters.Add(new SqlParameter("@sortOrder", SqlDbType.Int) { Value = (object?)reason.SortOrder ?? DBNull.Value });

                await insertReasonCmd.ExecuteNonQueryAsync();
            }
        }
    }

    // Request modelleri
    public class CreateCategoryRequest
    {
        public string CategoryCode { get; set; } = "";
        public string DisplayName { get; set; } = "";
        public string Machine { get; set; } = "";
    }

    public class CreateReasonRequest
    {
        public int CategoryId { get; set; }
        public string ReasonName { get; set; } = "";
        public int? SortOrder { get; set; }
        public string Machine { get; set; } = "";
    }
}