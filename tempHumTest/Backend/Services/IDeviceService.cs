using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public interface IDeviceService
    {
        Task<IEnumerable<Device>> GetAllDevicesAsync();
        Task<Device?> GetDeviceByIdAsync(int id);
        Task<Device?> GetDeviceByIpAsync(string ipAddress);
        Task<Device> CreateDeviceAsync(DeviceDto deviceDto);
        Task<Device?> UpdateDeviceAsync(int id, DeviceDto deviceDto);
        Task<bool> DeleteDeviceAsync(int id);
        Task<bool> UpdatePositionsAsync(List<DevicePositionDto> positions);
    }
}
