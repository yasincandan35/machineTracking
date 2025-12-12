using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenanceAssignments")]
    public class MaintenanceAssignment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MaintenanceRequestId { get; set; }

        [Required]
        public int UserId { get; set; } // Bakım personeli

        [MaxLength(100)]
        public string UserName { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? UserEmail { get; set; }

        [Required]
        public DateTime AcceptedAt { get; set; } // Kabul edildiği tarih/saat

        // Navigation properties
        [ForeignKey("MaintenanceRequestId")]
        public virtual MaintenanceRequest? MaintenanceRequest { get; set; }
    }
}

