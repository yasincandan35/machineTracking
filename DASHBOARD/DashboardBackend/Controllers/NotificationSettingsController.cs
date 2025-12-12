using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using System.Security.Claims;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationSettingsController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly ILogger<NotificationSettingsController> _logger;

        public NotificationSettingsController(
            DashboardDbContext context,
            ILogger<NotificationSettingsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId)) return null;
            if (!int.TryParse(userId, out var id)) return null;
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }

        // GET: api/notificationsettings - Kullanıcının tüm bildirim ayarlarını getir
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetNotificationSettings()
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var settings = await _context.UserNotificationSettings
                .Where(s => s.UserId == user.Id)
                .Include(s => s.Machine)
                .OrderBy(s => s.MachineId)
                .ThenBy(s => s.NotificationType)
                .Select(s => new
                {
                    s.Id,
                    s.UserId,
                    s.MachineId,
                    MachineName = s.Machine != null ? s.Machine.MachineName : "Tüm Makineler",
                    s.NotificationType,
                    s.IsEnabled,
                    s.Threshold,
                    s.ThresholdUnit,
                    s.NotificationTitle,
                    s.NotificationBody,
                    s.CreatedAt,
                    s.UpdatedAt
                })
                .ToListAsync();

            return Ok(settings);
        }

        // GET: api/notificationsettings/machines - Makine listesini getir
        [HttpGet("machines")]
        public async Task<ActionResult<IEnumerable<object>>> GetMachines()
        {
            var machines = await _context.MachineLists
                .OrderBy(m => m.MachineName)
                .Select(m => new
                {
                    m.Id,
                    m.MachineName
                })
                .ToListAsync();

            return Ok(machines);
        }

        // GET: api/notificationsettings/types - Bildirim tiplerini getir
        [HttpGet("types")]
        public ActionResult<IEnumerable<object>> GetNotificationTypes()
        {
            // Unit definitions - hepsi object[] tipinde
            object[] unitMinutes = new object[] { 
                new { value = "minutes", label = "Dakika" }, 
                new { value = "hours", label = "Saat" } 
            };
            object[] unitPercent = new object[] { 
                new { value = "percent", label = "Yüzde (%)" } 
            };
            object[] unitNone = Array.Empty<object>();

            // List kullanarak tip uyumsuzluğunu önle
            var types = new List<object>
            {
                new { 
                    value = "stoppage_duration", 
                    label = "Makina Duruşu Süresi",
                    description = "Makina belirtilen süreden fazla durduğunda bildirim gönder",
                    defaultThreshold = (int?)20,
                    defaultThresholdUnit = (string?)"minutes",
                    defaultTitle = "Makina Duruşu Uyarısı",
                    defaultBody = "{machineName} makinası {threshold} süresinden fazla durdu.",
                    availableUnits = (object[])unitMinutes
                },
                new { 
                    value = "speed_reached", 
                    label = "Hedef Hıza Ulaşıldı",
                    description = "Makina hızı hedef hıza ulaştığında bildirim gönder",
                    defaultThreshold = (int?)100,
                    defaultThresholdUnit = (string?)"percent",
                    defaultTitle = "Hedef Hıza Ulaşıldı",
                    defaultBody = "{machineName} makinası hedef hıza ulaştı: {currentSpeed} m/dk",
                    availableUnits = (object[])unitPercent
                },
                new { 
                    value = "new_report", 
                    label = "Yeni Rapor Oluşturuldu",
                    description = "Yeni rapor oluşturulduğunda bildirim gönder",
                    defaultThreshold = (int?)null,
                    defaultThresholdUnit = (string?)null,
                    defaultTitle = "Yeni Rapor",
                    defaultBody = "{machineName} için yeni rapor oluşturuldu. Görüntülemek için tıklayınız.",
                    availableUnits = (object[])unitNone
                },
                new { 
                    value = "production_complete", 
                    label = "Üretim Tamamlandı",
                    description = "Üretim tamamlandığında bildirim gönder",
                    defaultThreshold = (int?)100,
                    defaultThresholdUnit = (string?)"percent",
                    defaultTitle = "Üretim Tamamlandı",
                    defaultBody = "{machineName} makinasında üretim %{threshold} tamamlandı.",
                    availableUnits = (object[])unitPercent
                },
                new { 
                    value = "fire_threshold", 
                    label = "Fire Oranı Eşiği",
                    description = "Fire oranı belirtilen eşiği aştığında bildirim gönder",
                    defaultThreshold = (int?)5,
                    defaultThresholdUnit = (string?)"percent",
                    defaultTitle = "Fire Oranı Uyarısı",
                    defaultBody = "{machineName} makinasında fire oranı %{threshold} eşiğini aştı: %{currentValue}",
                    availableUnits = (object[])unitPercent
                },
                new { 
                    value = "oee_threshold", 
                    label = "OEE Eşiği",
                    description = "OEE değeri belirtilen eşiğin altına düştüğünde bildirim gönder",
                    defaultThreshold = (int?)70,
                    defaultThresholdUnit = (string?)"percent",
                    defaultTitle = "OEE Düşük Uyarısı",
                    defaultBody = "{machineName} makinasında OEE %{threshold} eşiğinin altına düştü: %{currentValue}",
                    availableUnits = (object[])unitPercent
                }
            };

            return Ok(types);
        }

        // POST: api/notificationsettings - Yeni bildirim ayarı oluştur
        [HttpPost]
        public async Task<ActionResult<object>> CreateNotificationSetting([FromBody] CreateNotificationSettingDto dto)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            // MachineId kontrolü (null olabilir - tüm makineler için)
            if (dto.MachineId.HasValue)
            {
                var machineExists = await _context.MachineLists.AnyAsync(m => m.Id == dto.MachineId.Value);
                if (!machineExists)
                {
                    return BadRequest(new { message = "Geçersiz makina ID'si" });
                }
            }

            // Aynı kullanıcı, makina ve tip kombinasyonu kontrolü
            var existing = await _context.UserNotificationSettings
                .FirstOrDefaultAsync(s => 
                    s.UserId == user.Id && 
                    s.MachineId == dto.MachineId && 
                    s.NotificationType == dto.NotificationType);

            if (existing != null)
            {
                return BadRequest(new { message = "Bu bildirim ayarı zaten mevcut" });
            }

            var setting = new UserNotificationSetting
            {
                UserId = user.Id,
                MachineId = dto.MachineId,
                NotificationType = dto.NotificationType,
                IsEnabled = dto.IsEnabled ?? true,
                Threshold = dto.Threshold,
                ThresholdUnit = dto.ThresholdUnit,
                NotificationTitle = dto.NotificationTitle,
                NotificationBody = dto.NotificationBody,
                CreatedAt = DateTime.Now
            };

            _context.UserNotificationSettings.Add(setting);
            await _context.SaveChangesAsync();

            var machine = dto.MachineId.HasValue 
                ? await _context.MachineLists.FindAsync(dto.MachineId.Value)
                : null;

            return Ok(new
            {
                setting.Id,
                setting.UserId,
                setting.MachineId,
                MachineName = machine != null ? machine.MachineName : "Tüm Makineler",
                setting.NotificationType,
                setting.IsEnabled,
                setting.Threshold,
                setting.ThresholdUnit,
                setting.NotificationTitle,
                setting.NotificationBody,
                setting.CreatedAt
            });
        }

        // PUT: api/notificationsettings/{id} - Bildirim ayarını güncelle
        [HttpPut("{id}")]
        public async Task<ActionResult<object>> UpdateNotificationSetting(int id, [FromBody] UpdateNotificationSettingDto dto)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var setting = await _context.UserNotificationSettings
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == user.Id);

            if (setting == null)
            {
                return NotFound(new { message = "Bildirim ayarı bulunamadı" });
            }

            // MachineId güncelleniyorsa kontrol et
            if (dto.MachineId.HasValue && dto.MachineId != setting.MachineId)
            {
                var machineExists = await _context.MachineLists.AnyAsync(m => m.Id == dto.MachineId.Value);
                if (!machineExists)
                {
                    return BadRequest(new { message = "Geçersiz makina ID'si" });
                }

                // Yeni kombinasyon kontrolü
                var existing = await _context.UserNotificationSettings
                    .FirstOrDefaultAsync(s => 
                        s.Id != id &&
                        s.UserId == user.Id && 
                        s.MachineId == dto.MachineId && 
                        s.NotificationType == (dto.NotificationType ?? setting.NotificationType));

                if (existing != null)
                {
                    return BadRequest(new { message = "Bu bildirim ayarı zaten mevcut" });
                }
            }

            // NotificationType güncelleniyorsa kontrol et
            if (!string.IsNullOrEmpty(dto.NotificationType) && dto.NotificationType != setting.NotificationType)
            {
                var existing = await _context.UserNotificationSettings
                    .FirstOrDefaultAsync(s => 
                        s.Id != id &&
                        s.UserId == user.Id && 
                        s.MachineId == (dto.MachineId ?? setting.MachineId) && 
                        s.NotificationType == dto.NotificationType);

                if (existing != null)
                {
                    return BadRequest(new { message = "Bu bildirim ayarı zaten mevcut" });
                }
            }

            // Güncelleme
            if (dto.MachineId.HasValue) setting.MachineId = dto.MachineId;
            if (!string.IsNullOrEmpty(dto.NotificationType)) setting.NotificationType = dto.NotificationType;
            if (dto.IsEnabled.HasValue) setting.IsEnabled = dto.IsEnabled.Value;
            if (dto.Threshold.HasValue) setting.Threshold = dto.Threshold;
            if (dto.ThresholdUnit != null) setting.ThresholdUnit = dto.ThresholdUnit;
            if (dto.NotificationTitle != null) setting.NotificationTitle = dto.NotificationTitle;
            if (dto.NotificationBody != null) setting.NotificationBody = dto.NotificationBody;
            setting.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            var machine = setting.MachineId.HasValue 
                ? await _context.MachineLists.FindAsync(setting.MachineId.Value)
                : null;

            return Ok(new
            {
                setting.Id,
                setting.UserId,
                setting.MachineId,
                MachineName = machine != null ? machine.MachineName : "Tüm Makineler",
                setting.NotificationType,
                setting.IsEnabled,
                setting.Threshold,
                setting.ThresholdUnit,
                setting.NotificationTitle,
                setting.NotificationBody,
                setting.CreatedAt,
                setting.UpdatedAt
            });
        }

        // DELETE: api/notificationsettings/{id} - Bildirim ayarını sil
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNotificationSetting(int id)
        {
            var user = await GetCurrentUserAsync();
            if (user == null) return Unauthorized();

            var setting = await _context.UserNotificationSettings
                .FirstOrDefaultAsync(s => s.Id == id && s.UserId == user.Id);

            if (setting == null)
            {
                return NotFound(new { message = "Bildirim ayarı bulunamadı" });
            }

            _context.UserNotificationSettings.Remove(setting);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    // DTOs
    public class CreateNotificationSettingDto
    {
        public int? MachineId { get; set; }
        public string NotificationType { get; set; } = string.Empty;
        public bool? IsEnabled { get; set; }
        public decimal? Threshold { get; set; }
        public string? ThresholdUnit { get; set; }
        public string? NotificationTitle { get; set; }
        public string? NotificationBody { get; set; }
    }

    public class UpdateNotificationSettingDto
    {
        public int? MachineId { get; set; }
        public string? NotificationType { get; set; }
        public bool? IsEnabled { get; set; }
        public decimal? Threshold { get; set; }
        public string? ThresholdUnit { get; set; }
        public string? NotificationTitle { get; set; }
        public string? NotificationBody { get; set; }
    }
}

