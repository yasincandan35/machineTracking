using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using Microsoft.AspNetCore.Authorization;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly TokenService _tokenService;

        public AuthController(DashboardDbContext context, TokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        private async Task<object?> BuildRoleSettingsAsync(string? roleName)
        {
            if (string.IsNullOrWhiteSpace(roleName))
            {
                return null;
            }

            var normalized = roleName.Trim().ToLowerInvariant();
            var roleSetting = await _context.RoleSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Name == normalized);

            if (roleSetting == null)
            {
                return null;
            }

            return new
            {
                roleSetting.Id,
                roleSetting.Name,
                roleSetting.DisplayName,
                roleSetting.TokenLifetimeMinutes,
                roleSetting.CanCreateUsers,
                roleSetting.CanDeleteUsers,
                roleSetting.CanManageRoles,
                roleSetting.CanUpdateWastageAfterQualityControl,
                allowedSections = roleSetting.AllowedSections ?? new List<string>()
            };
        }

        // POST: api/auth/register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                // Normalize girişler
                var normalizedUsername = (request.Username ?? string.Empty).Trim();
                var normalizedEmail = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();

                if (string.IsNullOrWhiteSpace(normalizedUsername))
                {
                    return BadRequest(new { message = "Kullanıcı adı boş olamaz" });
                }

                // Tüm kullanıcıları çek (case-insensitive kontrol için)
                var allUsers = await _context.Users
                    .Select(u => new { u.Username, u.Email })
                    .ToListAsync();

                // Kullanıcı adı kontrolü (trim + case-insensitive)
                var usernameExists = allUsers.Any(u => u.Username != null &&
                    string.Equals(u.Username.Trim(), normalizedUsername, StringComparison.OrdinalIgnoreCase));
                
                if (usernameExists)
                {
                    return BadRequest(new { message = $"Kullanıcı adı '{normalizedUsername}' zaten kullanılıyor" });
                }

                // E-posta kontrolü (varsa, trim + case-insensitive)
                if (!string.IsNullOrWhiteSpace(normalizedEmail))
                {
                    var emailExists = allUsers.Any(u => u.Email != null &&
                        string.Equals(u.Email.Trim(), normalizedEmail, StringComparison.OrdinalIgnoreCase));
                    
                    if (emailExists)
                    {
                        return BadRequest(new { message = $"E-posta '{normalizedEmail}' zaten kullanılıyor" });
                    }
                }

                // Id identity değilse manuel hesapla (geçici çözüm)
                int newId;
                var maxId = await _context.Users.MaxAsync(u => (int?)u.Id) ?? 0;
                newId = maxId + 1;

                // Aynı Id varsa tekrar hesapla (race condition koruması)
                while (await _context.Users.AnyAsync(u => u.Id == newId))
                {
                    newId++;
                }

                MachineList? assignedMachine = null;
                var requestedRole = (request.Role ?? "user").Trim();

                if (requestedRole.Equals("machine", StringComparison.OrdinalIgnoreCase))
                {
                    if (!request.AssignedMachineId.HasValue)
                    {
                        return BadRequest(new { message = "Makine rolü için makine seçimi zorunludur" });
                    }

                    assignedMachine = await _context.MachineLists
                        .FirstOrDefaultAsync(m => m.Id == request.AssignedMachineId.Value);

                    if (assignedMachine == null)
                    {
                        return BadRequest(new { message = "Atanmak istenen makine bulunamadı" });
                    }
                }

                var normalizedRole = requestedRole.ToLowerInvariant();
                var roleExists = await _context.RoleSettings.AnyAsync(r => r.Name == normalizedRole);
                if (!roleExists)
                {
                    return BadRequest(new { message = $"'{requestedRole}' rolü tanımlı değil. Önce rol ayarlarını oluşturun." });
                }

                var user = new User
                {
                    Id = newId,  // Manuel Id atama (DB'de Identity yok)
                    Username = normalizedUsername,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                    Email = normalizedEmail,
                    Role = normalizedRole,
                    Theme = "light",
                    AccentColor = "blue",
                    LanguageSelection = "tr",
                    CreatedAt = DateTime.Now,
                    IsActive = true,
                    IsOnline = false,
                    IsDemo = request.IsDemo
                };

                if (assignedMachine != null)
                {
                    user.AssignedMachineId = assignedMachine.Id;
                    user.AssignedMachineTable = assignedMachine.TableName;
                    user.AssignedMachineName = assignedMachine.MachineName;
                    user.LastSelectedMachineId = assignedMachine.Id;
                }

                // Demo ise ve özel ayar verilmediyse varsayılan gizlilik uygula
                if (user.IsDemo && string.IsNullOrWhiteSpace(request.PrivacySettingsJson))
                {
                    user.PrivacySettings = "{\"maskJobCardSensitive\":true,\"maskReportsJobFields\":true,\"hideFeedbackContent\":true}";
                }
                else if (!string.IsNullOrWhiteSpace(request.PrivacySettingsJson))
                {
                    user.PrivacySettings = request.PrivacySettingsJson;
                }

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                var roleSettings = await BuildRoleSettingsAsync(user.Role);

                return Ok(new { message = "Kayıt başarılı", userId = user.Id, roleSettings });
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
            {
                // Inner exception'da asıl SQL hatası var
                var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
                Console.WriteLine($"[REGISTER ERROR] DbUpdateException: {innerMessage}");
                return StatusCode(500, new { 
                    message = "Veritabanı hatası", 
                    error = innerMessage,
                    details = dbEx.ToString()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[REGISTER ERROR] Exception: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { 
                    message = "Kayıt sırasında bir hata oluştu", 
                    error = ex.Message,
                    innerError = ex.InnerException?.Message,
                    details = ex.ToString()
                });
            }
        }

        // POST: api/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);

            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized(new { message = "Kullanıcı adı veya şifre hatalı" });

            if (!user.IsActive)
                return Unauthorized(new { message = "Hesap devre dışı bırakılmış" });

            if (user.Role?.Equals("machine", StringComparison.OrdinalIgnoreCase) == true && user.AssignedMachineId.HasValue)
            {
                user.LastSelectedMachineId = user.AssignedMachineId;
            }

            // LastLogin güncelle
            user.LastLogin = DateTime.Now;
            user.LastSeen = DateTime.Now;
            user.IsOnline = true;
            await _context.SaveChangesAsync();

            var tokenResult = await _tokenService.GenerateTokenAsync(user);
            var roleSettings = await BuildRoleSettingsAsync(user.Role);

            return Ok(new
            {
                id = user.Id,
                token = tokenResult.Token,
                tokenExpiresAtUtc = tokenResult.ExpiresAtUtc,
                tokenLifetimeMinutes = tokenResult.LifetimeMinutes,
                username = user.Username,
                email = user.Email,
                role = user.Role,
                theme = user.Theme,
                accentColor = user.AccentColor,
                roleSettings,
                isActive = user.IsActive,
                isOnline = user.IsOnline,
                createdAt = user.CreatedAt,
                lastLogin = user.LastLogin,
                lastSeen = user.LastSeen,
                languageSelection = user.LanguageSelection,
                lastSelectedMachineId = user.LastSelectedMachineId,
                colorSettings = user.ColorSettings,
                assignedMachineId = user.AssignedMachineId,
                assignedMachineTable = user.AssignedMachineTable,
                assignedMachineName = user.AssignedMachineName,
                isDemo = user.IsDemo,
                privacySettings = user.PrivacySettings
            });
        }

        // POST: api/auth/logout
        [HttpPost("logout")]
        [Authorize]
        public async Task<IActionResult> Logout()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _context.Users.FindAsync(int.Parse(userId));
            if (user != null)
            {
                user.IsOnline = false;
                user.LastSeen = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Başarıyla çıkış yapıldı" });
        }

        // POST: api/auth/heartbeat
        [HttpPost("heartbeat")]
        [Authorize]
        public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest? request = null)
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _context.Users.FindAsync(int.Parse(userId));
            if (user != null)
            {
                if (user.Role?.Equals("machine", StringComparison.OrdinalIgnoreCase) == true && user.AssignedMachineId.HasValue)
                {
                    user.LastSelectedMachineId = user.AssignedMachineId;
                }

                user.LastSeen = DateTime.Now;
                user.IsOnline = true;

                // Sayfa ve tab bilgilerini güncelle
                if (request != null)
                {
                    if (!string.IsNullOrEmpty(request.CurrentPage))
                    {
                        user.CurrentPage = request.CurrentPage;
                    }
                    if (!string.IsNullOrEmpty(request.CurrentTab))
                    {
                        user.CurrentTab = request.CurrentTab;
                    }
                }

                // Activity log kaydet (sayfa/tab bilgisi varsa)
                if (request != null && (!string.IsNullOrEmpty(request.CurrentPage) || !string.IsNullOrEmpty(request.CurrentTab)))
                {
                    try
                    {
                        var activityLog = new UserActivityLog
                        {
                            UserId = user.Id,
                            EventType = "time_spent",
                            Page = request.CurrentPage,
                            Tab = request.CurrentTab,
                            SubTab = request.CurrentSubTab,
                            MachineId = request.MachineId,
                            MachineName = request.MachineName,
                            Duration = 2, // Her heartbeat 2 saniyede bir, bu süre aktif kalma süresi
                            Timestamp = DateTime.Now,
                            SessionId = request.SessionId
                        };
                        _context.UserActivityLogs.Add(activityLog);
                    }
                    catch (Exception ex)
                    {
                        // Activity log hatası heartbeat'i engellememeli
                        Console.WriteLine($"Activity log error in heartbeat: {ex.Message}");
                    }
                }

                await _context.SaveChangesAsync();

                var roleSettings = await BuildRoleSettingsAsync(user.Role);

                return Ok(new
                {
                    message = "Heartbeat alındı",
                    id = user.Id,
                    username = user.Username,
                    email = user.Email,
                    role = user.Role,
                    theme = user.Theme,
                    accentColor = user.AccentColor,
                    roleSettings,
                    isActive = user.IsActive,
                    isOnline = user.IsOnline,
                    createdAt = user.CreatedAt,
                    lastLogin = user.LastLogin,
                    lastSeen = user.LastSeen,
                    languageSelection = user.LanguageSelection,
                    lastSelectedMachineId = user.LastSelectedMachineId,
                    colorSettings = user.ColorSettings,
                    assignedMachineId = user.AssignedMachineId,
                    assignedMachineTable = user.AssignedMachineTable,
                    assignedMachineName = user.AssignedMachineName,
                    isDemo = user.IsDemo,
                    privacySettings = user.PrivacySettings,
                    currentPage = user.CurrentPage,
                    currentTab = user.CurrentTab
                });
            }

            return Ok(new { message = "Heartbeat alındı" });
        }

        // POST: api/auth/refresh-token
        [HttpPost("refresh-token")]
        [Authorize]
        public async Task<IActionResult> RefreshToken()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId))
                return Unauthorized();

            var user = await _context.Users.FindAsync(int.Parse(userId));
            if (user == null)
                return Unauthorized();

            if (!user.IsActive)
                return Unauthorized(new { message = "Hesap devre dışı bırakılmış" });

            if (user.Role?.Equals("machine", StringComparison.OrdinalIgnoreCase) == true && user.AssignedMachineId.HasValue)
            {
                user.LastSelectedMachineId = user.AssignedMachineId;
            }

            user.LastLogin = DateTime.Now;
            user.LastSeen = DateTime.Now;
            user.IsOnline = true;
            await _context.SaveChangesAsync();

            var tokenResult = await _tokenService.GenerateTokenAsync(user);
            var roleSettings = await BuildRoleSettingsAsync(user.Role);

            return Ok(new
            {
                token = tokenResult.Token,
                tokenExpiresAtUtc = tokenResult.ExpiresAtUtc,
                tokenLifetimeMinutes = tokenResult.LifetimeMinutes,
                id = user.Id,
                username = user.Username,
                email = user.Email,
                role = user.Role,
                theme = user.Theme,
                accentColor = user.AccentColor,
                roleSettings,
                isActive = user.IsActive,
                isOnline = user.IsOnline,
                createdAt = user.CreatedAt,
                lastLogin = user.LastLogin,
                lastSeen = user.LastSeen,
                languageSelection = user.LanguageSelection,
                lastSelectedMachineId = user.LastSelectedMachineId,
                colorSettings = user.ColorSettings,
                assignedMachineId = user.AssignedMachineId,
                assignedMachineTable = user.AssignedMachineTable,
                assignedMachineName = user.AssignedMachineName,
                isDemo = user.IsDemo,
                privacySettings = user.PrivacySettings
            });
        }

        // GET: api/auth/users (Admin only)
        [HttpGet("users")]
        [Authorize]
        public async Task<IActionResult> GetUsers()
        {
            var users = await _context.Users
                .OrderByDescending(u => u.IsOnline)
                .ThenBy(u => u.Username)
                .ToListAsync();

            var result = users.Select(u => new
            {
                id = u.Id,
                username = u.Username,
                email = u.Email,
                role = u.Role,
                theme = u.Theme,
                accentColor = u.AccentColor,
                isActive = u.IsActive,
                isOnline = u.IsOnline,
                createdAt = u.CreatedAt,
                lastLogin = u.LastLogin,
                lastSeen = u.LastSeen,
                languageSelection = u.LanguageSelection,
                lastSelectedMachineId = u.LastSelectedMachineId,
                colorSettings = u.ColorSettings,
                assignedMachineId = u.AssignedMachineId,
                assignedMachineTable = u.AssignedMachineTable,
                assignedMachineName = u.AssignedMachineName,
                currentPage = u.CurrentPage,
                currentTab = u.CurrentTab
            });

            return Ok(result);
        }

        // DELETE: api/auth/users/{id} (Admin only)
        [HttpDelete("users/{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteUser(int id)
        {
            try
            {
                var user = await _context.Users.FindAsync(id);
                if (user == null)
                    return NotFound(new { message = "Kullanıcı bulunamadı" });

                // İlgili UserPreferences kayıtlarını temizle (yetim kayıt kalmasın)
                var prefs = await _context.UserPreferences
                    .Where(p => p.UserId == id)
                    .ToListAsync();
                if (prefs.Any())
                {
                    _context.UserPreferences.RemoveRange(prefs);
                }

                _context.Users.Remove(user);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Kullanıcı ve tercihleri silindi" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Kullanıcı silinirken hata oluştu", error = ex.Message });
            }
        }

        // PUT: api/auth/users/{id}/role (Admin only)
        [HttpPut("users/{id}/role")]
        [Authorize]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] UpdateRoleRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            var newRole = request.Role?.Trim() ?? user.Role;
            if (string.IsNullOrWhiteSpace(newRole))
            {
                return BadRequest(new { message = "Rol bilgisi boş olamaz" });
            }

            var normalizedRole = newRole.ToLowerInvariant();
            var roleExists = await _context.RoleSettings.AnyAsync(r => r.Name == normalizedRole);
            if (!roleExists)
            {
                return BadRequest(new { message = $"'{newRole}' rolü tanımlı değil" });
            }

            user.Role = normalizedRole;

            if (normalizedRole == "machine")
            {
                var targetMachineId = request.AssignedMachineId ?? user.AssignedMachineId;
                if (!targetMachineId.HasValue)
                {
                    return BadRequest(new { message = "Makine rolü için makine seçimi zorunludur" });
                }

                var machine = await _context.MachineLists.FirstOrDefaultAsync(m => m.Id == targetMachineId.Value);
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

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Rol güncellendi",
                role = user.Role,
                assignedMachineId = user.AssignedMachineId
            });
        }

        // PATCH: api/auth/users/{id}/toggle-active (Admin only)
        [HttpPatch("users/{id}/toggle-active")]
        [Authorize]
        public async Task<IActionResult> ToggleActive(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            user.IsActive = !user.IsActive;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Aktiflik durumu güncellendi", isActive = user.IsActive });
        }

        // PUT: api/auth/users/{id}/password (Admin only)
        [HttpPut("users/{id}/password")]
        [Authorize]
        public async Task<IActionResult> UpdatePassword(int id, [FromBody] UpdatePasswordRequest request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Şifre güncellendi" });
        }

        // PUT: api/auth/users/{id}/theme
        [HttpPut("users/{id}/theme")]
        [Authorize]
        public async Task<IActionResult> UpdateTheme(int id, [FromBody] UpdateThemeRequest request)
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrEmpty(userId) || int.Parse(userId) != id)
                return Unauthorized(new { message = "Sadece kendi temanızı değiştirebilirsiniz" });

            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            user.Theme = request.Theme ?? "light";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tema başarıyla güncellendi", theme = user.Theme });
        }

        // DTOs
        public class RegisterRequest
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string? Role { get; set; }  // 🆕 Admin panel için
            public int? AssignedMachineId { get; set; }
            public bool IsDemo { get; set; } = false;
            public string? PrivacySettingsJson { get; set; }
        }

        public class LoginRequest
        {
            public string Username { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        public class UpdateThemeRequest
        {
            public string Theme { get; set; } = "light";
        }

        public class UpdateRoleRequest
        {
            public string Role { get; set; } = "user";
            public int? AssignedMachineId { get; set; }
        }

        public class UpdatePasswordRequest
        {
            public string NewPassword { get; set; } = string.Empty;
        }

        public class HeartbeatRequest
        {
            public string? CurrentPage { get; set; }
            public string? CurrentTab { get; set; }
            public string? CurrentSubTab { get; set; }
            public int? MachineId { get; set; }
            public string? MachineName { get; set; }
            public string? SessionId { get; set; }
        }
    }
}

