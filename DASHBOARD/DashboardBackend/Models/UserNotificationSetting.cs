using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("UserNotificationSettings")]
    public class UserNotificationSetting
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        public int? MachineId { get; set; } // NULL = tüm makineler için

        [Required]
        [MaxLength(50)]
        public string NotificationType { get; set; } = string.Empty; 
        // "stoppage_duration", "speed_reached", "new_report", "production_complete", "fire_threshold", vb.

        public bool IsEnabled { get; set; } = true;

        public decimal? Threshold { get; set; } // Eşik değeri (dakika, yüzde, vb.)

        [MaxLength(20)]
        public string? ThresholdUnit { get; set; } // "minutes", "percent", "count", vb.

        [MaxLength(200)]
        public string? NotificationTitle { get; set; } // Özelleştirilebilir başlık

        [MaxLength(500)]
        public string? NotificationBody { get; set; } // Özelleştirilebilir mesaj

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        [ForeignKey("MachineId")]
        public virtual MachineList? Machine { get; set; }
    }
}

