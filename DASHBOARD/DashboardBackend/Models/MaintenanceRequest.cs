using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenanceRequests")]
    public class MaintenanceRequest
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string MachineName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? MachineTableName { get; set; }

        [Required]
        [MaxLength(100)]
        public string FaultType { get; set; } = string.Empty; // Arıza tipi

        [MaxLength(500)]
        public string? Description { get; set; } // Açıklama

        [Required]
        public int CreatedByUserId { get; set; } // Bildirimi oluşturan kullanıcı

        [MaxLength(100)]
        public string CreatedByUserName { get; set; } = string.Empty;

        [Required]
        public DateTime CreatedAt { get; set; } // Bildirim açıldığı tarih/saat

        public DateTime? AcceptedAt { get; set; } // İlk kabul edildiği tarih/saat

        public DateTime? ArrivedAt { get; set; } // Makinaya gelindiği tarih/saat

        public DateTime? CompletedAt { get; set; } // Arıza bitiş tarih/saat

        [MaxLength(50)]
        public string Status { get; set; } = "pending"; // pending, accepted, in_progress, completed, cancelled

        // Navigation properties
        public virtual ICollection<MaintenanceAssignment> Assignments { get; set; } = new List<MaintenanceAssignment>();
        public virtual ICollection<MaintenanceComment> Comments { get; set; } = new List<MaintenanceComment>();
        public virtual ICollection<MaintenancePhoto> Photos { get; set; } = new List<MaintenancePhoto>();
    }
}

