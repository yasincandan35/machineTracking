using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeedbackReactionsController : ControllerBase
    {
        private readonly DashboardDbContext _context;

        public FeedbackReactionsController(DashboardDbContext context)
        {
            _context = context;
        }

        // GET: api/feedbackreactions?feedbackId=5
        [HttpGet]
        public async Task<ActionResult<IEnumerable<FeedbackReaction>>> GetReactionsByFeedback([FromQuery] int feedbackId)
        {
            var reactions = await _context.FeedbackReactions
                .Where(r => r.FeedbackId == feedbackId)
                .ToListAsync();

            return Ok(reactions);
        }

        // POST: api/feedbackreactions
        [HttpPost]
        public async Task<ActionResult<object>> PostReaction([FromBody] ReactionDto dto)
        {
            // Aynı kullanıcı aynı feedback'e aynı reaction'ı vermiş mi?
            var existing = await _context.FeedbackReactions
                .FirstOrDefaultAsync(r => 
                    r.FeedbackId == dto.FeedbackId && 
                    r.UserId == dto.UserId && 
                    r.ReactionType == dto.ReactionType);

            if (existing != null)
            {
                // Zaten var, kaldır (toggle)
                _context.FeedbackReactions.Remove(existing);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Tepki kaldırıldı", removed = true });
            }

            // Aynı kullanıcının farklı bir reaction'ı varsa, onu sil
            var otherReaction = await _context.FeedbackReactions
                .FirstOrDefaultAsync(r => 
                    r.FeedbackId == dto.FeedbackId && 
                    r.UserId == dto.UserId);

            if (otherReaction != null)
            {
                _context.FeedbackReactions.Remove(otherReaction);
            }

            // Yeni reaction ekle
            var reaction = new FeedbackReaction
            {
                FeedbackId = dto.FeedbackId,
                UserId = dto.UserId,
                ReactionType = dto.ReactionType,
                CreatedAt = DateTime.Now
            };

            _context.FeedbackReactions.Add(reaction);
            await _context.SaveChangesAsync();

            // Circular reference'ı önlemek için DTO dön
            var result = new
            {
                id = reaction.Id,
                feedbackId = reaction.FeedbackId,
                userId = reaction.UserId,
                reactionType = reaction.ReactionType,
                createdAt = reaction.CreatedAt
            };

            return CreatedAtAction(nameof(GetReactionsByFeedback), new { feedbackId = reaction.FeedbackId }, result);
        }

        // DELETE: api/feedbackreactions/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteReaction(int id)
        {
            var reaction = await _context.FeedbackReactions.FindAsync(id);
            if (reaction == null)
                return NotFound(new { message = "Tepki bulunamadı" });

            _context.FeedbackReactions.Remove(reaction);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tepki kaldırıldı" });
        }

        // DTOs
        public class ReactionDto
        {
            public int FeedbackId { get; set; }
            public int UserId { get; set; }
            public string ReactionType { get; set; } = string.Empty;
        }
    }
}

