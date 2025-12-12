using Microsoft.EntityFrameworkCore;
using TemperatureHumidityAPI.Data;
using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public class SensorDataService : ISensorDataService
    {
        private readonly TemperatureHumidityContext _context;

        public SensorDataService(TemperatureHumidityContext context)
        {
            _context = context;
        }

        public async Task<SensorDataResponse> AddSensorDataAsync(SensorDataDto sensorDataDto)
        {
            // sensorDataDto.DeviceId artık Device.DeviceId (int)
            var device = await _context.Devices
                .FirstOrDefaultAsync(d => d.DeviceId == sensorDataDto.DeviceId && d.IsActive);

            if (device == null)
                throw new ArgumentException("Device not found or inactive");

            var sensorData = new SensorData
            {
                DeviceId = device.DeviceId, // Device.DeviceId (int) kullan
                Temperature = sensorDataDto.Temperature,
                Humidity = sensorDataDto.Humidity,
                Timestamp = sensorDataDto.Timestamp ?? DateTime.Now // Eğer timestamp verilmişse onu kullan, yoksa şimdiki zamanı kullan
            };

            _context.SensorData.Add(sensorData);
            await _context.SaveChangesAsync();

            return new SensorDataResponse
            {
                Id = sensorData.Id,
                DeviceName = device.Name,
                Location = device.Location,
                Temperature = sensorData.Temperature,
                Humidity = sensorData.Humidity,
                Timestamp = sensorData.Timestamp
            };
        }

        public async Task<int> AddBulkSensorDataAsync(BulkSensorDataDto bulkSensorDataDto)
        {
            // Device.DeviceId (int) ile eşleştir
            var device = await _context.Devices
                .FirstOrDefaultAsync(d => d.DeviceId == bulkSensorDataDto.DeviceId && d.IsActive);

            if (device == null)
                throw new ArgumentException($"Device not found or inactive: DeviceId={bulkSensorDataDto.DeviceId}");

            if (bulkSensorDataDto.Entries == null || !bulkSensorDataDto.Entries.Any())
                return 0;

            // SensorData.DeviceId = Device.DeviceId (int) olarak kaydet
            var sensorDataList = bulkSensorDataDto.Entries.Select(entry => new SensorData
            {
                DeviceId = device.DeviceId, // Device.DeviceId (int) kullan, Device.Id değil
                Temperature = entry.Temperature,
                Humidity = entry.Humidity,
                Timestamp = entry.Timestamp
            }).ToList();

            _context.SensorData.AddRange(sensorDataList);
            await _context.SaveChangesAsync();

            return sensorDataList.Count;
        }

        public async Task<IEnumerable<SensorDataResponse>> GetLatestDataAsync()
        {
            return await _context.SensorData
                .Include(s => s.Device)
                .Where(s => s.Device.IsActive)
                .OrderByDescending(s => s.Timestamp)
                .Take(100)
                .Select(s => new SensorDataResponse
                {
                    Id = s.Id,
                    DeviceName = s.Device.Name,
                    Location = s.Device.Location,
                    Temperature = s.Temperature,
                    Humidity = s.Humidity,
                    Timestamp = s.Timestamp
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<SensorDataResponse>> GetDataByDeviceAsync(int deviceId)
        {
            // deviceId parametresi Device.DeviceId (int) olarak geliyor
            return await _context.SensorData
                .Include(s => s.Device)
                .Where(s => s.DeviceId == deviceId && s.Device.IsActive)
                .OrderByDescending(s => s.Timestamp)
                .Take(1000)
                .Select(s => new SensorDataResponse
                {
                    Id = s.Id,
                    DeviceName = s.Device.Name,
                    Location = s.Device.Location,
                    Temperature = s.Temperature,
                    Humidity = s.Humidity,
                    Timestamp = s.Timestamp
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<SensorDataResponse>> GetDataByDateRangeAsync(DateTime startDate, DateTime endDate)
        {
            return await _context.SensorData
                .Include(s => s.Device)
                .Where(s => s.Device.IsActive && 
                           s.Timestamp >= startDate && 
                           s.Timestamp <= endDate)
                .OrderByDescending(s => s.Timestamp)
                .Select(s => new SensorDataResponse
                {
                    Id = s.Id,
                    DeviceName = s.Device.Name,
                    Location = s.Device.Location,
                    Temperature = s.Temperature,
                    Humidity = s.Humidity,
                    Timestamp = s.Timestamp
                })
                .ToListAsync();
        }

        public async Task<IEnumerable<SensorDataResponse>> GetDataByDeviceAndDateRangeAsync(int deviceId, DateTime startDate, DateTime endDate)
        {
            // deviceId parametresi Device.DeviceId (int) olarak geliyor
            // SensorData.DeviceId de Device.DeviceId'ye referans veriyor
            var localStartDate = startDate;
            var localEndDate = endDate;
            
            var result = await _context.SensorData
                .Include(s => s.Device)
                .Where(s => s.DeviceId == deviceId && 
                           s.Device.IsActive && 
                           s.Timestamp >= localStartDate && 
                           s.Timestamp <= localEndDate)
                .OrderBy(s => s.Timestamp)
                .Select(s => new SensorDataResponse
                {
                    Id = s.Id,
                    DeviceName = s.Device.Name,
                    Location = s.Device.Location,
                    Temperature = s.Temperature,
                    Humidity = s.Humidity,
                    Timestamp = s.Timestamp
                })
                .ToListAsync();
                
            return result;
        }

        public async Task<IEnumerable<SensorDataResponse>> GetDataByDeviceIdAndDateRangeAsync(int deviceId, DateTime startDate, DateTime endDate)
        {
            // deviceId parametresi Device.DeviceId (int) olarak geliyor
            // SensorData.DeviceId de Device.DeviceId'ye referans veriyor, direkt eşleştir
            var localStartDate = startDate;
            var localEndDate = endDate;
            
            var result = await _context.SensorData
                .Include(s => s.Device)
                .Where(s => s.DeviceId == deviceId && 
                           s.Device.IsActive && 
                           s.Timestamp >= localStartDate && 
                           s.Timestamp <= localEndDate)
                .OrderBy(s => s.Timestamp)
                .Select(s => new SensorDataResponse
                {
                    Id = s.Id,
                    DeviceName = s.Device.Name,
                    Location = s.Device.Location,
                    Temperature = s.Temperature,
                    Humidity = s.Humidity,
                    Timestamp = s.Timestamp
                })
                .ToListAsync();
                
            return result;
        }

        public async Task<bool> DeleteOldDataAsync(DateTime cutoffDate)
        {
            var oldData = await _context.SensorData
                .Where(s => s.Timestamp < cutoffDate)
                .ToListAsync();

            if (oldData.Any())
            {
                _context.SensorData.RemoveRange(oldData);
                await _context.SaveChangesAsync();
                return true;
            }

            return false;
        }
    }
}
