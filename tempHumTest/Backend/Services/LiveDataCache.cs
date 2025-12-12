using System.Collections.Concurrent;
using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public class LiveDataCache : ILiveDataCache
    {
        private readonly ConcurrentDictionary<int, LiveSensorDataDto> _cache = new();

        public void Update(Device device, decimal temperature, decimal humidity, DateTime timestamp)
        {
            var entry = new LiveSensorDataDto
            {
                DeviceId = device.DeviceId, // Device.DeviceId (int) kullan
                DeviceName = device.Name,
                DeviceUniqueId = device.DeviceId, // Device.DeviceId (int) - artık string değil
                IpAddress = device.IpAddress,
                Location = device.Location,
                Temperature = temperature,
                Humidity = humidity,
                Timestamp = timestamp
            };

            _cache.AddOrUpdate(device.DeviceId, entry, (_, __) => entry); // Cache key olarak Device.DeviceId kullan
        }

        public IReadOnlyCollection<LiveSensorDataDto> GetAll()
        {
            return _cache.Values
                .OrderBy(x => x.DeviceName)
                .ToList()
                .AsReadOnly();
        }
    }
}

