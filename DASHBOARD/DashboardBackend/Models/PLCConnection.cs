using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    /// <summary>
    /// Veri Kaynağı (Data Source) - PLC, Enerji Analizörü, vb. cihazlar için
    /// </summary>
    public class PLCConnection
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty; // Teknik isim (örn: "EnergyAnalyzer", "MainPLC")
        
        [MaxLength(100)]
        public string? DisplayName { get; set; } // Görünen isim (örn: "Enerji Analizörü", "Ana PLC")
        
        [Required]
        [MaxLength(15)]
        public string IpAddress { get; set; } = string.Empty;
        
        public int Port { get; set; } = 502;
        
        public int ReadIntervalMs { get; set; } = 200;
        
        /// <summary>
        /// Veri kaynağı tipi: ModbusTCP, EnergyAnalyzer, vb.
        /// </summary>
        [MaxLength(50)]
        public string SourceType { get; set; } = "ModbusTCP";
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
