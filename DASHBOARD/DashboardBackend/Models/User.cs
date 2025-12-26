using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("Users")]
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [MaxLength(255)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string Role { get; set; } = "user";

        [MaxLength(50)]
        public string? Theme { get; set; }

        [MaxLength(50)]
        public string? AccentColor { get; set; }

        public DateTime? CreatedAt { get; set; }

        public DateTime? LastLogin { get; set; }

        public bool IsActive { get; set; } = true;

        public bool IsOnline { get; set; } = false;

        public DateTime? LastSeen { get; set; }

        // 🆕 Kullanıcı bazlı ayarlar (makina bağımsız)
        [MaxLength(10)]
        public string? LanguageSelection { get; set; } = "tr";

        public int? LastSelectedMachineId { get; set; }

        public string? ColorSettings { get; set; }  // JSON

        // 🆕 Makine ekranı kullanıcıları için zorunlu atamalar
        public int? AssignedMachineId { get; set; }

        [MaxLength(200)]
        public string? AssignedMachineTable { get; set; }

        [MaxLength(200)]
        public string? AssignedMachineName { get; set; }

        // Demo / Gizlilik ayarları
        public bool IsDemo { get; set; } = false;

        // JSON olarak kullanıcı bazlı gizlilik tercihleri
        public string? PrivacySettings { get; set; }

        // Anlık sayfa ve tab bilgisi
        [MaxLength(200)]
        public string? CurrentPage { get; set; } // Kullanıcının o an bulunduğu sayfa (örn: "/", "/admin")

        [MaxLength(200)]
        public string? CurrentTab { get; set; }  // Kullanıcının o an bulunduğu tab (örn: "home", "users")
    }
}

