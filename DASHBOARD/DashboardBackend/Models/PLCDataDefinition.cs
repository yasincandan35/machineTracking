using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class PLCDataDefinition
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [Required]
        [MaxLength(20)]
        public string DataType { get; set; } = string.Empty; // DINT, REAL, BOOL, WORD
        
        public int RegisterAddress { get; set; }
        
        public int RegisterCount { get; set; } = 1;
        
        /// <summary>
        /// Byte sıralaması: HighToLow, LowToHigh, BigEndian, LittleEndian
        /// </summary>
        [MaxLength(20)]
        public string? ByteOrder { get; set; } = "HighToLow";
        
        /// <summary>
        /// Word swap (16-bit word'lerin yer değiştirmesi) - Modbus için
        /// </summary>
        public bool WordSwap { get; set; } = false;
        
        [Required]
        [MaxLength(10)]
        public string OperationType { get; set; } = string.Empty; // READ, WRITE, READ_WRITE
        
        public int PLCConnectionId { get; set; }
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        
        [MaxLength(200)]
        public string? ApiEndpoint { get; set; } = "/api/data";
        
        public int? SaveToDatabase { get; set; }
        
        [MaxLength(200)]
        public string? SaveTableName { get; set; }
        
        [MaxLength(200)]
        public string? SaveColumnName { get; set; }
        
        // Navigation property
        public PLCConnection? PLCConnection { get; set; }
    }
}
