using System;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceRecord
    {
        public int Id { get; set; }
        public string Type { get; set; } = "maintenance"; // maintenance | fault
        public int MachineGroupId { get; set; }
        public int? MachineId { get; set; }
        public int? CategoryId { get; set; }
        public int? CauseId { get; set; }
        public int? OperatorId { get; set; }
        public string? Responsible { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int? DurationMinutes { get; set; }
        public string? Notes { get; set; }
        public string? PhotoData { get; set; }
        public string? MaterialsJson { get; set; }
        public int CreatedByUserId { get; set; }
        public int? PerformedByUserId { get; set; }
        public bool IsBackdated { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}

