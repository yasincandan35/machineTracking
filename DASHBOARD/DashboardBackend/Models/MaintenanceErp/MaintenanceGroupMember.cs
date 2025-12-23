using System;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceGroupMember
    {
        public int GroupId { get; set; }
        public int UserId { get; set; }
        public string Status { get; set; } = "pending"; // pending | approved
        public int? InvitedByUserId { get; set; }
        public DateTime? ApprovedAt { get; set; }

        public MaintenanceGroup? Group { get; set; }
    }
}

