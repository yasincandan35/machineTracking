# @ Mention Entegrasyonu - C# Backend İçin TAM REHBER

## 📋 Özet

**Frontend**: ✅ HAZIR (MentionInput çalışıyor)
**Backend**: ⚠️ 5 dosya değişikliği + 3 yeni dosya gerekli

---

## 🔧 ADIM 1: Email Servisi Oluştur

### YENİ DOSYA: `Services/EmailService.cs`

```csharp
using System.Net;
using System.Net.Mail;

namespace BobstDashboardAPI.Services
{
    public class EmailService
    {
        private readonly IConfiguration _configuration;
        private readonly string _smtpServer = "smtp.gmail.com";
        private readonly int _smtpPort = 587;
        private readonly string _senderEmail = "yasin.egemambalaj@gmail.com";
        
        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }
        
        private string GetPassword()
        {
            // appsettings.json'dan veya ortam değişkeninden al
            return _configuration["EmailSettings:Password"] ?? 
                   Environment.GetEnvironmentVariable("EMAIL_PASSWORD") ?? "";
        }
        
        public async Task<bool> SendMentionInFeedback(
            string toEmail, 
            string username, 
            string mentionedBy, 
            string feedbackContent, 
            int feedbackId)
        {
            try
            {
                var subject = "Egem Dashboard - Geri Bildirimde Bahsedildiniz";
                var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;'>
            <h2>🔔 Egem Dashboard Geri Bildirim Sistemi</h2>
        </div>
        <div style='background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;'>
            <p>Merhaba <strong>{username}</strong>,</p>
            <p><strong>{mentionedBy}</strong> kullanıcısı bir geri bildirimde sizden bahsetti:</p>
            
            <div style='background-color: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0;'>
                <p><em>{feedbackContent}</em></p>
            </div>
            
            <p>Geri bildirimi görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
            
            <a href='http://192.168.1.44:5173/feedback' 
               style='display: inline-block; padding: 12px 24px; background-color: #3b82f6; 
                      color: white; text-decoration: none; border-radius: 6px; margin-top: 15px;'>
                Geri Bildirimi Görüntüle
            </a>
        </div>
        <div style='text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;'>
            <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
            <p>© 2025 EGEM Makine Takip Sistemi</p>
        </div>
    </div>
</body>
</html>";
                
                return await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email gönderme hatası (mention in feedback): {ex.Message}");
                return false;
            }
        }
        
        public async Task<bool> SendMentionInComment(
            string toEmail, 
            string username, 
            string mentionedBy, 
            string commentContent, 
            int feedbackId)
        {
            try
            {
                var subject = "Egem Dashboard - Yorumda Bahsedildiniz";
                var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;'>
            <h2>💬 Egem Dashboard Geri Bildirim Sistemi</h2>
        </div>
        <div style='background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;'>
            <p>Merhaba <strong>{username}</strong>,</p>
            <p><strong>{mentionedBy}</strong> kullanıcısı bir yorumda sizden bahsetti:</p>
            
            <div style='background-color: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0;'>
                <p><em>{commentContent}</em></p>
            </div>
            
            <p>Yorumu görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
            
            <a href='http://192.168.1.44:5173/feedback' 
               style='display: inline-block; padding: 12px 24px; background-color: #10b981; 
                      color: white; text-decoration: none; border-radius: 6px; margin-top: 15px;'>
                Yorumu Görüntüle
            </a>
        </div>
        <div style='text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;'>
            <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
            <p>© 2025 EGEM Makine Takip Sistemi</p>
        </div>
    </div>
</body>
</html>";
                
                return await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email gönderme hatası (mention in comment): {ex.Message}");
                return false;
            }
        }
        
        public async Task<bool> SendFeedbackReplyNotification(
            string toEmail, 
            string username, 
            string replier, 
            string commentContent,
            string originalFeedback,
            int feedbackId)
        {
            try
            {
                var subject = "Egem Dashboard - Geri Bildiriminize Yanıt Geldi";
                var body = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6;'>
    <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
        <div style='background-color: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0;'>
            <h2>✉️ Egem Dashboard Geri Bildirim Sistemi</h2>
        </div>
        <div style='background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;'>
            <p>Merhaba <strong>{username}</strong>,</p>
            <p><strong>{replier}</strong> kullanıcısı geri bildiriminize yanıt verdi:</p>
            
            <div style='background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0;'>
                <strong>Sizin geri bildiriminiz:</strong>
                <p><em>{originalFeedback}</em></p>
            </div>
            
            <div style='background-color: white; padding: 15px; border-left: 4px solid #8b5cf6; margin: 15px 0;'>
                <strong>Yanıt:</strong>
                <p><em>{commentContent}</em></p>
            </div>
            
            <p>Yanıtı görüntülemek için dashboard'a giriş yapabilirsiniz.</p>
            
            <a href='http://192.168.1.44:5173/feedback' 
               style='display: inline-block; padding: 12px 24px; background-color: #8b5cf6; 
                      color: white; text-decoration: none; border-radius: 6px; margin-top: 15px;'>
                Yanıtı Görüntüle
            </a>
        </div>
        <div style='text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;'>
            <p>Bu otomatik bir bildirimdir. Lütfen yanıtlamayın.</p>
            <p>© 2025 EGEM Makine Takip Sistemi</p>
        </div>
    </div>
</body>
</html>";
                
                return await SendEmail(toEmail, subject, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email gönderme hatası (feedback reply): {ex.Message}");
                return false;
            }
        }
        
        private async Task<bool> SendEmail(string to, string subject, string htmlBody)
        {
            try
            {
                var password = GetPassword();
                if (string.IsNullOrEmpty(password))
                {
                    Console.WriteLine("UYARI: Email şifresi bulunamadı!");
                    return false;
                }
                
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
                Console.WriteLine($"Email başarıyla gönderildi: {to}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Email gönderme hatası: {ex.Message}");
                return false;
            }
        }
    }
}
```

