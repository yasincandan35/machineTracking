using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly DashboardDbContext _context;

        public UsersController(DashboardDbContext context)
        {
            _context = context;
        }

        // GET: api/users
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers()
        {
            var users = await _context.Users
                .Select(u => new
                {
                    u.Id,
                    u.Username,
                    u.Email,
                    u.Role,
                    u.Theme,
                    u.AccentColor,
                    u.CreatedAt,
                    u.LastLogin,
                    u.IsActive,
                    u.IsOnline,
                    u.LastSeen,
                    u.LanguageSelection,
                    u.LastSelectedMachineId,
                    u.ColorSettings,
                    u.AssignedMachineId,
                    u.AssignedMachineTable,
                    u.AssignedMachineName,
                    u.IsDemo,
                    u.PrivacySettings
                    // PasswordHash gizlendi
                })
                .ToListAsync();

            return Ok(users);
        }

        // GET: api/users/5
        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _context.Users.FindAsync(id);

            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            // Password hash'i döndürme
            return Ok(new
            {
                user.Id,
                user.Username,
                user.Email,
                user.Role,
                user.Theme,
                user.AccentColor,
                user.CreatedAt,
                user.LastLogin,
                user.IsActive,
                user.IsOnline,
                user.LastSeen,
                user.LanguageSelection,
                user.LastSelectedMachineId,
                user.ColorSettings,
                user.AssignedMachineId,
                user.AssignedMachineTable,
                user.AssignedMachineName,
                user.IsDemo,
                user.PrivacySettings
            });
        }

        // PUT: api/users/5/language
        [HttpPut("{id}/language")]
        public async Task<IActionResult> UpdateUserLanguage(int id, [FromBody] LanguageUpdateDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            user.LanguageSelection = dto.Language;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Dil tercihi güncellendi", language = dto.Language });
        }

        // PUT: api/users/5/theme
        [HttpPut("{id}/theme")]
        public async Task<IActionResult> UpdateUserTheme(int id, [FromBody] ThemeUpdateDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            user.Theme = dto.Theme;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tema tercihi güncellendi", theme = dto.Theme });
        }

        // PUT: api/users/5/color-settings
        [HttpPut("{id}/color-settings")]
        public async Task<IActionResult> UpdateUserColorSettings(int id, [FromBody] ColorSettingsUpdateDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            user.ColorSettings = dto.ColorSettings;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Renk tercihleri güncellendi", colorSettings = dto.ColorSettings });
        }

        // PUT: api/users/{id}/privacy
        [HttpPut("{id}/privacy")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> UpdatePrivacy(int id, [FromBody] UpdatePrivacyDto dto)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            user.IsDemo = dto.IsDemo;
            user.PrivacySettings = dto.PrivacySettingsJson;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Gizlilik ayarları güncellendi", isDemo = user.IsDemo });
        }

        // PUT: api/users/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutUser(int id, User user)
        {
            if (id != user.Id)
            {
                return BadRequest(new { message = "ID uyuşmuyor" });
            }

            var existingUser = await _context.Users.FindAsync(id);
            if (existingUser == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            existingUser.Username = user.Username;
            existingUser.Email = user.Email;
            existingUser.Theme = user.Theme ?? existingUser.Theme;
            existingUser.AccentColor = user.AccentColor ?? existingUser.AccentColor;
            existingUser.LanguageSelection = user.LanguageSelection ?? existingUser.LanguageSelection;
            existingUser.ColorSettings = user.ColorSettings ?? existingUser.ColorSettings;
            existingUser.IsActive = user.IsActive;

            var desiredRole = string.IsNullOrWhiteSpace(user.Role)
                ? existingUser.Role
                : user.Role.Trim();

            if (string.IsNullOrWhiteSpace(desiredRole))
            {
                return BadRequest(new { message = "Rol bilgisi boş olamaz" });
            }

            var normalizedRole = desiredRole.ToLowerInvariant();
            var roleExists = await _context.RoleSettings.AnyAsync(r => r.Name == normalizedRole);
            if (!roleExists)
            {
                return BadRequest(new { message = $"'{desiredRole}' rolü tanımlı değil" });
            }

            existingUser.Role = normalizedRole;

            if (normalizedRole == "machine")
            {
                var targetMachineId = user.AssignedMachineId ?? existingUser.AssignedMachineId;
                if (!targetMachineId.HasValue)
                {
                    return BadRequest(new { message = "Makine rolü için makine seçimi zorunludur" });
                }

                var machine = await _context.MachineLists
                    .FirstOrDefaultAsync(m => m.Id == targetMachineId.Value);

                if (machine == null)
                {
                    return BadRequest(new { message = "Atanmak istenen makine bulunamadı" });
                }

                existingUser.AssignedMachineId = machine.Id;
                existingUser.AssignedMachineTable = machine.TableName;
                existingUser.AssignedMachineName = machine.MachineName;
                existingUser.LastSelectedMachineId = machine.Id;
            }
            else
            {
                existingUser.AssignedMachineId = null;
                existingUser.AssignedMachineTable = null;
                existingUser.AssignedMachineName = null;
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!UserExists(id))
                {
                    return NotFound(new { message = "Kullanıcı bulunamadı" });
                }
                else
                {
                    throw;
                }
            }

            return Ok(new { message = "Kullanıcı güncellendi" });
        }

        // POST: api/users
        [HttpPost]
        public async Task<ActionResult<User>> PostUser(User user)
        {
            // Kullanıcı adı kontrolü
            if (await _context.Users.AnyAsync(u => u.Username == user.Username))
            {
                return BadRequest(new { message = "Bu kullanıcı adı zaten kullanılıyor" });
            }

            // Şifre hash'leme (BCrypt kullanılabilir)
            user.CreatedAt = DateTime.Now;
            user.IsActive = true;

            // Id identity değilse manuel hesapla (geçici çözüm)
            if (user.Id == 0)
            {
                var maxId = await _context.Users.MaxAsync(u => (int?)u.Id) ?? 0;
                user.Id = maxId + 1;
            }

            var requestedRole = string.IsNullOrWhiteSpace(user.Role) ? "user" : user.Role.Trim();
            var normalizedRole = requestedRole.ToLowerInvariant();
            var roleExists = await _context.RoleSettings.AnyAsync(r => r.Name == normalizedRole);
            if (!roleExists)
            {
                return BadRequest(new { message = $"'{requestedRole}' rolü tanımlı değil" });
            }
            user.Role = normalizedRole;

            if (normalizedRole == "machine")
            {
                if (!user.AssignedMachineId.HasValue)
                {
                    return BadRequest(new { message = "Makine rolü için AssignedMachineId zorunludur" });
                }

                var machine = await _context.MachineLists
                    .FirstOrDefaultAsync(m => m.Id == user.AssignedMachineId.Value);

                if (machine == null)
                {
                    return BadRequest(new { message = "Atanmak istenen makine bulunamadı" });
                }

                user.AssignedMachineId = machine.Id;
                user.AssignedMachineTable = machine.TableName;
                user.AssignedMachineName = machine.MachineName;
                user.LastSelectedMachineId = machine.Id;
            }
            else
            {
                user.AssignedMachineId = null;
                user.AssignedMachineTable = null;
                user.AssignedMachineName = null;
            }

            // Demo ise ve özel ayar verilmediyse varsayılan gizlilik uygula
            if (user.IsDemo && string.IsNullOrWhiteSpace(user.PrivacySettings))
            {
                user.PrivacySettings = "{\"maskJobCardSensitive\":true,\"maskReportsJobFields\":true,\"hideFeedbackContent\":true}";
            }

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetUser), new { id = user.Id }, new
            {
                user.Id,
                user.Username,
                user.Email,
                user.Role,
                user.IsDemo
            });
        }

        // DELETE: api/users/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound(new { message = "Kullanıcı bulunamadı" });
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Kullanıcı silindi" });
        }

        private bool UserExists(int id)
        {
            return _context.Users.Any(e => e.Id == id);
        }
    }

    // DTOs
    public class LanguageUpdateDto
    {
        public string Language { get; set; } = string.Empty;
    }

    public class ThemeUpdateDto
    {
        public string Theme { get; set; } = string.Empty;
    }

    public class UpdatePrivacyDto
    {
        public bool IsDemo { get; set; }
        // JSON string, ör: {"maskJobCardSensitive":true,"maskReportsJobFields":true,"hideFeedbackContent":true}
        public string? PrivacySettingsJson { get; set; }
    }

    public class ColorSettingsUpdateDto
    {
        public string? ColorSettings { get; set; }
    }
}

