using Microsoft.AspNetCore.Mvc;

namespace DashboardBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private static bool _xmasMode = false;

        [HttpGet("xmas-mode")]
        public IActionResult GetXmasMode()
        {
            return Ok(new { enabled = _xmasMode });
        }

        public class XmasModeRequest
        {
            public bool Enabled { get; set; }
        }

        [HttpPost("xmas-mode")]
        public IActionResult SetXmasMode([FromBody] XmasModeRequest request)
        {
            _xmasMode = request.Enabled;
            return Ok(new { enabled = _xmasMode });
        }
    }
}

