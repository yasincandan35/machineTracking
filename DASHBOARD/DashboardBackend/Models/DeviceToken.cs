using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("DeviceTokens")]
    public class DeviceToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Token { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Platform { get; set; } = string.Empty; // "ios", "android", "web"

        [MaxLength(200)]
        public string? DeviceName { get; set; }

        [MaxLength(100)]
        public string? AppVersion { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime? LastUsedAt { get; set; }

        public bool IsActive { get; set; } = true;

        // Navigation property
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}

