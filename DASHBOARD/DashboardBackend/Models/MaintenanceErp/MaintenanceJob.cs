using System;
using System.Collections.Generic;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceJob
    {
        public int Id { get; set; }
        public string Type { get; set; } = "maintenance"; // maintenance | fault
        public int MachineId { get; set; }
        public int? CategoryId { get; set; }
        public int? CauseId { get; set; }
        public int? OperatorId { get; set; }
        public string? ResponsibleOperator { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int? DurationMinutes { get; set; }
        public string? Notes { get; set; }
        public int CreatedByUserId { get; set; }
        public int? PerformedByUserId { get; set; }
        public bool IsBackdated { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public MaintenanceMachine? Machine { get; set; }
        public MaintenanceCategory? Category { get; set; }
        public MaintenanceCause? Cause { get; set; }
        public MaintenanceOperator? Operator { get; set; }
        public ICollection<MaintenanceJobPhoto> Photos { get; set; } = new List<MaintenanceJobPhoto>();
    }
}