---

## 🔧 ADIM 2: DTO Sınıfları Oluştur

### YENİ DOSYA: `Model/FeedbackDto.cs`

```csharp
namespace BobstDashboardAPI.Model
{
    public class FeedbackDto
    {
        public string Content { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public List<string> Mentions { get; set; } = new List<string>(); // ← YENİ
    }
}
```

### YENİ DOSYA: `Model/CommentDto.cs`

```csharp
namespace BobstDashboardAPI.Model
{
    public class CommentDto
    {
        public int FeedbackId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public List<string> Mentions { get; set; } = new List<string>(); // ← YENİ
    }
}
```

---

## 🔧 ADIM 3: Program.cs'i Güncelle

**DOSYA: `Program.cs`**

**51. satırdan SONRA ekle:**

```csharp
// 💉 Servisler
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<EmailService>(); // ← BURAYI EKLE
```

---

## 🔧 ADIM 4: AuthController'a YENİ Endpoint Ekle

**DOSYA: `Controllers/AuthController.cs`**

**260. satırdan SONRA (en sona) ekle:**

```csharp
        // Mention için kullanıcı listesi (auth olmadan)
        [HttpGet("/api/users")]
        [AllowAnonymous]
        public async Task<IActionResult> GetUsersForMention()
        {
            var users = await _context.Users
                .Select(u => new {
                    u.Id,
                    u.Username,
                    u.Email,
                    FullName = u.Username // Eğer FullName property'si varsa kullan
                })
                .ToListAsync();
            
            return Ok(users);
        }
```

---

## 🔧 ADIM 5: FeedbackController'ı Güncelle

**DOSYA: `Controllers/FeedbackController.cs`**

**1) Constructor'ı güncelle (13-17. satırları):**

```csharp
    private readonly SensorDbContext _context;
    private readonly EmailService _emailService; // ← EKLE

    public FeedbackController(SensorDbContext context, EmailService emailService) // ← EmailService ekle
    {
        _context = context;
        _emailService = emailService; // ← EKLE
    }
```

**2) PostFeedback metodunu değiştir (48-56. satırları):**

```csharp
        // POST: api/feedback
        [HttpPost]
        public async Task<ActionResult<Feedback>> PostFeedback(FeedbackDto dto) // ← Feedback yerine FeedbackDto
        {
            var feedback = new Feedback
            {
                Content = dto.Content,
                UserId = dto.UserId,
                UserName = dto.UserName,
                CreatedAt = DateTime.Now
            };
            
            _context.Feedbacks.Add(feedback);
            await _context.SaveChangesAsync();
            
            // ↓↓↓ MENTION HANDLING EKLE ↓↓↓
            if (dto.Mentions != null && dto.Mentions.Any())
            {
                foreach (var username in dto.Mentions)
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.Username == username);
                    
                    if (user != null && !string.IsNullOrEmpty(user.Email))
                    {
                        await _emailService.SendMentionInFeedback(
                            user.Email,
                            user.Username,
                            dto.UserName,
                            dto.Content,
                            feedback.Id
                        );
                    }
                }
            }
            // ↑↑↑ MENTION HANDLING SON ↑↑↑

            return CreatedAtAction("GetFeedback", new { id = feedback.Id }, feedback);
        }
```

---

## 🔧 ADIM 6: CommentsController'ı Güncelle

**DOSYA: `Controllers/CommentsController.cs`**

