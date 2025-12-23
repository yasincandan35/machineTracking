using System;

namespace DashboardBackend.Models.MaintenanceErp
{
    public class MaintenanceShift
    {
        public int Id { get; set; }
        public int MachineId { get; set; }
        public int? OperatorId { get; set; }
        public int? GroupId { get; set; }
        public string? ShiftName { get; set; }
        public DateTime ShiftDate { get; set; }
        public TimeSpan ShiftStart { get; set; }
        public TimeSpan ShiftEnd { get; set; }
        public string? Notes { get; set; }
        public int CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public MaintenanceMachine? Machine { get; set; }
        public MaintenanceOperator? Operator { get; set; }
        public MaintenanceGroup? Group { get; set; }
    }
}

