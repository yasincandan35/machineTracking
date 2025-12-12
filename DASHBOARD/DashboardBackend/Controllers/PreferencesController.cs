using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PreferencesController : ControllerBase
    {
        private readonly DashboardDbContext _context;

        public PreferencesController(DashboardDbContext context)
        {
            _context = context;
        }

        // GET: api/preferences?userId=1&machineId=3
        [HttpGet]
        public async Task<ActionResult> GetPreference([FromQuery] int userId, [FromQuery] int machineId)
        {
            var preference = await _context.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId && p.MachineId == machineId);

            if (preference == null)
            {
                // Varsayılan değerler döndür (sadece makina-bazlı)
                return Ok(new
                {
                    visibleCards = new string[] { },
                    layout = (string?)null
                });
            }

            return Ok(new
            {
                visibleCards = preference.VisibleCards,
                layout = preference.Layout
            });
        }

        // POST: api/preferences
        [HttpPost]
        public async Task<ActionResult> SavePreference([FromBody] PreferenceRequest request)
        {
            var existing = await _context.UserPreferences
                .FirstOrDefaultAsync(p => p.UserId == request.UserId && p.MachineId == request.MachineId);

            if (existing != null)
            {
                // Güncelle (sadece makina-bazlı ayarlar)
                if (request.VisibleCards != null)
                    existing.VisibleCards = request.VisibleCards;

                if (!string.IsNullOrEmpty(request.Layout))
                    existing.Layout = request.Layout;

                await _context.SaveChangesAsync();
                return Ok(new { message = "Tercihler güncellendi" });
            }
            else
            {
                // Yeni kayıt (sadece makina-bazlı ayarlar)
                // Id identity değilse manuel hesapla (geçici çözüm)
                var maxId = await _context.UserPreferences.MaxAsync(p => (int?)p.Id) ?? 0;
                var newId = maxId + 1;
                while (await _context.UserPreferences.AnyAsync(p => p.Id == newId))
                {
                    newId++;
                }

                var preference = new UserPreference
                {
                    Id = newId,
                    UserId = request.UserId,
                    MachineId = request.MachineId,
                    VisibleCards = request.VisibleCards ?? "[]",
                    Layout = request.Layout,
                    LastSelectedMachineId = 0
                };

                _context.UserPreferences.Add(preference);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Tercihler kaydedildi" });
            }
        }

        // POST: api/preferences/last-machine
        [HttpPost("last-machine")]
        public async Task<ActionResult> SaveLastMachine([FromBody] LastMachineRequest request)
        {
            // 🆕 Artık Users tablosunda tutuluyor
            var user = await _context.Users.FindAsync(request.UserId);
            
            if (user != null)
            {
                user.LastSelectedMachineId = request.MachineId;
                await _context.SaveChangesAsync();
                return Ok(new { message = "Son seçilen makina kaydedildi" });
            }

            return NotFound(new { message = "Kullanıcı bulunamadı" });
        }

        // GET: api/preferences/last-machine?userId=4
        [HttpGet("last-machine")]
        public async Task<ActionResult> GetLastMachine([FromQuery] int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            return Ok(new { machineId = user.LastSelectedMachineId ?? 0 });
        }

        public class PreferenceRequest
        {
            public int UserId { get; set; }
            public int MachineId { get; set; }
            public string? VisibleCards { get; set; }  // JSON string (makina-bazlı)
            public string? Layout { get; set; }  // JSON string (makina-bazlı)
        }

        public class LastMachineRequest
        {
            public int UserId { get; set; }
            public int MachineId { get; set; }
        }
    }
}