**1) Constructor'ı güncelle (12-17. satırları):**

```csharp
    private readonly SensorDbContext _context;
    private readonly EmailService _emailService; // ← EKLE

    public CommentsController(SensorDbContext context, EmailService emailService) // ← EmailService ekle
    {
        _context = context;
        _emailService = emailService; // ← EKLE
    }
```

**2) PostComment metodunu değiştir (29-38. satırları):**

```csharp
        // POST: api/comments
        [HttpPost]
        public async Task<ActionResult<Comment>> PostComment(CommentDto dto) // ← Comment yerine CommentDto
        {
            var comment = new Comment
            {
                FeedbackId = dto.FeedbackId,
                UserId = dto.UserId,
                UserName = dto.UserName,
                Content = dto.Content,
                CreatedAt = DateTime.Now
            };
            
            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();
            
            // ↓↓↓ FEEDBACK SAHİBİNE BİLDİRİM ↓↓↓
            var feedback = await _context.Feedbacks
                .FirstOrDefaultAsync(f => f.Id == dto.FeedbackId);
            
            if (feedback != null && feedback.UserId != dto.UserId)
            {
                var feedbackOwner = await _context.Users
                    .FirstOrDefaultAsync(u => u.Id == feedback.UserId);
                
                if (feedbackOwner != null && !string.IsNullOrEmpty(feedbackOwner.Email))
                {
                    await _emailService.SendFeedbackReplyNotification(
                        feedbackOwner.Email,
                        feedbackOwner.Username,
                        dto.UserName,
                        dto.Content,
                        feedback.Content,
                        dto.FeedbackId
                    );
                }
            }
            
            // ↓↓↓ MENTION EDİLEN KULLANICILARA BİLDİRİM ↓↓↓
            if (dto.Mentions != null && dto.Mentions.Any())
            {
                foreach (var username in dto.Mentions)
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.Username == username);
                    
                    if (user != null && !string.IsNullOrEmpty(user.Email))
                    {
                        await _emailService.SendMentionInComment(
                            user.Email,
                            user.Username,
                            dto.UserName,
                            dto.Content,
                            dto.FeedbackId
                        );
                    }
                }
            }
            // ↑↑↑ MENTION HANDLING SON ↑↑↑

            return CreatedAtAction("GetCommentsByFeedback", new { feedbackId = comment.FeedbackId }, comment);
        }
```

---

## 🔐 ADIM 7: appsettings.json'a Email Şifresi Ekle

**DOSYA: `appsettings.json`**

En alta ekle:

```json
{
  ... mevcut ayarlar ...
  
  "EmailSettings": {
    "Password": "sizin-gmail-app-password"
  }
}
```

**VEYA** Ortam Değişkeni Kullan (Daha Güvenli):

Windows PowerShell (Admin):
```powershell
[System.Environment]::SetEnvironmentVariable('EMAIL_PASSWORD', 'sizin-app-password', 'User')
```

---

## 📋 Özet - Yapılacaklar Listesi

### ✅ Yeni Dosyalar (3 adet):
1. [ ] `Services/EmailService.cs` - Email gönderme servisi
2. [ ] `Model/FeedbackDto.cs` - Mentions property'li DTO
3. [ ] `Model/CommentDto.cs` - Mentions property'li DTO

### ✏️ Güncellenecek Dosyalar (4 adet):
4. [ ] `Program.cs` - EmailService'i DI'a ekle (1 satır)
5. [ ] `Controllers/AuthController.cs` - `/api/users` endpoint ekle (~15 satır)
6. [ ] `Controllers/FeedbackController.cs` - Constructor ve PostFeedback (~30 satır)
7. [ ] `Controllers/CommentsController.cs` - Constructor ve PostComment (~50 satır)

### 🔐 Konfigürasyon:
8. [ ] Gmail App Password oluştur
9. [ ] `appsettings.json` veya ortam değişkeni ayarla

---

## 🎬 Test

```bash
# 1. Kullanıcı listesi (mention için)
curl http://192.168.1.237:5199/api/users

# 2. Mention ile feedback gönder
curl -X POST http://192.168.1.237:5199/api/Feedback \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test feedback @admin",
    "userId": 4,
    "userName": "yyc",
    "mentions": ["admin", "niko"]
  }'

# 3. Mention ile comment gönder
curl -X POST http://192.168.1.237:5199/api/Comments \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": 3,
    "content": "Test yorum @niko",
    "userId": 4,
    "userName": "yyc",
    "mentions": ["niko"]
  }'
```

---

**TAMAMLANDI!** 🎉

Frontend zaten hazır, backend'e bu değişiklikleri yaptıktan sonra @ mention sistemi tam çalışır hale gelecek!


