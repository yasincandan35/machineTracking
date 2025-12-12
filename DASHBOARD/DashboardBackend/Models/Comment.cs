using System;
using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class Comment
    {
        public int Id { get; set; }
        
        [Required]
        public int FeedbackId { get; set; }
        
        [Required]
        public int UserId { get; set; }
        
        [Required]
        public string UserName { get; set; } = string.Empty;
        
        [Required]
        public string Content { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; }
        
        public DateTime? UpdatedAt { get; set; }
        
        // Navigation properties
        public Feedback? Feedback { get; set; }
    }
}

