using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeedbackController : ControllerBase
    {
        private readonly DashboardDbContext _context;
        private readonly DashboardBackend.Services.EmailService _emailService;
        private readonly PrivacyService _privacyService;

        public FeedbackController(DashboardDbContext context, DashboardBackend.Services.EmailService emailService, PrivacyService privacyService)
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

        // GET: api/feedback
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFeedbacks()
        {
            var currentUser = await GetCurrentUserAsync();
            var privacy = _privacyService.GetPrivacy(currentUser);

            var feedbacks = await _context.Feedbacks
                .Include(f => f.Comments)
                .Include(f => f.Reactions)
                .AsSplitQuery()
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            // Circular reference'ı önlemek için DTO'ya dönüştür
            var result = feedbacks.Select(f => new
            {
                id = f.Id,
                content = privacy.HideFeedbackContent ? "***" : f.Content,
                userId = f.UserId,
                userName = f.UserName,
                createdAt = f.CreatedAt,
                updatedAt = f.UpdatedAt,
                comments = f.Comments?.Select(c => new
                {
                    id = c.Id,
                    feedbackId = c.FeedbackId,
                    userId = c.UserId,
                    userName = c.UserName,
                    content = privacy.HideFeedbackContent ? "***" : c.Content,
                    createdAt = c.CreatedAt,
                    updatedAt = c.UpdatedAt
                }).ToList(),
                reactions = f.Reactions?.Select(r => new
                {
                    id = r.Id,
                    feedbackId = r.FeedbackId,
                    userId = r.UserId,
                    reactionType = r.ReactionType,
                    createdAt = r.CreatedAt
                }).ToList(),
                likeCount = f.LikeCount,
                dislikeCount = f.DislikeCount
            });

            return Ok(result);
        }

        // GET: api/feedback/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetFeedback(int id)
        {
            var currentUser = await GetCurrentUserAsync();
            var privacy = _privacyService.GetPrivacy(currentUser);

            var feedback = await _context.Feedbacks
                .Include(f => f.Comments)
                .Include(f => f.Reactions)
                .AsSplitQuery()
                .FirstOrDefaultAsync(f => f.Id == id);

            if (feedback == null)
                return NotFound(new { message = "Geri bildirim bulunamadı" });

            // Circular reference'ı önlemek için DTO'ya dönüştür
            var result = new
            {
                id = feedback.Id,
                content = privacy.HideFeedbackContent ? "***" : feedback.Content,
                userId = feedback.UserId,
                userName = feedback.UserName,
                createdAt = feedback.CreatedAt,
                updatedAt = feedback.UpdatedAt,
                comments = feedback.Comments?.Select(c => new
                {
                    id = c.Id,
                    feedbackId = c.FeedbackId,
                    userId = c.UserId,
                    userName = c.UserName,
                    content = privacy.HideFeedbackContent ? "***" : c.Content,
                    createdAt = c.CreatedAt,
                    updatedAt = c.UpdatedAt
                }).ToList(),
                reactions = feedback.Reactions?.Select(r => new
                {
                    id = r.Id,
                    feedbackId = r.FeedbackId,
                    userId = r.UserId,
                    reactionType = r.ReactionType,
                    createdAt = r.CreatedAt
                }).ToList(),
                likeCount = feedback.LikeCount,
                dislikeCount = feedback.DislikeCount
            };

            return Ok(result);
        }

        // POST: api/feedback
        [HttpPost]
        public async Task<ActionResult<object>> PostFeedback([FromBody] FeedbackDto dto)
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

            // Mention edilen kullanıcılara email gönder
            if (dto.Mentions != null && dto.Mentions.Any())
            {
                foreach (var username in dto.Mentions)
                {
                    var user = await _context.Users
                        .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);
                    
                    if (user != null && !string.IsNullOrEmpty(user.Email))
                    {
                        await _emailService.SendMentionInFeedback(
                            user.Email, user.Username, dto.UserName, dto.Content, feedback.Id
                        );
                    }
                }
            }

            // Circular reference'ı önlemek için DTO dön
            var result = new
            {
                id = feedback.Id,
                content = feedback.Content,
                userId = feedback.UserId,
                userName = feedback.UserName,
                createdAt = feedback.CreatedAt,
                updatedAt = feedback.UpdatedAt,
                comments = new List<object>(),
                reactions = new List<object>(),
                likeCount = 0,
                dislikeCount = 0
            };

            return CreatedAtAction(nameof(GetFeedback), new { id = feedback.Id }, result);
        }

        // PUT: api/feedback/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFeedback(int id, Feedback feedback)
        {
            if (id != feedback.Id)
                return BadRequest(new { message = "ID uyuşmuyor" });

            _context.Entry(feedback).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FeedbackExists(id))
                    return NotFound(new { message = "Geri bildirim bulunamadı" });
                else
                    throw;
            }

            return Ok(new { message = "Geri bildirim güncellendi" });
        }

        // DELETE: api/feedback/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFeedback(int id)
        {
            var feedback = await _context.Feedbacks.FindAsync(id);
            if (feedback == null)
                return NotFound(new { message = "Geri bildirim bulunamadı" });

            // İlgili yorumları da sil
            var comments = await _context.Comments.Where(c => c.FeedbackId == id).ToListAsync();
            _context.Comments.RemoveRange(comments);

            // Reaction'ları da sil
            var reactions = await _context.FeedbackReactions.Where(r => r.FeedbackId == id).ToListAsync();
            _context.FeedbackReactions.RemoveRange(reactions);

            _context.Feedbacks.Remove(feedback);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Geri bildirim silindi" });
        }

        private bool FeedbackExists(int id)
        {
            return _context.Feedbacks.Any(e => e.Id == id);
        }

        // DTOs
        public class FeedbackDto
        {
            public string Content { get; set; } = string.Empty;
            public int UserId { get; set; }
            public string UserName { get; set; } = string.Empty;
            public List<string>? Mentions { get; set; }
        }
    }
}

