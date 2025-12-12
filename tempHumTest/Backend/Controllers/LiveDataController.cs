using Microsoft.AspNetCore.Mvc;
using TemperatureHumidityAPI.Services;

namespace TemperatureHumidityAPI.Controllers
{
    [ApiController]
    [Route("api/live")]
    public class LiveDataController : ControllerBase
    {
        private readonly ILiveDataCache _liveDataCache;

        public LiveDataController(ILiveDataCache liveDataCache)
        {
            _liveDataCache = liveDataCache;
        }

        [HttpGet("sensordata")]
        public IActionResult GetLiveSensorData()
        {
            var data = _liveDataCache.GetAll();
            return Ok(data);
        }
    }
}

