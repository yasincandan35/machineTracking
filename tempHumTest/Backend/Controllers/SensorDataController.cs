using Microsoft.AspNetCore.Mvc;
using TemperatureHumidityAPI.Models;
using TemperatureHumidityAPI.Services;

namespace TemperatureHumidityAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SensorDataController : ControllerBase
    {
        private readonly ISensorDataService _sensorDataService;
        private readonly ILiveDataCache _liveDataCache;

        public SensorDataController(
            ISensorDataService sensorDataService,
            ILiveDataCache liveDataCache)
        {
            _sensorDataService = sensorDataService;
            _liveDataCache = liveDataCache;
        }

        [HttpPost]
        public async Task<ActionResult<SensorDataResponse>> AddSensorData(SensorDataDto sensorDataDto)
        {
            try
            {
                var result = await _sensorDataService.AddSensorDataAsync(sensorDataDto);
                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("bulk")]
        public async Task<ActionResult<object>> AddBulkSensorData(BulkSensorDataDto bulkSensorDataDto)
        {
            try
            {
                var count = await _sensorDataService.AddBulkSensorDataAsync(bulkSensorDataDto);
                return Ok(new { message = "Bulk data imported successfully", count = count });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("latest")]
        public async Task<ActionResult<IEnumerable<object>>> GetLatestData()
        {
            var live = _liveDataCache.GetAll();
            if (live.Any())
                return Ok(live);

            var data = await _sensorDataService.GetLatestDataAsync();
            return Ok(data);
        }

        [HttpGet("device/{deviceId}")]
        public async Task<ActionResult<IEnumerable<SensorDataResponse>>> GetDataByDevice(int deviceId)
        {
            var data = await _sensorDataService.GetDataByDeviceAsync(deviceId);
            return Ok(data);
        }

        [HttpGet("daterange")]
        public async Task<ActionResult<IEnumerable<SensorDataResponse>>> GetDataByDateRange(
            [FromQuery] DateTime startDate, 
            [FromQuery] DateTime endDate)
        {
            var data = await _sensorDataService.GetDataByDateRangeAsync(startDate, endDate);
            return Ok(data);
        }

        [HttpGet("device/{deviceId}/daterange")]
        public async Task<ActionResult<IEnumerable<SensorDataResponse>>> GetDataByDeviceAndDateRange(
            int deviceId,
            [FromQuery] DateTime startDate, 
            [FromQuery] DateTime endDate)
        {
            // deviceId parametresi Device.DeviceId (int) olarak geliyor
            // SensorData.DeviceId de Device.DeviceId'ye referans veriyor
            var data = await _sensorDataService.GetDataByDeviceIdAndDateRangeAsync(deviceId, startDate, endDate);
            return Ok(data);
        }

        [HttpDelete("cleanup")]
        public async Task<IActionResult> CleanupOldData([FromQuery] DateTime cutoffDate)
        {
            var result = await _sensorDataService.DeleteOldDataAsync(cutoffDate);
            return Ok(new { deleted = result });
        }
    }
}
