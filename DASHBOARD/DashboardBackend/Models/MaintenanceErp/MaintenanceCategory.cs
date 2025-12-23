using System;
using System.Collections.Generic;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceCategory
    {
        public int Id { get; set; }
        public int? MachineId { get; set; }
        public int? MachineGroupId { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public MachineGroup? MachineGroup { get; set; }
        public MaintenanceMachine? Machine { get; set; }
        public ICollection<MaintenanceCause> Causes { get; set; } = new List<MaintenanceCause>();
    }
}

