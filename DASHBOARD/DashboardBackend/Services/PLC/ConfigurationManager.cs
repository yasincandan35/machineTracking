using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Timers;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC konfigürasyon yöneticisi - API'den dinamik olarak konfigürasyon okur
    /// </summary>
    public class ConfigurationManager : IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly System.Timers.Timer _refreshTimer;
        private PLCConfiguration? _currentConfiguration;
        private readonly string _apiBaseUrl;
        private bool _disposed = false;

        public event EventHandler<PLCConfiguration>? ConfigurationChanged;

        public ConfigurationManager(string apiBaseUrl = "http://192.168.1.237:8080")
        {
            _apiBaseUrl = apiBaseUrl;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
            
            // Her 30 saniyede bir konfigürasyonu yenile
            _refreshTimer = new System.Timers.Timer(30000);
            _refreshTimer.Elapsed += async (sender, e) => await RefreshConfigurationAsync();
            _refreshTimer.AutoReset = true;
        }

        public PLCConfiguration? CurrentConfiguration => _currentConfiguration;

        public async Task<PLCConfiguration?> LoadConfigurationAsync()
        {
            try
            {
                Console.WriteLine($"🔍 Konfigürasyon yükleniyor: {_apiBaseUrl}");
                var configuration = new PLCConfiguration();

                // PLC Bağlantıları
                Console.WriteLine($"🔍 PLC Bağlantıları yükleniyor: {_apiBaseUrl}/api/plcconfig/connections");
                var connectionsResponse = await _httpClient.GetStringAsync($"{_apiBaseUrl}/api/plcconfig/connections");
                var connections = JsonSerializer.Deserialize<List<PLCConnectionConfig>>(connectionsResponse, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (connections != null)
                    configuration.Connections = connections;
                Console.WriteLine($"✅ PLC Bağlantıları yüklendi: {connections?.Count ?? 0} adet");

                // PLC Veri Tanımları
                Console.WriteLine($"🔍 PLC Veri Tanımları yükleniyor: {_apiBaseUrl}/api/plcconfig/data-definitions");
                var definitionsResponse = await _httpClient.GetStringAsync($"{_apiBaseUrl}/api/plcconfig/data-definitions");
                var definitions = JsonSerializer.Deserialize<List<PLCDataDefinitionConfig>>(definitionsResponse, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (definitions != null)
                    configuration.DataDefinitions = definitions;
                Console.WriteLine($"✅ PLC Veri Tanımları yüklendi: {definitions?.Count ?? 0} adet");

                // SQL Bağlantıları
                Console.WriteLine($"🔍 SQL Bağlantıları yükleniyor: {_apiBaseUrl}/api/plcconfig/sql-connections");
                var sqlConnectionsResponse = await _httpClient.GetStringAsync($"{_apiBaseUrl}/api/plcconfig/sql-connections");
                var sqlConnections = JsonSerializer.Deserialize<List<SQLConnectionConfig>>(sqlConnectionsResponse, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (sqlConnections != null)
                    configuration.SQLConnections = sqlConnections;
                Console.WriteLine($"✅ SQL Bağlantıları yüklendi: {sqlConnections?.Count ?? 0} adet");

                // API Ayarları
                Console.WriteLine($"🔍 API Ayarları yükleniyor: {_apiBaseUrl}/api/plcconfig/api-settings");
                var apiSettingsResponse = await _httpClient.GetStringAsync($"{_apiBaseUrl}/api/plcconfig/api-settings");
                var apiSettings = JsonSerializer.Deserialize<List<APISettingConfig>>(apiSettingsResponse, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                if (apiSettings != null)
                    configuration.APISettings = apiSettings;
                Console.WriteLine($"✅ API Ayarları yüklendi: {apiSettings?.Count ?? 0} adet");

                _currentConfiguration = configuration;
                Console.WriteLine($"✅ Konfigürasyon yüklendi: {configuration.Connections.Count} PLC bağlantısı, {configuration.DataDefinitions.Count} veri tanımı");
                
                return configuration;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Konfigürasyon yüklenirken hata: {ex.Message}");
                Console.WriteLine($"❌ Stack trace: {ex.StackTrace}");
                return null;
            }
        }

        public async Task RefreshConfigurationAsync()
        {
            var newConfig = await LoadConfigurationAsync();
            if (newConfig != null && HasConfigurationChanged(newConfig))
            {
                _currentConfiguration = newConfig;
                ConfigurationChanged?.Invoke(this, newConfig);
                Console.WriteLine("🔄 Konfigürasyon değişti, sistem güncelleniyor...");
            }
        }

        private bool HasConfigurationChanged(PLCConfiguration newConfig)
        {
            if (_currentConfiguration == null) return true;

            // Basit karşılaştırma - gerçek uygulamada daha detaylı olabilir
            return _currentConfiguration.Connections.Count != newConfig.Connections.Count ||
                   _currentConfiguration.DataDefinitions.Count != newConfig.DataDefinitions.Count ||
                   _currentConfiguration.SQLConnections.Count != newConfig.SQLConnections.Count ||
                   _currentConfiguration.APISettings.Count != newConfig.APISettings.Count;
        }

        public void StartAutoRefresh()
        {
            _refreshTimer.Start();
            Console.WriteLine("🔄 Otomatik konfigürasyon yenileme başlatıldı (30 saniye aralık)");
        }

        public void StopAutoRefresh()
        {
            _refreshTimer.Stop();
            Console.WriteLine("⏹️ Otomatik konfigürasyon yenileme durduruldu");
        }

        public async Task LogSystemMessageAsync(string level, string component, string message, string? details = null)
        {
            try
            {
                var logEntry = new
                {
                    logLevel = level,
                    component = component,
                    message = message,
                    details = details
                };

                var json = JsonSerializer.Serialize(logEntry);
                var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
                
                await _httpClient.PostAsync($"{_apiBaseUrl}/api/plcconfig/system-logs", content);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Sistem logu gönderilemedi: {ex.Message}");
            }
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _refreshTimer?.Stop();
                _refreshTimer?.Dispose();
                _httpClient?.Dispose();
                _disposed = true;
            }
        }
    }
}
