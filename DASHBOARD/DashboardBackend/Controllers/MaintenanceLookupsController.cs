using DashboardBackend.Data;
using DashboardBackend.Models.MaintenanceErp;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/maintenance/lookups")]
    [Authorize]
    public class MaintenanceLookupsController : ControllerBase
    {
        private readonly MaintenanceErpDbContext _context;

        public MaintenanceLookupsController(MaintenanceErpDbContext context)
        {
            _context = context;
        }

        // Machine Groups
        [HttpGet("machine-groups")]
        public async Task<IActionResult> GetMachineGroups()
        {
            var data = await _context.MachineGroups
                .Where(x => x.IsActive)
                .OrderBy(x => x.Name)
                .ToListAsync();
            return Ok(data);
        }

        [HttpPost("machine-groups")]
        public async Task<IActionResult> CreateMachineGroup([FromBody] MachineGroup model)
        {
            model.Id = 0;
            model.CreatedAt = DateTime.UtcNow;
            model.UpdatedAt = DateTime.UtcNow;
            if (string.IsNullOrWhiteSpace(model.Name))
                return BadRequest("Name is required");
            _context.MachineGroups.Add(model);
            await _context.SaveChangesAsync();
            return Ok(model);
        }

        [HttpPut("machine-groups/{id:int}")]
        public async Task<IActionResult> UpdateMachineGroup(int id, [FromBody] MachineGroup payload)
        {
            var entity = await _context.MachineGroups.FindAsync(id);
            if (entity == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(payload.Name))
                entity.Name = payload.Name;
            entity.IsActive = payload.IsActive;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpDelete("machine-groups/{id:int}")]
        public async Task<IActionResult> DeleteMachineGroup(int id)
        {
            var entity = await _context.MachineGroups.FindAsync(id);
            if (entity == null) return NotFound();
            _context.MachineGroups.Remove(entity);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Machines
        [HttpGet("machines")]
        public async Task<IActionResult> GetMachines([FromQuery] int? machineGroupId)
        {
            var query = _context.Machines.AsQueryable();
            if (machineGroupId.HasValue && machineGroupId > 0)
            {
                query = query.Where(x => x.MachineGroupId == machineGroupId);
            }
            var data = await query.OrderBy(x => x.Name).ToListAsync();
            return Ok(data);
        }

        [HttpPost("machines")]
        public async Task<IActionResult> CreateMachine([FromBody] MaintenanceMachine model)
        {
            model.Id = 0;
            model.CreatedAt = DateTime.UtcNow;
            model.UpdatedAt = DateTime.UtcNow;
            _context.Machines.Add(model);
            await _context.SaveChangesAsync();
            return Ok(model);
        }

        [HttpPut("machines/{id:int}")]
        public async Task<IActionResult> UpdateMachine(int id, [FromBody] MaintenanceMachine payload)
        {
            var entity = await _context.Machines.FindAsync(id);
            if (entity == null) return NotFound();
            entity.Name = payload.Name ?? entity.Name;
            entity.Code = payload.Code;
            entity.IsActive = payload.IsActive;
            entity.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        [HttpDelete("machines/{id:int}")]
        public async Task<IActionResult> DeleteMachine(int id)
        {
            var entity = await _context.Machines.FindAsync(id);
            if (entity == null) return NotFound();
            // Opsiyonel: ilişkili operator/category/cause kontrolü yapılabilir
            _context.Machines.Remove(entity);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Operators (machine scoped)
        [HttpGet("operators")]
        public async Task<IActionResult> GetOperators([FromQuery] int machineId)
        {
            var query = _context.Operators.AsQueryable();
            if (machineId > 0)
                query = query.Where(x => x.MachineId == machineId);
            var data = await query.OrderBy(x => x.Name).ToListAsync();
            return Ok(data);
        }

        public class OperatorRequest
        {
            public int MachineId { get; set; }
            public string Name { get; set; } = string.Empty;
            public int? ExternalUserId { get; set; }
            public bool IsActive { get; set; } = true;
        }

        [HttpPost("operators")]
        public async Task<IActionResult> CreateOperator([FromBody] OperatorRequest model)
        {
            if (model.MachineId <= 0) return BadRequest("MachineId is required");
            var op = new MaintenanceOperator
            {
                MachineId = model.MachineId,
                Name = model.Name,
                ExternalUserId = model.ExternalUserId,
                IsActive = model.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Operators.Add(op);
            await _context.SaveChangesAsync();
            return Ok(op);
        }

        [HttpPut("operators/{id:int}")]
        public async Task<IActionResult> UpdateOperator(int id, [FromBody] OperatorRequest model)
        {
            var op = await _context.Operators.FindAsync(id);
            if (op == null) return NotFound();
            if (model.MachineId > 0) op.MachineId = model.MachineId;
            op.Name = model.Name ?? op.Name;
            op.ExternalUserId = model.ExternalUserId;
            op.IsActive = model.IsActive;
            op.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(op);
        }

        [HttpDelete("operators/{id:int}")]
        public async Task<IActionResult> DeleteOperator(int id)
        {
            var op = await _context.Operators.FindAsync(id);
            if (op == null) return NotFound();
            _context.Operators.Remove(op);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Categories (machine-group scoped)
        public class CategoryRequest
        {
            public int MachineGroupId { get; set; }
            public string Name { get; set; } = string.Empty;
            public bool IsActive { get; set; } = true;
        }

        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories([FromQuery] int machineGroupId)
        {
            var query = _context.Categories.AsQueryable();
            if (machineGroupId > 0)
                query = query.Where(x => x.MachineGroupId == machineGroupId);
            var data = await query.OrderBy(x => x.Name).ToListAsync();
            return Ok(data);
        }

        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] CategoryRequest model)
        {
            if (model.MachineGroupId <= 0) return BadRequest("MachineGroupId is required");
            var cat = new MaintenanceCategory
            {
                MachineGroupId = model.MachineGroupId,
                Name = model.Name,
                IsActive = model.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Categories.Add(cat);
            await _context.SaveChangesAsync();
            return Ok(cat);
        }

        [HttpPut("categories/{id:int}")]
        public async Task<IActionResult> UpdateCategory(int id, [FromBody] CategoryRequest model)
        {
            var cat = await _context.Categories.FindAsync(id);
            if (cat == null) return NotFound();
            if (model.MachineGroupId > 0) cat.MachineGroupId = model.MachineGroupId;
            cat.Name = model.Name ?? cat.Name;
            cat.IsActive = model.IsActive;
            cat.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(cat);
        }

        [HttpDelete("categories/{id:int}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var cat = await _context.Categories.FindAsync(id);
            if (cat == null) return NotFound();
            _context.Categories.Remove(cat);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Causes (machine + category scoped)
        public class CauseRequest
        {
            public int MachineId { get; set; }
            public int CategoryId { get; set; }
            public int MachineGroupId { get; set; }
            public string Name { get; set; } = string.Empty;
            public bool IsActive { get; set; } = true;
        }

        [HttpGet("causes")]
        public async Task<IActionResult> GetCauses([FromQuery] int machineId, [FromQuery] int? categoryId, [FromQuery] int? machineGroupId)
        {
            var query = _context.Causes.AsQueryable();
            if (machineId > 0)
                query = query.Where(x => x.MachineId == machineId);
            if (categoryId.HasValue && categoryId.Value > 0)
                query = query.Where(x => x.CategoryId == categoryId.Value);
            if (machineGroupId.HasValue && machineGroupId > 0)
                query = query.Where(x => x.MachineGroupId == machineGroupId);
            var data = await query.OrderBy(x => x.Name).ToListAsync();
            return Ok(data);
        }

        [HttpPost("causes")]
        public async Task<IActionResult> CreateCause([FromBody] CauseRequest model)
        {
            if (model.MachineId <= 0) return BadRequest("MachineId is required");
            if (model.CategoryId <= 0) return BadRequest("CategoryId is required");
            if (model.MachineGroupId <= 0) return BadRequest("MachineGroupId is required");
            var cause = new MaintenanceCause
            {
                MachineId = model.MachineId,
                CategoryId = model.CategoryId,
                MachineGroupId = model.MachineGroupId,
                Name = model.Name,
                IsActive = model.IsActive,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Causes.Add(cause);
            await _context.SaveChangesAsync();
            return Ok(cause);
        }

        [HttpPut("causes/{id:int}")]
        public async Task<IActionResult> UpdateCause(int id, [FromBody] CauseRequest model)
        {
            var cause = await _context.Causes.FindAsync(id);
            if (cause == null) return NotFound();
            if (model.MachineId > 0) cause.MachineId = model.MachineId;
            if (model.CategoryId > 0) cause.CategoryId = model.CategoryId;
            if (model.MachineGroupId > 0) cause.MachineGroupId = model.MachineGroupId;
            cause.Name = model.Name ?? cause.Name;
            cause.IsActive = model.IsActive;
            cause.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(cause);
        }

        [HttpDelete("causes/{id:int}")]
        public async Task<IActionResult> DeleteCause(int id)
        {
            var cause = await _context.Causes.FindAsync(id);
            if (cause == null) return NotFound();
            _context.Causes.Remove(cause);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}

