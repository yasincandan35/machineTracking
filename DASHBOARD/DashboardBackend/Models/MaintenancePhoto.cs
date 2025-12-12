using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DashboardBackend.Models
{
    [Table("MaintenancePhotos")]
    public class MaintenancePhoto
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MaintenanceRequestId { get; set; }

        [Required]
        [MaxLength(500)]
        public string FilePath { get; set; } = string.Empty; // Dosya yolu

        [MaxLength(500)]
        public string? FileName { get; set; }

        [MaxLength(50)]
        public string? FileType { get; set; } // image/jpeg, image/png, etc.

        public long? FileSize { get; set; } // Byte cinsinden

        // Fotoğraf üzerine işaretleme ve yazı bilgileri (JSON formatında)
        public string? Annotations { get; set; } // JSON: { marks: [{x, y, text}], ... }

        [Required]
        public int UploadedByUserId { get; set; }

        [MaxLength(100)]
        public string UploadedByUserName { get; set; } = string.Empty;

        [Required]
        public DateTime UploadedAt { get; set; }

        // Navigation properties
        [ForeignKey("MaintenanceRequestId")]
        public virtual MaintenanceRequest? MaintenanceRequest { get; set; }
    }
}

