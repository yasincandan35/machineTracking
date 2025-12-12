using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DashboardBackend.Data;
using DashboardBackend.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using FirebaseAdmin.Messaging;

namespace DashboardBackend.Services
{
    public class PushNotificationService
    {
        private readonly DashboardDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PushNotificationService> _logger;

        public PushNotificationService(
            DashboardDbContext context,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            ILogger<PushNotificationService> logger)
        {
            _context = context;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        private bool IsFirebaseInitialized()
        {
            try
            {
                return FirebaseMessaging.DefaultInstance != null;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Kullanıcının device token'ını kaydet veya güncelle
        /// </summary>
        public async Task<bool> RegisterDeviceToken(int userId, string token, string platform, string? deviceName = null, string? appVersion = null)
        {
            try
            {
                // Aynı kullanıcı için aynı token zaten varsa güncelle
                var existingToken = await _context.DeviceTokens
                    .FirstOrDefaultAsync(dt => dt.Token == token && dt.UserId == userId);

                if (existingToken != null)
                {
                    existingToken.LastUsedAt = DateTime.Now;
                    existingToken.IsActive = true;
                    existingToken.Platform = platform;
                    if (!string.IsNullOrEmpty(deviceName))
                        existingToken.DeviceName = deviceName;
                    if (!string.IsNullOrEmpty(appVersion))
                        existingToken.AppVersion = appVersion;
                }
                else
                {
                    // Yeni token ekle - eski token'ları pasif etme, her cihaz kendi token'ına sahip olmalı
                    var deviceToken = new DeviceToken
                    {
                        UserId = userId,
                        Token = token,
                        Platform = platform,
                        DeviceName = deviceName,
                        AppVersion = appVersion,
                        CreatedAt = DateTime.Now,
                        LastUsedAt = DateTime.Now,
                        IsActive = true
                    };
                    _context.DeviceTokens.Add(deviceToken);
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Device token kaydedilemedi: UserId={UserId}, Token={Token}", userId, token);
                return false;
            }
        }

        /// <summary>
        /// Belirli kullanıcılara push notification gönder
        /// </summary>
        public async Task<bool> SendPushNotificationToUsers(
            List<int> userIds,
            string title,
            string body,
            Dictionary<string, string>? data = null)
        {
            try
            {
                
                if (!IsFirebaseInitialized())
                {
                    _logger.LogWarning("Firebase Admin SDK başlatılmamış, push notification gönderilemedi.");
                    return false;
                }

                // Kullanıcıların aktif device token'larını al
                // SQL Server uyumluluğu için Contains yerine manuel filtreleme
                var allActiveTokens = await _context.DeviceTokens
                    .Where(dt => dt.IsActive)
                    .ToListAsync();
                
                // Memory'de filtrele (SQL Server uyumluluğu için)
                // Tüm aktif token'ları al (her cihaz için ayrı bildirim gönderilecek)
                var deviceTokens = allActiveTokens
                    .Where(dt => userIds.Contains(dt.UserId))
                    .ToList();

                if (!deviceTokens.Any())
                {
                    _logger.LogWarning("⚠️ Gönderilecek aktif device token bulunamadı. UserIds: {UserIds}", string.Join(", ", userIds));
                    return false;
                }
                
                _logger.LogInformation("📱 {Count} device token bulundu: UserIds={UserIds}", deviceTokens.Count, string.Join(", ", userIds));

                var successCount = 0;
                var failCount = 0;
                var sentTokens = new HashSet<string>(); // Aynı token'a 2 kez gönderilmesini önle

                // Her device token için ayrı ayrı gönder
                foreach (var deviceToken in deviceTokens)
                {
                    // Aynı token'a daha önce gönderildiyse atla
                    if (sentTokens.Contains(deviceToken.Token))
                    {
                        continue;
                    }
                    sentTokens.Add(deviceToken.Token);
                    
                    try
                    {
                        // Web platformu için sadece Notification gönder (Webpush.Notification ile birlikte gönderilirse çift bildirim olur)
                        // Mobil platformlar için hem Notification hem Data gönder
                        Message message;
                        
                        if (deviceToken.Platform == "web")
                        {
                            // Web için sadece Data gönder, Notification gönderme!
                            // Firebase Notification payload gönderilirse otomatik bildirim gösterir
                            // Service worker'daki onBackgroundMessage de bildirim gösterir
                            // Bu yüzden 2 bildirim gelir. Çözüm: Sadece Data gönder, bildirimi service worker göstersin
                            
                            // Data payload'ına title ve body ekle (service worker'da kullanmak için)
                            var webData = new Dictionary<string, string>();
                            if (data != null)
                            {
                                foreach (var kvp in data)
                                {
                                    webData[kvp.Key] = kvp.Value;
                                }
                            }
                            webData["title"] = title;
                            webData["body"] = body;
                            
                            message = new Message()
                            {
                                Token = deviceToken.Token,
                                // Notification payload YOK - çift bildirim olmasın!
                                // Sadece Data gönder, service worker bildirimi gösterecek
                                Data = webData
                            };
                        }
                        else
                        {
                            // Mobil için hem Notification hem Data gönder
                            message = new Message()
                            {
                                Token = deviceToken.Token,
                                Notification = new Notification()
                                {
                                    Title = title,
                                    Body = body
                                },
                                Data = data,
                                Android = new AndroidConfig()
                                {
                                    Priority = Priority.High
                                },
                                Apns = new ApnsConfig()
                                {
                                    Aps = new Aps()
                                    {
                                        Sound = "default",
                                        ContentAvailable = true
                                    }
                                }
                            };
                        }

                        var response = await FirebaseMessaging.DefaultInstance.SendAsync(message);
                        
                        successCount++;
                        deviceToken.LastUsedAt = DateTime.Now;
                    }
                    catch (FirebaseMessagingException ex)
                    {
                        failCount++;
                        _logger.LogWarning("Push notification gönderilemedi: UserId={UserId}, ErrorCode={ErrorCode}, Message={Message}", 
                            deviceToken.UserId, ex.MessagingErrorCode.ToString(), ex.Message);

                        // Eğer token geçersizse, token'ı pasif yap
                        var errorCode = ex.MessagingErrorCode;
                        if (errorCode == MessagingErrorCode.InvalidArgument || 
                            errorCode == MessagingErrorCode.Unregistered ||
                            errorCode == MessagingErrorCode.SenderIdMismatch)
                        {
                            deviceToken.IsActive = false;
                        }
                    }
                    catch (Exception ex)
                    {
                        failCount++;
                        _logger.LogError(ex, "Push notification gönderme hatası: UserId={UserId}", deviceToken.UserId);
                    }
                }

                await _context.SaveChangesAsync();

                return successCount > 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Push notification gönderme genel hatası");
                return false;
            }
        }

        /// <summary>
        /// Bakım personeline arıza bildirimi gönder
        /// </summary>
        public async Task SendMaintenanceRequestNotification(
            string machineName,
            string faultType,
            string? description,
            int requestId,
            string category = "maintenance") // "maintenance", "production", "quality"
        {
            try
            {
                // Admin tarafından belirlenen bildirim alıcılarını bul (kategoriye göre)
                var maintenanceUserIds = await _context.MaintenanceNotificationRecipients
                    .Where(r => r.IsActive && r.NotificationCategory == category)
                    .Select(r => r.UserId)
                    .Distinct()
                    .ToListAsync();

                if (!maintenanceUserIds.Any())
                {
                    return;
                }

                var title = "🔧 Yeni Arıza Bildirimi";
                var body = $"{machineName} - {faultType}";
                
                var data = new Dictionary<string, string>
                {
                    { "type", "maintenance_request" },
                    { "requestId", requestId.ToString() },
                    { "machineName", machineName },
                    { "faultType", faultType }
                };

                if (!string.IsNullOrEmpty(description))
                {
                    data["description"] = description;
                }

                await SendPushNotificationToUsers(maintenanceUserIds, title, body, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bakım bildirimi push notification gönderme hatası");
            }
        }

        /// <summary>
        /// Bakım hatırlatması gönder
        /// </summary>
        public async Task SendMaintenanceReminderNotification(
            string machineName,
            string maintenanceType,
            DateTime startDate,
            int daysUntil,
            string category = "maintenance") // "maintenance", "production", "quality"
        {
            try
            {
                // Admin tarafından belirlenen bildirim alıcılarını bul (kategoriye göre)
                var maintenanceUserIds = await _context.MaintenanceNotificationRecipients
                    .Where(r => r.IsActive && r.NotificationCategory == category)
                    .Select(r => r.UserId)
                    .Distinct()
                    .ToListAsync();

                if (!maintenanceUserIds.Any())
                {
                    return;
                }

                var title = "⏰ Bakım Hatırlatması";
                var body = $"{machineName} - {maintenanceType} ({daysUntil} gün kaldı)";
                
                var data = new Dictionary<string, string>
                {
                    { "type", "maintenance_reminder" },
                    { "machineName", machineName },
                    { "maintenanceType", maintenanceType },
                    { "startDate", startDate.ToString("yyyy-MM-ddTHH:mm:ss") },
                    { "daysUntil", daysUntil.ToString() }
                };

                await SendPushNotificationToUsers(maintenanceUserIds, title, body, data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bakım hatırlatması push notification gönderme hatası");
            }
        }
    }
}

