using System;
using System.Collections.Generic;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceGroup
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<MaintenanceGroupMember> Members { get; set; } = new List<MaintenanceGroupMember>();
    }
}

