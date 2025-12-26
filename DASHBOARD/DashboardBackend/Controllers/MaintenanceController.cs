using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using System.Security.Claims;
using System.Text.Json;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MaintenanceController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly EmailService _emailService;
        private readonly PushNotificationService _pushNotificationService;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(
            DashboardDbContext context, 
            EmailService emailService,
            PushNotificationService pushNotificationService,
            IWebHostEnvironment environment,
            ILogger<MaintenanceController> logger)
        {
            _context = context;
            _emailService = emailService;
            _pushNotificationService = pushNotificationService;
            _environment = environment;
            _logger = logger;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId)) return null;
            if (!int.TryParse(userId, out var id)) return null;
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }

        // GET: api/maintenance/requests - Tüm arıza bildirimlerini listele
        [HttpGet("requests")]
        public async Task<ActionResult<IEnumerable<object>>> GetMaintenanceRequests(
            [FromQuery] string? status = null,
            [FromQuery] string? machineName = null)
        {
            var query = _context.MaintenanceRequests
                .Include(r => r.Assignments)
                .Include(r => r.Comments)
                .Include(r => r.Photos)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                // Virgülle ayrılmış birden fazla status değeri destekle
                var statusList = status.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                if (statusList.Length > 0)
                {
                    query = query.Where(r => statusList.Contains(r.Status));
                }
            }

            if (!string.IsNullOrEmpty(machineName))
            {
                query = query.Where(r => r.MachineName == machineName);
            }

            var requests = await query
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            var result = requests.Select(r => new
            {
                id = r.Id,
                machineName = r.MachineName,
                machineTableName = r.MachineTableName,
                faultType = r.FaultType,
                description = r.Description,
                createdByUserId = r.CreatedByUserId,
                createdByUserName = r.CreatedByUserName,
                createdAt = r.CreatedAt,
                acceptedAt = r.AcceptedAt,
                arrivedAt = r.ArrivedAt,
                completedAt = r.CompletedAt,
                status = r.Status,
                assignments = r.Assignments?.Select(a => new
                {
                    id = a.Id,
                    userId = a.UserId,
                    userName = a.UserName,
                    userEmail = a.UserEmail,
                    acceptedAt = a.AcceptedAt
                }).ToList(),
                commentsCount = r.Comments?.Count ?? 0,
                photosCount = r.Photos?.Count ?? 0
            });

            return Ok(result);
        }

        // GET: api/maintenance/requests/5 - Arıza bildirimi detayı
        [HttpGet("requests/{id}")]
        public async Task<ActionResult<object>> GetMaintenanceRequest(int id)
        {
            var request = await _context.MaintenanceRequests
                .Include(r => r.Assignments)
                .Include(r => r.Comments)
                .Include(r => r.Photos)
                .AsSplitQuery()
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            var result = new
            {
                id = request.Id,
                machineName = request.MachineName,
                machineTableName = request.MachineTableName,
                faultType = request.FaultType,
                description = request.Description,
                createdByUserId = request.CreatedByUserId,
                createdByUserName = request.CreatedByUserName,
                createdAt = request.CreatedAt,
                acceptedAt = request.AcceptedAt,
                arrivedAt = request.ArrivedAt,
                completedAt = request.CompletedAt,
                status = request.Status,
                assignments = request.Assignments?.Select(a => new
                {
                    id = a.Id,
                    userId = a.UserId,
                    userName = a.UserName,
                    userEmail = a.UserEmail,
                    acceptedAt = a.AcceptedAt
                }).ToList(),
                comments = request.Comments?.OrderBy(c => c.CreatedAt).Select(c => new
                {
                    id = c.Id,
                    userId = c.UserId,
                    userName = c.UserName,
                    content = c.Content,
                    createdAt = c.CreatedAt,
                    updatedAt = c.UpdatedAt
                }).ToList(),
                photos = request.Photos?.OrderBy(p => p.UploadedAt).Select(p => new
                {
                    id = p.Id,
                    filePath = p.FilePath,
                    fileName = p.FileName,
                    fileType = p.FileType,
                    fileSize = p.FileSize,
                    annotations = p.Annotations,
                    uploadedByUserId = p.UploadedByUserId,
                    uploadedByUserName = p.UploadedByUserName,
                    uploadedAt = p.UploadedAt
                }).ToList()
            };

            return Ok(result);
        }

        // POST: api/maintenance/requests - Yeni arıza bildirimi oluştur
        [HttpPost("requests")]
        public async Task<ActionResult<object>> CreateMaintenanceRequest([FromBody] CreateMaintenanceRequestDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = new MaintenanceRequest
            {
                MachineName = dto.MachineName,
                MachineTableName = dto.MachineTableName,
                FaultType = dto.FaultType,
                Description = dto.Description,
                CreatedByUserId = currentUser.Id,
                CreatedByUserName = currentUser.Username ?? "Bilinmeyen",
                CreatedAt = DateTime.Now,
                Status = "pending"
            };

            _context.MaintenanceRequests.Add(request);
            await _context.SaveChangesAsync();

            // Push notification gönder (mobil uygulamalar için)
            _ = Task.Run(async () =>
            {
                try
                {
                    await _pushNotificationService.SendMaintenanceRequestNotification(
                        request.MachineName,
                        request.FaultType,
                        request.Description,
                        request.Id,
                        dto.NotificationCategory ?? "maintenance" // Varsayılan olarak maintenance
                    );
                }
                catch (Exception ex)
                {
                    // Log error but don't fail the request
                    _logger.LogError(ex, "Push notification gönderme hatası");
                }
            });

            var result = new
            {
                id = request.Id,
                machineName = request.MachineName,
                faultType = request.FaultType,
                description = request.Description,
                createdByUserName = request.CreatedByUserName,
                createdAt = request.CreatedAt,
                status = request.Status
            };

            return CreatedAtAction(nameof(GetMaintenanceRequest), new { id = request.Id }, result);
        }

        // POST: api/maintenance/requests/5/accept - Arıza bildirimini kabul et
        [HttpPost("requests/{id}/accept")]
        public async Task<ActionResult<object>> AcceptMaintenanceRequest(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = await _context.MaintenanceRequests
                .Include(r => r.Assignments)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            // Zaten kabul edilmiş mi kontrol et
            var existingAssignment = request.Assignments?.FirstOrDefault(a => a.UserId == currentUser.Id);
            if (existingAssignment != null)
                return BadRequest(new { message = "Bu arıza bildirimi zaten kabul edilmiş" });

            // İlk kabul eden ise AcceptedAt'i güncelle
            if (!request.AcceptedAt.HasValue)
            {
                request.AcceptedAt = DateTime.Now;
                request.Status = "accepted";
            }

            var assignment = new MaintenanceAssignment
            {
                MaintenanceRequestId = id,
                UserId = currentUser.Id,
                UserName = currentUser.Username ?? "Bilinmeyen",
                UserEmail = currentUser.Email,
                AcceptedAt = DateTime.Now
            };

            _context.MaintenanceAssignments.Add(assignment);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arıza bildirimi kabul edildi", assignmentId = assignment.Id });
        }

        // POST: api/maintenance/requests/5/arrived - Makinaya gelindiğini bildir
        [HttpPost("requests/{id}/arrived")]
        public async Task<ActionResult<object>> MarkArrived(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = await _context.MaintenanceRequests
                .Include(r => r.Assignments)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            // Kullanıcı kontrolü kaldırıldı - makine ekranından herkes basabilir
            // var assignment = request.Assignments?.FirstOrDefault(a => a.UserId == currentUser.Id);
            // if (assignment == null)
            //     return Forbid("Bu arıza bildirimi için yetkiniz yok");

            if (request.ArrivedAt.HasValue)
                return BadRequest(new { message = "Zaten gelindi olarak işaretlenmiş" });

            request.ArrivedAt = DateTime.Now;
            request.Status = "in_progress";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Geliş tarihi kaydedildi", arrivedAt = request.ArrivedAt });
        }

        // POST: api/maintenance/requests/5/complete - Arıza tamamlandı
        [HttpPost("requests/{id}/complete")]
        public async Task<ActionResult<object>> CompleteMaintenanceRequest(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = await _context.MaintenanceRequests
                .Include(r => r.Assignments)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            // Kullanıcı kontrolü kaldırıldı - makine ekranından herkes basabilir
            // var assignment = request.Assignments?.FirstOrDefault(a => a.UserId == currentUser.Id);
            // if (assignment == null)
            //     return Forbid("Bu arıza bildirimi için yetkiniz yok");

            if (request.CompletedAt.HasValue)
                return BadRequest(new { message = "Zaten tamamlandı olarak işaretlenmiş" });

            request.CompletedAt = DateTime.Now;
            request.Status = "completed";
            await _context.SaveChangesAsync();

            return Ok(new { message = "Arıza tamamlandı", completedAt = request.CompletedAt });
        }

        // POST: api/maintenance/requests/5/comments - Yorum ekle
        [HttpPost("requests/{id}/comments")]
        public async Task<ActionResult<object>> AddComment(int id, [FromBody] AddCommentDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            var comment = new MaintenanceComment
            {
                MaintenanceRequestId = id,
                UserId = currentUser.Id,
                UserName = currentUser.Username ?? "Bilinmeyen",
                Content = dto.Content,
                CreatedAt = DateTime.Now
            };

            _context.MaintenanceComments.Add(comment);
            await _context.SaveChangesAsync();

            var result = new
            {
                id = comment.Id,
                userId = comment.UserId,
                userName = comment.UserName,
                content = comment.Content,
                createdAt = comment.CreatedAt
            };

            return CreatedAtAction(nameof(GetMaintenanceRequest), new { id }, result);
        }

        // GET: api/maintenance/maintenance-personnel - Bakım personeli listesi
        [HttpGet("maintenance-personnel")]
        public async Task<ActionResult<IEnumerable<object>>> GetMaintenancePersonnel()
        {
            // Bakım personeli: maintenanceStaff, maintenanceEngineer, maintenanceManager rolleri
            // Önce tüm aktif kullanıcıları ve RoleSettings'i çek
            var allUsers = await _context.Users
                .Where(u => u.IsActive)
                .ToListAsync();
            
            var allRoleSettings = await _context.RoleSettings
                .ToListAsync();
            
            // Memory'de filtrele (case-insensitive)
            var maintenanceRoleNames = new[] { "maintenancestaff", "maintenanceengineer", "maintenancemanager", "maintenance" };
            var personnel = allUsers
                .Where(u => maintenanceRoleNames.Any(rn => rn.Equals(u.Role, StringComparison.OrdinalIgnoreCase)))
                .Select(u => {
                    var roleLower = u.Role.ToLowerInvariant();
                    string? displayName = null;
                    
                    // RoleSettings'ten display name al (memory'de)
                    var roleSetting = allRoleSettings
                        .FirstOrDefault(rs => rs.Name.ToLowerInvariant() == roleLower);
                    if (roleSetting != null)
                    {
                        displayName = roleSetting.DisplayName;
                    }
                    else
                    {
                        // Fallback display name
                        displayName = roleLower switch
                        {
                            "maintenancestaff" => "Bakım Personeli",
                            "maintenanceengineer" => "Bakım Mühendisi",
                            "maintenancemanager" => "Bakım Müdürü",
                            "maintenance" => "Bakım",
                            _ => null
                        };
                    }
                    
                    return new
                    {
                        id = u.Id,
                        username = u.Username,
                        email = u.Email,
                        role = u.Role,
                        roleDisplayName = displayName
                    };
                })
                .ToList();

            return Ok(personnel);
        }

        // GET: api/maintenance/fault-types - Arıza tipleri listesi
        [HttpGet("fault-types")]
        public ActionResult<IEnumerable<string>> GetFaultTypes()
        {
            // Sabit arıza tipleri listesi (ileride veritabanına taşınabilir)
            var faultTypes = new List<string>
            {
                "Elektrik Arızası",
                "Mekanik Arıza",
                "Hidrolik Arıza",
                "Pnömatik Arıza",
                "Yazılım Hatası",
                "Sensör Arızası",
                "Kesici Arıza",
                "Kağıt Sıkışması",
                "Diğer"
            };

            return Ok(faultTypes);
        }

        // POST: api/maintenance/requests/5/photos - Fotoğraf yükle
        [HttpPost("requests/{id}/photos")]
        public async Task<ActionResult<object>> UploadPhoto(int id, IFormFile file, [FromForm] string? annotations = null)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null)
                return NotFound(new { message = "Arıza bildirimi bulunamadı" });

            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Dosya seçilmedi" });

            // Dosya uzantısı kontrolü
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new { message = "Geçersiz dosya formatı. Sadece resim dosyaları kabul edilir." });

            // Dosya boyutu kontrolü (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "Dosya boyutu 10MB'dan büyük olamaz" });

            // Dosya kaydetme
            var uploadsFolder = Path.Combine(_environment.WebRootPath ?? _environment.ContentRootPath, "uploads", "maintenance");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            var filePath = Path.Combine(uploadsFolder, fileName);
            var relativePath = $"/uploads/maintenance/{fileName}";

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var photo = new MaintenancePhoto
            {
                MaintenanceRequestId = id,
                FilePath = relativePath,
                FileName = file.FileName,
                FileType = file.ContentType,
                FileSize = file.Length,
                Annotations = annotations,
                UploadedByUserId = currentUser.Id,
                UploadedByUserName = currentUser.Username ?? "Bilinmeyen",
                UploadedAt = DateTime.Now
            };

            _context.MaintenancePhotos.Add(photo);
            await _context.SaveChangesAsync();

            var result = new
            {
                id = photo.Id,
                filePath = photo.FilePath,
                fileName = photo.FileName,
                fileType = photo.FileType,
                fileSize = photo.FileSize,
                annotations = photo.Annotations,
                uploadedByUserName = photo.UploadedByUserName,
                uploadedAt = photo.UploadedAt
            };

            return CreatedAtAction(nameof(GetMaintenanceRequest), new { id }, result);
        }

        // GET: api/maintenance/schedules - Bakım planları listesi
        [HttpGet("schedules")]
        public async Task<ActionResult<IEnumerable<object>>> GetMaintenanceSchedules(
            [FromQuery] string? machineName = null,
            [FromQuery] bool? isCompleted = null)
        {
            var query = _context.MaintenanceSchedules.AsQueryable();

            if (!string.IsNullOrEmpty(machineName))
            {
                query = query.Where(s => s.MachineName == machineName);
            }

            if (isCompleted.HasValue)
            {
                query = query.Where(s => s.IsCompleted == isCompleted.Value);
            }

            var schedules = await query
                .OrderBy(s => s.StartDate)
                .ToListAsync();

            var result = schedules.Select(s => new
            {
                id = s.Id,
                machineName = s.MachineName,
                machineTableName = s.MachineTableName,
                maintenanceType = s.MaintenanceType,
                description = s.Description,
                startDate = s.StartDate,
                endDate = s.EndDate,
                notify30DaysBefore = s.Notify30DaysBefore,
                notify15DaysBefore = s.Notify15DaysBefore,
                notify3DaysBefore = s.Notify3DaysBefore,
                notification30DaysSentAt = s.Notification30DaysSentAt,
                notification15DaysSentAt = s.Notification15DaysSentAt,
                notification3DaysSentAt = s.Notification3DaysSentAt,
                isCompleted = s.IsCompleted,
                completedAt = s.CompletedAt,
                createdByUserId = s.CreatedByUserId,
                createdByUserName = s.CreatedByUserName,
                createdAt = s.CreatedAt,
                isRecurring = s.IsRecurring,
                recurringIntervalDays = s.RecurringIntervalDays
            });

            return Ok(result);
        }

        // POST: api/maintenance/schedules - Yeni bakım planı oluştur
        [HttpPost("schedules")]
        public async Task<ActionResult<object>> CreateMaintenanceSchedule([FromBody] CreateMaintenanceScheduleDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            // Bitiş tarihi başlangıç tarihinden önce olamaz
            if (dto.EndDate < dto.StartDate)
            {
                return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden önce olamaz" });
            }

            var schedule = new MaintenanceSchedule
            {
                MachineName = dto.MachineName,
                MachineTableName = dto.MachineTableName,
                MaintenanceType = dto.MaintenanceType,
                Description = dto.Description,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Notify30DaysBefore = dto.Notify30DaysBefore,
                Notify15DaysBefore = dto.Notify15DaysBefore,
                Notify3DaysBefore = dto.Notify3DaysBefore,
                IsCompleted = false,
                CreatedByUserId = currentUser.Id,
                CreatedByUserName = currentUser.Username ?? "Bilinmeyen",
                CreatedAt = DateTime.Now,
                IsRecurring = dto.IsRecurring,
                RecurringIntervalDays = dto.RecurringIntervalDays
            };

            _context.MaintenanceSchedules.Add(schedule);
            await _context.SaveChangesAsync();

            var result = new
            {
                id = schedule.Id,
                machineName = schedule.MachineName,
                maintenanceType = schedule.MaintenanceType,
                startDate = schedule.StartDate,
                endDate = schedule.EndDate,
                createdAt = schedule.CreatedAt
            };

            return CreatedAtAction(nameof(GetMaintenanceSchedules), null, result);
        }

        // POST: api/maintenance/schedules/5/complete - Bakım planını tamamlandı olarak işaretle
        [HttpPost("schedules/{id}/complete")]
        public async Task<ActionResult<object>> CompleteMaintenanceSchedule(int id)
        {
            var schedule = await _context.MaintenanceSchedules.FindAsync(id);
            if (schedule == null)
                return NotFound(new { message = "Bakım planı bulunamadı" });

            if (schedule.IsCompleted)
                return BadRequest(new { message = "Bakım planı zaten tamamlandı" });

            schedule.IsCompleted = true;
            schedule.CompletedAt = DateTime.Now;
            schedule.UpdatedAt = DateTime.Now;

            // Eğer tekrarlayan bakım ise, yeni bir plan oluştur
            if (schedule.IsRecurring && schedule.RecurringIntervalDays.HasValue)
            {
                var intervalDays = schedule.RecurringIntervalDays.Value;
                var newSchedule = new MaintenanceSchedule
                {
                    MachineName = schedule.MachineName,
                    MachineTableName = schedule.MachineTableName,
                    MaintenanceType = schedule.MaintenanceType,
                    Description = schedule.Description,
                    StartDate = schedule.StartDate.AddDays(intervalDays),
                    EndDate = schedule.EndDate.AddDays(intervalDays),
                    Notify30DaysBefore = schedule.Notify30DaysBefore,
                    Notify15DaysBefore = schedule.Notify15DaysBefore,
                    Notify3DaysBefore = schedule.Notify3DaysBefore,
                    IsCompleted = false,
                    CreatedByUserId = schedule.CreatedByUserId,
                    CreatedByUserName = schedule.CreatedByUserName,
                    CreatedAt = DateTime.Now,
                    IsRecurring = true,
                    RecurringIntervalDays = schedule.RecurringIntervalDays
                };
                _context.MaintenanceSchedules.Add(newSchedule);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Bakım planı tamamlandı", completedAt = schedule.CompletedAt });
        }

        // Bakım personeline email gönderme - DEVRE DIŞI
        // Email gönderimi kaldırıldı - Bildirimler bakım-onarım sekmesinde görünecek
        // İleride mobil uygulama için push notification eklenecek
        /*
        private async Task SendMaintenanceNotificationEmail(MaintenanceRequest request)
        {
            var personnel = await _context.Users
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.Email) && 
                           (u.Role == "maintenance" || u.Role == "engineer"))
                .ToListAsync();

            foreach (var person in personnel)
            {
                try
                {
                    await _emailService.SendMaintenanceRequestNotification(
                        person.Email!,
                        person.Username,
                        request.MachineName,
                        request.FaultType,
                        request.Description ?? "",
                        request.Id
                    );
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Email gönderme hatası ({person.Email}): {ex.Message}");
                }
            }
        }
        */

        // DTOs
        public class CreateMaintenanceRequestDto
        {
            public string MachineName { get; set; } = string.Empty;
            public string? MachineTableName { get; set; }
            public string FaultType { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? NotificationCategory { get; set; } = "maintenance"; // "maintenance", "production", "quality"
        }

        public class AddCommentDto
        {
            public string Content { get; set; } = string.Empty;
        }

        public class CreateMaintenanceScheduleDto
        {
            public string MachineName { get; set; } = string.Empty;
            public string? MachineTableName { get; set; }
            public string MaintenanceType { get; set; } = string.Empty;
            public string? Description { get; set; }
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public bool Notify30DaysBefore { get; set; } = true;
            public bool Notify15DaysBefore { get; set; } = true;
            public bool Notify3DaysBefore { get; set; } = true;
            public bool IsRecurring { get; set; } = false;
            public int? RecurringIntervalDays { get; set; }
        }

        // POST: api/maintenance/device-token - Device token kaydet/güncelle
        [HttpPost("device-token")]
        public async Task<ActionResult<object>> RegisterDeviceToken([FromBody] RegisterDeviceTokenDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            var success = await _pushNotificationService.RegisterDeviceToken(
                currentUser.Id,
                dto.Token,
                dto.Platform,
                dto.DeviceName,
                dto.AppVersion
            );

            if (success)
            {
                return Ok(new { message = "Device token başarıyla kaydedildi" });
            }
            else
            {
                return BadRequest(new { message = "Device token kaydedilemedi" });
            }
        }

        public class RegisterDeviceTokenDto
        {
            [Required]
            public string Token { get; set; } = string.Empty;
            [Required]
            public string Platform { get; set; } = string.Empty; // "ios", "android", "web"
            public string? DeviceName { get; set; }
            public string? AppVersion { get; set; }
        }

        // GET: api/maintenance/notification-recipients - Bildirim alıcılarını listele
        [HttpGet("notification-recipients")]
        public async Task<ActionResult<IEnumerable<object>>> GetNotificationRecipients()
        {
            var recipients = await _context.MaintenanceNotificationRecipients
                .Include(r => r.User)
                .OrderBy(r => r.UserName)
                .ToListAsync();

            var result = recipients.Select(r => new
            {
                id = r.Id,
                userId = r.UserId,
                userName = r.UserName,
                userEmail = r.UserEmail,
                userRole = r.UserRole,
                isActive = r.IsActive,
                createdAt = r.CreatedAt,
                createdByUserName = r.CreatedByUserName
            });

            return Ok(result);
        }

        // POST: api/maintenance/notification-recipients - Bildirim alıcısı ekle
        [HttpPost("notification-recipients")]
        public async Task<ActionResult<object>> AddNotificationRecipient([FromBody] AddNotificationRecipientDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            // Sadece admin ekleyebilir
            if (currentUser.Role != "admin")
                return Forbid("Sadece admin bildirim alıcısı ekleyebilir");

            // Kategori kontrolü
            var validCategories = new[] { "maintenance", "production", "quality" };
            if (!validCategories.Contains(dto.NotificationCategory?.ToLower()))
            {
                return BadRequest(new { message = "Geçersiz bildirim kategorisi. Geçerli kategoriler: maintenance, production, quality" });
            }

            // Kullanıcıyı kontrol et
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
                return NotFound(new { message = "Kullanıcı bulunamadı" });

            // Aynı kullanıcı ve kategori kombinasyonu için kontrol et
            var existing = await _context.MaintenanceNotificationRecipients
                .FirstOrDefaultAsync(r => r.UserId == dto.UserId && r.NotificationCategory == dto.NotificationCategory);
            
            if (existing != null)
            {
                // Varsa aktif yap
                existing.IsActive = true;
                existing.UpdatedAt = DateTime.Now;
            }
            else
            {
                // Yeni ekle
                var recipient = new MaintenanceNotificationRecipient
                {
                    UserId = dto.UserId,
                    UserName = user.Username ?? "Bilinmeyen",
                    UserEmail = user.Email,
                    UserRole = user.Role,
                    NotificationCategory = dto.NotificationCategory.ToLower(),
                    IsActive = true,
                    CreatedByUserId = currentUser.Id,
                    CreatedByUserName = currentUser.Username ?? "Bilinmeyen",
                    CreatedAt = DateTime.Now
                };
                _context.MaintenanceNotificationRecipients.Add(recipient);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Bildirim alıcısı eklendi" });
        }

        // DELETE: api/maintenance/notification-recipients/5 - Bildirim alıcısını kaldır
        [HttpDelete("notification-recipients/{id}")]
        public async Task<ActionResult<object>> RemoveNotificationRecipient(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            // Sadece admin silebilir
            if (currentUser.Role != "admin")
                return Forbid("Sadece admin bildirim alıcısı silebilir");

            var recipient = await _context.MaintenanceNotificationRecipients.FindAsync(id);
            if (recipient == null)
                return NotFound(new { message = "Bildirim alıcısı bulunamadı" });

            // Silmek yerine pasif yap
            recipient.IsActive = false;
            recipient.UpdatedAt = DateTime.Now;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Bildirim alıcısı kaldırıldı" });
        }

        public class AddNotificationRecipientDto
        {
            public int UserId { get; set; }
            [Required]
            public string NotificationCategory { get; set; } = "maintenance"; // "maintenance", "production", "quality"
        }

        // POST: api/maintenance/test-notification - Test bildirimi gönder
        [HttpPost("test-notification")]
        public async Task<ActionResult<object>> SendTestNotification([FromBody] SendTestNotificationDto dto)
        {
            var currentUser = await GetCurrentUserAsync();
            if (currentUser == null)
                return Unauthorized(new { message = "Kullanıcı bulunamadı" });

            // Sadece admin test bildirimi gönderebilir
            if (currentUser.Role != "admin")
                return Forbid("Sadece admin test bildirimi gönderebilir");

            try
            {
                // Kullanıcının aktif token'larını kontrol et
                var activeTokens = await _context.DeviceTokens
                    .Where(dt => dt.UserId == dto.UserId && dt.IsActive)
                    .ToListAsync();

                if (!activeTokens.Any())
                {
                    return BadRequest(new { 
                        message = "Kullanıcının aktif device token'ı bulunamadı. Bildirimin alınabilmesi için kullanıcının cihazında uygulamayı açıp bildirim izni vermesi gerekiyor.",
                        hasToken = false
                    });
                }

                // Eğer birden fazla aktif token varsa, sadece en son kullanılanı kullan
                var tokenToUse = activeTokens
                    .OrderByDescending(t => t.LastUsedAt ?? t.CreatedAt)
                    .First();
                
                _logger.LogInformation($"Test bildirimi gönderiliyor: UserId={dto.UserId}, TokenCount={activeTokens.Count}, UsingToken={tokenToUse.Id}");

                // Sadece en son kullanılan token'a bildirim gönder
                var success = await _pushNotificationService.SendPushNotificationToUsers(
                    new List<int> { dto.UserId },
                    dto.Title,
                    dto.Body,
                    new Dictionary<string, string>
                    {
                        { "type", "test_notification" },
                        { "category", dto.Category ?? "maintenance" }
                    }
                );
                
                // Her cihaz kendi token'ına sahip olmalı, diğer token'ları pasif etme

                if (success)
                {
                    return Ok(new { message = "Test bildirimi başarıyla gönderildi" });
                }
                else
                {
                    return BadRequest(new { 
                        message = "Test bildirimi gönderilemedi. Token geçersiz olabilir veya Firebase bağlantısında sorun olabilir.",
                        hasToken = true
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Test bildirimi gönderilirken hata oluştu: " + ex.Message });
            }
        }

        public class SendTestNotificationDto
        {
            [Required]
            public int UserId { get; set; }
            [Required]
            public string Title { get; set; } = string.Empty;
            [Required]
            public string Body { get; set; } = string.Empty;
            public string? Category { get; set; } = "maintenance";
        }
    }
}

