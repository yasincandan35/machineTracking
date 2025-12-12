using Microsoft.AspNetCore.Mvc;
using TemperatureHumidityAPI.Models;
using TemperatureHumidityAPI.Services;

namespace TemperatureHumidityAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly IDeviceService _deviceService;

        public DevicesController(IDeviceService deviceService)
        {
            _deviceService = deviceService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Device>>> GetDevices()
        {
            var devices = await _deviceService.GetAllDevicesAsync();
            return Ok(devices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Device>> GetDevice(int id)
        {
            var device = await _deviceService.GetDeviceByIdAsync(id);
            if (device == null)
                return NotFound();

            return Ok(device);
        }

        [HttpPost]
        public async Task<ActionResult<Device>> CreateDevice(DeviceDto deviceDto)
        {
            var device = await _deviceService.CreateDeviceAsync(deviceDto);
            return CreatedAtAction(nameof(GetDevice), new { id = device.Id }, device);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDevice(int id, DeviceDto deviceDto)
        {
            var device = await _deviceService.UpdateDeviceAsync(id, deviceDto);
            if (device == null)
                return NotFound();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(int id)
        {
            var result = await _deviceService.DeleteDeviceAsync(id);
            if (!result)
                return NotFound();

            return NoContent();
        }

        [HttpPut("positions")]
        public async Task<IActionResult> UpdatePositions([FromBody] List<DevicePositionDto> positions)
        {
            var result = await _deviceService.UpdatePositionsAsync(positions);
            if (!result)
                return BadRequest("Pozisyonlar güncellenemedi");

            return Ok();
        }
    }
}
