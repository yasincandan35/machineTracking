using System;
using System.Collections.Generic;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MachineGroup
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<MaintenanceMachine> Machines { get; set; } = new List<MaintenanceMachine>();
        public ICollection<MaintenanceCategory> Categories { get; set; } = new List<MaintenanceCategory>();
        public ICollection<MaintenanceCause> Causes { get; set; } = new List<MaintenanceCause>();
    }
}


