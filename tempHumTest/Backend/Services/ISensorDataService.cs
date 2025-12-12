using TemperatureHumidityAPI.Models;

namespace TemperatureHumidityAPI.Services
{
    public interface ISensorDataService
    {
        Task<SensorDataResponse> AddSensorDataAsync(SensorDataDto sensorDataDto);
        Task<int> AddBulkSensorDataAsync(BulkSensorDataDto bulkSensorDataDto);
        Task<IEnumerable<SensorDataResponse>> GetLatestDataAsync();
        Task<IEnumerable<SensorDataResponse>> GetDataByDeviceAsync(int deviceId);
        Task<IEnumerable<SensorDataResponse>> GetDataByDateRangeAsync(DateTime startDate, DateTime endDate);
        Task<IEnumerable<SensorDataResponse>> GetDataByDeviceAndDateRangeAsync(int deviceId, DateTime startDate, DateTime endDate);
        Task<IEnumerable<SensorDataResponse>> GetDataByDeviceIdAndDateRangeAsync(int deviceId, DateTime startDate, DateTime endDate);
        Task<bool> DeleteOldDataAsync(DateTime cutoffDate);
    }
}
