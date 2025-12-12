using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MachineLists")]
    public class MachineList
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string MachineName { get; set; } = string.Empty;

        [MaxLength(200)]
        public string DatabaseName { get; set; } = string.Empty; // Veritabanı adı (örn: "lemanic_3_tracking") - Backend'de otomatik set edilir

        [Required]
        [MaxLength(200)]
        public string TableName { get; set; } = string.Empty; // Tablo adı (örn: "lemanic3_tracking")

        public bool IsActive { get; set; } = false; // Aktif makine mi?

        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
}

