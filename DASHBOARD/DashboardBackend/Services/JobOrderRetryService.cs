using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DashboardBackend.Services.PLC;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DashboardBackend.Services
{
    /// <summary>
    /// Job Order Retry Service - targetProductionQ 0 ise iş emri verilerini tekrar PLC'ye gönderir
    /// </summary>
    public class JobOrderRetryService : BackgroundService
    {
        private readonly ILogger<JobOrderRetryService> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly IConfiguration _configuration;
        private readonly IHttpClientFactory _httpClientFactory;

        public JobOrderRetryService(
            ILogger<JobOrderRetryService> logger,
            IServiceProvider serviceProvider,
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            _configuration = configuration;
            _httpClientFactory = httpClientFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // İlk kontrol için 10 saniye bekle
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckAndRetryJobOrderAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Job order retry kontrolü sırasında hata oluştu");
                }

                // Her 10 saniyede bir kontrol et
                await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
            }
        }

        private async Task CheckAndRetryJobOrderAsync(CancellationToken cancellationToken)
        {
            // HostedService'leri almak için IHostedService interface'ini kullan
            var hostedServices = _serviceProvider.GetServices<Microsoft.Extensions.Hosting.IHostedService>();
            PLCDataCollectorService? plcDataCollectorService = null;
            
            foreach (var service in hostedServices)
            {
                if (service is PLCDataCollectorService plcService)
                {
                    plcDataCollectorService = plcService;
                    break;
                }
            }
            
            if (plcDataCollectorService == null)
            {
                return;
            }

            var sqlProxy = plcDataCollectorService.GetSqlProxy();
            if (sqlProxy == null)
            {
                return;
            }

            // Veritabanından aktif iş emri verilerini al (daha güvenilir - elektrik kesilse bile çalışır)
            var activeJobData = await sqlProxy.GetActiveJobCycleRecordAsync();
            if (activeJobData == null || !activeJobData.ContainsKey("siparis_no"))
            {
                // Aktif iş emri yok, kontrol etmeye gerek yok
                return;
            }

            // job_info JSON'dan iş emri verilerini parse et
            Dictionary<string, object>? jobData = null;
            if (activeJobData.TryGetValue("job_info", out var jobInfoObj) && jobInfoObj != null)
            {
                try
                {
                    var jobInfoStr = jobInfoObj.ToString();
                    if (!string.IsNullOrEmpty(jobInfoStr))
                    {
                        jobData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(jobInfoStr);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "job_info JSON parse edilemedi");
                }
            }

            // Eğer job_info yoksa, aktif kayıttan direkt alanları kullan
            if (jobData == null)
            {
                jobData = new Dictionary<string, object>();
                if (activeJobData.ContainsKey("siparis_no"))
                    jobData["siparis_no"] = activeJobData["siparis_no"];
                if (activeJobData.ContainsKey("kalan_miktar"))
                    jobData["kalan_miktar"] = activeJobData["kalan_miktar"];
                if (activeJobData.ContainsKey("set_sayisi"))
                    jobData["set_sayisi"] = activeJobData["set_sayisi"];
                if (activeJobData.ContainsKey("hedef_hiz"))
                    jobData["hedef_hiz"] = activeJobData["hedef_hiz"];
                if (activeJobData.ContainsKey("silindir_cevresi"))
                    jobData["silindir_cevresi"] = activeJobData["silindir_cevresi"];
            }

            if (jobData == null || !jobData.ContainsKey("siparis_no"))
            {
                // İş emri verileri eksik
                return;
            }

            // PLC'den targetProductionQ değerini oku
            var apiBaseUrl = _configuration["PLC:ApiBaseUrl"] ?? "http://localhost:5199";
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(5);

            try
            {
                // Aktif makine adını al
                var machineName = plcDataCollectorService.GetCurrentMachineName();
                if (string.IsNullOrEmpty(machineName))
                {
                    return;
                }

                var response = await httpClient.GetAsync($"{apiBaseUrl}/api/plcdata/data?machine={machineName}", cancellationToken);
                
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync(cancellationToken);
                    var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    
                    if (data != null && data.TryGetValue("targetProductionQ", out var targetProductionQObj))
                    {
                        var targetProductionQ = TryGetIntValue(targetProductionQObj);
                        
                        if (targetProductionQ.HasValue && targetProductionQ.Value == 0)
                        {
                            // targetProductionQ 0 ise, aktif iş emri verilerini tekrar PLC'ye yaz
                            var writeResult = await sqlProxy.WriteJobDataAsync(jobData);
                            
                            if (!writeResult)
                            {
                                _logger.LogWarning("⚠️ İş emri verileri PLC'ye gönderilemedi (targetProductionQ=0)");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "targetProductionQ kontrolü sırasında hata oluştu");
            }
        }

        private int? TryGetIntValue(object? value)
        {
            if (value == null) return null;
            
            try
            {
                if (value is System.Text.Json.JsonElement jsonElement)
                {
                    if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                    {
                        return jsonElement.GetInt32();
                    }
                    else if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        if (int.TryParse(jsonElement.GetString(), out var parsed))
                            return parsed;
                    }
                }
                else
                {
                    return Convert.ToInt32(value);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Değer dönüştürülemedi: {Value}, Type: {Type}", value, value?.GetType().Name);
            }
            
            return null;
        }
    }
}

