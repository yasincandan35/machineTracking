using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/groups")]
    [Authorize]
    public class MaintenanceGroupsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;

        public MaintenanceGroupsController(MaintenanceErpDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetGroups()
        {
            var groups = await _context.Groups
                .Include(g => g.Members)
                .ToListAsync();
            return Ok(groups);
        }

        public class GroupRequest
        {
            public string Name { get; set; } = string.Empty;
            public int CreatedByUserId { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] GroupRequest request)
        {
            var group = new MaintenanceGroup
            {
                Name = request.Name,
                CreatedByUserId = request.CreatedByUserId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Groups.Add(group);
            await _context.SaveChangesAsync();
            return Ok(group);
        }

        public class MemberRequest
        {
            public int UserId { get; set; }
            public int? InvitedByUserId { get; set; }
        }

        [HttpPost("{groupId:int}/members")]
        public async Task<IActionResult> InviteMember(int groupId, [FromBody] MemberRequest request)
        {
            var exists = await _context.Groups.AnyAsync(g => g.Id == groupId);
            if (!exists) return NotFound();

            var member = await _context.GroupMembers.FindAsync(groupId, request.UserId);
            if (member != null) return Ok(member);

            member = new MaintenanceGroupMember
            {
                GroupId = groupId,
                UserId = request.UserId,
                Status = "pending",
                InvitedByUserId = request.InvitedByUserId
            };
            _context.GroupMembers.Add(member);
            await _context.SaveChangesAsync();
            return Ok(member);
        }

        public class ApproveRequest
        {
            public int UserId { get; set; }
        }

        [HttpPost("{groupId:int}/approve")]
        public async Task<IActionResult> Approve(int groupId, [FromBody] ApproveRequest request)
        {
            var member = await _context.GroupMembers.FindAsync(groupId, request.UserId);
            if (member == null) return NotFound();
            member.Status = "approved";
            member.ApprovedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(member);
        }
    }
}

