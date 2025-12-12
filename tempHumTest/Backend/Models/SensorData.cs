namespace TemperatureHumidityAPI.Models
{
    public class SensorData
    {
        public long Id { get; set; }
        public int DeviceId { get; set; }
        public decimal Temperature { get; set; }
        public decimal Humidity { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.Now;
        
        // Navigation property
        public Device Device { get; set; } = null!;
    }

    public class SensorDataDto
    {
        public int DeviceId { get; set; } // Device.DeviceId (int)
        public decimal Temperature { get; set; }
        public decimal Humidity { get; set; }
        public DateTime? Timestamp { get; set; } // Optional: Eğer verilmezse DateTime.Now kullanılır
    }

    public class SensorDataResponse
    {
        public long Id { get; set; }
        public string DeviceName { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public decimal Temperature { get; set; }
        public decimal Humidity { get; set; }
        public DateTime Timestamp { get; set; }
    }

    public class BulkSensorDataDto
    {
        public int DeviceId { get; set; } // Device.DeviceId (int) - Python/Arduino'dan gelen ID
        public List<SensorDataEntryDto> Entries { get; set; } = new();
    }

    public class SensorDataEntryDto
    {
        public decimal Temperature { get; set; }
        public decimal Humidity { get; set; }
        public DateTime Timestamp { get; set; }
    }
}

public class LiveSensorDataDto
{
    public int DeviceId { get; set; } // Device.DeviceId (int)
    public string DeviceName { get; set; } = string.Empty;
    public int DeviceUniqueId { get; set; } // Device.DeviceId (int) - artık string değil
    public string IpAddress { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public decimal Temperature { get; set; }
    public decimal Humidity { get; set; }
    public DateTime Timestamp { get; set; }
}