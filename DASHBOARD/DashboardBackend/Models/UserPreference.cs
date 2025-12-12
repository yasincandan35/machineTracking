using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("UserPreferences")]
    public class UserPreference
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        public int MachineId { get; set; }

        // 🎯 Sadece makina bazlı ayarlar
        public string? VisibleCards { get; set; }  // JSON array (hangi kartlar görünsün)

        public string? Layout { get; set; }  // JSON array (kart pozisyonları)

        // DB tablosunda NOT NULL olabilir; varsayılan 0 gönderelim
        public int LastSelectedMachineId { get; set; } = 0;

        // DB'de mevcut olabilir; null bırakmak güvenli
        public string? ColorSettings { get; set; }

        public string? LanguageSelection { get; set; }
    }
}

