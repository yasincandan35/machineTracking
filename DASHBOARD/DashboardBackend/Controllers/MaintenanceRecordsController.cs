using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/records")]
    [Authorize]
    public class MaintenanceRecordsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;
        private readonly DashboardDbContext _dashboardContext;
        private readonly ILogger<MaintenanceRecordsController> _logger;

        public MaintenanceRecordsController(MaintenanceErpDbContext context, DashboardDbContext dashboardContext, ILogger<MaintenanceRecordsController> logger)
        {
            _context = context;
            _dashboardContext = dashboardContext;
            _logger = logger;
        }

        public class RecordFilter
        {
            public DateTime? Start { get; set; }
            public DateTime? End { get; set; }
            public int? MachineGroupId { get; set; }
            public int? MachineId { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public int? OperatorId { get; set; }
            public string? Type { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] RecordFilter filter)
        {
            var query = _context.MaintenanceRecords.AsQueryable();

            if (filter.MachineGroupId.HasValue && filter.MachineGroupId > 0)
                query = query.Where(x => x.MachineGroupId == filter.MachineGroupId);
            if (filter.MachineId.HasValue && filter.MachineId > 0)
                query = query.Where(x => x.MachineId == filter.MachineId);
            if (filter.CategoryId.HasValue && filter.CategoryId > 0)
                query = query.Where(x => x.CategoryId == filter.CategoryId);
            if (filter.CauseId.HasValue && filter.CauseId > 0)
                query = query.Where(x => x.CauseId == filter.CauseId);
            if (filter.OperatorId.HasValue && filter.OperatorId > 0)
                query = query.Where(x => x.OperatorId == filter.OperatorId);
            if (!string.IsNullOrWhiteSpace(filter.Type))
                query = query.Where(x => x.Type == filter.Type);
            if (filter.Start.HasValue)
                query = query.Where(x => x.CreatedAt >= filter.Start);
            if (filter.End.HasValue)
                query = query.Where(x => x.CreatedAt <= filter.End);

            // Önce verileri çek (sadece MaintenanceErpDbContext kullanarak)
            var data = await query
                .OrderByDescending(x => x.CreatedAt)
                .Take(500)
                .Select(x => new
                {
                    x.Id,
                    x.Type,
                    x.MachineGroupId,
                    x.MachineId,
                    x.CategoryId,
                    x.CauseId,
                    x.OperatorId,
                    x.Responsible,
                    x.StartedAt,
                    x.EndedAt,
                    x.DurationMinutes,
                    x.Notes,
                    PhotoData = x.PhotoData != null ? "exists" : null, // Sadece varlığını gönder, base64 veriyi değil
                    MaterialsJson = x.MaterialsJson, // Materials küçük, gönderebiliriz
                    x.CreatedAt,
                    x.CreatedByUserId,
                    x.PerformedByUserId,
                    x.IsBackdated,
                    x.UpdatedAt
                })
                .ToListAsync();

            // Kullanıcı ID'lerini topla ve tek sorguda kullanıcı adlarını çek
            var userIds = data.Select(x => x.CreatedByUserId).Distinct().Where(id => id > 0).ToList();
            var userNameDict = new Dictionary<int, string>();
            
            if (userIds.Any())
            {
                // SQL Server'da Contains sorun çıkarabiliyor, bu yüzden tüm kullanıcıları çekip memory'de filtreliyoruz
                // (Kullanıcı sayısı genelde az olduğu için performans sorunu olmaz)
                var allUsers = await _dashboardContext.Users
                    .Select(u => new { u.Id, u.Username })
                    .ToListAsync();
                
                userNameDict = allUsers
                    .Where(u => userIds.Contains(u.Id))
                    .ToDictionary(u => u.Id, u => u.Username ?? "Bilinmeyen");
            }

            // Kullanıcı adlarını ekle
            var result = data.Select(x => new
            {
                x.Id,
                x.Type,
                x.MachineGroupId,
                x.MachineId,
                x.CategoryId,
                x.CauseId,
                x.OperatorId,
                x.Responsible,
                x.StartedAt,
                x.EndedAt,
                x.DurationMinutes,
                x.Notes,
                x.PhotoData,
                x.MaterialsJson,
                x.CreatedAt,
                x.CreatedByUserId,
                CreatedByUserName = userNameDict.GetValueOrDefault(x.CreatedByUserId, "Bilinmeyen"),
                x.PerformedByUserId,
                x.IsBackdated,
                x.UpdatedAt
            }).ToList();

            var summary = new
            {
                total = result.Count,
                totalDuration = result.Sum(x => x.DurationMinutes ?? 0),
                avgDuration = result.Count == 0 ? 0 : (int)Math.Round(result.Sum(x => x.DurationMinutes ?? 0) / (double)result.Count)
            };

            return Ok(new { items = result, summary });
        }

        public class MaterialDto
        {
            public string Name { get; set; } = string.Empty;
            public decimal? Quantity { get; set; }
            public string? Unit { get; set; }
            public string? Note { get; set; }
        }

        public class RecordRequest
        {
            public string Type { get; set; } = "maintenance";
            public int MachineGroupId { get; set; }
            public int? MachineId { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public int? OperatorId { get; set; }
            public string? Responsible { get; set; }
            public DateTime? StartedAt { get; set; }
            public DateTime? EndedAt { get; set; }
            public string? Notes { get; set; }
            public string? PhotoData { get; set; }
            public List<MaterialDto>? Materials { get; set; }
            public int CreatedByUserId { get; set; }
            public int? PerformedByUserId { get; set; }
            public bool IsBackdated { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] RecordRequest request)
        {
            if (request.MachineGroupId <= 0) return BadRequest("MachineGroupId is required");

            var rec = new MaintenanceRecord
            {
                Type = string.IsNullOrWhiteSpace(request.Type) ? "maintenance" : request.Type,
                MachineGroupId = request.MachineGroupId,
                MachineId = request.MachineId,
                CategoryId = request.CategoryId,
                CauseId = request.CauseId,
                OperatorId = request.OperatorId,
                Responsible = request.Responsible,
                StartedAt = request.StartedAt,
                EndedAt = request.EndedAt,
                Notes = request.Notes,
                PhotoData = request.PhotoData,
                MaterialsJson = request.Materials != null ? System.Text.Json.JsonSerializer.Serialize(request.Materials) : null,
                CreatedByUserId = request.CreatedByUserId,
                PerformedByUserId = request.PerformedByUserId,
                IsBackdated = request.IsBackdated,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            if (rec.StartedAt.HasValue && rec.EndedAt.HasValue)
            {
                rec.DurationMinutes = (int)Math.Max(0, Math.Round((rec.EndedAt.Value - rec.StartedAt.Value).TotalMinutes));
            }

            _context.MaintenanceRecords.Add(rec);
            await _context.SaveChangesAsync();
            return Ok(rec);
        }

        public class RecordUpdateRequest
        {
            public string? Notes { get; set; }
            public DateTime? StartedAt { get; set; }
            public DateTime? EndedAt { get; set; }
            public string? PhotoData { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public List<MaterialDto>? Materials { get; set; }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] RecordUpdateRequest request)
        {
            var rec = await _context.MaintenanceRecords.FindAsync(id);
            if (rec == null) return NotFound();

            if (request.Notes != null) rec.Notes = request.Notes;
            if (request.StartedAt.HasValue) rec.StartedAt = request.StartedAt;
            if (request.EndedAt.HasValue) rec.EndedAt = request.EndedAt;
            if (request.PhotoData != null)
            {
                // PhotoData can be JSON array or single base64 string
                // Store as-is (already JSON stringified if array)
                rec.PhotoData = request.PhotoData;
            }
            if (request.CategoryId.HasValue) rec.CategoryId = request.CategoryId;
            if (request.CauseId.HasValue) rec.CauseId = request.CauseId;
            if (request.Materials != null && request.Materials.Count > 0)
            {
                rec.MaterialsJson = System.Text.Json.JsonSerializer.Serialize(request.Materials);
            }
            else if (request.Materials != null && request.Materials.Count == 0)
            {
                // Empty array means clear materials
                rec.MaterialsJson = null;
            }

            if (rec.StartedAt.HasValue && rec.EndedAt.HasValue)
            {
                rec.DurationMinutes = (int)Math.Max(0, Math.Round((rec.EndedAt.Value - rec.StartedAt.Value).TotalMinutes));
            }

            rec.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();
            return Ok(rec);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                _logger.LogInformation($"[DELETE] MaintenanceRecord silme işlemi başlatıldı - ID: {id}");
                Console.WriteLine($"[DELETE] MaintenanceRecord silme işlemi başlatıldı - ID: {id}");
                
                // Önce kayıt var mı kontrol et (hızlı sorgu)
                var exists = await _context.MaintenanceRecords
                    .AsNoTracking()
                    .AnyAsync(r => r.Id == id);
                    
                if (!exists)
                {
                    _logger.LogWarning($"[DELETE] Kayıt bulunamadı - ID: {id}");
                    Console.WriteLine($"[DELETE] Kayıt bulunamadı - ID: {id}");
                    return NotFound(new { message = "Kayıt bulunamadı" });
                }

                _logger.LogInformation($"[DELETE] Kayıt var, silme işlemi başlatılıyor - ID: {id}");
                Console.WriteLine($"[DELETE] Kayıt var, silme işlemi başlatılıyor - ID: {id}");
                
                // SQL ile direkt sil (EF Core'dan daha hızlı ve güvenilir)
                var connection = _context.Database.GetDbConnection();
                await connection.OpenAsync();
                
                try
                {
                    using var command = connection.CreateCommand();
                    command.CommandText = "DELETE FROM maintenanceRecords WHERE Id = @id";
                    var param = command.CreateParameter();
                    param.ParameterName = "@id";
                    param.Value = id;
                    param.DbType = DbType.Int32;
                    command.Parameters.Add(param);
                    
                    _logger.LogInformation($"[DELETE] SQL DELETE komutu çalıştırılıyor...");
                    Console.WriteLine($"[DELETE] SQL DELETE komutu çalıştırılıyor...");
                    var startTime = DateTime.Now;
                    
                    var rowsAffected = await command.ExecuteNonQueryAsync();
                    var duration = (DateTime.Now - startTime).TotalMilliseconds;
                    
                    _logger.LogInformation($"[DELETE] SQL DELETE tamamlandı - ID: {id}, Etkilenen satır: {rowsAffected}, Süre: {duration}ms");
                    Console.WriteLine($"[DELETE] SQL DELETE tamamlandı - ID: {id}, Etkilenen satır: {rowsAffected}, Süre: {duration}ms");
                    
                    if (rowsAffected == 0)
                    {
                        return NotFound(new { message = "Kayıt bulunamadı" });
                    }
                }
                finally
                {
                    await connection.CloseAsync();
                }
                
                return NoContent();
            }
            catch (OperationCanceledException)
            {
                _logger.LogError($"[DELETE] Timeout - ID: {id}, SaveChangesAsync 30 saniye içinde tamamlanamadı");
                Console.Error.WriteLine($"[DELETE] Timeout - ID: {id}, SaveChangesAsync 30 saniye içinde tamamlanamadı");
                return StatusCode(500, new { message = "Silme işlemi zaman aşımına uğradı" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"[DELETE] Hata oluştu - ID: {id}, Error: {ex.Message}");
                Console.Error.WriteLine($"[DELETE] Hata oluştu - ID: {id}, Error: {ex.Message}");
                Console.Error.WriteLine($"[DELETE] StackTrace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.Error.WriteLine($"[DELETE] InnerException: {ex.InnerException.Message}");
                }
                return StatusCode(500, new { message = "Silme işlemi sırasında hata oluştu", error = ex.Message });
            }
        }
    }
}

