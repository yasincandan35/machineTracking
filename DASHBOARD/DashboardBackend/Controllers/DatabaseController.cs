using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DatabaseController : ControllerBase
    {
        private readonly IConfiguration _config;

        public DatabaseController(IConfiguration config)
        {
            _config = config;
        }

        private string GetConnectionString() => _config.GetConnectionString("DefaultConnection");

        [HttpGet("tables")]
        public IActionResult GetTables()
        {
            var tableNames = new List<string>();
            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();
            var cmd = new SqlCommand("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'", conn);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                tableNames.Add(reader.GetString(0));
            return Ok(tableNames);
        }

        [HttpPost("create")]
        public IActionResult CreateTable([FromBody] TableCreateRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.TableName) || req.Columns == null || req.Columns.Count == 0)
                return BadRequest("Tablo adı ve kolonlar zorunludur.");

            var columnsSql = req.Columns.Select(col =>
                $"[{col.Name}] {col.Type} {(col.Required ? "NOT NULL" : "NULL")}");

            var createTableSql = $@"
                CREATE TABLE [{req.TableName}] (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    {string.Join(", ", columnsSql)}
                );";

            var insertMachineSql = $@"
                INSERT INTO MachineLists (MachineName, TableName)
                VALUES (@MachineName, @TableName);";

            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();

            using var transaction = conn.BeginTransaction();
            try
            {
                var createCmd = new SqlCommand(createTableSql, conn, transaction);
                createCmd.ExecuteNonQuery();

                var insertCmd = new SqlCommand(insertMachineSql, conn, transaction);
                insertCmd.Parameters.AddWithValue("@MachineName", req.MachineName);
                insertCmd.Parameters.AddWithValue("@TableName", req.TableName);
                insertCmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                return StatusCode(500, "Tablo oluşturulurken hata oluştu: " + ex.Message);
            }

            return Ok(new { message = "Tablo ve makine kaydı oluşturuldu." });
        }

        [HttpPost("add-column")]
        public IActionResult AddColumn([FromBody] ColumnUpdateRequest req)
        {
            var nullability = req.Column.Required ? "NOT NULL" : "NULL";
            var sql = $"ALTER TABLE [{req.TableName}] ADD [{req.Column.Name}] {req.Column.Type} {nullability};";

            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();
            var cmd = new SqlCommand(sql, conn);
            cmd.ExecuteNonQuery();

            return Ok(new { message = "Kolon eklendi." });
        }

        [HttpPost("drop-column")]
        public IActionResult DropColumn([FromBody] ColumnDeleteRequest req)
        {
            var sql = $"ALTER TABLE [{req.TableName}] DROP COLUMN [{req.ColumnName}];";

            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();
            var cmd = new SqlCommand(sql, conn);
            cmd.ExecuteNonQuery();

            return Ok(new { message = "Kolon silindi." });
        }

        [HttpPost("drop-table")]
        public IActionResult DropTable([FromBody] TableDropRequest req)
        {
            var sql = $"DROP TABLE [{req.TableName}];";
            var deleteMachineSql = $"DELETE FROM MachineLists WHERE TableName = @TableName;";

            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();

            using var transaction = conn.BeginTransaction();
            try
            {
                var dropCmd = new SqlCommand(sql, conn, transaction);
                dropCmd.ExecuteNonQuery();

                var deleteCmd = new SqlCommand(deleteMachineSql, conn, transaction);
                deleteCmd.Parameters.AddWithValue("@TableName", req.TableName);
                deleteCmd.ExecuteNonQuery();

                transaction.Commit();
            }
            catch (Exception ex)
            {
                transaction.Rollback();
                return StatusCode(500, "Tablo silinirken hata oluştu: " + ex.Message);
            }

            return Ok(new { message = "Tablo ve eşleşen makine kaydı silindi." });
        }

        [HttpGet("machines")]
        public IActionResult GetMachineList()
        {
            var machines = new List<object>();
            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();
            var cmd = new SqlCommand("SELECT Id, MachineName, TableName FROM MachineLists", conn);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                machines.Add(new
                {
                    Id = reader.GetInt32(0),
                    MachineName = reader.GetString(1),
                    TableName = reader.GetString(2)
                });
            }
            return Ok(machines);
        }

        [HttpGet("columns")]
        public IActionResult GetTableColumns([FromQuery] string tableName)
        {
            var columns = new List<string>();
            using var conn = new SqlConnection(GetConnectionString());
            conn.Open();
            var cmd = new SqlCommand(@"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @TableName AND COLUMN_NAME != 'Id'", conn);
            cmd.Parameters.AddWithValue("@TableName", tableName);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                columns.Add(reader.GetString(0));
            return Ok(columns);
        }
    }

    public class TableCreateRequest
    {
        public string TableName { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
        public List<ColumnDefinition> Columns { get; set; } = new();
    }

    public class ColumnDefinition
    {
        public string Name { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public bool Required { get; set; }
    }

    public class ColumnUpdateRequest
    {
        public string TableName { get; set; } = string.Empty;
        public ColumnDefinition Column { get; set; } = new();
    }

    public class ColumnDeleteRequest
    {
        public string TableName { get; set; } = string.Empty;
        public string ColumnName { get; set; } = string.Empty;
    }

    public class TableDropRequest
    {
        public string TableName { get; set; } = string.Empty;
    }
}
