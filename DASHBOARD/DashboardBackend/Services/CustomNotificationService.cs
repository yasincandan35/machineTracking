using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.RegularExpressions;

namespace DashboardBackend.Services
{
    /// <summary>
    /// Custom Notification Service - Kullanıcıların özelleştirilebilir bildirim ayarlarını kontrol eder ve bildirim gönderir
    /// </summary>
    public class CustomNotificationService : BackgroundService
    {
        private readonly ILogger<CustomNotificationService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;
        
        // Son bildirim gönderilen zamanları takip et (spam önleme)
        private readonly Dictionary<string, DateTime> _lastNotificationTimes = new();
        // Eşik aşıldığında bildirim gönderildi mi? (eşik altına düşene kadar tekrar gönderme)
        private readonly Dictionary<string, bool> _thresholdExceeded = new();
        private readonly object _notificationLock = new();

        public CustomNotificationService(
            ILogger<CustomNotificationService> logger,
            IServiceProvider serviceProvider,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🔔 Custom Notification Service başlatılıyor...");

            // İlk kontrol için 30 saniye bekle (servislerin hazır olması için)
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            
            _logger.LogInformation("✅ Custom Notification Service başlatıldı, ilk kontrol başlıyor...");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("⏰ Bildirim kontrolü başlatılıyor...");
                    await CheckAndSendNotificationsAsync(stoppingToken);
                    _logger.LogInformation("✅ Bildirim kontrolü tamamlandı");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ Bildirim kontrolü sırasında hata oluştu");
                }

