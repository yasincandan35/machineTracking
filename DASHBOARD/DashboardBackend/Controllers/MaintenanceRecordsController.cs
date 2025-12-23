using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/records")]
    [Authorize]
    public class MaintenanceRecordsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;

        public MaintenanceRecordsController(MaintenanceErpDbContext context)
        {
            _context = context;
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

            var data = await query
                .OrderByDescending(x => x.CreatedAt)
                .Take(500)
                .ToListAsync();

            var summary = new
            {
                total = data.Count,
                totalDuration = data.Sum(x => x.DurationMinutes ?? 0),
                avgDuration = data.Count == 0 ? 0 : (int)Math.Round(data.Sum(x => x.DurationMinutes ?? 0) / (double)data.Count)
            };

            return Ok(new { items = data, summary });
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
            var rec = await _context.MaintenanceRecords.FindAsync(id);
            if (rec == null) return NotFound();

            _context.MaintenanceRecords.Remove(rec);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}

