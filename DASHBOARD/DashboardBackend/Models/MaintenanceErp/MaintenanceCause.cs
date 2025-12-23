using System;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceCause
    {
        public int Id { get; set; }
        public int MachineId { get; set; }
        public int CategoryId { get; set; }
        public int? MachineGroupId { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public MachineGroup? MachineGroup { get; set; }
        public MaintenanceMachine? Machine { get; set; }
        public MaintenanceCategory? Category { get; set; }
    }
}

