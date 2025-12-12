using System.ComponentModel.DataAnnotations;

namespace DashboardBackend.Models
{
    public class SQLConnection
    {
        public int Id { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(100)]
        public string Server { get; set; } = string.Empty;
        
        [Required]
        [MaxLength(100)]
        public string Database { get; set; } = string.Empty;
        
        [MaxLength(100)]
        public string? Username { get; set; }
        
        [MaxLength(200)]
        public string? Password { get; set; } // Şifreli olarak saklanacak
        
        public int ConnectionTimeout { get; set; } = 30;
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}
