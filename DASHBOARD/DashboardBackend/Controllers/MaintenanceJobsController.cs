using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/jobs")]
    [Authorize]
    public class MaintenanceJobsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;

        public MaintenanceJobsController(MaintenanceErpDbContext context)
        {
            _context = context;
        }

        public class JobFilter
        {
            public DateTime? Start { get; set; }
            public DateTime? End { get; set; }
            public int? MachineId { get; set; }
            public string? Type { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public int? OperatorId { get; set; }
            public int? GroupId { get; set; }
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] JobFilter filter)
        {
            var query = _context.Jobs
                .Include(x => x.Photos)
                .AsQueryable();

            if (filter.MachineId.HasValue && filter.MachineId > 0)
                query = query.Where(x => x.MachineId == filter.MachineId);
            if (!string.IsNullOrWhiteSpace(filter.Type))
                query = query.Where(x => x.Type == filter.Type);
            if (filter.CategoryId.HasValue && filter.CategoryId > 0)
                query = query.Where(x => x.CategoryId == filter.CategoryId);
            if (filter.CauseId.HasValue && filter.CauseId > 0)
                query = query.Where(x => x.CauseId == filter.CauseId);
            if (filter.OperatorId.HasValue && filter.OperatorId > 0)
                query = query.Where(x => x.OperatorId == filter.OperatorId);
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

        public class JobRequest
        {
            public string Type { get; set; } = "maintenance";
            public int MachineId { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public int? OperatorId { get; set; }
            public string? ResponsibleOperator { get; set; }
            public DateTime? StartedAt { get; set; }
            public DateTime? EndedAt { get; set; }
            public string? Notes { get; set; }
            public int CreatedByUserId { get; set; }
            public int? PerformedByUserId { get; set; }
            public bool IsBackdated { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] JobRequest request)
        {
            if (request.MachineId <= 0) return BadRequest("MachineId is required");

            var job = new MaintenanceJob
            {
                Type = string.IsNullOrWhiteSpace(request.Type) ? "maintenance" : request.Type,
                MachineId = request.MachineId,
                CategoryId = request.CategoryId,
                CauseId = request.CauseId,
                OperatorId = request.OperatorId,
                ResponsibleOperator = request.ResponsibleOperator,
                StartedAt = request.StartedAt,
                EndedAt = request.EndedAt,
                Notes = request.Notes,
                CreatedByUserId = request.CreatedByUserId,
                PerformedByUserId = request.PerformedByUserId,
                IsBackdated = request.IsBackdated,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            if (job.StartedAt.HasValue && job.EndedAt.HasValue)
            {
                job.DurationMinutes = (int)Math.Max(0, Math.Round((job.EndedAt.Value - job.StartedAt.Value).TotalMinutes));
            }

            _context.Jobs.Add(job);
            await _context.SaveChangesAsync();
            return Ok(job);
        }

        public class JobUpdateRequest
        {
            public string? Type { get; set; }
            public int? CategoryId { get; set; }
            public int? CauseId { get; set; }
            public int? OperatorId { get; set; }
            public string? ResponsibleOperator { get; set; }
            public DateTime? StartedAt { get; set; }
            public DateTime? EndedAt { get; set; }
            public string? Notes { get; set; }
            public bool? IsBackdated { get; set; }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] JobUpdateRequest request)
        {
            var job = await _context.Jobs.FindAsync(id);
            if (job == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(request.Type)) job.Type = request.Type;
            if (request.CategoryId.HasValue) job.CategoryId = request.CategoryId;
            if (request.CauseId.HasValue) job.CauseId = request.CauseId;
            if (request.OperatorId.HasValue) job.OperatorId = request.OperatorId;
            if (request.IsBackdated.HasValue) job.IsBackdated = request.IsBackdated.Value;
            job.ResponsibleOperator = request.ResponsibleOperator ?? job.ResponsibleOperator;
            job.StartedAt = request.StartedAt ?? job.StartedAt;
            job.EndedAt = request.EndedAt ?? job.EndedAt;
            job.Notes = request.Notes ?? job.Notes;
            if (job.StartedAt.HasValue && job.EndedAt.HasValue)
            {
                job.DurationMinutes = (int)Math.Max(0, Math.Round((job.EndedAt.Value - job.StartedAt.Value).TotalMinutes));
            }
            job.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(job);
        }

        public class PhotoRequest
        {
            public string FileUrl { get; set; } = string.Empty;
            public string? AnnotationJson { get; set; }
        }

        [HttpPost("{id:int}/photos")]
        public async Task<IActionResult> AddPhoto(int id, [FromBody] PhotoRequest request)
        {
            var job = await _context.Jobs.FindAsync(id);
            if (job == null) return NotFound();

            var photo = new MaintenanceJobPhoto
            {
                JobId = id,
                FileUrl = request.FileUrl,
                AnnotationJson = request.AnnotationJson,
                CreatedAt = DateTime.UtcNow
            };
            _context.JobPhotos.Add(photo);
            await _context.SaveChangesAsync();
            return Ok(photo);
        }
    }
}

