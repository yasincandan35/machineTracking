using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenanceNotificationRecipients")]
    public class MaintenanceNotificationRecipient
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [MaxLength(100)]
        public string UserName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? UserEmail { get; set; }

        [MaxLength(50)]
        public string? UserRole { get; set; }

        [Required]
        [MaxLength(50)]
        public string NotificationCategory { get; set; } = "maintenance"; // "maintenance", "production", "quality"

        public bool IsActive { get; set; } = true;

        [Required]
        public int CreatedByUserId { get; set; }

        [MaxLength(100)]
        public string CreatedByUserName { get; set; } = string.Empty;

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime? UpdatedAt { get; set; }

        // Navigation property
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}

