namespace TemperatureHumidityAPI.Models
{
    public class Device
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public int DeviceId { get; set; } // int olarak değiştirildi
        public string IpAddress { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public int Position { get; set; } = 0; // Drag & Drop pozisyonu
        public DateTime CreatedDate { get; set; } = DateTime.Now;
    }

    public class DeviceDto
    {
        public string Name { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public int DeviceId { get; set; } // int olarak değiştirildi
        public string IpAddress { get; set; } = string.Empty;
        public bool IsActive { get; set; } = true;
        public int Position { get; set; } = 0;
    }

    public class DevicePositionDto
    {
        public int Id { get; set; }
        public int Position { get; set; }
    }
}
