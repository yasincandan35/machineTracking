using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using TemperatureHumidityAPI.Models;
using TemperatureHumidityAPI.Services;
using tempHumTest.Backend.Hubs;
using System.Net.Http;

namespace TemperatureHumidityAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ArduinoController : ControllerBase
    {
        private readonly ISensorDataService _sensorDataService;
        private readonly IDeviceService _deviceService;
        private readonly IHubContext<SensorHub> _hubContext;
        private readonly ILiveDataCache _liveDataCache;
        private readonly IHttpClientFactory _httpClientFactory;
        private static readonly ConcurrentDictionary<int, DateTime> _lastDbSaveTimes = new();
        private const int DbSaveIntervalSeconds = 300; // 5 dakika = 300 saniye

        public ArduinoController(
            ISensorDataService sensorDataService, 
            IDeviceService deviceService, 
            IHubContext<SensorHub> hubContext,
            ILiveDataCache liveDataCache,
            IHttpClientFactory httpClientFactory)
        {
            _sensorDataService = sensorDataService;
            _deviceService = deviceService;
            _hubContext = hubContext;
            _liveDataCache = liveDataCache;
            _httpClientFactory = httpClientFactory;
        }

        [HttpPost("data")]
        public async Task<IActionResult> ReceiveArduinoData([FromBody] ArduinoDataDto arduinoData)
        {
            try
            {
                var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                
                // Null kontrolü
                if (arduinoData == null)
                {
                    return BadRequest("Invalid JSON data");
                }
                
                // JSON parsing hatası kontrolü
                if (string.IsNullOrEmpty(arduinoData.ToString()))
                {
                    return BadRequest("Empty JSON data");
                }
                
                // Arduino verilerini kontrol et
                if (arduinoData.Temperature == 0 && arduinoData.Humidity == 0)
                {
                    return BadRequest("Invalid sensor data");
                }
                
                // Geçersiz değerleri kontrol et
                if (arduinoData.Temperature < -50 || arduinoData.Temperature > 100 || 
                    arduinoData.Humidity < 0 || arduinoData.Humidity > 100)
                {
                    return BadRequest("Invalid sensor values");
                }
                
                // IP adresine göre cihazı bul
                var device = await _deviceService.GetDeviceByIpAsync(clientIp ?? "");
                if (device == null)
                {
                    // Arduino cihazını otomatik oluştur
                    // DeviceId için benzersiz bir int değer oluştur (IP'nin son oktedini kullan)
                    var ipParts = (clientIp ?? "192.168.1.238").Split('.');
                    var lastOctet = ipParts.Length > 0 && int.TryParse(ipParts[ipParts.Length - 1], out var octet) ? octet : 238;
                    var autoDeviceId = 1000 + lastOctet; // 1000-1255 arası benzersiz ID
                    
                    var deviceDto = new DeviceDto
                    {
                        Name = "Arduino Uno",
                        Location = "Ofis",
                        DeviceId = autoDeviceId, // int olarak ayarla
                        IpAddress = clientIp ?? "192.168.1.238"
                    };
                    device = await _deviceService.CreateDeviceAsync(deviceDto);
                }

                var timestamp = DateTime.Now;
                
                // LiveDataCache'e her zaman güncelle (saniyede bir POST geldiğinde)
                _liveDataCache.Update(device, arduinoData.Temperature, arduinoData.Humidity, timestamp);
                
                // WebSocket ile frontend'e canlı veri gönder
                await _hubContext.Clients.All.SendAsync("ReceiveSensorData", new {
                    deviceId = device.Id,
                    deviceName = device.Name,
                    ipAddress = device.IpAddress,
                    temperature = arduinoData.Temperature,
                    humidity = arduinoData.Humidity,
                    timestamp = timestamp
                });

                // Veritabanına kaydetme işlemini 5 dakikada bir yap (5'in katlarında: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
                await SaveToDatabaseIfNeeded(device, arduinoData);
                
                return Ok(new { 
                    success = true, 
                    message = "Data received successfully"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { 
                    success = false, 
                    message = ex.Message 
                });
            }
        }

        [HttpPost("live-data")]
        public async Task<IActionResult> ReceiveLiveData([FromBody] ArduinoDataDto arduinoData)
        {
            try
            {
                var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();
                
                // Null kontrolü
                if (arduinoData == null)
                {
                    return BadRequest("Invalid JSON data");
                }
                
                // JSON parsing hatası kontrolü
                if (string.IsNullOrEmpty(arduinoData.ToString()))
                {
                    return BadRequest("Empty JSON data");
                }
                
                // Arduino verilerini kontrol et
                if (arduinoData.Temperature == 0 && arduinoData.Humidity == 0)
                {
                    return BadRequest("Invalid sensor data");
                }
                
                // Geçersiz değerleri kontrol et
                if (arduinoData.Temperature < -50 || arduinoData.Temperature > 100 || 
                    arduinoData.Humidity < 0 || arduinoData.Humidity > 100)
                {
                    return BadRequest("Invalid sensor values");
                }
                
                // IP adresine göre cihazı bul
                var device = await _deviceService.GetDeviceByIpAsync(clientIp ?? "");
                if (device == null)
                {
                    return BadRequest("Device not found");
                }

                var timestamp = DateTime.Now;
                
                // LiveDataCache'e her zaman güncelle (saniyede bir POST geldiğinde)
                _liveDataCache.Update(device, arduinoData.Temperature, arduinoData.Humidity, timestamp);
                
                // WebSocket ile frontend'e canlı veri gönder
                await _hubContext.Clients.All.SendAsync("ReceiveSensorData", new {
                    deviceId = device.Id,
                    deviceName = device.Name,
                    ipAddress = device.IpAddress,
                    temperature = arduinoData.Temperature,
                    humidity = arduinoData.Humidity,
                    timestamp = timestamp
                });
                
                // Veritabanına kaydetme işlemini 5 dakikada bir yap (5'in katlarında: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
                await SaveToDatabaseIfNeeded(device, arduinoData);
                
                return Ok(new { 
                    success = true, 
                    message = "Live data sent successfully"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { 
                    success = false, 
                    message = ex.Message 
                });
            }
        }

        [HttpGet("calibrate/{ipAddress}")]
        public async Task<IActionResult> GetCalibration(string ipAddress)
        {
            try
            {
                if (string.IsNullOrEmpty(ipAddress))
                {
                    return BadRequest(new { success = false, message = "IP adresi gerekli" });
                }

                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(10);

                try
                {
                    var response = await httpClient.GetAsync($"http://{ipAddress}/calibrate");

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ✅ Kalibrasyon değerleri okundu - IP: {ipAddress}, Response: {responseContent}");
                        
                        // JSON parse et
                        try
                        {
                            var calibrationData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, decimal>>(responseContent);
                            return Ok(new { 
                                success = true, 
                                temperatureOffset = calibrationData?.GetValueOrDefault("temperatureOffset", 0),
                                humidityOffset = calibrationData?.GetValueOrDefault("humidityOffset", 0)
                            });
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ JSON parse hatası - IP: {ipAddress}, Error: {ex.Message}");
                            return BadRequest(new { success = false, message = "Arduino'dan gelen veri parse edilemedi" });
                        }
                    }
                    else
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino kalibrasyon okuma hatası - IP: {ipAddress}, Status: {response.StatusCode}, Error: {errorContent}");
                        return BadRequest(new { success = false, message = $"Arduino yanıt vermedi: {response.StatusCode}" });
                    }
                }
                catch (HttpRequestException ex)
                {
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino bağlantı hatası - IP: {ipAddress}, Error: {ex.Message}");
                    return BadRequest(new { success = false, message = $"Arduino'ya bağlanılamadı: {ex.Message}" });
                }
                catch (TaskCanceledException)
                {
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino timeout - IP: {ipAddress}");
                    return BadRequest(new { success = false, message = "Arduino yanıt vermiyor (timeout)" });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Kalibrasyon okuma hatası: {ex.Message}");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        [HttpPost("calibrate")]
        public async Task<IActionResult> CalibrateDevice([FromBody] CalibrationRequestDto request)
        {
            try
            {
                if (request == null || string.IsNullOrEmpty(request.IpAddress))
                {
                    return BadRequest(new { success = false, message = "IP adresi gerekli" });
                }

                // Arduino'ya kalibrasyon değerlerini gönder (cihaz bulunamasa bile gönder)
                var calibrationData = new Dictionary<string, object>();
                if (request.TemperatureOffset.HasValue)
                {
                    calibrationData["temperatureOffset"] = request.TemperatureOffset.Value;
                }
                if (request.HumidityOffset.HasValue)
                {
                    calibrationData["humidityOffset"] = request.HumidityOffset.Value;
                }

                if (calibrationData.Count == 0)
                {
                    return BadRequest(new { success = false, message = "En az bir kalibrasyon değeri gerekli" });
                }

                var httpClient = _httpClientFactory.CreateClient();
                httpClient.Timeout = TimeSpan.FromSeconds(10);

                try
                {
                    var response = await httpClient.PostAsJsonAsync(
                        $"http://{request.IpAddress}/calibrate",
                        calibrationData
                    );

                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        var device = await _deviceService.GetDeviceByIpAsync(request.IpAddress);
                        var deviceInfo = device != null ? $"Device.Id: {device.Id}, " : "";
                        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ✅ Kalibrasyon gönderildi - {deviceInfo}IP: {request.IpAddress}, TempOffset: {request.TemperatureOffset}, HumOffset: {request.HumidityOffset}");
                        
                        return Ok(new { 
                            success = true, 
                            message = "Kalibrasyon başarıyla gönderildi"
                        });
                    }
                    else
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino kalibrasyon hatası - IP: {request.IpAddress}, Status: {response.StatusCode}, Error: {errorContent}");
                        return BadRequest(new { success = false, message = $"Arduino yanıt vermedi: {response.StatusCode}" });
                    }
                }
                catch (HttpRequestException ex)
                {
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino bağlantı hatası - IP: {request.IpAddress}, Error: {ex.Message}");
                    return BadRequest(new { success = false, message = $"Arduino'ya bağlanılamadı: {ex.Message}" });
                }
                catch (TaskCanceledException)
                {
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Arduino timeout - IP: {request.IpAddress}");
                    return BadRequest(new { success = false, message = "Arduino yanıt vermiyor (timeout)" });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ❌ Kalibrasyon hatası: {ex.Message}");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        private async Task SaveToDatabaseIfNeeded(Device device, ArduinoDataDto arduinoData)
        {
            // Veritabanına kaydetme işlemini 5 dakikada bir yap (5'in katlarında: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
            var now = DateTime.Now;
            var minute = now.Minute;
            
            // Sadece 5'in katlarında kayıt yap (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55)
            var shouldSave = minute % 5 == 0;
            
            if (shouldSave)
            {
                var lastDbSave = _lastDbSaveTimes.GetOrAdd(device.DeviceId, DateTime.MinValue); // device.DeviceId kullan
            
                // Aynı dakikada birden fazla kayıt yapılmasını engelle
                var lastSaveMinute = lastDbSave.Minute;
                var lastSaveHour = lastDbSave.Hour;
                var currentHour = now.Hour;
                var currentMinute = now.Minute;
                
                // Farklı saatte veya farklı dakikada ise kaydet
                var isDifferentMinute = lastSaveMinute != currentMinute;
                var isDifferentHour = lastSaveHour != currentHour;
                
                if (isDifferentMinute || isDifferentHour)
                {
                    try
                    {
                        var sensorDataDto = new SensorDataDto
                        {
                            DeviceId = device.DeviceId, // Device.DeviceId (int) kullan
                            Temperature = arduinoData.Temperature,
                            Humidity = arduinoData.Humidity
                        };

                        await _sensorDataService.AddSensorDataAsync(sensorDataDto);
                        _lastDbSaveTimes[device.DeviceId] = now; // device.DeviceId kullan
                        
                        // Sadece kayıt yapıldığında log göster
                        Console.WriteLine($"[{now:yyyy-MM-dd HH:mm:ss}] ✅ Veritabanına kaydedildi - Device.Id: {device.Id}, Device.DeviceId: {device.DeviceId}, Location: {device.Location}, Temp: {arduinoData.Temperature}°C, Hum: {arduinoData.Humidity}%");
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{now:yyyy-MM-dd HH:mm:ss}] ❌ Veritabanına kayıt hatası - Device.Id: {device.Id}, Device.DeviceId: {device.DeviceId}, Error: {ex.Message}");
                    }
                }
            }
        }
    }

    public class ArduinoDataDto
    {
        public decimal Temperature { get; set; }
        public decimal Humidity { get; set; }
    }

    public class CalibrationRequestDto
    {
        public string IpAddress { get; set; } = string.Empty;
        public decimal? TemperatureOffset { get; set; }
        public decimal? HumidityOffset { get; set; }
    }
}
