using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class SQLQueryDefinition
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [Required]
        public string SQLQuery { get; set; } = string.Empty;
        
        public int SQLConnectionId { get; set; }
        
        public string? Parameters { get; set; } // JSON formatında parametre tanımları
        
        public string? ResultMapping { get; set; } // JSON formatında sonuç eşleme
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        
        // Navigation property
        public SQLConnection? SQLConnection { get; set; }
    }
}
