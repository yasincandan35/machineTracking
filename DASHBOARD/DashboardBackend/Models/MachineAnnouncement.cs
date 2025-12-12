using System;
using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class MachineAnnouncement
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string Message { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(100)]
        public string? CreatedBy { get; set; }
    }
}

