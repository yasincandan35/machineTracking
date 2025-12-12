using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace DashboardBackend.Services
{
    public class EmailService
    {
        private readonly string _smtpServer = "smtp.gmail.com";
        private readonly int _smtpPort = 587;
        private readonly string _senderEmail = "yasin.egemambalaj@gmail.com";
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetPassword()
        {
            // Try to get from appsettings.json first, then environment variable
            var password = _configuration["EmailSettings:Password"] ?? 
                           Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(password))
            {
                Console.WriteLine("⚠️ Email şifresi bulunamadı! EMAIL_PASSWORD ortam değişkenini veya appsettings.json'ı ayarlayın.");
                throw new InvalidOperationException("Email password not found. Set EMAIL_PASSWORD environment variable or EmailSettings:Password in appsettings.json.");
            }
            return password;
        }

        public async Task SendMentionInFeedback(string toEmail, string username,
            string mentionedBy, string feedbackContent, int feedbackId)
        {
            try
            {
                var subject = "🔔 Egem Dashboard - Geri Bildirimde Bahsedildiniz";
                var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #e0f2fe;'>
                    <h2 style='color: #2196f3; border-bottom: 2px solid #2196f3; padding-bottom: 10px;'>🔔 Egem Dashboard Geri Bildirim Sistemi</h2>
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{mentionedBy}</strong> kullanıcısı bir geri bildirimde sizden bahsetti:</p>
                    <div style='background:#bbdefb; padding:15px; border-left:4px solid #2196f3; margin: 15px 0; border-radius: 4px;'>
                        <em style='color: #1976d2;'>""{feedbackContent}""</em>
                    </div>
                    <p>Geri bildirimi görüntülemek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
                    <p style='text-align: center; margin-top: 20px;'>
                        <a href='http://192.168.1.44:5173/feedback'
                           style='display: inline-block; padding: 12px 24px; background: #2196f3; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                            Geri Bildirimi Görüntüle
                        </a>
                    </p>
                    <p style='font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;'>
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
                    </p>
                </div>";
                await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email gönderme hatası: {ex.Message}");
            }
        }

        public async Task SendMentionInComment(string toEmail, string username,
            string mentionedBy, string commentContent, int feedbackId)
        {
            try
            {
                var subject = "💬 Egem Dashboard - Yorumda Bahsedildiniz";
                var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #e8f5e9;'>
                    <h2 style='color: #4caf50; border-bottom: 2px solid #4caf50; padding-bottom: 10px;'>💬 Egem Dashboard Geri Bildirim Sistemi</h2>
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{mentionedBy}</strong> kullanıcısı bir yorumda sizden bahsetti:</p>
                    <div style='background:#c8e6c9; padding:15px; border-left:4px solid #4caf50; margin: 15px 0; border-radius: 4px;'>
                        <em style='color: #2e7d32;'>""{commentContent}""</em>
                    </div>
                    <p>İlgili geri bildirimi görüntülemek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
                    <p style='text-align: center; margin-top: 20px;'>
                        <a href='http://192.168.1.44:5173/feedback'
                           style='display: inline-block; padding: 12px 24px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                            Geri Bildirimi Görüntüle
                        </a>
                    </p>
                    <p style='font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;'>
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
                    </p>
                </div>";
                await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email gönderme hatası: {ex.Message}");
            }
        }

        public async Task SendFeedbackReply(string toEmail, string username,
            string replierName, string replyContent, string feedbackContent, int feedbackId)
        {
            try
            {
                var subject = "✉️ Egem Dashboard - Geri Bildiriminize Yanıt Aldınız";
                var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #ede7f6;'>
                    <h2 style='color: #673ab7; border-bottom: 2px solid #673ab7; padding-bottom: 10px;'>✉️ Egem Dashboard Geri Bildirim Sistemi</h2>
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p><strong>{replierName}</strong> kullanıcısı geri bildiriminize yanıt verdi:</p>
                    <div style='background:#d1c4e9; padding:15px; border-left:4px solid #673ab7; margin: 15px 0; border-radius: 4px;'>
                        <em style='color: #4527a0;'>""{replyContent}""</em>
                    </div>
                    <p>Yanıt verilen geri bildiriminiz:</p>
                    <div style='background:#e0e0e0; padding:10px; border-left:4px solid #9e9e9e; margin: 10px 0; font-size: 0.9em; color: #555; border-radius: 4px;'>
                        <em>""{feedbackContent}""</em>
                    </div>
                    <p>Geri bildirimi görüntülemek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
                    <p style='text-align: center; margin-top: 20px;'>
                        <a href='http://192.168.1.44:5173/feedback'
                           style='display: inline-block; padding: 12px 24px; background: #673ab7; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                            Geri Bildirimi Görüntüle
                        </a>
                    </p>
                    <p style='font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;'>
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
                    </p>
                </div>";
                await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email gönderme hatası: {ex.Message}");
            }
        }

        public async Task SendMaintenanceRequestNotification(string toEmail, string username,
            string machineName, string faultType, string description, int requestId)
        {
            try
            {
                var subject = "🔧 EGEM Makine Takip Sistemi - Yeni Arıza Bildirimi";
                var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff3cd;'>
                    <h2 style='color: #f57c00; border-bottom: 2px solid #f57c00; padding-bottom: 10px;'>🔧 Yeni Arıza Bildirimi</h2>
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p>Yeni bir arıza bildirimi oluşturuldu:</p>
                    <div style='background:#ffe0b2; padding:15px; border-left:4px solid #f57c00; margin: 15px 0; border-radius: 4px;'>
                        <p><strong>Makine:</strong> {machineName}</p>
                        <p><strong>Arıza Tipi:</strong> {faultType}</p>
                        {(string.IsNullOrEmpty(description) ? "" : $"<p><strong>Açıklama:</strong> {description}</p>")}
                    </div>
                    <p>Arıza bildirimini görüntülemek ve kabul etmek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
                    <p style='text-align: center; margin-top: 20px;'>
                        <a href='http://192.168.1.44:5173/maintenance'
                           style='display: inline-block; padding: 12px 24px; background: #f57c00; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                            Arıza Bildirimini Görüntüle
                        </a>
                    </p>
                    <p style='font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;'>
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
                    </p>
                </div>";
                await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email gönderme hatası: {ex.Message}");
            }
        }

        public async Task SendMaintenanceReminder(string toEmail, string username,
            string machineName, string maintenanceType, DateTime startDate, int daysUntil)
        {
            try
            {
                var subject = $"⏰ EGEM Makine Takip Sistemi - Bakım Hatırlatması ({daysUntil} gün kaldı)";
                var body = $@"
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #e3f2fd;'>
                    <h2 style='color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;'>⏰ Bakım Hatırlatması</h2>
                    <p>Merhaba <strong>{username}</strong>,</p>
                    <p>Planlanan bakım yaklaşıyor:</p>
                    <div style='background:#bbdefb; padding:15px; border-left:4px solid #1976d2; margin: 15px 0; border-radius: 4px;'>
                        <p><strong>Makine:</strong> {machineName}</p>
                        <p><strong>Bakım Tipi:</strong> {maintenanceType}</p>
                        <p><strong>Başlangıç Tarihi:</strong> {startDate:dd.MM.yyyy HH:mm}</p>
                        <p><strong>Kalan Süre:</strong> <strong style='color: #d32f2f;'>{daysUntil} gün</strong></p>
                    </div>
                    <p>Bakım planlamasını görüntülemek için aşağıdaki bağlantıyı kullanabilirsiniz:</p>
                    <p style='text-align: center; margin-top: 20px;'>
                        <a href='http://192.168.1.44:5173/maintenance'
                           style='display: inline-block; padding: 12px 24px; background: #1976d2; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;'>
                            Bakım Planlamasını Görüntüle
                        </a>
                    </p>
                    <p style='font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;'>
                        Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayın.
                    </p>
                </div>";
                await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email gönderme hatası: {ex.Message}");
            }
        }

        private async Task SendEmail(string to, string subject, string htmlBody)
        {
            try
            {
                var password = GetPassword();
                
                using var message = new MailMessage(_senderEmail, to)
                {
                    Subject = subject,
                    Body = htmlBody,
                    IsBodyHtml = true
                };

                using var client = new SmtpClient(_smtpServer, _smtpPort)
                {
                    EnableSsl = true,
                    Credentials = new NetworkCredential(_senderEmail, password)
                };

                await client.SendMailAsync(message);
                Console.WriteLine($"✅ Email gönderildi: {to}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Email hatası: {ex.Message}");
                throw;
            }
        }
    }
}

