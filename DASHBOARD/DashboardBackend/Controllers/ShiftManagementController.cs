using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authorization;
using DashboardBackend.Services;
using DashboardBackend.Data;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ShiftManagementController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly MachineDatabaseService _machineDatabaseService;
        private readonly DashboardDbContext _dashboardContext;
        private const bool EnableVerboseLogging = false;

        public ShiftManagementController(
            IConfiguration config,
            MachineDatabaseService machineDatabaseService,
            DashboardDbContext dashboardContext)
        {
            _config = config;
            _machineDatabaseService = machineDatabaseService;
            _dashboardContext = dashboardContext;
        }

        // GET: /api/shiftmanagement/templates
        [HttpGet("templates")]
        [Authorize(Roles = "admin,engineer,shiftEngineer,demo")]
        public async Task<IActionResult> GetShiftTemplates([FromQuery] string? machine = null)
        {
            var templates = new List<object>();

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand("SELECT id, name, start_time, end_time, duration_hours, color FROM shift_templates ORDER BY name", conn);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var startTimeValue = reader["start_time"];
                    var endTimeValue = reader["end_time"];
                    var durationValue = reader["duration_hours"];
                    var colorValue = reader["color"];

                    var startTime = startTimeValue != DBNull.Value
                        ? (TimeSpan)startTimeValue
                        : TimeSpan.Zero;

                    var endTime = endTimeValue != DBNull.Value
                        ? (TimeSpan)endTimeValue
                        : TimeSpan.Zero;

                    var durationHours = durationValue != DBNull.Value
                        ? Convert.ToDecimal(durationValue)
                        : 0m;

                    var color = colorValue != DBNull.Value
                        ? (string)colorValue
                        : "#ff0000";

                    templates.Add(new
                    {
                        id = (int)reader["id"],
                        name = (string)reader["name"],
                        startTime = startTime.ToString(@"hh\:mm"),
                        endTime = endTime.ToString(@"hh\:mm"),
                        durationHours = durationHours,
                        color = color
                    });
                }

                LogConnection("Templates fetched", connectionString, machine, databaseName, templates.Count);
                return Ok(templates);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Template'ler alınırken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/templates
        [HttpPost("templates")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateShiftTemplate([FromBody] CreateShiftTemplateRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrEmpty(request.Name) || string.IsNullOrEmpty(request.StartTime) || string.IsNullOrEmpty(request.EndTime))
            {
                return BadRequest("Template adı, başlangıç ve bitiş zamanı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    INSERT INTO shift_templates (name, start_time, end_time, duration_hours, color) 
                    VALUES (@name, @startTime, @endTime, @durationHours, @color);
                    SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);

                cmd.Parameters.AddWithValue("@name", request.Name);
                cmd.Parameters.AddWithValue("@startTime", TimeSpan.Parse(request.StartTime));
                cmd.Parameters.AddWithValue("@endTime", TimeSpan.Parse(request.EndTime));
                cmd.Parameters.AddWithValue("@durationHours", request.DurationHours);
                cmd.Parameters.AddWithValue("@color", request.Color);

                var newId = (int)(await cmd.ExecuteScalarAsync() ?? 0);

                LogConnection("Template created", connectionString, machine, databaseName, 1);
                return Ok(new { id = newId, message = "Vardiya template'i oluşturuldu" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Template oluşturulurken hata: {ex.Message}");
            }
        }

        // GET: /api/shiftmanagement/groups
        [HttpGet("groups")]
        [Authorize(Roles = "admin,engineer,shiftEngineer,demo")]
        public async Task<IActionResult> GetShiftGroups([FromQuery] string? machine = null)
        {
            var groups = new List<object>();

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand("SELECT id, name, description, created_at, updated_at FROM shift_groups ORDER BY name", conn);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    groups.Add(new
                    {
                        id = (int)reader["id"],
                        name = (string)reader["name"],
                        description = reader["description"] == DBNull.Value ? null : (string)reader["description"],
                        createdAt = ((DateTime)reader["created_at"]).ToString("yyyy-MM-ddTHH:mm:ss"),
                        updatedAt = ((DateTime)reader["updated_at"]).ToString("yyyy-MM-ddTHH:mm:ss")
                    });
                }

                LogConnection("Groups fetched", connectionString, machine, databaseName, groups.Count);
                return Ok(groups);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Gruplar alınırken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/groups
        [HttpPost("groups")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateShiftGroup([FromBody] CreateShiftGroupRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("Grup adı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    INSERT INTO shift_groups (name, description) 
                    VALUES (@name, @description);
                    SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);

                cmd.Parameters.AddWithValue("@name", request.Name.Trim());
                cmd.Parameters.AddWithValue("@description", (object?)request.Description ?? DBNull.Value);

                var newId = (int)(await cmd.ExecuteScalarAsync() ?? 0);

                LogConnection("Group created", connectionString, machine, databaseName, 1);
                return Ok(new { id = newId, message = "Grup oluşturuldu" });
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
            {
                return BadRequest("Bu grup adı zaten kullanılıyor");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Grup oluşturulurken hata: {ex.Message}");
            }
        }

        // PUT: /api/shiftmanagement/groups/{id}
        [HttpPut("groups/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> UpdateShiftGroup(int id, [FromBody] CreateShiftGroupRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest("Grup adı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    UPDATE shift_groups 
                    SET name = @name, description = @description, updated_at = GETDATE()
                    WHERE id = @id", conn);

                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@name", request.Name.Trim());
                cmd.Parameters.AddWithValue("@description", (object?)request.Description ?? DBNull.Value);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Grup bulunamadı");
                }

                LogConnection("Group updated", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Grup güncellendi" });
            }
            catch (SqlException ex) when (ex.Number == 2627 || ex.Number == 2601)
            {
                return BadRequest("Bu grup adı zaten kullanılıyor");
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Grup güncellenirken hata: {ex.Message}");
            }
        }

        // DELETE: /api/shiftmanagement/groups/{id}
        [HttpDelete("groups/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> DeleteShiftGroup(int id, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                // Önce grup adını al
                var getGroupCmd = new SqlCommand("SELECT name FROM shift_groups WHERE id = @id", conn);
                getGroupCmd.Parameters.AddWithValue("@id", id);
                var groupName = await getGroupCmd.ExecuteScalarAsync();

                if (groupName == null || groupName == DBNull.Value)
                {
                    return NotFound("Grup bulunamadı");
                }

                // Bu grubu kullanan çalışanları kontrol et
                var checkCmd = new SqlCommand("SELECT COUNT(*) FROM employees WHERE ShiftGroup = @groupName AND ShiftGroup IS NOT NULL", conn);
                checkCmd.Parameters.AddWithValue("@groupName", groupName.ToString());
                var employeeCount = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());

                if (employeeCount > 0)
                {
                    return BadRequest($"Bu grup {employeeCount} çalışan tarafından kullanılıyor. Önce çalışanların grup bilgisini güncelleyin.");
                }

                var cmd = new SqlCommand("DELETE FROM shift_groups WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("@id", id);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Grup bulunamadı");
                }

                LogConnection("Group deleted", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Grup silindi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Grup silinirken hata: {ex.Message}");
            }
        }

        // GET: /api/shiftmanagement/employees
        [HttpGet("employees")]
        [Authorize(Roles = "admin,engineer,shiftEngineer,demo")]
        public async Task<IActionResult> GetEmployees([FromQuery] string? machine = null, [FromQuery] string? group = null)
        {
            var employees = new List<object>();

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var sql = "SELECT id, name, title, active, ShiftGroup FROM employees";
                if (!string.IsNullOrWhiteSpace(group))
                {
                    sql += " WHERE ShiftGroup = @group";
                }
                sql += " ORDER BY name";

                var cmd = new SqlCommand(sql, conn);
                if (!string.IsNullOrWhiteSpace(group))
                {
                    cmd.Parameters.AddWithValue("@group", group);
                }

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    employees.Add(new
                    {
                        id = (int)reader["id"],
                        name = (string)reader["name"],
                        title = reader["title"] == DBNull.Value ? "" : (string)reader["title"],
                        active = reader["active"] != DBNull.Value && (bool)reader["active"],
                        shiftGroup = reader["ShiftGroup"] == DBNull.Value ? null : (string)reader["ShiftGroup"]
                    });
                }

                LogConnection("Employees fetched", connectionString, machine, databaseName, employees.Count);
                return Ok(employees);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Çalışanlar alınırken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/employees
        [HttpPost("employees")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateEmployee([FromBody] CreateEmployeeRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrEmpty(request.Name))
            {
                return BadRequest("Çalışan adı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    INSERT INTO employees (name, title, active, ShiftGroup) 
                    VALUES (@name, @title, 1, @shiftGroup);
                    SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);

                cmd.Parameters.AddWithValue("@name", request.Name);
                cmd.Parameters.AddWithValue("@title", request.Title ?? "");
                cmd.Parameters.AddWithValue("@shiftGroup", (object?)request.ShiftGroup ?? DBNull.Value);

                var newId = (int)(await cmd.ExecuteScalarAsync() ?? 0);

                LogConnection("Employee created", connectionString, machine, databaseName, 1);
                return Ok(new { id = newId, message = "Çalışan eklendi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Çalışan eklenirken hata: {ex.Message}");
            }
        }

        // GET: /api/shiftmanagement/assignments/monthly/{year}/{month}
        [HttpGet("assignments/monthly/{year}/{month}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer,demo")]
        public async Task<IActionResult> GetMonthlyAssignments(int year, int month, [FromQuery] string? machine = null)
        {
            var assignments = new List<object>();

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                // Takvim görünümü için 6 haftalık veri lazım (önceki ve sonraki aydan da günler)
                var firstDayOfMonth = new DateTime(year, month, 1);
                
                // Takvimin başlangıç tarihini bul (önceki aydan olabilir)
                var dayOfWeek = (int)firstDayOfMonth.DayOfWeek;
                var daysToSubtract = dayOfWeek == 0 ? 6 : dayOfWeek - 1; // Pazartesi = 0
                var startDate = firstDayOfMonth.AddDays(-daysToSubtract);
                
                // 5 hafta = 35 gün (daha kompakt)
                var endDate = startDate.AddDays(34);
                
                // Debug log
                if (EnableVerboseLogging)
                {
                    Console.WriteLine($"📅 Aylık veri çekiliyor: {year}/{month:00} - Tarih aralığı: {startDate:yyyy-MM-dd} - {endDate:yyyy-MM-dd}");
                }

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    SELECT 
                        sa.id,
                        sa.shift_date,
                        sa.day_of_week,
                        sa.employee_id,
                        sa.template_id,
                        sa.is_primary,
                        sa.position,
                        e.name as employee_name,
                        st.name as template_name,
                        st.start_time,
                        st.end_time,
                        st.color
                    FROM shift_assignments sa
                    JOIN employees e ON sa.employee_id = e.id
                    JOIN shift_templates st ON sa.template_id = st.id
                    WHERE sa.shift_date BETWEEN @startDate AND @endDate
                    ORDER BY sa.shift_date, st.start_time", conn);

                cmd.Parameters.AddWithValue("@startDate", startDate);
                cmd.Parameters.AddWithValue("@endDate", endDate);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    assignments.Add(new
                    {
                        id = (int)reader["id"],
                        shiftDate = ((DateTime)reader["shift_date"]).ToString("yyyy-MM-dd"),
                        dayOfWeek = (int)reader["day_of_week"],
                        employeeId = (int)reader["employee_id"],
                        templateId = (int)reader["template_id"],
                        isPrimary = reader["is_primary"] != DBNull.Value ? (bool)reader["is_primary"] : false,
                        position = reader["position"] != DBNull.Value ? (string)reader["position"] : "Çalışan",
                        employeeName = (string)reader["employee_name"],
                        templateName = (string)reader["template_name"],
                        startTime = ((TimeSpan)reader["start_time"]).ToString(@"hh\:mm"),
                        endTime = ((TimeSpan)reader["end_time"]).ToString(@"hh\:mm"),
                        color = (string)reader["color"]
                    });
                }

                LogConnection("Monthly assignments fetched", connectionString, machine, databaseName, assignments.Count);
                return Ok(assignments);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Aylık vardiya atamaları alınırken hata: {ex.Message}");
            }
        }

        // GET: /api/shiftmanagement/assignments/{date}
        [HttpGet("assignments/{date}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer,demo")]
        public async Task<IActionResult> GetWeeklyAssignments(string date, [FromQuery] string? machine = null)
        {
            var assignments = new List<object>();

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                var startDate = DateTime.Parse(date);
                var endDate = startDate.AddDays(6); // 7 günlük hafta

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    SELECT 
                        sa.id,
                        sa.shift_date,
                        sa.day_of_week,
                        sa.employee_id,
                        sa.template_id,
                        sa.is_primary,
                        sa.position,
                        e.name as employee_name,
                        st.name as template_name,
                        st.start_time,
                        st.end_time,
                        st.color
                    FROM shift_assignments sa
                    JOIN employees e ON sa.employee_id = e.id
                    JOIN shift_templates st ON sa.template_id = st.id
                    WHERE sa.shift_date BETWEEN @startDate AND @endDate
                    ORDER BY sa.shift_date, st.start_time", conn);

                cmd.Parameters.AddWithValue("@startDate", startDate);
                cmd.Parameters.AddWithValue("@endDate", endDate);

                await using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    assignments.Add(new
                    {
                        id = (int)reader["id"],
                        shiftDate = ((DateTime)reader["shift_date"]).ToString("yyyy-MM-dd"),
                        dayOfWeek = (int)reader["day_of_week"],
                        employeeId = (int)reader["employee_id"],
                        templateId = (int)reader["template_id"],
                        isPrimary = reader["is_primary"] != DBNull.Value ? (bool)reader["is_primary"] : false,
                        position = reader["position"] != DBNull.Value ? (string)reader["position"] : "Çalışan",
                        employeeName = (string)reader["employee_name"],
                        templateName = (string)reader["template_name"],
                        startTime = ((TimeSpan)reader["start_time"]).ToString(@"hh\:mm"),
                        endTime = ((TimeSpan)reader["end_time"]).ToString(@"hh\:mm"),
                        color = (string)reader["color"]
                    });
                }

                LogConnection("Weekly assignments fetched", connectionString, machine, databaseName, assignments.Count);
                return Ok(assignments);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Vardiya atamaları alınırken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/assignments
        [HttpPost("assignments")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateAssignment([FromBody] CreateAssignmentRequest request, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    INSERT INTO shift_assignments (employee_id, template_id, shift_date, day_of_week) 
                    VALUES (@employeeId, @templateId, @shiftDate, @dayOfWeek);
                    SELECT CAST(SCOPE_IDENTITY() AS INT);", conn);

                cmd.Parameters.AddWithValue("@employeeId", request.EmployeeId);
                cmd.Parameters.AddWithValue("@templateId", request.TemplateId);
                cmd.Parameters.AddWithValue("@shiftDate", DateTime.Parse(request.ShiftDate));
                cmd.Parameters.AddWithValue("@dayOfWeek", request.DayOfWeek);

                var newId = (int)(await cmd.ExecuteScalarAsync() ?? 0);

                LogConnection("Assignment created", connectionString, machine, databaseName, 1);
                return Ok(new { id = newId, message = "Vardiya ataması oluşturuldu" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Vardiya ataması oluşturulurken hata: {ex.Message}");
            }
        }

        // PUT: /api/shiftmanagement/templates/{id}
        [HttpPut("templates/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> UpdateShiftTemplate(int id, [FromBody] CreateShiftTemplateRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrEmpty(request.Name) || string.IsNullOrEmpty(request.StartTime) || string.IsNullOrEmpty(request.EndTime))
            {
                return BadRequest("Template adı, başlangıç ve bitiş zamanı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    UPDATE shift_templates 
                    SET name = @name, start_time = @startTime, end_time = @endTime, 
                        duration_hours = @durationHours, color = @color 
                    WHERE id = @id", conn);

                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@name", request.Name);
                cmd.Parameters.AddWithValue("@startTime", TimeSpan.Parse(request.StartTime));
                cmd.Parameters.AddWithValue("@endTime", TimeSpan.Parse(request.EndTime));
                cmd.Parameters.AddWithValue("@durationHours", request.DurationHours);
                cmd.Parameters.AddWithValue("@color", request.Color);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Template bulunamadı");
                }

                LogConnection("Template updated", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Template güncellendi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Template güncellenirken hata: {ex.Message}");
            }
        }

        // DELETE: /api/shiftmanagement/templates/{id}
        [HttpDelete("templates/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> DeleteShiftTemplate(int id, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                // Önce bu template'i kullanan atamaları kontrol et
                var checkCmd = new SqlCommand("SELECT COUNT(*) FROM shift_assignments WHERE template_id = @id", conn);
                checkCmd.Parameters.AddWithValue("@id", id);
                var assignmentCount = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());

                if (assignmentCount > 0)
                {
                    return BadRequest($"Bu template {assignmentCount} vardiya atamasında kullanılıyor. Önce atamaları silin.");
                }

                var cmd = new SqlCommand("DELETE FROM shift_templates WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("@id", id);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Template bulunamadı");
                }

                LogConnection("Template deleted", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Template silindi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Template silinirken hata: {ex.Message}");
            }
        }

        // PUT: /api/shiftmanagement/employees/{id}
        [HttpPut("employees/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> UpdateEmployee(int id, [FromBody] CreateEmployeeRequest request, [FromQuery] string? machine = null)
        {
            if (string.IsNullOrEmpty(request.Name))
            {
                return BadRequest("Çalışan adı zorunludur");
            }

            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    UPDATE employees 
                    SET name = @name, title = @title, ShiftGroup = @shiftGroup, active = @active 
                    WHERE id = @id", conn);

                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@name", request.Name);
                cmd.Parameters.AddWithValue("@title", request.Title ?? "");
                cmd.Parameters.AddWithValue("@shiftGroup", (object?)request.ShiftGroup ?? DBNull.Value);
                cmd.Parameters.AddWithValue("@active", request.Active);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Çalışan bulunamadı");
                }

                LogConnection("Employee updated", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Çalışan güncellendi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Çalışan güncellenirken hata: {ex.Message}");
            }
        }

        // DELETE: /api/shiftmanagement/employees/{id}
        [HttpDelete("employees/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> DeleteEmployee(int id, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                // Önce bu çalışanın atamalarını kontrol et
                var checkCmd = new SqlCommand("SELECT COUNT(*) FROM shift_assignments WHERE employee_id = @id", conn);
                checkCmd.Parameters.AddWithValue("@id", id);
                var assignmentCount = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());

                if (assignmentCount > 0)
                {
                    return BadRequest($"Bu çalışanın {assignmentCount} vardiya ataması var. Önce atamaları silin.");
                }

                // Gerçekten sil (CASCADE ile shift_assignments otomatik silinir ama yine de kontrol ettik)
                var cmd = new SqlCommand("DELETE FROM employees WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("@id", id);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Çalışan bulunamadı");
                }

                LogConnection("Employee deleted", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Çalışan silindi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Çalışan silinirken hata: {ex.Message}");
            }
        }

        // PUT: /api/shiftmanagement/assignments/{id}
        [HttpPut("assignments/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> UpdateAssignment(int id, [FromBody] CreateAssignmentRequest request, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand(@"
                    UPDATE shift_assignments 
                    SET employee_id = @employeeId, template_id = @templateId, 
                        shift_date = @shiftDate, day_of_week = @dayOfWeek 
                    WHERE id = @id", conn);

                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@employeeId", request.EmployeeId);
                cmd.Parameters.AddWithValue("@templateId", request.TemplateId);
                cmd.Parameters.AddWithValue("@shiftDate", DateTime.Parse(request.ShiftDate));
                cmd.Parameters.AddWithValue("@dayOfWeek", request.DayOfWeek);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Vardiya ataması bulunamadı");
                }

                LogConnection("Assignment updated", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Vardiya ataması güncellendi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Vardiya ataması güncellenirken hata: {ex.Message}");
            }
        }

        // DELETE: /api/shiftmanagement/assignments/{id}
        [HttpDelete("assignments/{id}")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> DeleteAssignment(int id, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                var cmd = new SqlCommand("DELETE FROM shift_assignments WHERE id = @id", conn);
                cmd.Parameters.AddWithValue("@id", id);

                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                
                if (rowsAffected == 0)
                {
                    return NotFound("Vardiya ataması bulunamadı");
                }

                LogConnection("Assignment deleted", connectionString, machine, databaseName, rowsAffected);
                return Ok(new { message = "Vardiya ataması silindi" });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Vardiya ataması silinirken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/assignments/multi
        [HttpPost("assignments/multi")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateMultiEmployeeAssignment([FromBody] MultiEmployeeAssignmentRequest request, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                using var transaction = conn.BeginTransaction();

                try
                {
                    foreach (var employee in request.Employees)
                    {
                        var cmd = new SqlCommand(@"
                            INSERT INTO shift_assignments (employee_id, template_id, shift_date, day_of_week, is_primary, position) 
                            VALUES (@employeeId, @templateId, @shiftDate, @dayOfWeek, @isPrimary, @position)", conn, transaction);

                        cmd.Parameters.AddWithValue("@employeeId", employee.EmployeeId);
                        cmd.Parameters.AddWithValue("@templateId", request.TemplateId);
                        cmd.Parameters.AddWithValue("@shiftDate", DateTime.Parse(request.ShiftDate));
                        cmd.Parameters.AddWithValue("@dayOfWeek", request.DayOfWeek);
                        cmd.Parameters.AddWithValue("@isPrimary", employee.IsPrimary);
                        cmd.Parameters.AddWithValue("@position", employee.Position);

                        await cmd.ExecuteNonQueryAsync();
                    }

                    transaction.Commit();
                    LogConnection("Multi assignment created", connectionString, machine, databaseName, request.Employees.Count);
                    return Ok(new { message = $"{request.Employees.Count} çalışan vardiyaya atandı" });
                }
                catch
                {
                    transaction.Rollback();
                    throw;
                }
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Çoklu atama oluşturulurken hata: {ex.Message}");
            }
        }

        // POST: /api/shiftmanagement/assignments/bulk
        [HttpPost("assignments/bulk")]
        [Authorize(Roles = "admin,engineer,shiftEngineer")]
        public async Task<IActionResult> CreateBulkAssignments([FromBody] BulkAssignmentRequest request, [FromQuery] string? machine = null)
        {
            try
            {
                var (connectionString, databaseName) = await GetConnectionStringAsync(machine);

                await using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureShiftTablesAsync(conn);

                using var transaction = conn.BeginTransaction();

                try
                {
                    foreach (var assignment in request.Assignments)
                    {
                        var cmd = new SqlCommand(@"
                            INSERT INTO shift_assignments (employee_id, template_id, shift_date, day_of_week) 
                            VALUES (@employeeId, @templateId, @shiftDate, @dayOfWeek)", conn, transaction);

                        cmd.Parameters.AddWithValue("@employeeId", assignment.EmployeeId);
                        cmd.Parameters.AddWithValue("@templateId", assignment.TemplateId);
                        cmd.Parameters.AddWithValue("@shiftDate", DateTime.Parse(assignment.ShiftDate));
                        cmd.Parameters.AddWithValue("@dayOfWeek", assignment.DayOfWeek);

                        await cmd.ExecuteNonQueryAsync();
                    }

                    transaction.Commit();
                    LogConnection("Bulk assignments created", connectionString, machine, databaseName, request.Assignments.Count);
                    return Ok(new { message = $"{request.Assignments.Count} vardiya ataması oluşturuldu" });
                }
                catch
                {
                    transaction.Rollback();
                    throw;
                }
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Toplu atama oluşturulurken hata: {ex.Message}");
            }
        }
        private async Task<(string ConnectionString, string? DatabaseName)> GetConnectionStringAsync(string? machine)
        {
            if (string.IsNullOrWhiteSpace(machine))
            {
                var defaultConnection = _config.GetConnectionString("DefaultConnection");
                if (string.IsNullOrWhiteSpace(defaultConnection))
                {
                    throw new InvalidOperationException("Varsayılan veritabanı bağlantısı yapılandırılmamış");
                }

                return (defaultConnection, null);
            }

            var (databaseName, _) = await ResolveMachineAsync(machine);
            var connectionString = _machineDatabaseService.GetConnectionString(databaseName);
            return (connectionString, databaseName);
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

        private async Task EnsureShiftTablesAsync(SqlConnection connection)
        {
            var ensureSql = @"
                IF OBJECT_ID('shift_templates', 'U') IS NULL
                BEGIN
                    CREATE TABLE shift_templates (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(200) NOT NULL,
                        start_time TIME NOT NULL,
                        end_time TIME NOT NULL,
                        duration_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
                        color NVARCHAR(20) NOT NULL DEFAULT '#ff0000'
                    );
                END;
                ELSE IF COLUMNPROPERTY(OBJECT_ID('shift_templates'), 'id', 'IsIdentity') <> 1
                BEGIN
                    SELECT id, name, start_time, end_time, duration_hours, color INTO #tmp_shift_templates FROM shift_templates;
                    DROP TABLE shift_templates;
                    CREATE TABLE shift_templates (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(200) NOT NULL,
                        start_time TIME NOT NULL,
                        end_time TIME NOT NULL,
                        duration_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
                        color NVARCHAR(20) NOT NULL DEFAULT '#ff0000'
                    );
                    SET IDENTITY_INSERT shift_templates ON;
                    INSERT INTO shift_templates (id, name, start_time, end_time, duration_hours, color)
                    SELECT id, name, start_time, end_time, duration_hours, color FROM #tmp_shift_templates ORDER BY id;
                    SET IDENTITY_INSERT shift_templates OFF;
                    DROP TABLE #tmp_shift_templates;
                END;

                IF COL_LENGTH('shift_templates', 'color') IS NULL
                BEGIN
                    ALTER TABLE shift_templates ADD color NVARCHAR(20) NOT NULL DEFAULT '#ff0000';
                END;

                IF COL_LENGTH('shift_templates', 'duration_hours') IS NULL
                BEGIN
                    ALTER TABLE shift_templates ADD duration_hours DECIMAL(10,2) NOT NULL DEFAULT 0;
                END;

                IF OBJECT_ID('shift_groups', 'U') IS NULL
                BEGIN
                    CREATE TABLE shift_groups (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(50) NOT NULL UNIQUE,
                        description NVARCHAR(200) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
                    );
                END;

                IF COL_LENGTH('shift_groups', 'description') IS NULL
                BEGIN
                    ALTER TABLE shift_groups ADD description NVARCHAR(200) NULL;
                END;

                IF COL_LENGTH('shift_groups', 'created_at') IS NULL
                BEGIN
                    ALTER TABLE shift_groups ADD created_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF COL_LENGTH('shift_groups', 'updated_at') IS NULL
                BEGIN
                    ALTER TABLE shift_groups ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF OBJECT_ID('employees', 'U') IS NULL
                BEGIN
                    CREATE TABLE employees (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(200) NOT NULL,
                        title NVARCHAR(200) NULL,
                        active BIT NOT NULL DEFAULT 1,
                        ShiftGroup NVARCHAR(50) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
                    );
                END;
                ELSE IF COLUMNPROPERTY(OBJECT_ID('employees'), 'id', 'IsIdentity') <> 1
                BEGIN
                    SELECT id, name, title, active, created_at, updated_at, 
                           CASE WHEN COL_LENGTH('employees', 'ShiftGroup') IS NOT NULL THEN ShiftGroup ELSE NULL END AS ShiftGroup
                    INTO #tmp_employees FROM employees;
                    DROP TABLE employees;
                    CREATE TABLE employees (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        name NVARCHAR(200) NOT NULL,
                        title NVARCHAR(200) NULL,
                        active BIT NOT NULL DEFAULT 1,
                        ShiftGroup NVARCHAR(50) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
                    );
                    SET IDENTITY_INSERT employees ON;
                    INSERT INTO employees (id, name, title, active, created_at, updated_at, ShiftGroup)
                    SELECT id, name, title, active, created_at, updated_at, ShiftGroup FROM #tmp_employees ORDER BY id;
                    SET IDENTITY_INSERT employees OFF;
                    DROP TABLE #tmp_employees;
                END;

                IF COL_LENGTH('employees', 'active') IS NULL
                BEGIN
                    ALTER TABLE employees ADD active BIT NOT NULL DEFAULT 1;
                END;

                IF COL_LENGTH('employees', 'ShiftGroup') IS NULL
                BEGIN
                    ALTER TABLE employees ADD ShiftGroup NVARCHAR(50) NULL;
                END;

                IF COL_LENGTH('employees', 'created_at') IS NULL
                BEGIN
                    ALTER TABLE employees ADD created_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF COL_LENGTH('employees', 'updated_at') IS NULL
                BEGIN
                    ALTER TABLE employees ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF OBJECT_ID('shift_assignments', 'U') IS NULL
                BEGIN
                    CREATE TABLE shift_assignments (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        employee_id INT NOT NULL,
                        template_id INT NOT NULL,
                        shift_date DATE NOT NULL,
                        day_of_week INT NOT NULL,
                        is_primary BIT NULL,
                        position NVARCHAR(200) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                        FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE CASCADE
                    );
                END;
                ELSE IF COLUMNPROPERTY(OBJECT_ID('shift_assignments'), 'id', 'IsIdentity') <> 1
                BEGIN
                    SELECT id, employee_id, template_id, shift_date, day_of_week, is_primary, position, created_at, updated_at
                    INTO #tmp_shift_assignments
                    FROM shift_assignments;

                    DROP TABLE shift_assignments;

                    CREATE TABLE shift_assignments (
                        id INT IDENTITY(1,1) PRIMARY KEY,
                        employee_id INT NOT NULL,
                        template_id INT NOT NULL,
                        shift_date DATE NOT NULL,
                        day_of_week INT NOT NULL,
                        is_primary BIT NULL,
                        position NVARCHAR(200) NULL,
                        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                        FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE CASCADE
                    );

                    SET IDENTITY_INSERT shift_assignments ON;
                    INSERT INTO shift_assignments (id, employee_id, template_id, shift_date, day_of_week, is_primary, position, created_at, updated_at)
                    SELECT id, employee_id, template_id, shift_date, day_of_week, is_primary, position, created_at, updated_at
                    FROM #tmp_shift_assignments
                    ORDER BY id;
                    SET IDENTITY_INSERT shift_assignments OFF;

                    DROP TABLE #tmp_shift_assignments;
                END;

                IF COL_LENGTH('shift_assignments', 'is_primary') IS NULL
                BEGIN
                    ALTER TABLE shift_assignments ADD is_primary BIT NULL;
                END;

                IF COL_LENGTH('shift_assignments', 'position') IS NULL
                BEGIN
                    ALTER TABLE shift_assignments ADD position NVARCHAR(200) NULL;
                END;

                IF COL_LENGTH('shift_assignments', 'created_at') IS NULL
                BEGIN
                    ALTER TABLE shift_assignments ADD created_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;

                IF COL_LENGTH('shift_assignments', 'updated_at') IS NULL
                BEGIN
                    ALTER TABLE shift_assignments ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
                END;
            ";

            await using var command = new SqlCommand(ensureSql, connection);
            await command.ExecuteNonQueryAsync();
        }

        private void LogConnection(string action, string connectionString, string? machine, string? databaseName, int count)
        {
            try
            {
                var builder = new SqlConnectionStringBuilder(connectionString);
                if (!EnableVerboseLogging)
                {
                    return;
                }

                Console.WriteLine($"[ShiftManagement] {action}. Machine={machine ?? "default"} Database={databaseName ?? builder.InitialCatalog} Server={builder.DataSource} Count={count}");
            }
            catch
            {
                // Ignore logging failures
            }
        }
    }

    // Request modelleri
    public class CreateShiftTemplateRequest
    {
        public string Name { get; set; } = "";
        public string StartTime { get; set; } = "";
        public string EndTime { get; set; } = "";
        public decimal DurationHours { get; set; }
        public string Color { get; set; } = "#ff0000";
    }

    public class CreateEmployeeRequest
    {
        public string Name { get; set; } = "";
        public string? Title { get; set; }
        public string? ShiftGroup { get; set; }
        public bool Active { get; set; } = true;
    }

    public class CreateShiftGroupRequest
    {
        public string Name { get; set; } = "";
        public string? Description { get; set; }
    }

    public class CreateAssignmentRequest
    {
        public int EmployeeId { get; set; }
        public int TemplateId { get; set; }
        public string ShiftDate { get; set; } = "";
        public int DayOfWeek { get; set; }
    }

    public class BulkAssignmentRequest
    {
        public List<CreateAssignmentRequest> Assignments { get; set; } = new();
    }

    public class MultiEmployeeAssignmentRequest
    {
        public int TemplateId { get; set; }
        public string ShiftDate { get; set; } = "";
        public int DayOfWeek { get; set; }
        public List<EmployeeAssignment> Employees { get; set; } = new();
    }

    public class EmployeeAssignment
    {
        public int EmployeeId { get; set; }
        public string Position { get; set; } = "Çalışan";
        public bool IsPrimary { get; set; } = false;
    }
}
