using System;
using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class FeedbackReaction
    {
        public int Id { get; set; }
        
        [Required]
        public int FeedbackId { get; set; }
        
        [Required]
        public int UserId { get; set; }
        
        [Required]
        [StringLength(10)]
        public string ReactionType { get; set; } = string.Empty; // 'like' or 'dislike'
        
        public DateTime CreatedAt { get; set; }
        
        // Navigation properties
        public Feedback? Feedback { get; set; }
    }
}

