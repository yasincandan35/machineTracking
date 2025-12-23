using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/shifts")]
    [Authorize]
    public class MaintenanceShiftsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;

        public MaintenanceShiftsController(MaintenanceErpDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] int? machineId, [FromQuery] DateTime? date)
        {
            var query = _context.Shifts.AsQueryable();
            if (machineId.HasValue && machineId > 0)
                query = query.Where(x => x.MachineId == machineId);
            if (date.HasValue)
                query = query.Where(x => x.ShiftDate == date.Value.Date);

            var data = await query.OrderByDescending(x => x.ShiftDate).ThenBy(x => x.ShiftStart).ToListAsync();
            return Ok(data);
        }

        public class ShiftRequest
        {
            public int MachineId { get; set; }
            public int? OperatorId { get; set; }
            public int? GroupId { get; set; }
            public string? ShiftName { get; set; }
            public DateTime ShiftDate { get; set; }
            public TimeSpan ShiftStart { get; set; }
            public TimeSpan ShiftEnd { get; set; }
            public string? Notes { get; set; }
            public int CreatedByUserId { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] ShiftRequest request)
        {
            if (request.MachineId <= 0) return BadRequest("MachineId is required");

            var shift = new MaintenanceShift
            {
                MachineId = request.MachineId,
                OperatorId = request.OperatorId,
                GroupId = request.GroupId,
                ShiftName = request.ShiftName,
                ShiftDate = request.ShiftDate.Date,
                ShiftStart = request.ShiftStart,
                ShiftEnd = request.ShiftEnd,
                Notes = request.Notes,
                CreatedByUserId = request.CreatedByUserId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Shifts.Add(shift);
            await _context.SaveChangesAsync();
            return Ok(shift);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] ShiftRequest request)
        {
            var shift = await _context.Shifts.FindAsync(id);
            if (shift == null) return NotFound();

            if (request.MachineId > 0) shift.MachineId = request.MachineId;
            shift.OperatorId = request.OperatorId;
            shift.GroupId = request.GroupId;
            shift.ShiftName = request.ShiftName ?? shift.ShiftName;
            shift.ShiftDate = request.ShiftDate == default ? shift.ShiftDate : request.ShiftDate.Date;
            shift.ShiftStart = request.ShiftStart != default ? request.ShiftStart : shift.ShiftStart;
            shift.ShiftEnd = request.ShiftEnd != default ? request.ShiftEnd : shift.ShiftEnd;
            shift.Notes = request.Notes ?? shift.Notes;
            await _context.SaveChangesAsync();
            return Ok(shift);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var shift = await _context.Shifts.FindAsync(id);
            if (shift == null) return NotFound();
            _context.Shifts.Remove(shift);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}

