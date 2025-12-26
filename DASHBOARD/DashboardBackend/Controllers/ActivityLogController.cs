using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using System.Text.Json;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ActivityLogController : ControllerBase
    {
        private readonly DashboardDbContext _context;

        public ActivityLogController(DashboardDbContext context)
        {
            _context = context;
        }

        // POST: api/activitylog/log
        [HttpPost("log")]
        public async Task<IActionResult> LogActivity([FromBody] ActivityLogRequest request)
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            try
            {
                var log = new UserActivityLog
                {
                    UserId = int.Parse(userId),
                    EventType = request.EventType,
                    Page = request.Page,
                    Tab = request.Tab,
                    SubTab = request.SubTab,
                    MachineId = request.MachineId,
                    MachineName = request.MachineName,
                    Action = request.Action,
                    Details = request.Details != null ? JsonSerializer.Serialize(request.Details) : null,
                    Duration = request.Duration,
                    Timestamp = DateTime.Now,
                    SessionId = request.SessionId
                };

                _context.UserActivityLogs.Add(log);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Activity logged", logId = log.Id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Activity log error: {ex.Message}");
                return StatusCode(500, new { message = "Activity log kaydedilemedi", error = ex.Message });
            }
        }

        // POST: api/activitylog/log-batch (Birden fazla log'u toplu kaydetmek için)
        [HttpPost("log-batch")]
        public async Task<IActionResult> LogActivityBatch([FromBody] List<ActivityLogRequest> requests)
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            try
            {
                var logs = requests.Select(request => new UserActivityLog
                {
                    UserId = int.Parse(userId),
                    EventType = request.EventType,
                    Page = request.Page,
                    Tab = request.Tab,
                    SubTab = request.SubTab,
                    MachineId = request.MachineId,
                    MachineName = request.MachineName,
                    Action = request.Action,
                    Details = request.Details != null ? JsonSerializer.Serialize(request.Details) : null,
                    Duration = request.Duration,
                    Timestamp = DateTime.Now,
                    SessionId = request.SessionId
                }).ToList();

                _context.UserActivityLogs.AddRange(logs);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Activities logged", count = logs.Count });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Activity log batch error: {ex.Message}");
                return StatusCode(500, new { message = "Activity logs kaydedilemedi", error = ex.Message });
            }
        }

        // GET: api/activitylog/user/{userId} (Admin - belirli kullanıcının logları)
        [HttpGet("user/{userId}")]
        [Authorize] // Admin kontrolü eklenebilir
        public async Task<IActionResult> GetUserLogs(int userId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int page = 1, [FromQuery] int pageSize = 100)
        {
            IQueryable<UserActivityLog> query = _context.UserActivityLogs
                .Where(l => l.UserId == userId);

            if (startDate.HasValue)
                query = query.Where(l => l.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.Timestamp <= endDate.Value);

            var totalCount = await query.CountAsync();
            
            var orderedQuery = query.OrderByDescending(l => l.Timestamp);
            var logs = await orderedQuery
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(l => new
                {
                    l.Id,
                    l.EventType,
                    l.Page,
                    l.Tab,
                    l.SubTab,
                    l.MachineId,
                    l.MachineName,
                    l.Action,
                    l.Details,
                    l.Duration,
                    l.Timestamp,
                    l.SessionId
                })
                .ToListAsync();

            return Ok(new
            {
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                logs
            });
        }

        // GET: api/activitylog/user/{userId}/statistics
        [HttpGet("user/{userId}/statistics")]
        [Authorize]
        public async Task<IActionResult> GetUserStatistics(int userId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var query = _context.UserActivityLogs.Where(l => l.UserId == userId);

            if (startDate.HasValue)
                query = query.Where(l => l.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.Timestamp <= endDate.Value);

            var logs = await query.ToListAsync();

            // En çok kullanılan sayfa
            var pageStats = logs
                .Where(l => !string.IsNullOrEmpty(l.Page))
                .GroupBy(l => l.Page)
                .Select(g => new { Page = g.Key, Count = g.Count(), TotalDuration = g.Where(l => l.Duration.HasValue).Sum(l => l.Duration.Value) })
                .OrderByDescending(x => x.Count)
                .ToList();

            // En çok kullanılan tab
            var tabStats = logs
                .Where(l => !string.IsNullOrEmpty(l.Tab))
                .GroupBy(l => l.Tab)
                .Select(g => new { Tab = g.Key, Count = g.Count(), TotalDuration = g.Where(l => l.Duration.HasValue).Sum(l => l.Duration.Value) })
                .OrderByDescending(x => x.Count)
                .ToList();

            // En çok kullanılan makine
            var machineStats = logs
                .Where(l => l.MachineId.HasValue)
                .GroupBy(l => new { l.MachineId, l.MachineName })
                .Select(g => new { MachineId = g.Key.MachineId, MachineName = g.Key.MachineName, Count = g.Count() })
                .OrderByDescending(x => x.Count)
                .ToList();

            // Toplam aktif süre (saniye cinsinden)
            var totalActiveDuration = logs.Where(l => l.Duration.HasValue).Sum(l => l.Duration.Value);

            // Günlük aktivite dağılımı
            var dailyActivity = logs
                .GroupBy(l => l.Timestamp.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Count = g.Count(),
                    TotalDuration = g.Where(l => l.Duration.HasValue).Sum(l => l.Duration.Value)
                })
                .OrderBy(x => x.Date)
                .ToList();

            // Saatlik aktivite dağılımı
            var hourlyActivity = logs
                .GroupBy(l => l.Timestamp.Hour)
                .Select(g => new
                {
                    Hour = g.Key,
                    Count = g.Count(),
                    TotalDuration = g.Where(l => l.Duration.HasValue).Sum(l => l.Duration.Value)
                })
                .OrderBy(x => x.Hour)
                .ToList();

            return Ok(new
            {
                totalLogs = logs.Count,
                totalActiveDurationSeconds = totalActiveDuration,
                totalActiveDurationHours = Math.Round(totalActiveDuration / 3600.0, 2),
                pageStats,
                tabStats,
                machineStats,
                dailyActivity,
                hourlyActivity
            });
        }

        // GET: api/activitylog/user/{userId}/timeline
        [HttpGet("user/{userId}/timeline")]
        [Authorize]
        public async Task<IActionResult> GetUserTimeline(int userId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, [FromQuery] int limit = 500)
        {
            IQueryable<UserActivityLog> query = _context.UserActivityLogs
                .Where(l => l.UserId == userId);

            if (startDate.HasValue)
                query = query.Where(l => l.Timestamp >= startDate.Value);

            if (endDate.HasValue)
                query = query.Where(l => l.Timestamp <= endDate.Value);

            var orderedQuery = query.OrderByDescending(l => l.Timestamp);
            var logs = await orderedQuery
                .Take(limit)
                .Select(l => new
                {
                    l.Id,
                    l.EventType,
                    l.Page,
                    l.Tab,
                    l.SubTab,
                    l.MachineId,
                    l.MachineName,
                    l.Action,
                    l.Details,
                    l.Duration,
                    l.Timestamp,
                    l.SessionId
                })
                .ToListAsync();

            return Ok(logs);
        }
    }

    // Request model
    public class ActivityLogRequest
    {
        public string EventType { get; set; } = string.Empty;
        public string? Page { get; set; }
        public string? Tab { get; set; }
        public string? SubTab { get; set; }
        public int? MachineId { get; set; }
        public string? MachineName { get; set; }
        public string? Action { get; set; }
        public object? Details { get; set; }
        public int? Duration { get; set; }
        public string? SessionId { get; set; }
    }
}