                // Her 60 saniyede bir kontrol et
                _logger.LogInformation("⏳ 60 saniye bekleniyor...");
                await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
            }
        }

        // Helper method to safely convert JsonElement or other types to double
        private double? TryGetDoubleValue(object? value)
        {
            if (value == null) return null;
            
            try
            {
                if (value is System.Text.Json.JsonElement jsonElement)
                {
                    if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                    {
                        return jsonElement.GetDouble();
                    }
                    else if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (double.TryParse(jsonElement.GetString(), out var parsed))
                            return parsed;
                    }
                }
                else
                {
                    return Convert.ToDouble(value);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Değer dönüştürülemedi: {Value}, Type: {Type}", value, value?.GetType().Name);
            }
            
            return null;
        }

        private async Task CheckAndSendNotificationsAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
            var pushNotificationService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();
            var machineDatabaseService = scope.ServiceProvider.GetRequiredService<MachineDatabaseService>();

            // Aktif bildirim ayarlarını getir
            var activeSettings = await context.UserNotificationSettings
                .Where(s => s.IsEnabled)
                .Include(s => s.User)
                .Include(s => s.Machine)
                .ToListAsync(cancellationToken);

            if (!activeSettings.Any())
            {
                _logger.LogDebug("Aktif bildirim ayarı bulunamadı");
                return;
            }

            _logger.LogInformation("🔔 Bildirim kontrolü başladı: {Count} aktif ayar", activeSettings.Count);

            // Makine bazlı grupla
            var settingsByMachine = activeSettings.GroupBy(s => s.MachineId);

            foreach (var machineGroup in settingsByMachine)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var machineId = machineGroup.Key;
                var settings = machineGroup.ToList();

                // Makine bilgisini al
                MachineList? machine = null;
                if (machineId.HasValue)
                {
                    machine = await context.MachineLists.FindAsync(new object[] { machineId.Value }, cancellationToken);
                }

                // Tüm makineler için ayarlar varsa, her makineyi kontrol et
                if (!machineId.HasValue)
                {
                    var allMachines = await context.MachineLists.ToListAsync(cancellationToken);
                    foreach (var m in allMachines)
                    {
                        await CheckMachineNotificationsAsync(m, settings, context, pushNotificationService, machineDatabaseService, cancellationToken);
                    }
                }
                else if (machine != null)
                {
                    await CheckMachineNotificationsAsync(machine, settings, context, pushNotificationService, machineDatabaseService, cancellationToken);
                }
            }
        }

        private async Task CheckMachineNotificationsAsync(
            MachineList machine,
            List<UserNotificationSetting> settings,
            DashboardDbContext context,
            PushNotificationService pushNotificationService,
            MachineDatabaseService machineDatabaseService,
            CancellationToken cancellationToken)
        {
            try
            {
                // PLC verilerini al (makine API'sinden)
                var liveData = await GetLiveDataForMachineAsync(machine, machineDatabaseService, cancellationToken);
                if (liveData == null)
                {
                    _logger.LogWarning("⚠️ PLC verisi alınamadı: Machine={Machine}", machine.MachineName);
                    return; // Veri alınamadı, atla
                }
                
                _logger.LogInformation("✅ PLC verisi alındı: Machine={Machine}, Keys={Keys}", 
                    machine.MachineName, string.Join(", ", liveData.Keys));

                foreach (var setting in settings)
                {
                    if (cancellationToken.IsCancellationRequested) break;

                    // Spam önleme: Eşik aşıldığında bildirim gönder, eşik altına düşene kadar tekrar gönderme
                    var notificationKey = $"{setting.UserId}_{setting.MachineId}_{setting.NotificationType}";
                    
                    // Eşik durumunu kontrol et
                    bool wasExceeded = _thresholdExceeded.TryGetValue(notificationKey, out var exceeded) && exceeded;

                    bool shouldNotify = false;
                    bool isCurrentlyExceeded = false;
                    string? title = null;
                    string? body = null;

                    switch (setting.NotificationType)
                    {
                        case "stoppage_duration":
                            isCurrentlyExceeded = await CheckStoppageDurationAsync(setting, liveData, context, machine);
                            // Eşik aşıldıysa ve daha önce aşılmamışsa bildirim gönder
                            shouldNotify = isCurrentlyExceeded && !wasExceeded;
                            break;
                        case "speed_reached":
                            isCurrentlyExceeded = CheckSpeedReached(setting, liveData);
                            shouldNotify = isCurrentlyExceeded && !wasExceeded;
                            break;
                        case "new_report":
                            // Bu bildirim rapor oluşturulduğunda manuel olarak tetiklenir
                            continue;
                        case "production_complete":
                            isCurrentlyExceeded = CheckProductionComplete(setting, liveData);
                            shouldNotify = isCurrentlyExceeded && !wasExceeded;
                            break;
                        case "fire_threshold":
                            isCurrentlyExceeded = CheckFireThreshold(setting, liveData);
                            shouldNotify = isCurrentlyExceeded && !wasExceeded;
                            break;
                        case "oee_threshold":
                            isCurrentlyExceeded = CheckOEEThreshold(setting, liveData);
                            shouldNotify = isCurrentlyExceeded && !wasExceeded;
                            break;
                    }

                    if (shouldNotify)
                    {
                        title = FormatNotificationTitle(setting, machine, liveData);
                        body = FormatNotificationBody(setting, machine, liveData);

                        _logger.LogInformation("📤 Bildirim gönderiliyor: UserId={UserId}, Title={Title}, Body={Body}",
                            setting.UserId, title, body);

                        // Bildirim gönder
                        var result = await pushNotificationService.SendPushNotificationToUsers(
                            new List<int> { setting.UserId },
                            title,
                            body,
                            new Dictionary<string, string>
                            {
                                { "type", "custom_notification" },
                                { "notificationType", setting.NotificationType },
                                { "machineId", machine.Id.ToString() },
                                { "machineName", machine.MachineName }
                            }
                        );

                        // Son bildirim zamanını kaydet ve eşik aşıldı durumunu işaretle
                        lock (_notificationLock)
                        {
                            _lastNotificationTimes[notificationKey] = DateTime.Now;
                            _thresholdExceeded[notificationKey] = true; // Eşik aşıldı, bildirim gönderildi
                        }

                        if (result)
                        {
                            _logger.LogInformation("✅ Bildirim başarıyla gönderildi: UserId={UserId}, Type={Type}, Machine={Machine}",
                                setting.UserId, setting.NotificationType, machine.MachineName);
                        }
                        else
                        {
                            _logger.LogWarning("⚠️ Bildirim gönderilemedi: UserId={UserId}, Type={Type}, Machine={Machine}",
                                setting.UserId, setting.NotificationType, machine.MachineName);
                        }
                    }
                    else
                    {
                        // Eşik durumunu güncelle (eşik altına düştüyse sıfırla)
                        lock (_notificationLock)
                        {
                            if (wasExceeded && !isCurrentlyExceeded)
                            {
                                // Eşik altına düştü, bir sonraki eşik aşımında bildirim gönderilebilir
                                _thresholdExceeded[notificationKey] = false;
                                _logger.LogDebug("🔄 Eşik altına düştü, bir sonraki eşik aşımında bildirim gönderilecek: {Key}", notificationKey);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Makine bildirim kontrolü hatası: Machine={Machine}", machine.MachineName);
            }
        }

        private async Task<Dictionary<string, object>?> GetLiveDataForMachineAsync(
            MachineList machine,
            MachineDatabaseService machineDatabaseService,
            CancellationToken cancellationToken)
        {
            try
            {
                // PLC Data Collector API'sinden veri al
                var apiBaseUrl = _configuration["PLC:ApiBaseUrl"] ?? "http://localhost:5199";
                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(5);

                // Doğru endpoint: /api/plcdata/data
                var response = await httpClient.GetAsync($"{apiBaseUrl}/api/plcdata/data?machine={machine.TableName}", cancellationToken);
                
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(cancellationToken);
                    var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    if (data != null)
                    {
                        _logger.LogDebug("PLC verisi alındı: Machine={Machine}, Keys={Keys}", 
                            machine.MachineName, string.Join(", ", data.Keys));
                    }
                    return data;
                }
                else
                {
                    _logger.LogWarning("PLC verisi alınamadı: Machine={Machine}, Status={Status}", 
                        machine.MachineName, response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PLC verisi alınamadı: Machine={Machine}", machine.MachineName);
            }

            return null;
        }

        private async Task<bool> CheckStoppageDurationAsync(
            UserNotificationSetting setting,
            Dictionary<string, object> liveData,
            DashboardDbContext context,
            MachineList machine)
        {
            if (!setting.Threshold.HasValue) return false;

            // Duruş süresini al - farklı alan adlarını dene
            double? stoppageSeconds = null;
            
            // Önce totalStoppageDurationSec dene
            if (liveData.TryGetValue("totalStoppageDurationSec", out var stoppageSecObj))
            {
                stoppageSeconds = TryGetDoubleValue(stoppageSecObj);
            }
            // Sonra totalStoppageDuration dene (milisaniye cinsinden geliyor - örn: 378149 ms = ~6dk 20sn)
            else if (liveData.TryGetValue("totalStoppageDuration", out var stoppageObj))
            {
                var stoppageValue = TryGetDoubleValue(stoppageObj);
                if (stoppageValue.HasValue)
                {
                    // totalStoppageDuration milisaniye cinsinden geliyor, saniyeye çevir
                    stoppageSeconds = stoppageValue.Value / 1000.0; // Milisaniye -> Saniye
                }
            }
            // Son olarak stoppageDuration dene (milisaniye cinsinden)
            else if (liveData.TryGetValue("stoppageDuration", out var stoppageDurObj))
            {
                var stoppageValue = TryGetDoubleValue(stoppageDurObj);
                if (stoppageValue.HasValue)
                {
                    // stoppageDuration da milisaniye cinsinden geliyor
                    stoppageSeconds = stoppageValue.Value / 1000.0; // Milisaniye -> Saniye
                }
            }

            if (stoppageSeconds.HasValue)
            {
                // Birim kontrolü: minutes veya hours
                var thresholdSeconds = 0.0;
                var thresholdUnit = setting.ThresholdUnit?.ToLower() ?? "minutes";
                
                if (thresholdUnit == "hours")
                {
                    thresholdSeconds = (double)setting.Threshold.Value * 3600; // Saat -> Saniye
                }
                else // minutes (varsayılan)
                {
                    thresholdSeconds = (double)setting.Threshold.Value * 60; // Dakika -> Saniye
                }

                // Orijinal milisaniye değerini bul (log için)
                double originalMs = 0;
                if (liveData.TryGetValue("stoppageDuration", out var stopDurObj))
                {
                    var msValue = TryGetDoubleValue(stopDurObj);
                    if (msValue.HasValue) originalMs = msValue.Value;
                }
                else if (liveData.TryGetValue("totalStoppageDuration", out var totalStopDurObj))
                {
                    var msValue = TryGetDoubleValue(totalStopDurObj);
                    if (msValue.HasValue) originalMs = msValue.Value;
                }
                
                _logger.LogInformation("🔍 Duruş kontrolü: Machine={Machine}, Duruş={Stoppage}s ({StoppageMs}ms), Eşik={Threshold} {Unit} ({ThresholdSeconds}s)", 
                    machine.MachineName, stoppageSeconds.Value, originalMs, setting.Threshold.Value, thresholdUnit, thresholdSeconds);

                if (stoppageSeconds.Value >= thresholdSeconds)
                {
                    _logger.LogInformation("✅ Duruş eşiği aşıldı: Machine={Machine}, Duruş={Stoppage}s, Eşik={Threshold} {Unit} ({ThresholdSeconds}s)", 
                        machine.MachineName, stoppageSeconds.Value, setting.Threshold.Value, thresholdUnit, thresholdSeconds);
                    return true;
                }
            }
            else
            {
                _logger.LogWarning("Duruş süresi verisi bulunamadı: Machine={Machine}, Mevcut Keys={Keys}", 
                    machine.MachineName, string.Join(", ", liveData.Keys));
            }

            return false;
        }

        private bool CheckSpeedReached(UserNotificationSetting setting, Dictionary<string, object> liveData)
        {
            if (!setting.Threshold.HasValue) return false;

            // Makine hızı ve hedef hızı al
            if (liveData.TryGetValue("machineSpeed", out var speedObj) &&
                liveData.TryGetValue("targetSpeed", out var targetObj))
            {
                var currentSpeed = TryGetDoubleValue(speedObj);
                var targetSpeed = TryGetDoubleValue(targetObj);
                
                if (!currentSpeed.HasValue || !targetSpeed.HasValue) return false;

                if (targetSpeed.Value > 0)
                {
                    var percentage = (currentSpeed.Value / targetSpeed.Value) * 100;
                    var threshold = (double)setting.Threshold.Value;

                    if (percentage >= threshold)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private bool CheckProductionComplete(UserNotificationSetting setting, Dictionary<string, object> liveData)
        {
            if (!setting.Threshold.HasValue) return false;

            // Tamamlanma yüzdesini al
            if (liveData.TryGetValue("completionPercentage", out var completionObj))
            {
                var completion = TryGetDoubleValue(completionObj);
                if (!completion.HasValue) return false;
                
                var threshold = (double)setting.Threshold.Value;

                if (completion.Value >= threshold)
                {
                    return true;
                }
            }

            return false;
        }

        private bool CheckFireThreshold(UserNotificationSetting setting, Dictionary<string, object> liveData)
        {
            if (!setting.Threshold.HasValue) return false;

            // Fire oranını al
            if (liveData.TryGetValue("wastageRatio", out var fireObj))
            {
                var fireRatio = TryGetDoubleValue(fireObj);
                if (!fireRatio.HasValue) return false;
                
                var threshold = (double)setting.Threshold.Value;

                if (fireRatio.Value >= threshold)
                {
                    return true;
                }
            }

            return false;
        }

        private bool CheckOEEThreshold(UserNotificationSetting setting, Dictionary<string, object> liveData)
        {
            if (!setting.Threshold.HasValue) return false;

            // OEE değerini al
            if (liveData.TryGetValue("oee", out var oeeObj))
            {
                var oee = TryGetDoubleValue(oeeObj);
                if (!oee.HasValue) return false;
                
                var threshold = (double)setting.Threshold.Value;

                if (oee.Value < threshold) // OEE eşiğin altına düştüğünde
                {
                    return true;
                }
            }

            return false;
        }

        private string FormatNotificationTitle(UserNotificationSetting setting, MachineList machine, Dictionary<string, object> liveData)
        {
            var title = setting.NotificationTitle ?? "Bildirim";
            return ReplacePlaceholders(title, machine, liveData, setting);
        }

        private string FormatNotificationBody(UserNotificationSetting setting, MachineList machine, Dictionary<string, object> liveData)
        {
            var body = setting.NotificationBody ?? "Yeni bildirim";
            return ReplacePlaceholders(body, machine, liveData, setting);
        }

        private string ReplacePlaceholders(string text, MachineList machine, Dictionary<string, object> liveData, UserNotificationSetting? setting = null)
        {
            var result = text;
            
            // {machineName}
            result = result.Replace("{machineName}", machine.MachineName);
            
            // {threshold} - Eşik değeri
            if (setting != null && setting.Threshold.HasValue)
            {
                var thresholdValue = setting.Threshold.Value.ToString();
                var thresholdUnit = setting.ThresholdUnit?.ToLower() ?? "";
                
                // Birim etiketini ekle
                string thresholdDisplay = thresholdValue;
                if (thresholdUnit == "minutes")
                    thresholdDisplay = $"{thresholdValue} dakika";
                else if (thresholdUnit == "hours")
                    thresholdDisplay = $"{thresholdValue} saat";
                else if (thresholdUnit == "percent")
                    thresholdDisplay = $"%{thresholdValue}";
                
                result = result.Replace("{threshold}", thresholdDisplay);
            }

            // {currentValue}, {currentSpeed}, vb.
            if (liveData.TryGetValue("machineSpeed", out var speed))
                result = result.Replace("{currentSpeed}", speed.ToString());
            
            if (liveData.TryGetValue("wastageRatio", out var fire))
                result = result.Replace("{currentValue}", fire.ToString());
            
            if (liveData.TryGetValue("oee", out var oee))
                result = result.Replace("{currentValue}", oee.ToString());

            return result;
        }
        
        /// <summary>
        /// Yeni rapor oluşturulduğunda bildirim gönder (public metod - SqlProxy'den çağrılır)
        /// </summary>
        public async Task NotifyNewReportAsync(int machineId, string machineName)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
                var pushNotificationService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();
                
                // "new_report" tipindeki aktif bildirim ayarlarını al
                var settings = await context.UserNotificationSettings
                    .Where(s => s.IsEnabled 
                        && s.NotificationType == "new_report"
                        && (s.MachineId == null || s.MachineId == machineId))
                    .ToListAsync();
                
                if (!settings.Any())
                {
                    _logger.LogDebug("Yeni rapor bildirimi için aktif ayar bulunamadı: MachineId={MachineId}", machineId);
                    return;
                }
                
                // Her ayar için bildirim gönder
                foreach (var setting in settings)
                {
                    try
                    {
                        // Spam önleme kontrolü
                        var notificationKey = $"new_report_{setting.UserId}_{machineId}";
                        lock (_notificationLock)
                        {
                            if (_lastNotificationTimes.TryGetValue(notificationKey, out var lastTime))
                            {
                                // Son 5 dakika içinde bildirim gönderildiyse tekrar gönderme
                                if (DateTime.Now - lastTime < TimeSpan.FromMinutes(5))
                                {
                                    _logger.LogDebug("Yeni rapor bildirimi spam önleme nedeniyle atlandı: UserId={UserId}, MachineId={MachineId}", 
                                        setting.UserId, machineId);
                                    continue;
                                }
                            }
                        }
                        
                        // Bildirim başlığı ve içeriğini formatla
                        var title = FormatNotificationTitle(setting, new MachineList { Id = machineId, MachineName = machineName }, new Dictionary<string, object>());
                        var body = FormatNotificationBody(setting, new MachineList { Id = machineId, MachineName = machineName }, new Dictionary<string, object>());
                        
                        _logger.LogInformation("📤 Yeni rapor bildirimi gönderiliyor: UserId={UserId}, Title={Title}, Body={Body}",
                            setting.UserId, title, body);
                        
                        // Bildirim gönder
                        var result = await pushNotificationService.SendPushNotificationToUsers(
                            new List<int> { setting.UserId },
                            title,
                            body,
                            new Dictionary<string, string>
                            {
                                { "type", "custom_notification" },
                                { "notificationType", "new_report" },
                                { "machineId", machineId.ToString() },
                                { "machineName", machineName }
                            }
                        );
                        
                        // Son bildirim zamanını kaydet
                        lock (_notificationLock)
                        {
                            _lastNotificationTimes[notificationKey] = DateTime.Now;
                        }
                        
                        if (result)
                        {
                            _logger.LogInformation("✅ Yeni rapor bildirimi başarıyla gönderildi: UserId={UserId}, Machine={Machine}",
                                setting.UserId, machineName);
                        }
                        else
                        {
                            _logger.LogWarning("⚠️ Yeni rapor bildirimi gönderilemedi: UserId={UserId}, Machine={Machine}",
                                setting.UserId, machineName);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Yeni rapor bildirimi gönderilirken hata: UserId={UserId}, MachineId={MachineId}",
                            setting.UserId, machineId);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yeni rapor bildirimi kontrolü sırasında hata: MachineId={MachineId}", machineId);
            }
        }
    }
}

