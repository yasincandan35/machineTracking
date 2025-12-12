using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenanceSchedules")]
    public class MaintenanceSchedule
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string MachineName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? MachineTableName { get; set; }

        [Required]
        [MaxLength(200)]
        public string MaintenanceType { get; set; } = string.Empty; // Bakım tipi

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        public DateTime StartDate { get; set; } // Bakım başlangıç tarihi

        [Required]
        public DateTime EndDate { get; set; } // Bakım bitiş tarihi

        // Bildirim gönderilecek günler (1 ay, 15 gün, 3 gün kala)
        public bool Notify30DaysBefore { get; set; } = true;
        public bool Notify15DaysBefore { get; set; } = true;
        public bool Notify3DaysBefore { get; set; } = true;

        // Bildirimlerin gönderildiği tarihler
        public DateTime? Notification30DaysSentAt { get; set; }
        public DateTime? Notification15DaysSentAt { get; set; }
        public DateTime? Notification3DaysSentAt { get; set; }

        public bool IsCompleted { get; set; } = false;
        public DateTime? CompletedAt { get; set; }

        [Required]
        public int CreatedByUserId { get; set; }

        [MaxLength(100)]
        public string CreatedByUserName { get; set; } = string.Empty;

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Tekrarlayan bakım için (opsiyonel)
        public bool IsRecurring { get; set; } = false;
        public int? RecurringIntervalDays { get; set; } // Kaç günde bir tekrar edecek
    }
}

