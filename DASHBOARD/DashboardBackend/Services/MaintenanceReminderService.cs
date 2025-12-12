using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Services
{
    public class MaintenanceReminderService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MaintenanceReminderService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6); // 6 saatte bir kontrol et

        public MaintenanceReminderService(
            IServiceProvider serviceProvider,
            ILogger<MaintenanceReminderService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Bakım hatırlatma servisi başlatıldı.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndSendReminders();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Bakım hatırlatma kontrolü sırasında hata oluştu.");
                }

                await Task.Delay(_checkInterval, stoppingToken);
            }
        }

        private async Task CheckAndSendReminders()
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<EmailService>();
            var pushNotificationService = scope.ServiceProvider.GetRequiredService<PushNotificationService>();

            var now = DateTime.Now;
            var schedules = await context.MaintenanceSchedules
                .Where(s => !s.IsCompleted && s.StartDate > now)
                .ToListAsync();

            foreach (var schedule in schedules)
            {
                var daysUntil = (schedule.StartDate.Date - now.Date).Days;

                // 30 gün kala bildirim
                if (schedule.Notify30DaysBefore && 
                    daysUntil <= 30 && daysUntil > 15 && 
                    !schedule.Notification30DaysSentAt.HasValue)
                {
                    await SendReminderToPersonnel(context, emailService, pushNotificationService, schedule, 30);
                    schedule.Notification30DaysSentAt = now;
                }

                // 15 gün kala bildirim
                if (schedule.Notify15DaysBefore && 
                    daysUntil <= 15 && daysUntil > 3 && 
                    !schedule.Notification15DaysSentAt.HasValue)
                {
                    await SendReminderToPersonnel(context, emailService, pushNotificationService, schedule, 15);
                    schedule.Notification15DaysSentAt = now;
                }

                // 3 gün kala bildirim
                if (schedule.Notify3DaysBefore && 
                    daysUntil <= 3 && daysUntil >= 0 && 
                    !schedule.Notification3DaysSentAt.HasValue)
                {
                    await SendReminderToPersonnel(context, emailService, pushNotificationService, schedule, 3);
                    schedule.Notification3DaysSentAt = now;
                }
            }

            await context.SaveChangesAsync();
        }

        private async Task SendReminderToPersonnel(
            DashboardDbContext context, 
            EmailService emailService,
            PushNotificationService pushNotificationService,
            MaintenanceSchedule schedule, 
            int daysUntil)
        {
            // Admin tarafından belirlenen bildirim alıcılarını bul (maintenance kategorisi için)
            var recipientUserIds = await context.MaintenanceNotificationRecipients
                .Where(r => r.IsActive && r.NotificationCategory == "maintenance")
                .Select(r => r.UserId)
                .Distinct()
                .ToListAsync();

            var personnel = await context.Users
                .Where(u => u.IsActive && !string.IsNullOrEmpty(u.Email) && 
                           recipientUserIds.Contains(u.Id))
                .ToListAsync();

            foreach (var person in personnel)
            {
                try
                {
                    await emailService.SendMaintenanceReminder(
                        person.Email!,
                        person.Username,
                        schedule.MachineName,
                        schedule.MaintenanceType,
                        schedule.StartDate,
                        daysUntil
                    );
                    _logger.LogInformation($"Bakım hatırlatması (email) gönderildi: {person.Email} - {schedule.MachineName} ({daysUntil} gün kala)");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Bakım hatırlatması (email) gönderme hatası: {person.Email}");
                }
            }

            // Push notification gönder (mobil uygulamalar için)
            try
            {
                await pushNotificationService.SendMaintenanceReminderNotification(
                    schedule.MachineName,
                    schedule.MaintenanceType,
                    schedule.StartDate,
                    daysUntil
                );
                _logger.LogInformation($"Bakım hatırlatması (push) gönderildi: {schedule.MachineName} ({daysUntil} gün kala)");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Bakım hatırlatması (push) gönderme hatası");
            }
        }
    }
}

