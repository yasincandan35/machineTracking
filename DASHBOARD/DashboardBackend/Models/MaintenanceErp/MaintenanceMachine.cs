using System;
using System.Collections.Generic;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceMachine
    {
        public int Id { get; set; }
        public int? MachineGroupId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public MachineGroup? MachineGroup { get; set; }
        public ICollection<MaintenanceOperator> Operators { get; set; } = new List<MaintenanceOperator>();
        public ICollection<MaintenanceCategory> Categories { get; set; } = new List<MaintenanceCategory>();
        public ICollection<MaintenanceCause> Causes { get; set; } = new List<MaintenanceCause>();
        public ICollection<MaintenanceJob> Jobs { get; set; } = new List<MaintenanceJob>();
        public ICollection<MaintenanceShift> Shifts { get; set; } = new List<MaintenanceShift>();
    }
}

