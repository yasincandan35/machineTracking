using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenanceComments")]
    public class MaintenanceComment
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MaintenanceRequestId { get; set; }

        [Required]
        public int UserId { get; set; }

        [MaxLength(100)]
        public string UserName { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        // Navigation properties
        [ForeignKey("MaintenanceRequestId")]
        public virtual MaintenanceRequest? MaintenanceRequest { get; set; }
    }
}

