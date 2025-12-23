using System;
using System.Collections.Generic;
using System.Linq;
using DashboardBackend.Data;
using DashboardBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RoleSettingsController : ControllerBase
    {
        private readonly DashboardDbContext _context;

        private static readonly List<string> AvailableSections = new()
        {
            "home",
            "analysis",
            "reports",
            "feedback",
            "projectTimeline",
            "temperatureHumidity",
            "settings",
            "add",
            "profile",
            "jobPassport",
            "maintenanceManual",
            "maintenanceReports",
            "maintenanceAdmin",
            "admin",
            "database",
            "shifts",
            "machineScreen"
        };

        private static readonly List<string> BaseSections = new()
        {
            "home",
            "analysis",
            "reports",
            "feedback",
            "projectTimeline",
            "settings",
            "add",
            "profile"
        };

        private static List<string> Sections(params string[] extra) =>
            BaseSections.Union(extra).Distinct().ToList();

        private static readonly List<RoleSetting> DefaultRoles = new()
        {
            new RoleSetting
            {
                Name = "admin",
                DisplayName = "Admin",
                TokenLifetimeMinutes = 60 * 24, // 24 saat
                CanCreateUsers = true,
                CanDeleteUsers = true,
                CanManageRoles = true,
                AllowedSections = AvailableSections.ToList()
            },
            new RoleSetting
            {
                Name = "manager",
                DisplayName = "Manager",
                TokenLifetimeMinutes = 60 * 12, // 12 saat
                CanCreateUsers = true,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections()
            },
            new RoleSetting
            {
                Name = "engineer",
                DisplayName = "Engineer",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("jobPassport", "database", "shifts")
            },
            new RoleSetting
            {
                Name = "technical",
                DisplayName = "Technical",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("database", "shifts")
            },
            new RoleSetting
            {
                Name = "shiftengineer",
                DisplayName = "Vardiya Mühendisi",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("shifts")
            },
            new RoleSetting
            {
                Name = "qualityengineer",
                DisplayName = "Kalite Mühendisi",
                TokenLifetimeMinutes = 60 * 12,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections("temperatureHumidity")
            },
            new RoleSetting
            {
                Name = "user",
                DisplayName = "User",
                TokenLifetimeMinutes = 60 * 8,
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = Sections()
            },
            new RoleSetting
            {
                Name = "machine",
                DisplayName = "Machine",
                TokenLifetimeMinutes = 0, // Süresiz (10 yıl)
                CanCreateUsers = false,
                CanDeleteUsers = false,
                CanManageRoles = false,
                AllowedSections = new List<string> { "machineScreen" }
            }
        };

        public RoleSettingsController(DashboardDbContext context)
        {
            _context = context;
        }

        [HttpGet("sections")]
        public IActionResult GetAvailableSections()
        {
            return Ok(AvailableSections);
        }

        // GET: api/rolesettings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RoleSettingDto>>> GetRoleSettings()
        {
            await EnsureDefaultsAsync();
            var roles = await _context.RoleSettings
                .OrderBy(r => r.Name)
                .ToListAsync();
            return Ok(roles.Select(MapToDto));
        }

        // GET: api/rolesettings/{id}
        [HttpGet("{id:int}")]
        public async Task<ActionResult<RoleSettingDto>> GetRoleSetting(int id)
        {
            var role = await _context.RoleSettings.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "Rol bulunamadı" });
            }
            return Ok(MapToDto(role));
        }

        // POST: api/rolesettings
        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> CreateRole([FromBody] RoleSettingRequest roleSetting)
        {
            if (string.IsNullOrWhiteSpace(roleSetting.Name))
            {
                return BadRequest(new { message = "Rol ismi boş olamaz" });
            }

            var normalizedName = roleSetting.Name.Trim().ToLowerInvariant();

            if (!ValidateSections(roleSetting.AllowedSections ?? new List<string>(), out var invalidSections))
            {
                return BadRequest(new { message = $"Geçersiz sekmeler: {string.Join(", ", invalidSections)}" });
            }

            var exists = await _context.RoleSettings
                .AnyAsync(r => r.Name.ToLower() == normalizedName);
            if (exists)
            {
                return Conflict(new { message = $"'{normalizedName}' isimli rol zaten tanımlı" });
            }

            var entity = new RoleSetting
            {
                Name = normalizedName,
                DisplayName = string.IsNullOrWhiteSpace(roleSetting.DisplayName)
                    ? Capitalize(normalizedName)
                    : roleSetting.DisplayName.Trim(),
                TokenLifetimeMinutes = roleSetting.TokenLifetimeMinutes <= 0 ? 0 : roleSetting.TokenLifetimeMinutes,
                CanCreateUsers = roleSetting.CanCreateUsers,
                CanDeleteUsers = roleSetting.CanDeleteUsers,
                CanManageRoles = roleSetting.CanManageRoles,
                CanUpdateWastageAfterQualityControl = roleSetting.CanUpdateWastageAfterQualityControl,
                AllowedSections = roleSetting.AllowedSections?.Distinct().ToList() ?? new List<string>()
            };

            _context.RoleSettings.Add(entity);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRoleSetting), new { id = entity.Id }, MapToDto(entity));
        }

        // PUT: api/rolesettings/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] RoleSettingRequest update)
        {
            var role = await _context.RoleSettings.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "Rol bulunamadı" });
            }

            if (!string.IsNullOrWhiteSpace(update.DisplayName))
            {
                role.DisplayName = update.DisplayName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(update.Name) && !role.Name.Equals(update.Name, StringComparison.OrdinalIgnoreCase))
            {
                var newName = update.Name.Trim().ToLowerInvariant();
                var exists = await _context.RoleSettings.AnyAsync(r => r.Id != id && r.Name.ToLower() == newName);
                if (exists)
                {
                    return Conflict(new { message = $"'{newName}' isimli rol zaten tanımlı" });
                }
                role.Name = newName;
            }

            role.TokenLifetimeMinutes = update.TokenLifetimeMinutes <= 0 ? 0 : update.TokenLifetimeMinutes;
            role.CanCreateUsers = update.CanCreateUsers;
            role.CanDeleteUsers = update.CanDeleteUsers;
            role.CanManageRoles = update.CanManageRoles;
            role.CanUpdateWastageAfterQualityControl = update.CanUpdateWastageAfterQualityControl;

            if (update.AllowedSections != null)
            {
                if (!ValidateSections(update.AllowedSections, out var invalidSections))
                {
                    return BadRequest(new { message = $"Geçersiz sekmeler: {string.Join(", ", invalidSections)}" });
                }
                role.AllowedSections = update.AllowedSections.Distinct().ToList();
            }

            await _context.SaveChangesAsync();
            return Ok(MapToDto(role));
        }

        // DELETE: api/rolesettings/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> DeleteRole(int id)
        {
            var role = await _context.RoleSettings.FindAsync(id);
            if (role == null)
            {
                return NotFound(new { message = "Rol bulunamadı" });
            }

            var isInUse = await _context.Users.AnyAsync(u => u.Role == role.Name);
            if (isInUse)
            {
                return BadRequest(new { message = "Bu rol şu anda kullanıcılar tarafından kullanılıyor, silinemez" });
            }

            _context.RoleSettings.Remove(role);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Rol silindi" });
        }

        private async Task EnsureDefaultsAsync()
        {
            var rolesInDb = await _context.RoleSettings.ToListAsync();
            var existingNames = rolesInDb.Select(r => r.Name.ToLower()).ToList();
            var missing = DefaultRoles.Where(d => !existingNames.Contains(d.Name.ToLower())).ToList();

            if (missing.Count > 0)
            {
                var newRoles = missing.Select(m => new RoleSetting
                {
                    Name = m.Name,
                    DisplayName = m.DisplayName,
                    TokenLifetimeMinutes = m.TokenLifetimeMinutes,
                    CanCreateUsers = m.CanCreateUsers,
                    CanDeleteUsers = m.CanDeleteUsers,
                    CanManageRoles = m.CanManageRoles,
                    AllowedSections = m.AllowedSections
                }).ToList();

                _context.RoleSettings.AddRange(newRoles);
                rolesInDb.AddRange(newRoles);
                await _context.SaveChangesAsync();
            }

            var hasUpdates = false;
            foreach (var defaultRole in DefaultRoles)
            {
                var existing = rolesInDb.FirstOrDefault(r => r.Name.Equals(defaultRole.Name, StringComparison.OrdinalIgnoreCase));
                if (existing == null)
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(existing.DisplayName) && !string.IsNullOrWhiteSpace(defaultRole.DisplayName))
                {
                    existing.DisplayName = defaultRole.DisplayName;
                    hasUpdates = true;
                }

                if ((existing.AllowedSections == null || existing.AllowedSections.Count == 0) && defaultRole.AllowedSections != null)
                {
                    existing.AllowedSections = defaultRole.AllowedSections;
                    hasUpdates = true;
                }
            }

            if (hasUpdates)
            {
                await _context.SaveChangesAsync();
            }
        }

        private static RoleSettingDto MapToDto(RoleSetting role) =>
            new()
            {
                Id = role.Id,
                Name = role.Name,
                DisplayName = role.DisplayName,
                TokenLifetimeMinutes = role.TokenLifetimeMinutes,
                CanCreateUsers = role.CanCreateUsers,
                CanDeleteUsers = role.CanDeleteUsers,
                CanManageRoles = role.CanManageRoles,
                CanUpdateWastageAfterQualityControl = role.CanUpdateWastageAfterQualityControl,
                AllowedSections = role.AllowedSections ?? new List<string>()
            };

        private static bool ValidateSections(IEnumerable<string> sections, out List<string> invalid)
        {
            invalid = sections
                .Where(section => !AvailableSections.Contains(section))
                .Distinct()
                .ToList();
            return invalid.Count == 0;
        }

        private static string Capitalize(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return value;
            if (value.Length == 1) return value.ToUpper();
            return char.ToUpper(value[0]) + value.Substring(1);
        }

        public class RoleSettingDto
        {
            public int Id { get; set; }
            public string Name { get; set; } = string.Empty;
            public string? DisplayName { get; set; }
            public int TokenLifetimeMinutes { get; set; }
            public bool CanCreateUsers { get; set; }
            public bool CanDeleteUsers { get; set; }
            public bool CanManageRoles { get; set; }
            public bool CanUpdateWastageAfterQualityControl { get; set; }
            public List<string> AllowedSections { get; set; } = new();
        }

        public class RoleSettingRequest
        {
            public string Name { get; set; } = string.Empty;
            public string? DisplayName { get; set; }
            public int TokenLifetimeMinutes { get; set; }
            public bool CanCreateUsers { get; set; }
            public bool CanDeleteUsers { get; set; }
            public bool CanManageRoles { get; set; }
            public bool CanUpdateWastageAfterQualityControl { get; set; }
            public List<string>? AllowedSections { get; set; }
        }
    }
}
