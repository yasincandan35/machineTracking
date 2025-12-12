using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MachineAnnouncementsController : ControllerBase
    {
        private readonly DashboardDbContext _dashboardContext;
        private readonly MachineDatabaseService _machineDbService;

        public MachineAnnouncementsController(DashboardDbContext dashboardContext, MachineDatabaseService machineDbService)
        {
            _dashboardContext = dashboardContext;
            _machineDbService = machineDbService;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId)) return null;
            if (!int.TryParse(userId, out var id)) return null;
            return await _dashboardContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }

        private string? ResolveMachineName(string? machineFromQuery, User? currentUser)
        {
            if (!string.IsNullOrWhiteSpace(machineFromQuery))
            {
                return machineFromQuery.Trim();
            }

            if (!string.IsNullOrWhiteSpace(currentUser?.AssignedMachineTable))
            {
                return currentUser.AssignedMachineTable.Trim();
            }

            return null;
        }

        // GET: api/machineannouncements/active
        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<object>>> GetActiveAnnouncements()
        {
            var currentUser = await GetCurrentUserAsync();
            var machine = ResolveMachineName(Request.Query["machine"].FirstOrDefault(), currentUser);
            if (string.IsNullOrWhiteSpace(machine))
            {
                return BadRequest(new { message = "Makine parametresi zorunludur" });
            }

            await using var machineDb = _machineDbService.CreateDbContext(machine);

            var announcements = await machineDb.MachineAnnouncements
                .Where(a => a.IsActive)
                .OrderByDescending(a => a.CreatedAt)
                .Select(a => new
                {
                    a.Id,
                    a.Message,
                    a.CreatedAt,
                    a.CreatedBy
                })
                .ToListAsync();

            return Ok(announcements);
        }

        // GET: api/machineannouncements
        [HttpGet]
        [Authorize(Roles = "admin,engineer")]
        public async Task<ActionResult<IEnumerable<MachineAnnouncement>>> GetAll()
        {
            var currentUser = await GetCurrentUserAsync();
            var machine = ResolveMachineName(Request.Query["machine"].FirstOrDefault(), currentUser);
            if (string.IsNullOrWhiteSpace(machine))
            {
                return BadRequest(new { message = "Makine parametresi zorunludur" });
            }

            await using var machineDb = _machineDbService.CreateDbContext(machine);

            var announcements = await machineDb.MachineAnnouncements
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(announcements);
        }

        public class CreateAnnouncementRequest
        {
            public string Message { get; set; } = string.Empty;
            public bool IsActive { get; set; } = true;
        }

        // POST: api/machineannouncements
        [HttpPost]
        [Authorize(Roles = "admin,engineer")]
        public async Task<ActionResult<object>> CreateAnnouncement([FromBody] CreateAnnouncementRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "Duyuru metni zorunludur" });
            }

            var currentUser = await GetCurrentUserAsync();
            var machine = ResolveMachineName(Request.Query["machine"].FirstOrDefault(), currentUser);
            if (string.IsNullOrWhiteSpace(machine))
            {
                return BadRequest(new { message = "Makine parametresi zorunludur" });
            }

            await using var machineDb = _machineDbService.CreateDbContext(machine);

            var announcement = new MachineAnnouncement
            {
                Message = request.Message.Trim(),
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = currentUser?.Username
            };

            machineDb.MachineAnnouncements.Add(announcement);
            await machineDb.SaveChangesAsync();

            return CreatedAtAction(nameof(GetActiveAnnouncements), new { id = announcement.Id }, new
            {
                announcement.Id,
                announcement.Message,
                announcement.IsActive,
                announcement.CreatedAt,
                announcement.CreatedBy
            });
        }

        // DELETE: api/machineannouncements/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "admin,engineer")]
        public async Task<IActionResult> DeleteAnnouncement(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            var machine = ResolveMachineName(Request.Query["machine"].FirstOrDefault(), currentUser);
            if (string.IsNullOrWhiteSpace(machine))
            {
                return BadRequest(new { message = "Makine parametresi zorunludur" });
            }

            await using var machineDb = _machineDbService.CreateDbContext(machine);

            var announcement = await machineDb.MachineAnnouncements.FindAsync(id);
            if (announcement == null)
            {
                return NotFound();
            }

            machineDb.MachineAnnouncements.Remove(announcement);
            await machineDb.SaveChangesAsync();

            return NoContent();
        }
    }
}

