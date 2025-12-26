using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("UserActivityLogs")]
    public class UserActivityLog
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [MaxLength(50)]
        [Required]
        public string EventType { get; set; } = string.Empty; // 'page_view', 'tab_change', 'subtab_change', 'machine_selected', 'action', 'time_spent'

        [MaxLength(100)]
        public string? Page { get; set; } // "/", "/machine-screen", "/admin"

        [MaxLength(100)]
        public string? Tab { get; set; } // "home", "analysis", "reports", "admin", vb.

        [MaxLength(100)]
        public string? SubTab { get; set; } // Home için: "dashboard", "periodicSummaries", "operatorPerformance"

        public int? MachineId { get; set; }

        [MaxLength(200)]
        public string? MachineName { get; set; }

        [MaxLength(100)]
        public string? Action { get; set; } // "view_live_stream", "select_job", "view_data_analysis", vb.

        public string? Details { get; set; } // JSON formatında ek detaylar

        public int? Duration { get; set; } // Saniye cinsinden süre (sayfada geçirilen süre için)

        [Required]
        public DateTime Timestamp { get; set; } = DateTime.Now;

        [MaxLength(100)]
        public string? SessionId { get; set; } // Aynı oturumu gruplamak için

        // Navigation property
        [ForeignKey("UserId")]
        public User? User { get; set; }
    }
}

