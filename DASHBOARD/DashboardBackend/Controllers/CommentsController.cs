using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CommentsController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly DashboardBackend.Services.EmailService _emailService;
        private readonly PrivacyService _privacyService;

        public CommentsController(DashboardDbContext context, DashboardBackend.Services.EmailService emailService, PrivacyService privacyService)
        {
            _context = context;
            _emailService = emailService;
            _privacyService = privacyService;
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst("userId")?.Value;
            if (string.IsNullOrWhiteSpace(userId)) return null;
            if (!int.TryParse(userId, out var id)) return null;
            return await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id);
        }

        // GET: api/comments?feedbackId=5
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Comment>>> GetCommentsByFeedback([FromQuery] int feedbackId)
        {
            var currentUser = await GetCurrentUserAsync();
            var privacy = _privacyService.GetPrivacy(currentUser);

            var comments = await _context.Comments
                .Where(c => c.FeedbackId == feedbackId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            if (!privacy.HideFeedbackContent)
            {
                return Ok(comments);
            }

            var masked = comments.Select(c => new Comment
            {
                Id = c.Id,
                FeedbackId = c.FeedbackId,
                UserId = c.UserId,
                UserName = c.UserName,
                Content = "***",
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList();

            return Ok(masked);
        }

        // GET: api/comments/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Comment>> GetComment(int id)
        {
            var comment = await _context.Comments.FindAsync(id);

            if (comment == null)
                return NotFound(new { message = "Yorum bulunamadı" });

            return Ok(comment);
        }

        // POST: api/comments
        [HttpPost]
        public async Task<ActionResult<object>> PostComment([FromBody] CommentDto dto)
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

            // Feedback sahibine bildirim gönder (eğer farklı kullanıcı yorum yapmışsa)
            var feedback = await _context.Feedbacks.FirstOrDefaultAsync(f => f.Id == dto.FeedbackId);
            if (feedback != null && feedback.UserId != dto.UserId)
            {
                var feedbackOwner = await _context.Users.FirstOrDefaultAsync(u => u.Id == feedback.UserId);
                if (feedbackOwner != null && !string.IsNullOrEmpty(feedbackOwner.Email))
                {
                    await _emailService.SendFeedbackReply(
                        feedbackOwner.Email, feedbackOwner.Username, dto.UserName,
                        dto.Content, feedback.Content, dto.FeedbackId
                    );
                }
            }

            // Mention edilen kullanıcılara bildirim gönder
            if (dto.Mentions != null && dto.Mentions.Any())
            {
                foreach (var username in dto.Mentions)
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);
                    
                    if (user != null && !string.IsNullOrEmpty(user.Email))
                    {
                        await _emailService.SendMentionInComment(
                            user.Email, user.Username, dto.UserName, dto.Content, dto.FeedbackId
                        );
                    }
                }
            }

            // Circular reference'ı önlemek için DTO dön
            var result = new
            {
                id = comment.Id,
                feedbackId = comment.FeedbackId,
                userId = comment.UserId,
                userName = comment.UserName,
                content = comment.Content,
                createdAt = comment.CreatedAt,
                updatedAt = comment.UpdatedAt
            };

            return CreatedAtAction(nameof(GetComment), new { id = comment.Id }, result);
        }

        // DELETE: api/comments/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteComment(int id)
        {
            var comment = await _context.Comments.FindAsync(id);
            if (comment == null)
                return NotFound(new { message = "Yorum bulunamadı" });

            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Yorum silindi" });
        }

        // DTOs
        public class CommentDto
        {
            public int FeedbackId { get; set; }
            public int UserId { get; set; }
            public string UserName { get; set; } = string.Empty;
            public string Content { get; set; } = string.Empty;
            public List<string>? Mentions { get; set; }
        }
    }
}

