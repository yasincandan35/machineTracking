using System.Collections.Concurrent;
using System.Net.Http.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TemperatureHumidityAPI.Data;
using TemperatureHumidityAPI.Models;
using tempHumTest.Backend.Hubs;

namespace TemperatureHumidityAPI.Services
{
    public class DevicePollingService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<DevicePollingService> _logger;
        private readonly ILiveDataCache _liveDataCache;
        private readonly ConcurrentDictionary<int, DateTime> _lastDbSaveTimes = new();
        private static readonly TimeSpan _loopDelay = TimeSpan.FromSeconds(1);

        public DevicePollingService(
            IServiceProvider serviceProvider,
            IHttpClientFactory httpClientFactory,
            ILiveDataCache liveDataCache,
            ILogger<DevicePollingService> logger)
        {
            _serviceProvider = serviceProvider;
            _httpClientFactory = httpClientFactory;
            _liveDataCache = liveDataCache;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Device polling service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await PollDevicesAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unhandled exception in device polling loop");
                }

                try
                {
                    await Task.Delay(_loopDelay, stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    // Swallow cancellation exceptions during shutdown
                }
            }

            _logger.LogInformation("Device polling service stopped");
        }

        private async Task PollDevicesAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<TemperatureHumidityContext>();
            var sensorDataService = scope.ServiceProvider.GetRequiredService<ISensorDataService>();
            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<SensorHub>>();

            var devices = await context.Devices
                .Where(d => d.IsActive && !string.IsNullOrWhiteSpace(d.IpAddress))
                .ToListAsync(cancellationToken);

            if (!devices.Any())
            {
                return;
            }

            foreach (var device in devices)
            {
                if (cancellationToken.IsCancellationRequested)
                    break;

                // Her cihazdan saniyede bir veri çek (LiveDataCache için)
                var reading = await TryFetchArduinoDataAsync(device, cancellationToken);
                if (reading == null)
                {
                    continue;
                }

                try
                {
                    var temperature = reading.Temperature ?? 0;
                    var humidity = reading.Humidity ?? 0;
                    var timestamp = DateTime.Now;

                    // LiveDataCache'e her zaman güncelle (saniyede bir)
                    _liveDataCache.Update(device, temperature, humidity, timestamp);

                    // SignalR ile canlı veriyi gönder
                    await hubContext.Clients.All.SendAsync("ReceiveSensorData", new
                    {
                        deviceId = device.Id,
                        deviceName = device.Name,
                        ipAddress = device.IpAddress,
                        temperature = temperature,
                        humidity = humidity,
                        timestamp = timestamp
                    }, cancellationToken);

                    // Veritabanına kaydetme işlemini 5 dakikada bir yap (değiştirilemez)
                    const int dbSaveIntervalSeconds = 300; // 5 dakika = 300 saniye
                    var lastDbSave = _lastDbSaveTimes.GetOrAdd(device.Id, DateTime.MinValue);

                    if ((DateTime.UtcNow - lastDbSave).TotalSeconds >= dbSaveIntervalSeconds)
                    {
                        var dto = new SensorDataDto
                        {
                            DeviceId = device.Id,
                            Temperature = temperature,
                            Humidity = humidity,
                            Timestamp = timestamp
                        };

                        await sensorDataService.AddSensorDataAsync(dto);
                        _lastDbSaveTimes[device.Id] = DateTime.UtcNow;
                        _logger.LogDebug("Sensor data saved to DB for device {DeviceId}", device.Id);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to process data for device {DeviceId}", device.Id);
                }
            }
        }

        private async Task<ArduinoReading?> TryFetchArduinoDataAsync(Device device, CancellationToken cancellationToken)
        {
            try
            {
                var client = _httpClientFactory.CreateClient("arduino");
                var url = $"http://{device.IpAddress}/data";

                var response = await client.GetAsync(url, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Arduino {DeviceId} responded with {StatusCode}", device.Id, response.StatusCode);
                    return null;
                }

                var payload = await response.Content.ReadFromJsonAsync<ArduinoReading>(cancellationToken: cancellationToken);
                if (payload == null || !payload.IsValid())
                {
                    _logger.LogWarning("Invalid payload received from Arduino {DeviceId}", device.Id);
                    return null;
                }

                return payload;
            }
            catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch data from Arduino {DeviceId} ({Ip})", device.Id, device.IpAddress);
                return null;
            }
        }

        private record ArduinoReading
        {
            public decimal? Temperature { get; init; }
            public decimal? Humidity { get; init; }

            public bool IsValid()
            {
                return Temperature.HasValue && Humidity.HasValue;
            }
        }
    }
}

