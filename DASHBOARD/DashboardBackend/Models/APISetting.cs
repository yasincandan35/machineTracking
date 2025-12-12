using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class APISetting
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string SettingKey { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(500)]
        public string SettingValue { get; set; } = string.Empty;
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
