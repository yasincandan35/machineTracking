using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public interface ILiveDataCache
    {
        void Update(Device device, decimal temperature, decimal humidity, DateTime timestamp);
        IReadOnlyCollection<LiveSensorDataDto> GetAll();
    }
}

