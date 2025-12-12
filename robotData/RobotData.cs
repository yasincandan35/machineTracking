using System;
using System.Collections.Generic;

namespace RobotDataCollector
{
    /// <summary>
    /// Robot PLC'den okunan verileri tutan model
    /// </summary>
    public class RobotData
    {
        public DateTime Timestamp { get; set; } = DateTime.Now;

        // Alarm Durumları (Coil 0-6)
        public bool IsometricBeltAlarm { get; set; }          // Coil 0
        public bool GoodProductGantryAlarm { get; set; }      // Coil 1
        public bool SidePushMechanism1Alarm { get; set; }     // Coil 2
        public bool SidePushMechanism2Alarm { get; set; }     // Coil 3
        public bool FormingPlatformAlarm { get; set; }        // Coil 4
        public bool RejectMechanismAlarm { get; set; }        // Coil 5
        public bool PalletLineAlarm { get; set; }             // Coil 6

        // Reset Counter (Coil 20)
        public bool ResetCounter { get; set; }                // Coil 20

        // Running Durumları (Coil 50-52)
        public bool IsometricBeltRunning { get; set; }        // Coil 50
        public bool PalletisingMechanismRunning { get; set; } // Coil 51
        public bool PalletLineRunning { get; set; }           // Coil 52

        // Veri Register'ları (Hold Register 0-5)
        public ushort QualifiedItemsCount { get; set; }       // Register 0
        public ushort DefectiveItemsCount { get; set; }       // Register 1
        public ushort GoodPalletsCount { get; set; }          // Register 2
        public ushort DefectivePalletsCount { get; set; }     // Register 3
        public ushort EquidistantBeltStatus { get; set; }     // Register 4
        public ushort PalletisingMechanismStatus { get; set; } // Register 5

        /// <summary>
        /// Status kodlarını string'e çevir (Çince/İngilizce)
        /// </summary>
        public string GetStatusString(ushort statusCode)
        {
            return statusCode switch
            {
                1 => "手动模式 / Manual mode",
                2 => "运行中 / Running",
                3 => "报警中 / Alarm active",
                4 => "设备待机状态 / Device standby state",
                5 => "设备未初始化 / Device not initialised",
                _ => $"未知状态 ({statusCode}) / Unknown Status ({statusCode})"
            };
        }

        public override string ToString()
        {
            return $@"Robot Verileri - {Timestamp:yyyy-MM-dd HH:mm:ss}
========================================
ALARM DURUMLARI:
  Isometric Belt Alarm: {IsometricBeltAlarm}
  Good Product Gantry Alarm: {GoodProductGantryAlarm}
  Side Push Mechanism 1 Alarm: {SidePushMechanism1Alarm}
  Side Push Mechanism 2 Alarm: {SidePushMechanism2Alarm}
  Forming Platform Alarm: {FormingPlatformAlarm}
  Reject Mechanism Alarm: {RejectMechanismAlarm}
  Pallet Line Alarm: {PalletLineAlarm}

ÇALIŞMA DURUMLARI:
  Isometric Belt Running: {IsometricBeltRunning}
  Palletising Mechanism Running: {PalletisingMechanismRunning}
  Pallet Line Running: {PalletLineRunning}

VERİLER:
  Qualified Items: {QualifiedItemsCount}
  Defective Items: {DefectiveItemsCount}
  Good Pallets: {GoodPalletsCount}
  Defective Pallets: {DefectivePalletsCount}
  Equidistant Belt Status: {GetStatusString(EquidistantBeltStatus)} ({EquidistantBeltStatus})
  Palletising Mechanism Status: {GetStatusString(PalletisingMechanismStatus)} ({PalletisingMechanismStatus})
========================================";
        }
    }
}

