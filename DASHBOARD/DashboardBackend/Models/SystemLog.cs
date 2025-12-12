using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class SystemLog
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(20)]
        public string LogLevel { get; set; } = string.Empty; // INFO, WARNING, ERROR, DEBUG
        
        [Required]
        [MaxLength(50)]
        public string Component { get; set; } = string.Empty; // PLCReader, SqlProxy, DataProcessor
        
        [Required]
        public string Message { get; set; } = string.Empty;
        
        public string? Details { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
