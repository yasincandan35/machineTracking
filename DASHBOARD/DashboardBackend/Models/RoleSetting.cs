using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace DashboardBackend.Models
{
    [Table("RoleSettings")]
    public class RoleSetting
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? DisplayName { get; set; }

        /// <summary>
        /// Token süresi (dakika cinsinden). 0 veya negatif değerler sınırsız anlamına gelir.
        /// </summary>
        public int TokenLifetimeMinutes { get; set; } = 60 * 24; // Varsayılan: 24 saat

        /// <summary>
        /// Bu rol yeni kullanıcı oluşturabilir mi?
        /// </summary>
        public bool CanCreateUsers { get; set; } = false;

        /// <summary>
        /// Bu rol mevcut kullanıcıları silebilir mi?
        /// </summary>
        public bool CanDeleteUsers { get; set; } = false;

        /// <summary>
        /// Bu rol sistemdeki rol tanımlarını yönetebilir mi?
        /// </summary>
        public bool CanManageRoles { get; set; } = false;

        [Column("AllowedSections")]
        public string? AllowedSectionsSerialized { get; set; }

        [NotMapped]
        public List<string> AllowedSections
        {
            get
            {
                if (string.IsNullOrWhiteSpace(AllowedSectionsSerialized))
                {
                    return new List<string>();
                }

                try
                {
                    var list = JsonSerializer.Deserialize<List<string>>(AllowedSectionsSerialized);
                    return list ?? new List<string>();
                }
                catch
                {
                    return new List<string>();
                }
            }
            set
            {
                AllowedSectionsSerialized = value == null
                    ? null
                    : JsonSerializer.Serialize(value);
            }
        }
    }
}

