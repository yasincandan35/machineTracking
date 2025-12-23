using System;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceJobPhoto
    {
        public int Id { get; set; }
        public int JobId { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string? AnnotationJson { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public MaintenanceJob? Job { get; set; }
    }
}

