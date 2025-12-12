using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DashboardBackend.Data;
using DashboardBackend.Models;
using DashboardBackend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC Data Collector Background Service - PLC'den veri toplar ve API sunar
    /// </summary>
    public class PLCDataCollectorService : BackgroundService
    {
        private readonly ILogger<PLCDataCollectorService> _logger;
        private readonly IConfiguration _configuration;
        private readonly IServiceProvider _serviceProvider;
        private readonly MachineDatabaseService _machineDatabaseService;
        private SqlProxy? _sqlProxy;
        private DataProcessor? _dataProcessor;
        private ConfigurationManager? _configurationManager;
        private CancellationTokenSource? _cancellationTokenSource;
        private string? _currentMachineName;

        // Multi-connection support
        private readonly Dictionary<int, PLCReader> _plcReaders = new();
        private readonly Dictionary<int, PLCData> _latestDataPerConnection = new();
        private readonly object _mergeLock = new();
        private int? _primaryConnectionId;
        private PLCReader? _primaryPLCReader;

        // Public accessors for controllers
        public SqlProxy? GetSqlProxy() => _sqlProxy;
        public DataProcessor? GetDataProcessor() => _dataProcessor;
        public PLCReader? GetPLCReader() => _primaryPLCReader;
        public string? GetCurrentMachineName() => _currentMachineName;

        public PLCDataCollectorService(
            ILogger<PLCDataCollectorService> logger,
            IConfiguration configuration,
            IServiceProvider serviceProvider,
            MachineDatabaseService machineDatabaseService)
        {
            _logger = logger;
            _configuration = configuration;
            _serviceProvider = serviceProvider;
            _machineDatabaseService = machineDatabaseService;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🚀 PLC Data Collector Service başlatılıyor...");

            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);

            try
            {
                // Port 1502'yi temizle
                await CleanupPort1502();

                // Aktif makineyi bul (Dashboard DB'den)
                _currentMachineName = await GetActiveMachineNameAsync();
                if (string.IsNullOrEmpty(_currentMachineName))
                {
                    _logger.LogWarning("⚠️ Aktif makine bulunamadı! Servis başlatılamıyor.");
                    return;
                }

                _logger.LogInformation("✅ Aktif makine bulundu: {MachineName}", _currentMachineName);

                // Makine bazlı connection string oluştur
                var machineConnectionString = _machineDatabaseService.GetConnectionString(_currentMachineName);
                _logger.LogInformation("📊 Makine veritabanı: {ConnectionString}", machineConnectionString.Replace("Password=***;", ""));

                // Servisleri oluştur
                _sqlProxy = new SqlProxy(machineConnectionString, serviceProvider: _serviceProvider);
                _sqlProxy.SetServiceProvider(_serviceProvider);
                _dataProcessor = new DataProcessor(_sqlProxy);

                // ConfigurationManager - Artık kendi API'mizden okuyacak
                var apiBaseUrl = _configuration["PLC:ApiBaseUrl"] ?? "http://localhost:5199";
                _configurationManager = new ConfigurationManager(apiBaseUrl);

                // Servisleri başlat
                _logger.LogInformation("🔄 Servisler başlatılıyor...");
                await _sqlProxy.StartAsync(_cancellationTokenSource.Token);
                _logger.LogInformation("✅ SQL Proxy başlatıldı");

                _sqlProxy.SetDataProcessor(_dataProcessor);

                _logger.LogInformation("🔄 Konfigürasyon yükleniyor...");
                var config = await LoadConfigurationFromDatabaseAsync();
                if (config != null)
                {
                    await InitializeReadersAsync(config, _cancellationTokenSource.Token);
                }
                else
                {
                    _logger.LogWarning("⚠️ Konfigürasyon yüklenemedi, varsayılan ayarlar kullanılıyor");
                }

                _logger.LogInformation("✅ Tüm servisler başlatıldı!");
                if (_primaryPLCReader != null)
                {
                    _logger.LogInformation("📊 Birincil PLC Okuma: {IpAddress}:{Port}", _primaryPLCReader.IpAddress, _primaryPLCReader.Port);
                }

                // Servisler çalışırken bekle
                while (!_cancellationTokenSource.Token.IsCancellationRequested)
                {
                    await Task.Delay(1000, _cancellationTokenSource.Token);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Kritik hata: {Message}", ex.Message);
            }
            finally
            {
                // Servisleri durdur
                _logger.LogInformation("🔄 Servisler durduruluyor...");
                await StopAllReadersAsync();
                if (_sqlProxy != null)
                    await _sqlProxy.StopAsync();
                _logger.LogInformation("✅ Tüm servisler durduruldu");
            }
        }

        /// <summary>
        /// Dashboard DB'den aktif makine veritabanı adını al
        /// MachineName "Bobst Lemanic 3" gibi bir şey olabilir, bu yüzden TableName'den veritabanı adını çıkarıyoruz
        /// </summary>
        private async Task<string?> GetActiveMachineNameAsync()
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var dashboardContext = scope.ServiceProvider.GetRequiredService<DashboardDbContext>();
                
                // İlk aktif makineyi al (IsActive = true) veya ilk makineyi al
                var machine = await dashboardContext.MachineLists
                    .Where(m => m.IsActive)
                    .FirstOrDefaultAsync() 
                    ?? await dashboardContext.MachineLists.FirstOrDefaultAsync();
                
                if (machine == null)
                {
                    _logger.LogWarning("⚠️ Hiç makine bulunamadı!");
                    return null;
                }
                
                // DatabaseName kolonunu kullan (artık direkt veritabanı adı tutuluyor)
                var databaseName = machine.DatabaseName;
                
                // Eğer DatabaseName boşsa, TableName'i kullan (geriye uyumluluk)
                if (string.IsNullOrEmpty(databaseName))
                {
                    databaseName = machine.TableName;
                    _logger.LogWarning("⚠️ DatabaseName boş, TableName kullanılıyor: {TableName}", machine.TableName);
                }
                
                _logger.LogInformation("✅ Aktif makine bulundu: {MachineName}, Database: {DatabaseName}", machine.MachineName, databaseName);
                return databaseName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Aktif makine bulunurken hata: {Message}", ex.Message);
                return null;
            }
        }

        /// <summary>
        /// Veritabanından konfigürasyon yükle (makine bazlı)
        /// </summary>
        private async Task<PLCConfiguration?> LoadConfigurationFromDatabaseAsync()
        {
            if (string.IsNullOrEmpty(_currentMachineName))
            {
                _logger.LogError("Makine ismi bulunamadı, konfigürasyon yüklenemiyor");
                return null;
            }

            try
            {
                // Makine bazlı veritabanı bağlantısı oluştur
                using var context = _machineDatabaseService.CreateDbContext(_currentMachineName);

                var config = new PLCConfiguration();

                // PLC Bağlantıları
                var connections = await context.PLCConnections.ToListAsync();
                config.Connections = connections.Select(c => new PLCConnectionConfig
                {
                    Id = c.Id,
                    Name = c.Name,
                    DisplayName = c.DisplayName,
                    IpAddress = c.IpAddress,
                    Port = c.Port,
                    ReadIntervalMs = c.ReadIntervalMs,
                    SourceType = c.SourceType,
                    IsActive = c.IsActive
                }).ToList();

                // PLC Data Definitions
                var definitions = await context.PLCDataDefinitions
                    .Include(d => d.PLCConnection)
                    .ToListAsync();
                config.DataDefinitions = definitions.Select(d => new PLCDataDefinitionConfig
                {
                    Id = d.Id,
                    Name = d.Name,
                    Description = d.Description ?? string.Empty,
                    DataType = d.DataType,
                    RegisterAddress = d.RegisterAddress,
                    RegisterCount = d.RegisterCount,
                    ByteOrder = d.ByteOrder ?? "HighToLow",
                    WordSwap = d.WordSwap,
                    OperationType = d.OperationType,
                    PLCConnectionId = d.PLCConnectionId,
                    IsActive = d.IsActive,
                    ApiEndpoint = d.ApiEndpoint ?? "/api/data"
                }).ToList();

                return config;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Konfigürasyon yüklenirken hata: {Message}", ex.Message);
                return null;
            }
        }

        private async Task InitializeReadersAsync(PLCConfiguration config, CancellationToken token)
        {
            await StopAllReadersAsync();
            _plcReaders.Clear();
            _latestDataPerConnection.Clear();
            _primaryConnectionId = null;
            _primaryPLCReader = null;

            var activeConnections = config.Connections.Where(c => c.IsActive).ToList();
            if (!activeConnections.Any())
            {
                _logger.LogWarning("⚠️ Aktif PLC bağlantısı bulunamadı");
                return;
            }

            foreach (var connection in activeConnections)
            {
                var definitions = config.DataDefinitions
                    .Where(d => d.IsActive && d.PLCConnectionId == connection.Id)
                    .ToList();

                if (!definitions.Any())
                {
                    _logger.LogWarning("⚠️ Bağlantı için veri tanımı bulunamadı: {Connection}", connection.Name);
                    continue;
                }

                var reader = new PLCReader();
                reader.DataReceived += async (sender, data) => await HandleReaderDataAsync(connection.Id, data);
                reader.ErrorOccurred += (sender, ex) =>
                {
                    _logger.LogError(
                        ex,
                        "❌ PLC Reader hatası ({Connection} - {Ip}:{Port}): {Message}",
                        connection.Name,
                        connection.IpAddress ?? "bilinmiyor",
                        connection.Port,
                        ex.Message);
                };

                reader.UpdateConfiguration(connection, definitions);
                _plcReaders[connection.Id] = reader;

                if (_primaryConnectionId == null)
                {
                    _primaryConnectionId = connection.Id;
                    _primaryPLCReader = reader;
                    _sqlProxy?.SetPLCReader(reader);
                }

                try
                {
                    await reader.StartAsync(token);
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "❌ PLC Reader başlatılamadı ({Connection} - {Ip}:{Port})",
                        connection.Name,
                        connection.IpAddress ?? "bilinmiyor",
                        connection.Port);
                }
            }
        }

        private PLCData MergeLatestDataLocked()
        {
            var merged = new PLCData();
            DateTime latestTimestamp = DateTime.MinValue;

            foreach (var entry in _latestDataPerConnection.Values)
            {
                if (entry.Timestamp > latestTimestamp)
                {
                    latestTimestamp = entry.Timestamp;
                }

                foreach (var kvp in entry.Data)
                {
                    merged.Data[kvp.Key] = kvp.Value;
                }
            }

            merged.Timestamp = latestTimestamp == DateTime.MinValue ? DateTime.Now : latestTimestamp;
            return merged;
        }

        private async Task HandleReaderDataAsync(int connectionId, PLCData data)
        {
            if (data == null)
            {
                return;
            }

            PLCData? mergedForProcessing = null;

            lock (_mergeLock)
            {
                _latestDataPerConnection[connectionId] = data.Clone();

                var isPrimaryReady = !_primaryConnectionId.HasValue ||
                                      _latestDataPerConnection.ContainsKey(_primaryConnectionId.Value);

                if (isPrimaryReady)
                {
                    mergedForProcessing = MergeLatestDataLocked();
                }
            }

            if (mergedForProcessing != null && _dataProcessor != null)
            {
                await _dataProcessor.ProcessDataAsync(mergedForProcessing);
            }
        }

        private async Task StopAllReadersAsync()
        {
            foreach (var reader in _plcReaders.Values)
            {
                try
                {
                    await reader.StopAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "⚠️ PLC Reader durdurulamadı: {Message}", ex.Message);
                }
                finally
                {
                    reader.Dispose();
                }
            }

            _plcReaders.Clear();
            _latestDataPerConnection.Clear();
            _primaryPLCReader = null;
            _primaryConnectionId = null;
        }

        /// <summary>
        /// Port 1502'yi temizle
        /// </summary>
        private async Task CleanupPort1502()
        {
            try
            {
                _logger.LogInformation("🧹 Port 1502 temizleniyor...");

                var processInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "netstat",
                    Arguments = "-ano | findstr :1502",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    CreateNoWindow = true
                };

                using var process = System.Diagnostics.Process.Start(processInfo);
                if (process != null)
                {
                    var output = await process.StandardOutput.ReadToEndAsync();
                    await process.WaitForExitAsync();

                    if (!string.IsNullOrEmpty(output))
                    {
                        var lines = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                        foreach (var line in lines)
                        {
                            if (line.Contains(":1502") && line.Contains("ESTABLISHED"))
                            {
                                var parts = line.Split(new char[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                if (parts.Length >= 5 && int.TryParse(parts[4], out int pid))
                                {
                                    try
                                    {
                                        var targetProcess = System.Diagnostics.Process.GetProcessById(pid);
                                        if (targetProcess.ProcessName.Contains("DashboardBackend") || 
                                            targetProcess.ProcessName.Contains("PLCDataCollector"))
                                        {
                                            _logger.LogInformation("🔪 Eski process sonlandırılıyor: PID {Pid}", pid);
                                            targetProcess.Kill();
                                            await Task.Delay(1000);
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogWarning(ex, "⚠️ Process {Pid} zaten kapanmış", pid);
                                    }
                                }
                            }
                        }
                    }
                }

                _logger.LogInformation("✅ Port 1502 temizlendi");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "⚠️ Port temizleme hatası: {Message}", ex.Message);
            }
        }

        public override void Dispose()
        {
            _cancellationTokenSource?.Cancel();
            _cancellationTokenSource?.Dispose();
            StopAllReadersAsync().GetAwaiter().GetResult();
            _sqlProxy?.Dispose();
            _dataProcessor?.Dispose();
            _configurationManager?.Dispose();
            base.Dispose();
        }
    }
}

