using Microsoft.EntityFrameworkCore;
using TemperatureHumidityAPI.Data;
using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public class DeviceService : IDeviceService
    {
        private readonly TemperatureHumidityContext _context;

        public DeviceService(TemperatureHumidityContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Device>> GetAllDevicesAsync()
        {
            return await _context.Devices
                .OrderBy(d => d.Position)
                .ThenBy(d => d.Name)
                .ToListAsync();
        }

        public async Task<Device?> GetDeviceByIdAsync(int id)
        {
            return await _context.Devices
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        public async Task<Device?> GetDeviceByIpAsync(string ipAddress)
        {
            return await _context.Devices
                .FirstOrDefaultAsync(d => d.IpAddress == ipAddress && d.IsActive);
        }

        public async Task<Device> CreateDeviceAsync(DeviceDto deviceDto)
        {
            var device = new Device
            {
                Name = deviceDto.Name,
                Location = deviceDto.Location,
                DeviceId = deviceDto.DeviceId,
                IpAddress = deviceDto.IpAddress,
                IsActive = deviceDto.IsActive,
                Position = deviceDto.Position,
                CreatedDate = DateTime.Now
            };

            _context.Devices.Add(device);
            await _context.SaveChangesAsync();
            return device;
        }

        public async Task<Device?> UpdateDeviceAsync(int id, DeviceDto deviceDto)
        {
            var device = await _context.Devices.FindAsync(id);
            if (device == null) return null;

            device.Name = deviceDto.Name;
            device.Location = deviceDto.Location;
            device.DeviceId = deviceDto.DeviceId;
            device.IpAddress = deviceDto.IpAddress;
            device.IsActive = deviceDto.IsActive;

            await _context.SaveChangesAsync();
            return device;
        }

        public async Task<bool> DeleteDeviceAsync(int id)
        {
            var device = await _context.Devices.FindAsync(id);
            if (device == null) return false;

            device.IsActive = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdatePositionsAsync(List<DevicePositionDto> positions)
        {
            try
            {
                foreach (var pos in positions)
                {
                    var device = await _context.Devices.FindAsync(pos.Id);
                    if (device != null)
                    {
                        device.Position = pos.Position;
                    }
                }
                await _context.SaveChangesAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
