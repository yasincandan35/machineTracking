using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;

namespace DashboardBackend.Models
{
    public class Feedback
    {
        public int Id { get; set; }
        
        [Required]
        public string Content { get; set; } = string.Empty;
        
        [Required]
        public int UserId { get; set; }
        
        [Required]
        public string UserName { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; }
        
        public DateTime? UpdatedAt { get; set; }
        
        // Navigation properties
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<FeedbackReaction> Reactions { get; set; } = new List<FeedbackReaction>();
        
        // Computed properties
        public int LikeCount => Reactions.Count(r => r.ReactionType == "like");
        public int DislikeCount => Reactions.Count(r => r.ReactionType == "dislike");
    }
}

