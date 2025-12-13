using System;
using System.Collections.Generic;
using System.Net;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Web;
using Microsoft.Data.SqlClient;
using System.IO;
using Microsoft.EntityFrameworkCore;
using DashboardBackend.Data;
using DashboardBackend.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// SQL veritabanı proxy servisi (Dashboard için API)
    /// </summary>
    public class SqlProxy : IDisposable
    {
        private HttpListener? httpListener;
        private CancellationTokenSource? cancellationTokenSource;
        private bool isRunning = false;

        // Configuration
        private string connectionString;
        public string ConnectionString => connectionString;
        private string egemConnectionString = "Server=192.168.0.251;Database=EGEM2025;User Id=bakim;Password=3542;TrustServerCertificate=true;Connection Timeout=30;";
        private int port = 8080; // Network izinleri için yüksek port
        private string computerIp = "192.168.1.237";

        // Data cache
        private PLCData? lastData;
        private readonly object dataLock = new object();
        
        // Job data cache
        private Dictionary<string, object>? lastJobData;
        private readonly object jobDataLock = new object();
        private string? lastJobEndReportError;
        public string? LastJobEndReportError
        {
            get
            {
                lock (jobDataLock)
                {
                    return lastJobEndReportError;
                }
            }
        }
        
        // Statistics
        private int requestCount = 0;
        private int sqlQueryCount = 0;
        private const bool EnableVerboseLogging = false;
        
        // PLC Writer - Artık manuel olarak oluşturuluyor
        
        // DataProcessor reference for save settings and stoppage tracking
        private DataProcessor? dataProcessor;
        private PLCReader? plcReader;
        
        // Service provider for accessing other services (e.g., CustomNotificationService)
        private IServiceProvider? serviceProvider;

        // Persist etmeye çalıştığımız enerji alanları
        private readonly Dictionary<string, object> lastStableFieldValues = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string[]> stabilizedFieldSynonyms = new(StringComparer.OrdinalIgnoreCase)
        {
            ["activePowerW"] = new[] { "activePowerW", "ActivePower", "ActivePowerW" },
            ["totalEnergyKwh"] = new[] { "totalEnergyKwh", "TotalEnergy", "TotalEnergyKwh" },
            ["voltageL1"] = new[] { "voltageL1", "VoltageL1" },
            ["voltageL2"] = new[] { "voltageL2", "VoltageL2" },
            ["voltageL3"] = new[] { "voltageL3", "VoltageL3" },
            ["currentL1"] = new[] { "currentL1", "CurrentL1" },
            ["currentL2"] = new[] { "currentL2", "CurrentL2" },
            ["currentL3"] = new[] { "currentL3", "CurrentL3" }
        };

        public void SetDataProcessor(DataProcessor processor)
        {
            this.dataProcessor = processor;
        }
        
        public void SetPLCReader(PLCReader reader)
        {
            this.plcReader = reader;
        }

        /// <summary>
        /// Son PLC verisini al (Controller'lar için)
        /// </summary>
        public PLCData? GetLastData()
        {
            lock (dataLock)
            {
                return lastData;
            }
        }

        /// <summary>
        /// Son iş emri verisini al (Controller'lar için)
        /// </summary>
        public Dictionary<string, object>? GetLastJobData()
        {
            lock (jobDataLock)
            {
                return lastJobData;
            }
        }

        /// <summary>
        /// String değeri float'a çevir (nokta ve virgülü destekler)
        /// Virgül ondalık ayırıcıdır: 660,291 = 660.291 (altı yüz altmış nokta iki yüz doksan bir)
        /// </summary>
        private float ParseFloatValue(object? value)
        {
            if (value == null) return 0f;
            
            string strValue;
            
            // JsonElement'ten gelen değerleri handle et
            if (value is System.Text.Json.JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    return (float)jsonElement.GetDouble();
                }
                else if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    strValue = jsonElement.GetString() ?? "0";
                }
                else
                {
                    strValue = value.ToString() ?? "0";
                }
            }
            else
            {
                strValue = value.ToString() ?? "0";
            }
            
            // Boşlukları kaldır
            strValue = strValue.Trim().Replace(" ", "");
            
            // Virgülü noktaya çevir (Türkçe format: 660,291 -> 660.291)
            // Virgül ondalık ayırıcıdır, binlik ayırıcı değil
            strValue = strValue.Replace(",", ".");
            
            // Birden fazla nokta varsa (binlik ayırıcı olabilir), sadece son noktayı tut
            var parts = strValue.Split('.');
            if (parts.Length > 2)
            {
                // Son noktadan önceki tüm noktaları kaldır (binlik ayırıcılar)
                strValue = string.Join("", parts.Take(parts.Length - 1)) + "." + parts.Last();
            }
            
            if (float.TryParse(strValue, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var result))
            {
                return result;
            }
            
            return 0f;
        }

        /// <summary>
        /// String değeri int'e çevir (nokta ve virgülü destekler - ondalık kısmı atar)
        /// Virgül ondalık ayırıcıdır: 660,291 -> 660 (ondalık kısım atılır)
        /// </summary>
        private int ParseIntValue(object? value)
        {
            if (value == null) return 0;
            
            string strValue;
            
            // JsonElement'ten gelen değerleri handle et
            if (value is System.Text.Json.JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.Number)
                {
                    return jsonElement.GetInt32();
                }
                else if (jsonElement.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    strValue = jsonElement.GetString() ?? "0";
                }
                else
                {
                    strValue = value.ToString() ?? "0";
                }
            }
            else
            {
                strValue = value.ToString() ?? "0";
            }
            
            // Boşlukları kaldır
            strValue = strValue.Trim().Replace(" ", "");
            
            // Virgül veya noktadan önceki kısmı al (ondalık kısmı at)
            // Virgül ondalık ayırıcıdır, binlik ayırıcı değil
            if (strValue.Contains(","))
            {
                // Virgül varsa, virgülden önceki kısmı al (ondalık ayırıcı)
                var parts = strValue.Split(',');
                strValue = parts[0];
            }
            else if (strValue.Contains("."))
            {
                // Nokta varsa, son noktadan önceki kısmı al (son nokta ondalık ayırıcı olabilir)
                var parts = strValue.Split('.');
                if (parts.Length == 2 && parts[1].Length <= 3)
                {
                    // Sadece 2 parça varsa ve ikinci parça 3 karakter veya daha azsa, bu ondalık ayırıcıdır
                    strValue = parts[0];
                }
                else
                {
                    // Birden fazla nokta varsa, son noktadan önceki kısmı al
                    strValue = string.Join("", parts.Take(parts.Length - 1));
                }
            }
            
            // Binlik ayırıcıları kaldır (nokta veya virgül - artık sadece binlik ayırıcı olabilir)
            strValue = strValue.Replace(".", "").Replace(",", "");
            
            if (int.TryParse(strValue, out var result))
            {
                return result;
            }
            
            return 0;
        }

        /// <summary>
        /// İş emri verilerini PLC'ye yaz (public)
        /// </summary>
        public async Task<bool> WriteJobDataAsync(Dictionary<string, object> jobData)
        {
            try
            {
                var tempPlcWriter = new PLCWriter();
                var connectResult = await tempPlcWriter.ConnectAsync();
                
                if (!connectResult)
                {
                    tempPlcWriter.Dispose();
                    return false;
                }

                var kalanMiktar = ParseIntValue(jobData.ContainsKey("kalan_miktar") ? jobData["kalan_miktar"] : null);
                var setSayisi = ParseIntValue(jobData.ContainsKey("set_sayisi") ? jobData["set_sayisi"] : null);
                var silindirCevresi = ParseFloatValue(jobData.ContainsKey("silindir_cevresi") ? jobData["silindir_cevresi"] : null);
                var hedefHizValue = ParseIntValue(jobData.ContainsKey("hedef_hiz") ? jobData["hedef_hiz"] : null);
                
                await tempPlcWriter.WriteDINTAsync(0, kalanMiktar);
                await tempPlcWriter.WriteDINTAsync(4, setSayisi);
                await tempPlcWriter.WriteDINTAsync(8, hedefHizValue);
                await tempPlcWriter.WriteREALAsync(12, silindirCevresi);
                
                tempPlcWriter.Disconnect();
                tempPlcWriter.Dispose();

                // Aktif JobCycle kaydını iş emri bilgileriyle güncelle
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📝 [WriteJobDataAsync] Aktif JobCycle kaydı iş emri bilgileriyle güncelleniyor...");
                var activeCycle = await GetActiveJobCycleRecordAsync();
                if (activeCycle == null)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [WriteJobDataAsync] Aktif JobCycle kaydı bulunamadı, yeni kayıt oluşturuluyor...");
                    // Aktif kayıt yoksa yeni bir kayıt oluştur
                    double totalEnergyKwhStart = 0.0;
                    
                    if (jobData.ContainsKey("totalEnergyKwhStart") && 
                        double.TryParse(jobData["totalEnergyKwhStart"]?.ToString(), out var parsedValue))
                    {
                        totalEnergyKwhStart = parsedValue;
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] totalEnergyKwhStart request'ten alındı: {totalEnergyKwhStart:F2} kWh");
                    }
                    
                    if (totalEnergyKwhStart == 0.0)
                    {
                        lock (dataLock)
                        {
                            if (lastData != null)
                            {
                                // Önce totalEnergyKwh key'ini dene
                                if (lastData.Data.TryGetValue("totalEnergyKwh", out var rawEnergy))
                                {
                                    totalEnergyKwhStart = ToDouble(rawEnergy);
                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] totalEnergyKwhStart PLC'den (totalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                }
                                // Yoksa TotalEnergy key'ini dene
                                else if (lastData.Data.TryGetValue("TotalEnergy", out var rawEnergy2))
                                {
                                    totalEnergyKwhStart = ToDouble(rawEnergy2);
                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] totalEnergyKwhStart PLC'den (TotalEnergy) alındı: {totalEnergyKwhStart:F2} kWh");
                                }
                                // Yoksa TotalEnergyKwh key'ini dene
                                else if (lastData.Data.TryGetValue("TotalEnergyKwh", out var rawEnergy3))
                                {
                                    totalEnergyKwhStart = ToDouble(rawEnergy3);
                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] totalEnergyKwhStart PLC'den (TotalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                }
                            }
                        }
                    }
                    
                    PLCData? snapshot;
                    lock (dataLock)
                    {
                        snapshot = lastData?.Clone();
                    }
                    var cycleId = await CreateJobCycleRecordAsync(snapshot ?? new PLCData());
                    if (cycleId > 0)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] Yeni JobCycle kaydı oluşturuldu (ID: {cycleId})");
                    }
                    else
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [WriteJobDataAsync] Yeni JobCycle kaydı oluşturulamadı");
                    }
                }
                
                // Aktif kaydı iş emri bilgileriyle güncelle
                var updateResult = await UpdateActiveJobCycleWithOrderAsync(jobData);
                if (updateResult)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [WriteJobDataAsync] Aktif JobCycle kaydı sipariş bilgileriyle güncellendi");
                }
                else
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [WriteJobDataAsync] Aktif JobCycle kaydı güncellenemedi - aktif kayıt bulunamadı veya güncelleme başarısız");
                }

                // Yeni iş başlangıç zamanında duruş durumunu kontrol et
                // Eğer duruş kaydı zaten varsa (iş sonu basıldığında aktarılmışsa), onu koru
                // Eğer makine duruyorsa ve duruş kaydı yoksa, yeni duruş kaydı başlat
                var jobStartTime = DateTime.Now;
                bool machineStopped = false;
                lock (dataLock)
                {
                    if (lastData != null && lastData.Data.TryGetValue("machineStatus", out var machineStatusObj))
                    {
                        var machineStatus = Convert.ToInt32(machineStatusObj);
                        machineStopped = (machineStatus & 0x0001) != 0; // Bit 0 = duruş durumu
                    }
                }
                
                if (dataProcessor != null)
                {
                    await dataProcessor.EnsureStoppageStateForNewJobAsync(jobStartTime, machineStopped, "WriteJobData");
                }

                // Cache'e jobStartTime ekle
                if (jobData.ContainsKey("jobStartTime"))
                {
                    double totalEnergyKwhStart = 0.0;
                    lock (dataLock)
                    {
                        if (lastData != null && lastData.Data.TryGetValue("totalEnergyKwh", out var rawEnergy))
                        {
                            totalEnergyKwhStart = ToDouble(rawEnergy);
                        }
                    }

                    lock (jobDataLock)
                    {
                        if (lastJobData != null)
                        {
                            lastJobData["jobStartTime"] = jobData["jobStartTime"];
                            lastJobData["totalEnergyKwhStart"] = totalEnergyKwhStart;
                        }
                        else
                        {
                            lastJobData = new Dictionary<string, object>(jobData)
                            {
                                ["totalEnergyKwhStart"] = totalEnergyKwhStart
                            };
                        }
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// İş sonu işlemi (public)
        /// </summary>
        public async Task<bool> EndJobAsync(string orderNumber, object? totalEnergyKwhStartFromRequest = null)
        {
            try
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔵 [EndJobAsync] Çağrıldı - OrderNumber: {orderNumber}");
                
                PLCData? currentData;
                Dictionary<string, object>? currentJobData;
                var activeCycle = await GetActiveJobCycleRecordAsync();
                
                lock (dataLock)
                {
                    currentData = lastData;
                }
                
                lock (jobDataLock)
                {
                    currentJobData = lastJobData;
                }
                
                if (currentData == null)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] currentData null!");
                    return false;
                }
                
                if (currentJobData == null)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] currentJobData null, sorgulanıyor...");
                    var jobResult = await QueryJobDataAsync(orderNumber);
                    if (jobResult.ContainsKey("success") && jobResult["success"].Equals(true))
                    {
                        currentJobData = jobResult["data"] as Dictionary<string, object>;
                        if (currentJobData == null)
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] QueryJobDataAsync sonucu null!");
                            return false;
                        }
                    }
                    else
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] QueryJobDataAsync başarısız!");
                        return false;
                    }
                }
                
                if (currentJobData == null && activeCycle != null && activeCycle.TryGetValue("job_info", out var jobInfoObj))
                {
                    var jobInfoJson = jobInfoObj?.ToString();
                    if (!string.IsNullOrWhiteSpace(jobInfoJson))
                    {
                        try
                        {
                            currentJobData = JsonSerializer.Deserialize<Dictionary<string, object>>(jobInfoJson);
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] job_info aktif kayıt üzerinden alındı");
                        }
                        catch (Exception jsonEx)
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] job_info JSON parse hatası: {jsonEx.Message}");
                        }
                    }
                }
                
                if (currentJobData == null)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] currentJobData bulunamadı!");
                    return false;
                }
                
                // totalEnergyKwh değerlerini al
                double totalEnergyKwhStart = 0.0;
                double totalEnergyKwhEnd = 0.0;
                DateTime jobStartTime = DateTime.Now;
                
                if (activeCycle != null && activeCycle.TryGetValue("cycle_start_time", out var cycleStartObj) && cycleStartObj is DateTime cycleStartTime)
                {
                    jobStartTime = cycleStartTime;
                }
                else if (currentJobData.ContainsKey("jobStartTime"))
                {
                    jobStartTime = GetDateTime(currentJobData, "jobStartTime", DateTime.Now);
                }
                
                // Başlangıç değerini önce request'ten, sonra cache'den, son olarak veritabanından al
                if (totalEnergyKwhStartFromRequest != null)
                {
                    if (double.TryParse(totalEnergyKwhStartFromRequest.ToString(), out var parsedValue) && parsedValue > 0.0)
                    {
                        totalEnergyKwhStart = parsedValue;
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart request'ten alındı: {totalEnergyKwhStart:F2} kWh");
                    }
                }
                
                if (totalEnergyKwhStart == 0.0 && currentJobData.ContainsKey("totalEnergyKwhStart"))
                {
                    var cacheValue = Convert.ToDouble(currentJobData["totalEnergyKwhStart"]);
                    if (cacheValue > 0.0)
                    {
                        totalEnergyKwhStart = cacheValue;
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart cache'den alındı: {totalEnergyKwhStart:F2} kWh");
                    }
                }
                
                // Eğer başlangıç değeri hala 0 ise, initial_snapshot'tan almayı dene
                if (totalEnergyKwhStart == 0.0 && activeCycle != null && activeCycle.TryGetValue("initial_snapshot", out var initialSnapshotStr) && initialSnapshotStr != null)
                {
                    try
                    {
                        var initialSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(initialSnapshotStr.ToString() ?? "{}");
                        if (initialSnapshot != null)
                        {
                            // TotalEnergy, totalEnergyKwh veya TotalEnergyKwh key'lerini dene
                            if (initialSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart initial_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                            else if (initialSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyKwhObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart initial_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                            else if (initialSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyKwhObj2);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart initial_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] initial_snapshot parse hatası: {ex.Message}");
                    }
                }
                
                // Eğer hala 0 ise ve activeCycle null veya snapshot yoksa, veritabanından sipariş numarasına göre ara
                Dictionary<string, object>? dbCycleRecord = null;
                if ((totalEnergyKwhStart == 0.0 || totalEnergyKwhEnd == 0.0) && currentJobData != null && currentJobData.ContainsKey("siparis_no"))
                {
                    var dbOrderNumber = currentJobData["siparis_no"]?.ToString();
                    if (!string.IsNullOrWhiteSpace(dbOrderNumber))
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔍 [EndJobAsync] activeCycle'da snapshot bulunamadı, veritabanından sipariş numarasına göre aranıyor: {dbOrderNumber}");
                        dbCycleRecord = await GetJobCycleRecordByOrderNumberAsync(dbOrderNumber);
                        
                        // Initial snapshot'ı oku
                        if (totalEnergyKwhStart == 0.0 && dbCycleRecord != null && dbCycleRecord.TryGetValue("initial_snapshot", out var dbInitialSnapshotStr) && dbInitialSnapshotStr != null)
                        {
                            try
                            {
                                var initialSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(dbInitialSnapshotStr.ToString() ?? "{}");
                                if (initialSnapshot != null)
                                {
                                    if (initialSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                                    {
                                        totalEnergyKwhStart = ToDouble(totalEnergyObj);
                                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart veritabanından initial_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhStart:F2} kWh");
                                    }
                                    else if (initialSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                                    {
                                        totalEnergyKwhStart = ToDouble(totalEnergyKwhObj);
                                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart veritabanından initial_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                    }
                                    else if (initialSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                                    {
                                        totalEnergyKwhStart = ToDouble(totalEnergyKwhObj2);
                                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhStart veritabanından initial_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] Veritabanından initial_snapshot parse hatası: {ex.Message}");
                            }
                        }
                    }
                }
                
                if (totalEnergyKwhStart == 0.0)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] totalEnergyKwhStart bulunamadı, 0 kullanılıyor");
                }
                
                // Bitiş değerini PLC'den al - önce TotalEnergy key'ini dene (en yaygın)
                if (currentData != null)
                {
                    if (currentData.Data.TryGetValue("TotalEnergy", out var rawEnergyEnd2))
                    {
                        var energyValue = ToDouble(rawEnergyEnd2);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd PLC'den (TotalEnergy) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                    else if (currentData.Data.TryGetValue("totalEnergyKwh", out var rawEnergyEnd))
                    {
                        var energyValue = ToDouble(rawEnergyEnd);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd PLC'den (totalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                    else if (currentData.Data.TryGetValue("TotalEnergyKwh", out var rawEnergyEnd3))
                    {
                        var energyValue = ToDouble(rawEnergyEnd3);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd PLC'den (TotalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                }
                
                // Eğer son değer hala 0 ise ve final_snapshot varsa, ondan almayı dene
                if (totalEnergyKwhEnd == 0.0 && activeCycle != null && activeCycle.TryGetValue("final_snapshot", out var finalSnapshotStr) && finalSnapshotStr != null)
                {
                    try
                    {
                        var finalSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(finalSnapshotStr.ToString() ?? "{}");
                        if (finalSnapshot != null)
                        {
                            // TotalEnergy, totalEnergyKwh veya TotalEnergyKwh key'lerini dene
                            if (finalSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd final_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd final_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj2);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd final_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] final_snapshot parse hatası: {ex.Message}");
                    }
                }
                
                // Final snapshot'ı da dbCycleRecord'dan oku (eğer yukarıda çekildiyse)
                if (totalEnergyKwhEnd == 0.0 && dbCycleRecord != null && dbCycleRecord.TryGetValue("final_snapshot", out var dbFinalSnapshotStr) && dbFinalSnapshotStr != null)
                {
                    try
                    {
                        var finalSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(dbFinalSnapshotStr.ToString() ?? "{}");
                        if (finalSnapshot != null)
                        {
                            if (finalSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd veritabanından final_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd veritabanından final_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj2);
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] totalEnergyKwhEnd veritabanından final_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] Veritabanından final_snapshot parse hatası: {ex.Message}");
                    }
                }
                
                // Enerji tüketimini hesapla
                double energyConsumptionKwh = 0.0;
                if (totalEnergyKwhStart > 0.0 && totalEnergyKwhEnd > 0.0)
                {
                    energyConsumptionKwh = totalEnergyKwhEnd - totalEnergyKwhStart;
                    if (energyConsumptionKwh < 0)
                    {
                        energyConsumptionKwh = 0.0;
                    }
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [EndJobAsync] Enerji tüketimi hesaplandı: {energyConsumptionKwh:F2} kWh (Final: {totalEnergyKwhEnd:F2} - Initial: {totalEnergyKwhStart:F2})");
                }
                else
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [EndJobAsync] Enerji tüketimi hesaplanamadı - Start: {totalEnergyKwhStart:F2}, End: {totalEnergyKwhEnd:F2}");
                }
                
                // İş bitiş zamanında aktif duruş kaydını yeni iş döngüsüne aktar (eğer varsa)
                // İş sonu zamanı = duruş başlangıcı - 1 saniye
                // Yeni iş başlangıcı = duruş başlangıcı
                var jobEndTimeRequested = DateTime.Now;
                DateTime actualJobEndTime = jobEndTimeRequested;
                DateTime? newJobStartTime = null;
                
                if (dataProcessor != null)
                {
                    var result = await dataProcessor.ForceTransferStoppageToNewJobAsync(jobEndTimeRequested, "EndJob");
                    if (result.actualJobEndTime.HasValue)
                    {
                        actualJobEndTime = result.actualJobEndTime.Value;
                        newJobStartTime = result.newJobStartTime;
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [EndJobAsync] İş bitiş zamanında aktif duruş kaydı yeni iş döngüsüne aktarıldı: İş sonu={actualJobEndTime:HH:mm:ss}, Yeni iş başlangıcı={newJobStartTime.Value:HH:mm:ss}");
                    }
                }
                
                // Raporlama verilerini hazırla ve kaydet
                var setupTime = ToDouble(currentJobData.ContainsKey("setup") ? currentJobData["setup"] : 0);
                
                // Bundle ve pallet verilerini currentData.Data'dan al
                var qualifiedBundle = GetInt(currentData.Data, "qualifiedBundle", 0);
                var defectiveBundle = GetInt(currentData.Data, "defectiveBundle", 0);
                var goodPallets = GetInt(currentData.Data, "goodPallets", 0);
                var defectivePallets = GetInt(currentData.Data, "defectivePallets", 0);
                
                var reportData = new Dictionary<string, object>
                {
                    ["siparis_no"] = currentJobData["siparis_no"],
                    ["toplam_miktar"] = currentJobData["toplam_miktar"],
                    ["kalan_miktar"] = currentJobData["kalan_miktar"],
                    ["set_sayisi"] = currentJobData["set_sayisi"],
                    ["uretim_tipi"] = currentJobData["uretim_tipi"],
                    ["stok_adi"] = currentJobData["stok_adi"],
                    ["bundle"] = currentJobData["bundle"],
                    ["silindir_cevresi"] = currentJobData["silindir_cevresi"],
                    ["hedef_hiz"] = currentJobData["hedef_hiz"],
                    ["setup"] = setupTime,
                    ["qualifiedBundle"] = qualifiedBundle,
                    ["defectiveBundle"] = defectiveBundle,
                    ["goodPallets"] = goodPallets,
                    ["defectivePallets"] = defectivePallets,
                    ["ethylAlcoholConsumption"] = currentData.ethylAlcoholConsumption,
                    ["ethylAcetateConsumption"] = currentData.ethylAcetateConsumption,
                    ["paperConsumption"] = currentData.paperConsumption,
                    ["actualProduction"] = currentData.actualProduction,
                    ["remainingWork"] = currentData.remainingWork,
                    ["wastageBeforeDie"] = currentData.wastageBeforeDie,
                    ["wastageAfterDie"] = currentData.wastageAfterDie,
                    ["wastageRatio"] = currentData.wastageRatio,
                    ["totalStoppageDuration"] = currentData.totalStoppageDuration,
                    ["overProduction"] = currentData.overProduction,
                    ["completionPercentage"] = currentData.completionPercentage,
                    ["energyConsumptionKwh"] = energyConsumptionKwh,
                    ["jobStartTime"] = jobStartTime,
                    ["jobEndTime"] = actualJobEndTime
                };
                
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] Veritabanına kaydediliyor...");
                var success = await SaveJobEndReportAsync(reportData);
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 💾 [EndJobAsync] SaveJobEndReportAsync sonucu: {success}");
                
                // PLC'ye reset sinyali gönder
                if (success)
                {
                    await CompleteActiveJobCycleAsync(actualJobEndTime, currentData);
                    
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [EndJobAsync] PLC reset sinyali gönderme işlemi başlatılıyor...");
                    try
                    {
                        var tempPlcWriter = new PLCWriter();
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔌 [EndJobAsync] PLC'ye bağlanılıyor...");
                        var connectResult = await tempPlcWriter.ConnectAsync();
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔌 [EndJobAsync] ConnectAsync sonucu: {connectResult}");
                        
                        if (connectResult)
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [EndJobAsync] Coil 0'a true yazılıyor (reset sinyali)...");
                            // GVL.g_Coils[0] = true (reset sinyali) - Coil yazma
                            var writeResult1 = await tempPlcWriter.WriteCoilAsync(0, true); // Coil 0'a true yaz (reset sinyali)
                            if (writeResult1)
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [EndJobAsync] PLC'ye reset sinyali gönderildi (GVL.g_Coils[0]) - WriteCoilAsync başarılı");
                            }
                            else
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] PLC'ye reset sinyali gönderilemedi - WriteCoilAsync başarısız!");
                            }
                            
                            // 5 saniye bekle ve reset sinyalini kapat
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⏳ [EndJobAsync] 5 saniye bekleniyor...");
                            await Task.Delay(5000);
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [EndJobAsync] Coil 0'a false yazılıyor (reset sinyali kapatılıyor)...");
                            var writeResult2 = await tempPlcWriter.WriteCoilAsync(0, false); // Coil 0'a false yaz (reset sinyali kapat)
                            if (writeResult2)
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [EndJobAsync] PLC reset sinyali kapatıldı - WriteCoilAsync başarılı");
                            }
                            else
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] PLC reset sinyali kapatılamadı - WriteCoilAsync başarısız!");
                            }
                            
                            tempPlcWriter.Disconnect();
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔌 [EndJobAsync] PLC bağlantısı kapatıldı");
                            
                            // Robot paketleme sistemine reset sinyali gönder
                            await SendRobotResetSignalAsync();
                            
                            // Reset tamamlandıktan sonra yeni JobCycle kaydı oluştur
                            await Task.Delay(500);
                            double nextCycleEnergyStart = 0.0;
                            PLCData? postResetSnapshot;
                            lock (dataLock)
                            {
                                postResetSnapshot = lastData?.Clone();
                                if (postResetSnapshot != null && postResetSnapshot.Data.TryGetValue("totalEnergyKwh", out var rawStart))
                                {
                                    nextCycleEnergyStart = ToDouble(rawStart);
                                }
                            }
                            
                            if (nextCycleEnergyStart <= 0)
                            {
                                nextCycleEnergyStart = Math.Max(0, totalEnergyKwhEnd);
                            }
                            
                            // Eğer duruş varsa, yeni iş başlangıcı = duruş başlangıcı
                            DateTime? newCycleStartTimeForJob = null;
                            if (newJobStartTime.HasValue)
                            {
                                newCycleStartTimeForJob = newJobStartTime.Value;
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📅 [EndJobAsync] Yeni JobCycle başlangıcı duruş başlangıcına göre ayarlandı: {newCycleStartTimeForJob.Value:HH:mm:ss}");
                            }
                            
                            await CreateJobCycleRecordAsync(postResetSnapshot ?? currentData, newCycleStartTimeForJob);
                        }
                        else
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] PLC'ye bağlantı kurulamadı, reset sinyali gönderilemedi");
                        }
                        
                        tempPlcWriter.Dispose();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] PLC reset sinyali gönderme hatası: {ex.Message}");
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] StackTrace: {ex.StackTrace}");
                    }
                }
                else
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] SaveJobEndReportAsync başarısız oldu, PLC reset sinyali gönderilmedi!");
                }
                
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔵 [EndJobAsync] Tamamlandı - Sonuç: {success}");
                return success;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] Genel hata: {ex.Message}");
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [EndJobAsync] StackTrace: {ex.StackTrace}");
                return false;
            }
        }

        /// <summary>
        /// Robot paketleme sistemine reset sinyali gönder
        /// Port 502 kullanır (PLC ile karıştırılmamalı - PLC port 1502 kullanıyor)
        /// </summary>
        private async Task SendRobotResetSignalAsync()
        {
            try
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🤖 [SendRobotResetSignalAsync] Robot paketleme sistemine reset sinyali gönderme işlemi başlatılıyor...");
                
                // resetRobotCounter sinyalini veritabanından bul
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    // resetRobotCounter sinyalini ve PLCConnection bilgilerini al
                    var query = @"
                        SELECT 
                            d.id,
                            d.name,
                            d.data_type,
                            d.register_address,
                            d.operation_type,
                            d.plc_connection_id,
                            c.ip_address,
                            c.port
                        FROM plc_data_definitions d
                        INNER JOIN plc_connections c ON d.plc_connection_id = c.id
                        WHERE d.name = 'resetRobotCounter' 
                            AND d.operation_type = 'WRITE' 
                            AND d.is_active = 1
                            AND c.is_active = 1";
                    
                    using (var cmd = new SqlCommand(query, connection))
                    {
                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                var signalName = reader["name"].ToString();
                                var dataType = reader["data_type"].ToString();
                                var registerAddress = Convert.ToInt32(reader["register_address"]);
                                var ipAddress = reader["ip_address"].ToString();
                                var port = Convert.ToInt32(reader["port"]);
                                
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [SendRobotResetSignalAsync] resetRobotCounter sinyali bulundu: IP={ipAddress}, Port={port}, Address={registerAddress}, DataType={dataType}");
                                
                                // Robot PLC'ye bağlan (Port 502 - Modbus TCP)
                                // PLCWriter'ı robot için kullan (port 502 ile)
                                using (var robotPlcWriter = new PLCWriter(ipAddress, port))
                                {
                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔌 [SendRobotResetSignalAsync] Robot PLC'ye bağlanılıyor: {ipAddress}:{port} (Modbus TCP)");
                                    var connectResult = await robotPlcWriter.ConnectAsync();
                                    
                                    if (connectResult)
                                    {
                                        bool writeResult = false;
                                        
                                        // DataType'a göre yazma işlemi
                                        if (dataType?.ToUpper() == "BOOL")
                                        {
                                            // Reset sinyali: Coil'e true yaz, 100ms bekle, sonra false yaz (pulse)
                                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [SendRobotResetSignalAsync] Coil {registerAddress}'a true yazılıyor (reset sinyali - pulse)...");
                                            writeResult = await robotPlcWriter.WriteCoilAsync(registerAddress, true);
                                            
                                            if (writeResult)
                                            {
                                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [SendRobotResetSignalAsync] Robot reset sinyali gönderildi - Coil {registerAddress} = true");
                                                
                                                // 100ms bekle (pulse için)
                                                await Task.Delay(100);
                                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [SendRobotResetSignalAsync] Coil {registerAddress}'a false yazılıyor (reset sinyali kapatılıyor)...");
                                                var closeResult = await robotPlcWriter.WriteCoilAsync(registerAddress, false);
                                                
                                                if (closeResult)
                                                {
                                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [SendRobotResetSignalAsync] Robot reset sinyali kapatıldı - Coil {registerAddress} = false (pulse tamamlandı)");
                                                }
                                                else
                                                {
                                                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [SendRobotResetSignalAsync] Robot reset sinyali kapatılamadı");
                                                }
                                            }
                                            else
                                            {
                                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [SendRobotResetSignalAsync] Robot reset sinyali gönderilemedi - WriteCoilAsync başarısız!");
                                            }
                                        }
                                        else
                                        {
                                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [SendRobotResetSignalAsync] DataType '{dataType}' desteklenmiyor. Sadece BOOL tipi destekleniyor.");
                                        }
                                        
                                        robotPlcWriter.Disconnect();
                                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔌 [SendRobotResetSignalAsync] Robot PLC bağlantısı kapatıldı");
                                    }
                                    else
                                    {
                                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [SendRobotResetSignalAsync] Robot PLC'ye bağlantı kurulamadı: {ipAddress}:{port}");
                                    }
                                }
                            }
                            else
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [SendRobotResetSignalAsync] resetRobotCounter sinyali bulunamadı veya aktif değil. Robot reset sinyali gönderilmedi.");
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [SendRobotResetSignalAsync] Robot reset sinyali gönderme hatası: {ex.Message}");
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [SendRobotResetSignalAsync] StackTrace: {ex.StackTrace}");
            }
        }

        /// <summary>
        /// Duruş sebebi kaydet (public)
        /// </summary>
        public async Task<bool> SaveStoppageReasonAsync(int categoryId, int reasonId)
        {
            try
            {
                if (dataProcessor != null)
                {
                    dataProcessor.UpdateStoppageReason(categoryId, reasonId);
                    return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        public async Task<(bool success, string? error, DateTime? newStartTime, int savedDurationSeconds)> SplitActiveStoppageAsync(DateTime splitTimeUtc, int? categoryId = null, int? reasonId = null)
        {
            if (dataProcessor == null)
            {
                return (false, "PLC veri işleyici bulunamadı", null, 0);
            }

            return await dataProcessor.SplitActiveStoppageAsync(splitTimeUtc, categoryId, reasonId);
        }
        
        // PLC Connection Timer - Artık kullanılmıyor
        private System.Threading.Timer? plcConnectionTimer;
        
        // Log cleanup
        private System.Threading.Timer? logCleanupTimer;
        
        // DbContext for API
        private PLCConfigDbContext? dbContext;
        private const int MAX_LOG_LINES = 100;

        public SqlProxy(string connectionString, string computerIp = "192.168.1.237", int port = 8080, IServiceProvider? serviceProvider = null)
        {
            this.connectionString = connectionString;
            this.computerIp = computerIp;
            this.port = port;
            this.serviceProvider = serviceProvider;
            
            // DbContext'i initialize et
            var options = new DbContextOptionsBuilder<PLCConfigDbContext>()
                .UseSqlServer(connectionString)
                .Options;
            dbContext = new PLCConfigDbContext(options);
        }
        
        public void SetServiceProvider(IServiceProvider serviceProvider)
        {
            this.serviceProvider = serviceProvider;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            if (isRunning) return;

            try
            {
                isRunning = true;
                cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                
                // HTTP listener artık gerekli değil - tüm istekler PLCDataController üzerinden geliyor
                // HttpListener'ı devre dışı bırakıyoruz
                // httpListener = new HttpListener();
                // httpListener.Prefixes.Add($"http://{computerIp}:{port}/");
                // httpListener.Start();
                // LogMessage($"🌐 HTTP Server başlatıldı: http://{computerIp}:{port}/");
                LogMessage("ℹ️ HTTP Listener devre dışı - API istekleri PLCDataController üzerinden geliyor");
                
                // PLC Writer'ı sadece gerektiğinde oluşturacağız (lazy loading)
                // Başlangıçta bağlantı kurmuyoruz
                // LogMessage("ℹ️ PLC yazma bağlantısı manuel olarak açılacak");
                
                // Start PLC connection monitoring timer
                // InitializePlcConnectionTimer(); // PLC test timer'ı kapatıldı - reading ile çakışıyor
                
                // Start log cleanup timer
                InitializeLogCleanupTimer();
                
            }
            catch (Exception ex)
            {
                isRunning = false;
                throw;
            }
        }

        public async Task StopAsync()
        {
            if (!isRunning) return;

            isRunning = false;
            cancellationTokenSource?.Cancel();
            
            try
            {
                httpListener?.Stop();
                httpListener?.Close();
            }
            catch { }
        }

        private async Task ListenLoopAsync(CancellationToken cancellationToken)
        {
            LogMessage("🔄 HTTP dinleme döngüsü başladı");
            while (!cancellationToken.IsCancellationRequested && isRunning)
            {
                try
                {
                    var context = await httpListener!.GetContextAsync();
                    // Sadece POST request'leri logla
                    if (context.Request.HttpMethod == "POST")
                    {
                        // LogMessage($"📥 HTTP request geldi: {context.Request.HttpMethod} {context.Request.Url?.AbsolutePath}");
                    }
                    _ = Task.Run(async () => await HandleRequestAsync(context), cancellationToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex) 
                { 
                    LogMessage($"❌ HTTP dinleme hatası: {ex.Message}");
                }
            }
        }

        private async Task HandleRequestAsync(HttpListenerContext context)
        {
            try
            {
                var request = context.Request;
                var response = context.Response;

                // CORS headers
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                
                if (request.HttpMethod == "OPTIONS")
                {
                    response.StatusCode = 200;
                    return;
                }
                
                requestCount++;
                
                string body = "";
                if (request.HttpMethod == "POST")
                {
                    // POST body'yi oku - tüm endpoint'ler için
                    using var reader = new StreamReader(request.InputStream);
                    body = await reader.ReadToEndAsync();
                    
                    if (request.Url?.AbsolutePath == "/api/job")
                    {
                        sqlQueryCount++;
                    
                    var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(body);
                    
                    // İş emri sorgusu için özel kontrol
                    if (requestData?.ContainsKey("orderNumber") == true && !requestData.ContainsKey("jobStartTime"))
                    {
                        LogMessage("🔍 orderNumber bulundu, /api/job endpoint'ine yönlendiriliyor");
                        // İş emri sorgusu - /api/job endpoint'ine yönlendir
                        var orderNumber = requestData["orderNumber"].ToString() ?? "";
                        var result = await QueryJobDataAsync(orderNumber);
                        
                        // Cache'e yaz
                        if (result["success"].Equals(true))
                        {
                            lock (jobDataLock)
                            {
                                lastJobData = result["data"] as Dictionary<string, object>;
                                LogMessage($"Cache'e yazıldı: {JsonSerializer.Serialize(lastJobData)}");
                            }
                            
                            LogMessage("✅ İş emri verisi veritabanından alındı ve cache'e yazıldı");
                        }
                        
                        var json = JsonSerializer.Serialize(result);
                        var buffer = Encoding.UTF8.GetBytes(json);
                        
                        response.ContentType = "application/json";
                        response.ContentLength64 = buffer.Length;
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        return;
                    }
                    else if (requestData?.ContainsKey("stoppageType") == true)
                    {
                        // Duruş sebebi endpoint'i
                        var stoppageType = Convert.ToInt32(requestData["stoppageType"]);
                        
                        bool writeSuccess = false;
                        // stoppageType kaldırıldı - kullanılmıyor
                        
                        var result = new Dictionary<string, object> { 
                            ["success"] = writeSuccess,
                            ["message"] = writeSuccess ? "Duruş sebebi PLC'ye gönderildi" : "PLC'ye yazma başarısız"
                        };
                        
                        var json = JsonSerializer.Serialize(result);
                        var buffer = Encoding.UTF8.GetBytes(json);
                        
                        response.ContentType = "application/json";
                        response.ContentLength64 = buffer.Length;
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        return;
                    }
                    }
                }
                
                // Console.WriteLine($"Request: {request.HttpMethod} {request.Url?.AbsolutePath}");
                
                // Console.WriteLine($"Switch statement - URL: {request.Url?.AbsolutePath}, Method: {request.HttpMethod}");
                switch (request.Url?.AbsolutePath?.ToLower())
                {
                    case "/adminpanel":
                        await HandleAdminPanelRequest(response);
                        break;
                    
                    case "/api/status":
                        await HandleStatusRequest(response);
                        break;
                    
                    case "/api/data":
                        await HandleDataRequest(response);
                        break;
                    
                    case "/api/sensors":
                        await HandleDynamicDataRequest(response, "/api/sensors");
                        break;
                    
                    case "/api/production":
                        await HandleDynamicDataRequest(response, "/api/production");
                        break;
                    
                    case "/api/quality":
                        await HandleDynamicDataRequest(response, "/api/quality");
                        break;
                    
                    case "/api/maintenance":
                        await HandleDynamicDataRequest(response, "/api/maintenance");
                        break;
                    
                    // PLC Config API endpoints
                    case "/api/plcconfig/connections":
                    // Console.WriteLine($"Handling PLC connections request: {request.HttpMethod}");
                        await HandlePLCConnectionsRequest(request, response);
                        break;
                    
                    case "/api/plcconfig/data-definitions":
                    // Console.WriteLine($"Handling PLC data definitions request: {request.HttpMethod}");
                        await HandlePLCDataDefinitionsRequest(request, response);
                        break;
                    
                    case "/api/plcconfig/sql-connections":
                        await HandleSQLConnectionsRequest(request, response);
                        break;
                    
                    case "/api/plcconfig/api-settings":
                        await HandleAPISettingsRequest(request, response);
                        break;
                    
                case "/api/plcconfig/save-settings":
                    await HandleSaveSettingsRequest(request, response);
                    break;
                case "/api/plcconfig/save-statistics":
                    await HandleSaveStatisticsRequest(request, response);
                    break;
                    
                    case "/api/plcconfig/system-logs":
                        await HandleSystemLogsRequest(request, response);
                        break;
                    
                    case "/api/plcconfig/restart":
                        await HandleRestartRequest(request, response);
                        break;
                    
                    case "/api/job":
                        if (request.HttpMethod == "POST")
                        {
                            await HandleJobPostRequest(request, response, body);
                        }
                        else if (request.HttpMethod == "GET")
                        {
                            await HandleJobGetRequest(response);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/api/job-write":
                        if (request.HttpMethod == "POST")
                        {
                            await HandleJobWriteRequest(request, response, body);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/job-web":
                        if (request.HttpMethod == "GET")
                        {
                            await HandleJobWebRequest(response);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/api/health":
                        await HandleHealthRequest(response);
                        break;
                    
                    case "/plc-status":
                        await HandlePlcStatusRequest(response);
                        break;
                    
                    case "/api/stoppage":
                        if (request.HttpMethod == "POST")
                        {
                            await HandleStoppageRequest(request, response, body);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/production-data":
                        await HandleProductionDataRequest(response);
                        break;
                    
                    case "/api/stoppage-records":
                        await HandleStoppageRecordsRequest(response);
                        break;
                    
                    case "/api/stoppage-reason":
                        if (request.HttpMethod == "POST")
                        {
                            await HandleStoppageReasonRequest(request, response, body);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/api/job-end":
                        if (request.HttpMethod == "POST")
                        {
                            await HandleJobEndRequest(request, response, body);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/api/reports":
                        if (request.HttpMethod == "GET")
                        {
                            await HandleGetReportsRequest(response);
                        }
                        else
                        {
                            response.StatusCode = 405; // Method Not Allowed
                        }
                        break;
                    
                    case "/":
                        await HandleRootRequest(response);
                        break;
                    
                    default:
                        Console.WriteLine($"Default case - URL: {request.Url?.AbsolutePath}, Method: {request.HttpMethod}");
                        // Dinamik routing için PUT/DELETE isteklerini kontrol et
                        if (request.Url?.AbsolutePath?.StartsWith("/api/plcconfig/data-definitions/") == true)
                        {
                            Console.WriteLine("Dynamic routing to data definitions");
                            await HandlePLCDataDefinitionsRequest(request, response);
                        }
                        else
                        {
                            Console.WriteLine($"404 - Endpoint not found: {request.Url?.AbsolutePath}");
                        response.StatusCode = 404;
                            var notFound = JsonSerializer.Serialize(new { error = "Endpoint not found" });
                            var buffer = Encoding.UTF8.GetBytes(notFound);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                context.Response.StatusCode = 500;
                var errorBytes = Encoding.UTF8.GetBytes($"Error: {ex.Message}");
                await context.Response.OutputStream.WriteAsync(errorBytes, 0, errorBytes.Length);
            }
            finally
            {
                context.Response.OutputStream.Close();
            }
        }

        private async Task HandleAdminPanelRequest(HttpListenerResponse response)
        {
            try
            {
                var filePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "adminpanel.html");
                if (File.Exists(filePath))
                {
                    response.ContentType = "text/html";
                    var content = await File.ReadAllTextAsync(filePath);
                    var bytes = Encoding.UTF8.GetBytes(content);
                    await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
                }
                else
                {
                    response.StatusCode = 404;
                    response.ContentType = "text/plain";
                    var errorMessage = "Admin panel not found";
                    var bytes = Encoding.UTF8.GetBytes(errorMessage);
                    await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                response.ContentType = "text/plain";
                var errorMessage = $"Error loading admin panel: {ex.Message}";
                var bytes = Encoding.UTF8.GetBytes(errorMessage);
                await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
            }
        }

        private async Task HandleStatusRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            var status = new
            {
                Service = "PLC Data Collector",
                Status = isRunning ? "Running" : "Stopped",
                Timestamp = DateTime.Now,
                Port = port
            };
            
            var json = JsonSerializer.Serialize(status, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
        }

        private async Task HandleDataRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            
            try
            {
                // Veritabanından /api/data endpoint'ine ait veri tanımlarını al
                var definitions = new List<object>();
                
                using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                {
                    await connection.OpenAsync();
                    var command = new Microsoft.Data.SqlClient.SqlCommand(
                        "SELECT * FROM plc_data_definitions WHERE api_endpoint = @endpoint AND is_active = 1", 
                        connection);
                    command.Parameters.AddWithValue("@endpoint", "/api/data");
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            definitions.Add(new
                            {
                                Name = reader["name"].ToString(),
                                DataType = reader["data_type"].ToString(),
                                RegisterAddress = Convert.ToInt32(reader["register_address"]),
                                RegisterCount = Convert.ToInt32(reader["register_count"])
                            });
                        }
                    }
                }
                
                // PLC verisini al
                PLCData? data;
                lock (dataLock)
                {
                    data = lastData;
                }
                
                // Console.WriteLine($"🔍 HandleDataRequest: data={data != null}");
                
                // Eski yapıyı koru - data wrapper olmadan
                var result = new Dictionary<string, object>
                {
                    ["Timestamp"] = DateTime.Now
                };
                
                if (data != null)
                {
                    // Dinamik veri mapping - veritabanından gelen tüm veriler
                    foreach (var definition in definitions)
                    {
                        var def = (dynamic)definition;
                        var name = def.Name;
                        var dataType = def.DataType;
                        var registerAddress = def.RegisterAddress;
                        var registerCount = def.RegisterCount;
                        
                        try
                        {
                            object value = null;
                            
                            // Dinamik veri mapping - data.Data dictionary'sinden al
                            if (data.Data.ContainsKey(name))
                            {
                                value = data.Data[name];
                            }
                            else
                            {
                                // Fallback: Eski hardcoded mapping
                                switch (name.ToLower())
                                {
                                    case "machinespeed":
                                    case "machinediecounter":
                                    case "ethylalcoholconsumption":
                                    case "ethylacetateconsumption":
                                    case "laststoptime":
                                    case "stoppageduration":
                                    case "mtbfvalue":
                                    case "laststopepoch":
                                    case "diespeed":
                                    case "paperconsumption":
                                    case "actualproduction":
                                    case "remainingwork":
                                    case "estimatedtime":
                                    case "totalstops":
                                    case "setupstops":
                                    case "faultstops":
                                    case "qualitystops":
                                    case "machinestopped":
                                    case "wastagebeforedie":
                                    case "wastageafterdie":
                                    case "wastageratio":
                                    case "totalstoppageduration":
                                    case "overproduction":
                                    case "completionpercentage":
                                    case "overalloee":
                                    case "availability":
                                    case "performance":
                                    case "quality":
                                    case "uretimhizadetdakika":
                                    case "hedefuretimhizadetdakika":
                                    case "plannedtime":
                                    case "randomtestreal":
                                        // Bu veriler zaten yukarıda eklendi, atla
                                        continue;
                                    default:
                                        // Yeni eklenen veriler için 0 değer
                                        value = 0;
                                        break;
                                }
                            }
                            
                            // Yeni veriyi ekle (PascalCase ile)
                            if (value != null)
                            {
                                result[name] = value;
                            }
                        }
                        catch (Exception ex)
                        {
                            LogMessage($"❌ Veri okuma hatası ({name}): {ex.Message}");
                            result[name] = 0;
                        }
                    }
                }
                
                var json = JsonSerializer.Serialize(result);
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentType = "application/json";
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                LogMessage($"❌ HandleDataRequest hatası: {ex.Message}");
                response.StatusCode = 500;
            }
        }

        private async Task HandleDynamicDataRequest(HttpListenerResponse response, string endpoint)
        {
            response.ContentType = "application/json";
            
            try
            {
                // Veritabanından bu endpoint'e ait veri tanımlarını al
                var definitions = new List<object>();
                
                using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                {
                    await connection.OpenAsync();
                    var command = new Microsoft.Data.SqlClient.SqlCommand(
                        "SELECT * FROM plc_data_definitions WHERE api_endpoint = @endpoint AND is_active = 1", 
                        connection);
                    command.Parameters.AddWithValue("@endpoint", endpoint);
                    
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            definitions.Add(new
                            {
                                Name = reader["name"].ToString(),
                                DataType = reader["data_type"].ToString(),
                                RegisterAddress = Convert.ToInt32(reader["register_address"]),
                                RegisterCount = Convert.ToInt32(reader["register_count"])
                            });
                        }
                    }
                }
                
                // PLC verisini al
                PLCData? data;
                lock (dataLock)
                {
                    data = lastData;
                }
                
                // Dinamik veri oluştur
                var dynamicData = new Dictionary<string, object>
                {
                    ["timestamp"] = DateTime.Now,
                    ["endpoint"] = endpoint,
                    ["data"] = new Dictionary<string, object>()
                };
                
                if (data != null)
                {
                    // Veri tanımlarına göre sadece ilgili verileri ekle
                    foreach (var definition in definitions)
                    {
                        var def = (dynamic)definition;
                        var propertyName = ConvertToPropertyName(def.Name);
                        var property = typeof(PLCData).GetProperty(propertyName);
                        
                        if (property != null)
                        {
                            var value = property.GetValue(data);
                            ((Dictionary<string, object>)dynamicData["data"])[def.Name] = value ?? 0;
                        }
                    }
                }
                else
                {
                    // Veri yoksa 0 değerlerle doldur
                    foreach (var definition in definitions)
                    {
                        var def = (dynamic)definition;
                        ((Dictionary<string, object>)dynamicData["data"])[def.Name] = 0;
                    }
                }
                
                var json = JsonSerializer.Serialize(dynamicData, new JsonSerializerOptions { WriteIndented = true });
                var bytes = Encoding.UTF8.GetBytes(json);
                await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Dinamik veri endpoint hatası ({endpoint}): {ex.Message}");
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private string ConvertToPropertyName(string name)
        {
            // Veritabanındaki name'i C# property adına çevir
            var propertyName = name.Replace(" ", "")
                                 .Replace("(", "")
                                 .Replace(")", "")
                                 .Replace("-", "")
                                 .Replace("_", "");
            
            // İlk harfi büyük yap
            if (propertyName.Length > 0)
            {
                propertyName = char.ToUpper(propertyName[0]) + propertyName.Substring(1);
            }
            
            return propertyName;
        }

        private async Task HandleHealthRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            var health = new
            {
                Status = "Healthy",
                Timestamp = DateTime.Now,
                Database = await CheckDatabaseConnectionAsync()
            };
            
            var json = JsonSerializer.Serialize(health, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
        }

        private async Task HandleRootRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            var info = new
            {
                Service = "PLC Data Collector",
                Description = "Lemanic 3 Makine Veri Toplama Servisi",
                Status = isRunning ? "Running" : "Stopped",
                Endpoints = new[]
                {
                    "GET /api/status - Servis durumu",
                    "GET /api/data - Son PLC verisi",
                    "GET /api/sensors - Sensor verileri",
                    "GET /api/production - Üretim verileri",
                    "GET /api/quality - Kalite verileri",
                    "GET /api/maintenance - Bakım verileri",
                    "GET /api/health - Sağlık kontrolü",
                    "GET /plc-status - PLC durumu",
                    "GET /production-data - Üretim verileri (detaylı)",
                    "POST /api/job - İş emri no gönder (MachineScreen)",
                    "GET /api/job - Son iş emri verilerini al (Dashboard & MachineScreen)",
                    "POST /api/job-write - İş emri PLC'ye yaz",
                    "POST /api/stoppage - Duruş tipi kaydet",
                    "GET /api/stoppage-records - Duruş kayıtları (son 24 saat)",
                    "POST /api/stoppage-reason - Duruş sebebi kaydet (MachineScreen'den)",
                    "POST /api/job-end - İş sonu raporu kaydet (MachineScreen'den)",
                    "GET /api/reports - İş sonu raporlarını getir (PLCDataCollector'dan)",
                    "GET /api/plcconfig/connections - PLC bağlantı ayarları",
                    "GET /api/plcconfig/data-definitions - Veri tanımları",
                    "GET /api/plcconfig/sql-connections - SQL bağlantıları",
                    "GET /api/plcconfig/api-settings - API ayarları",
                    "POST /api/plcconfig/save-settings - Ayarları kaydet",
                    "POST /api/plcconfig/save-statistics - İstatistikleri kaydet",
                    "GET /api/plcconfig/system-logs - Sistem logları",
                    "POST /api/plcconfig/restart - Servisi yeniden başlat"
                },
                Timestamp = DateTime.Now
            };
            
            var json = JsonSerializer.Serialize(info, new JsonSerializerOptions { WriteIndented = true });
            var bytes = Encoding.UTF8.GetBytes(json);
            await response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
        }

        private async Task HandlePlcStatusRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            
            PLCData? data;
            lock (dataLock)
            {
                data = lastData;
            }
            
            // Son 5 saniye içinde veri gelmişse bağlı kabul et
            var isConnected = data != null && data.Timestamp > DateTime.Now.AddSeconds(-5);
            
            // Hardcoded machine_stopped değeri - Register 30'dan okunan değer
            var machineStopped = false;
            if (data != null)
            {
                // Register 30'dan gelen değerin ilk bitini kontrol et
                machineStopped = (data.machineStatus & 0x0001) != 0;
            }
            
            var plcStatus = new
            {
                success = true,
                connected = isConnected, // Son 5 saniye içinde veri gelmişse bağlı
                machine_running = isConnected && !machineStopped, // Register 30'dan gelen makine durumu
                machine_stopped = !isConnected || machineStopped, // PLC yoksa veya makine durmuşsa
                last_update = data?.Timestamp ?? DateTime.Now,
                request_count = requestCount,
                plc_write_connected = false, // Artık manuel bağlantı kullanılıyor
                data_source = isConnected ? "PLC" : "Default (0 values)" // Veri kaynağını göster
            };
            
            var json = JsonSerializer.Serialize(plcStatus);
            var buffer = Encoding.UTF8.GetBytes(json);
            
            response.ContentType = "application/json";
            response.ContentLength64 = buffer.Length;
            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
        }

        private async Task HandleProductionDataRequest(HttpListenerResponse response)
        {
            response.ContentType = "application/json";
            
            PLCData? data;
            lock (dataLock)
            {
                data = lastData;
            }
            
            if (data != null)
            {
                var productionData = new Dictionary<string, object>
                {
                    ["actualProduction"] = data.actualProduction, // Register 800'den (2-3)
                    ["remainingWork"] = data.remainingWork, // Register 800'den (0-1)
                    ["estimatedTime"] = data.estimatedTime, // Register 800'den (4-5)
                    ["totalStops"] = data.totalStops, // Register 800'den (8-9)
                    ["setupStops"] = data.setupStops, // Register 800'den (12-13)
                    ["faultStops"] = data.faultStops, // Register 800'den (16-17)
                    ["qualityStops"] = data.qualityStops, // Register 800'den (20-21)
                    ["machineSpeed"] = data.machineSpeed,
                    ["dieSpeed"] = data.dieSpeed,
                    ["paperConsumption"] = data.paperConsumption,
                    ["ethylAlcoholConsumption"] = data.ethylAlcoholConsumption,
                    ["ethylAcetateConsumption"] = data.ethylAcetateConsumption
                };
                
                var result = new Dictionary<string, object>
                {
                    ["success"] = true,
                    ["data"] = productionData
                };
                
                var json = JsonSerializer.Serialize(result);
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentType = "application/json";
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            else
            {
                response.StatusCode = 204; // No Content
            }
        }

        private async Task HandleJobPostRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            LogMessage("🚀 HandleJobPostRequest başladı!");
            try
            {
                response.ContentType = "application/json";
                
                // POST body'den iş emri no'yu al
                var orderNumber = "";
                
                if (!string.IsNullOrEmpty(requestBody))
                {
                    try
                    {
                        var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                        orderNumber = requestData?.GetValueOrDefault("orderNumber")?.ToString() ?? "";
                        LogMessage($"Request body: {requestBody}");
                        LogMessage($"Parsed orderNumber: {orderNumber}");
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"JSON parse hatası: {ex.Message}");
                    }
                }
                
                if (string.IsNullOrEmpty(orderNumber))
                {
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "orderNumber parametresi gerekli"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                // SQL sorgusu yap
                var jobData = await QueryJobDataAsync(orderNumber);
                
                LogMessage($"QueryJobDataAsync result: {JsonSerializer.Serialize(jobData)}");
                
                if (jobData["success"].Equals(true))
                {
                    // Cache'e sadece data kısmını yaz
                    lock (jobDataLock)
                    {
                        lastJobData = jobData["data"] as Dictionary<string, object>;
                        LogMessage($"Cache'e yazıldı: {JsonSerializer.Serialize(lastJobData)}");
                    }
                    
                    // Yalnızca sorgula: PLC'ye yazma bu endpointte yapılmayacak. Onay için /api/job-write kullanılacak.
                    LogMessage("ℹ️ İş emri sadece sorgulandı, PLC'ye yazılmadı. Onay için /api/job-write bekleniyor.");
                    
                    var json = JsonSerializer.Serialize(jobData);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    
                    response.ContentType = "application/json";
                    response.ContentLength64 = buffer.Length;
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else
                {
                    response.StatusCode = 404;
                    var json = JsonSerializer.Serialize(jobData);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                return;
            }
        }

        private async Task HandleStoppageRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            try
            {
                response.ContentType = "application/json";
                
                var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                
                if (requestData?.ContainsKey("stoppageType") == true)
                {
                    // Duruş sebebi endpoint'i
                    var stoppageType = Convert.ToInt32(requestData["stoppageType"]);
                    
                    bool writeSuccess = false;
                    // stoppageType kaldırıldı - kullanılmıyor
                    
                    var result = new Dictionary<string, object> { 
                        ["success"] = writeSuccess,
                        ["message"] = writeSuccess ? "Duruş sebebi PLC'ye gönderildi" : "PLC'ye yazma başarısız"
                    };
                    
                    var json = JsonSerializer.Serialize(result);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    
                    response.ContentType = "application/json";
                    response.ContentLength64 = buffer.Length;
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else
                {
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "stoppageType parametresi gerekli"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleJobGetRequest(HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                // Veritabanından aktif job cycle kaydını oku
                var activeCycle = await GetActiveJobCycleRecordAsync();
                
                if (activeCycle != null && activeCycle.TryGetValue("job_info", out var jobInfoStr) && jobInfoStr != null)
                {
                    try
                    {
                        // job_info JSON'unu parse et
                        var jobData = JsonSerializer.Deserialize<Dictionary<string, object>>(jobInfoStr.ToString() ?? "{}");
                        
                        if (jobData != null && jobData.Count > 0)
                        {
                            var result = new Dictionary<string, object>
                            {
                                ["success"] = true,
                                ["data"] = jobData
                            };
                            var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                            var buffer = Encoding.UTF8.GetBytes(json);
                            
                            response.ContentType = "application/json";
                            response.ContentLength64 = buffer.Length;
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                            LogMessage($"✅ [HandleJobGetRequest] Aktif iş bilgileri veritabanından okundu - Sipariş: {activeCycle.GetValueOrDefault("siparis_no")}");
                            return;
                        }
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"⚠️ [HandleJobGetRequest] job_info parse hatası: {ex.Message}");
                    }
                }
                
                // Aktif kayıt yoksa veya job_info boşsa, cache'den dene (fallback)
                Dictionary<string, object>? jobDataFromCache = null;
                lock (jobDataLock)
                {
                    jobDataFromCache = lastJobData;
                }
                
                if (jobDataFromCache != null)
                {
                    var result = new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["data"] = jobDataFromCache
                    };
                    var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                    var buffer = Encoding.UTF8.GetBytes(json);
                    
                    response.ContentType = "application/json";
                    response.ContentLength64 = buffer.Length;
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    LogMessage($"✅ [HandleJobGetRequest] İş bilgileri cache'den okundu (fallback)");
                    return;
                }
                
                // Hiçbir kayıt yoksa
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["message"] = "Henüz iş emri sorgulanmadı. MachineScreen'den bir iş emri numarası sorgulayın."
                };
                var errorJson = JsonSerializer.Serialize(errorResult, new JsonSerializerOptions { WriteIndented = true });
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                
                response.ContentType = "application/json";
                response.ContentLength64 = errorBuffer.Length;
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                LogMessage($"⚠️ [HandleJobGetRequest] Aktif iş kaydı bulunamadı");
            }
            catch (Exception ex)
            {
                LogMessage($"❌ [HandleJobGetRequest] Hata: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        /// <summary>
        /// İş emri verilerini sorgula (public)
        /// </summary>
        public async Task<Dictionary<string, object>> QueryJobDataAsync(string orderNumber)
        {
            try
            {
                using var conn = new SqlConnection(egemConnectionString);
                await conn.OpenAsync();
                
                // Önce tam eşleşme dene, yoksa LIKE ile ara
                var query = @"
                    SELECT TOP 1
                        SIPARIS_NO,
                        TOPLAM_MIKTAR,
                        KALAN,
                        SET_SAYISI,
                        URETIM_TIPI,
                        stok_adi,
                        hiz,
                        COALESCE(bundle, 'N/A') as bundle,
                        NET_KARTON_MIKTAR_MT,
                        PALET_ADET,
                        COALESCE(
                            NULLIF(silindir_cevresi, ''), 
                            NULLIF(silindir_cevre1, ''), 
                            NULLIF(silindir_cevre2, ''), 
                            NULLIF(silindir_cevre3, ''), 
                            NULLIF(silindir_cevre4, ''), 
                            NULLIF(silindir_cevre5, ''), 
                            NULLIF(silindir_cevre6, ''), 
                            NULLIF(silindir_cevre7, ''), 
                            NULLIF(silindir_cevre8, ''), 
                            NULLIF(silindir_cevre9, ''), 
                            NULLIF(silindir_cevre10, ''), 
                            NULLIF(silindir_cevre11, ''), 
                            NULLIF(silindir_cevre12, '')
                        ) as silindir_cevresi,
                        COALESCE(SETUP, 0) as SETUP
                    FROM EGEM_GRAVUR_SIPARIS_IZLEME 
                    WHERE SIPARIS_NO = @OrderNumberExact
                       OR SIPARIS_NO LIKE @OrderNumber
                    ORDER BY CASE WHEN SIPARIS_NO = @OrderNumberExact THEN 1 ELSE 2 END,
                             SIPARIS_NO DESC";
                
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@OrderNumberExact", orderNumber.Trim());
                cmd.Parameters.AddWithValue("@OrderNumber", $"%{orderNumber.Trim()}%");
                
                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    // Debug: Veritabanından gelen ham değerleri logla
                    LogMessage($"📋 SQL'den gelen ham veriler:");
                    LogMessage($"  SIPARIS_NO: {reader["SIPARIS_NO"]}");
                    LogMessage($"  TOPLAM_MIKTAR: {reader["TOPLAM_MIKTAR"]}");
                    LogMessage($"  KALAN: {reader["KALAN"]}");
                    LogMessage($"  SET_SAYISI: {reader["SET_SAYISI"]}");
                    LogMessage($"  URETIM_TIPI: {reader["URETIM_TIPI"]}");
                    LogMessage($"  stok_adi: {reader["stok_adi"]}");
                    LogMessage($"  hiz: {reader["hiz"]}");
                    LogMessage($"  NET_KARTON_MIKTAR_MT: {reader["NET_KARTON_MIKTAR_MT"]}");
                    LogMessage($"  PALET_ADET: {reader["PALET_ADET"]}");
                    LogMessage($"  silindir_cevresi: {reader["silindir_cevresi"]}");
                    LogMessage($"  SETUP: {reader["SETUP"]}");
                    
                    var data = new Dictionary<string, object>
                    {
                        ["siparis_no"] = reader["SIPARIS_NO"]?.ToString() ?? "",
                        ["toplam_miktar"] = reader["TOPLAM_MIKTAR"],
                        ["kalan_miktar"] = reader["KALAN"],
                        ["set_sayisi"] = reader["SET_SAYISI"]?.ToString() ?? "",
                        ["uretim_tipi"] = reader["URETIM_TIPI"]?.ToString() ?? "",
                        ["stok_adi"] = reader["stok_adi"]?.ToString() ?? "",
                        ["hiz"] = reader["hiz"],
                        ["bundle"] = reader["bundle"]?.ToString() ?? "N/A",
                        ["brut_karton_mt"] = ToDouble(reader["NET_KARTON_MIKTAR_MT"]),
                        ["palet_adet"] = ToDouble(reader["PALET_ADET"]),
                        ["silindir_cevresi"] = reader["silindir_cevresi"]?.ToString() ?? "",
                        ["setup"] = ToDouble(reader["SETUP"])
                    };
                    
                    LogMessage($"📦 Dönüştürülmüş data: {JsonSerializer.Serialize(data)}");
                    
                    // Hedef hız hesaplama
                    var hiz = Convert.ToDouble(data["hiz"]);
                    var uretimTipi = data["uretim_tipi"]?.ToString() ?? "";
                    var hedefHiz = 0.0;
                    
                    if (!string.IsNullOrEmpty(uretimTipi))
                    {
                        if (uretimTipi.Contains("INLINE", StringComparison.OrdinalIgnoreCase))
                        {
                            // INLINE tipi üretimler: hizmkn = Round(((hiz * 0.8) * 370) / 1000)
                            hedefHiz = Math.Round(((hiz * 0.8) * 370) / 1000);
                        }
                        else if (uretimTipi.Contains("SHEET", StringComparison.OrdinalIgnoreCase))
                        {
                            // SHEET tipi üretimler: hizmkn = Round(((hiz * 0.9) * 370) / 1000)
                            hedefHiz = Math.Round(((hiz * 0.9) * 370) / 1000);
                        }
                        else
                        {
                            // Diğer tipler için varsayılan hesaplama
                            hedefHiz = Math.Round(((hiz * 0.85) * 370) / 1000);
                        }
                    }
                    
                    // Hedef hızı data'ya ekle
                    data["hedef_hiz"] = hedefHiz;
                    
                    // Cache'deki jobStartTime'ı koru (eğer varsa ve aynı sipariş numarasıysa)
                    lock (jobDataLock)
                    {
                        if (lastJobData != null && 
                            lastJobData.ContainsKey("siparis_no") && 
                            lastJobData["siparis_no"]?.ToString() == data["siparis_no"]?.ToString() &&
                            lastJobData.ContainsKey("jobStartTime"))
                        {
                            data["jobStartTime"] = lastJobData["jobStartTime"];
                            LogMessage($"✅ Cache'den jobStartTime korundu: {lastJobData["jobStartTime"]}");
                        }
                    }
                    
                    return new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["data"] = data
                    };
                }
                else
                {
                    return new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["message"] = "Sipariş bulunamadı"
                    };
                }
            }
            catch (Exception ex)
            {
                return new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Veritabanı hatası: {ex.Message}"
                };
            }
        }

        private async Task HandleJobWebRequest(HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "text/html; charset=utf-8";
                
                Dictionary<string, object>? jobData;
                lock (jobDataLock)
                {
                    jobData = lastJobData;
                }
                
                var dataJson = jobData != null ? JsonSerializer.Serialize(jobData, new JsonSerializerOptions { WriteIndented = true }) : "Henüz veri yok";
                
                var html = $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
    <title>İş Emri API - PLC Data Collector</title>
    <style>
        body {{ font-family: monospace; margin: 20px; background: #f5f5f5; }}
        .container {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-bottom: 20px; }}
        .json-data {{ background: #f8f8f8; border: 1px solid #ddd; border-radius: 4px; padding: 15px; white-space: pre-wrap; overflow-x: auto; }}
        .refresh-btn {{ background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 20px; }}
        .refresh-btn:hover {{ background: #45a049; }}
        .timestamp {{ color: #666; font-size: 12px; margin-top: 10px; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='header'>
            <h1>📊 İş Emri API Durumu</h1>
            <p>PLC Data Collector - {DateTime.Now:dd.MM.yyyy HH:mm:ss}</p>
        </div>
        
        <button class='refresh-btn' onclick='location.reload()'>🔄 Yenile</button>
        
        <div class='json-data'>{dataJson}</div>
        
        <div class='timestamp'>
            Son güncelleme: {DateTime.Now:dd.MM.yyyy HH:mm:ss}
        </div>
    </div>
</body>
</html>";
                
                var buffer = Encoding.UTF8.GetBytes(html);
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var errorHtml = $"<html><body><h1>Hata</h1><p>{ex.Message}</p></body></html>";
                var errorBuffer = Encoding.UTF8.GetBytes(errorHtml);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task<bool> CheckDatabaseConnectionAsync()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        private void InitializePlcConnectionTimer()
        {
            plcConnectionTimer = new System.Threading.Timer(PlcConnectionTimerCallback, null, TimeSpan.Zero, TimeSpan.FromSeconds(30));
        }
        
        private async void PlcConnectionTimerCallback(object? state)
        {
            await CheckPlcConnection();
        }

        private async Task CheckPlcConnection()
        {
            try
            {
                // Manuel bağlantı ile test
                var tempPlcWriter = new PLCWriter();
                var connectResult = await tempPlcWriter.ConnectAsync();
                
                if (connectResult)
                {
                    // Basit test - register yazmaya çalış
                    var testValue = 999;
                    var success = await tempPlcWriter.WriteDINTAsync(999, testValue);
                    
                    if (success)
                    {
                        // LogMessage("✅ PLC yazma testi başarılı");
                    }
                    else
                    {
                        // LogMessage("❌ PLC yazma testi başarısız");
                    }
                    
                    // Bağlantıyı kapat
                    tempPlcWriter.Disconnect();
                }
                else
                {
                    LogMessage("❌ PLC'ye bağlantı kurulamadı");
                }
                
                tempPlcWriter.Dispose();
            }
            catch (Exception ex)
            {
                LogMessage($"❌ PLC test hatası: {ex.Message}");
            }
        }

        private void InitializeLogCleanupTimer()
        {
            logCleanupTimer = new System.Threading.Timer(LogCleanupTimerCallback, null, TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(5));
        }
        
        private void LogCleanupTimerCallback(object? state)
        {
            CleanupOldLogs();
        }

        private void CleanupOldLogs()
        {
            // Log temizleme işlemi (şimdilik boş)
            // Form1'deki ListBox log'ları temizlenebilir
        }

        private async Task<Dictionary<string, object>> QuerySqlServer(string orderNumber)
        {
            try
            {
                using var connection = new SqlConnection(egemConnectionString);
                await connection.OpenAsync();
                
                var sql = @"
                    SELECT TOP 1 
                        SIPARIS_NO, 
                        TOPLAM_MIKTAR,
                        KALAN, 
                        COALESCE(
                            NULLIF(silindir_cevresi, ''), 
                            NULLIF(silindir_cevre1, ''), 
                            NULLIF(silindir_cevre2, ''), 
                            NULLIF(silindir_cevre3, ''), 
                            NULLIF(silindir_cevre4, ''), 
                            NULLIF(silindir_cevre5, ''), 
                            NULLIF(silindir_cevre6, ''), 
                            NULLIF(silindir_cevre7, ''), 
                            NULLIF(silindir_cevre8, ''), 
                            NULLIF(silindir_cevre9, ''), 
                            NULLIF(silindir_cevre10, ''), 
                            NULLIF(silindir_cevre11, ''), 
                            NULLIF(silindir_cevre12, '')
                        ) as silindir_cevresi, 
                        BUNDLE, 
                        HIZ,
                        SET_SAYISI,
                        URETIM_TIPI,
                        stok_adi
                    FROM EGEM_GRAVUR_SIPARIS_IZLEME 
                    WHERE SIPARIS_NO LIKE @OrderNumber";
                
                using var command = new SqlCommand(sql, connection);
                command.Parameters.AddWithValue("@OrderNumber", $"%{orderNumber}%");
                
                using var reader = await command.ExecuteReaderAsync();
                
                if (await reader.ReadAsync())
                {
                    var data = new Dictionary<string, object>
                    {
                        ["siparis_no"] = reader["SIPARIS_NO"],
                        ["toplam_miktar"] = reader["TOPLAM_MIKTAR"], // Toplam miktar
                        ["kalan_miktar"] = reader["KALAN"], // Kalan miktar
                        ["silindir_cevresi"] = reader["silindir_cevresi"],
                        ["bundle"] = reader["BUNDLE"],
                        ["hiz"] = reader["HIZ"],
                        ["set_sayisi"] = reader["SET_SAYISI"],
                        ["uretim_tipi"] = reader["URETIM_TIPI"],
                        ["stok_adi"] = reader["stok_adi"]
                    };
                    
                    // Hedef hız hesaplama
                    var hiz = Convert.ToDouble(data["hiz"]);
                    var uretimTipi = data["uretim_tipi"]?.ToString() ?? "";
                    var hedefHiz = 0.0;
                    
                    if (!string.IsNullOrEmpty(uretimTipi))
                    {
                        if (uretimTipi.Contains("INLINE", StringComparison.OrdinalIgnoreCase))
                        {
                            // INLINE tipi üretimler: hizmkn = Round(((hiz * 0.8) * 370) / 1000)
                            hedefHiz = Math.Round(((hiz * 0.8) * 370) / 1000);
                        }
                        else if (uretimTipi.Contains("SHEET", StringComparison.OrdinalIgnoreCase))
                        {
                            // SHEET tipi üretimler: hizmkn = Round(((hiz * 0.9) * 370) / 1000)
                            hedefHiz = Math.Round(((hiz * 0.9) * 370) / 1000);
                        }
                        else
                        {
                            // Diğer tipler için varsayılan hesaplama
                            hedefHiz = Math.Round(((hiz * 0.85) * 370) / 1000);
                        }
                    }
                    
                    // Hedef hızı data'ya ekle
                    data["hedef_hiz"] = hedefHiz;
                    
                    // PLC'ye veri gönder - Manuel bağlantı ile
                    try
                    {
                        var tempPlcWriter = new PLCWriter();
                        var connectResult = await tempPlcWriter.ConnectAsync();
                        
                        if (connectResult)
                        {
                            var kalanMiktar = ParseIntValue(data.ContainsKey("kalan_miktar") ? data["kalan_miktar"] : null);
                            var setSayisi = ParseIntValue(data.ContainsKey("set_sayisi") ? data["set_sayisi"] : null);
                            
                            // Silindir çevresini parse et
                            var silindirCevresiRaw = data.ContainsKey("silindir_cevresi") ? data["silindir_cevresi"]?.ToString() ?? "0" : "0";
                            float silindirCevresi = ParseFloatValue(silindirCevresiRaw);
                            
                            // Eğer nokta/virgül yoksa ve değer 10000'den büyükse, 100'e böl (eski format)
                            if (!silindirCevresiRaw.Contains(".") && !silindirCevresiRaw.Contains(",") && float.TryParse(silindirCevresiRaw, out float tempVal) && tempVal > 10000)
                            {
                                silindirCevresi = tempVal / 100f;
                            }
                            
                            var hedefHizValue = ParseIntValue(data.ContainsKey("hedef_hiz") ? data["hedef_hiz"] : null);
                            
                            await tempPlcWriter.WriteDINTAsync(0, kalanMiktar); // Register 0-1 (targetProduction)
                            await tempPlcWriter.WriteDINTAsync(4, setSayisi);     // Register 4-5 (patternValue)
                            await tempPlcWriter.WriteDINTAsync(8, hedefHizValue);     // Register 8-9 (targetSpeed)
                            await tempPlcWriter.WriteREALAsync(12, silindirCevresi); // Register 12-13 (jobCylinderLength)
                            
                            tempPlcWriter.Disconnect();
                        }
                        
                        tempPlcWriter.Dispose();
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"❌ PLC'ye veri gönderme hatası: {ex.Message}");
                    }
                    
                    return new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["data"] = data
                    };
                }
                else
                {
                    return new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["message"] = "Sipariş bulunamadı"
                    };
                }
            }
            catch (Exception ex)
            {
                return new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Veritabanı hatası: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// Son veriyi güncelle (DataProcessor'dan çağrılır)
        /// </summary>
        public void UpdateData(PLCData data)
        {
            // TODO: Legacy energy analyzer injection removed; data now expected from PLC readers only
            lock (dataLock)
            {
                if (data != null)
                {
                    StabilizeMappedFields(data);
                    lastData = data.Clone();
                }
                else
                {
                    lastData = null;
                    Console.WriteLine("⚠️ SqlProxy.UpdateData(): PLC verisi null - 0 değerler kullanılacak");
                }
            }
        }

        private void StabilizeMappedFields(PLCData data)
        {
            foreach (var kvp in stabilizedFieldSynonyms)
            {
                var canonicalKey = kvp.Key;
                var aliases = kvp.Value;
                var currentValue = GetFirstExistingValue(data, aliases);

                if (currentValue != null && !IsZeroLike(currentValue))
                {
                    lastStableFieldValues[canonicalKey] = currentValue;
                }
                else if (lastStableFieldValues.TryGetValue(canonicalKey, out var stableValue))
                {
                    foreach (var alias in aliases)
                    {
                        data.Data[alias] = stableValue;
                    }
                }
            }
        }

        public void Dispose()
        {
            Dispose(true);
            GC.SuppressFinalize(this);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (disposing)
            {
                StopAsync().Wait();
                cancellationTokenSource?.Dispose();
                // plcWriter artık manuel olarak oluşturuluyor, dispose edilmesine gerek yok
                plcConnectionTimer?.Dispose();
                logCleanupTimer?.Dispose();
            }
        }

        private static double ToDouble(object? value)
        {
            if (value == null)
            {
                return 0d;
            }

            try
            {
                return Convert.ToDouble(value, CultureInfo.InvariantCulture);
            }
            catch
            {
                var str = value.ToString();
                if (!string.IsNullOrWhiteSpace(str) &&
                    double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                {
                    return parsed;
                }

                return 0d;
            }
        }

        private static bool IsZeroLike(object? value)
        {
            if (value == null)
            {
                return true;
            }

            switch (value)
            {
                case int i:
                    return i == 0;
                case long l:
                    return l == 0;
                case short s:
                    return s == 0;
                case byte b:
                    return b == 0;
                case float f:
                    return Math.Abs(f) < 0.0001f;
                case double d:
                    return Math.Abs(d) < 0.0001d;
                case decimal m:
                    return m == 0m;
                case string str when double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed):
                    return Math.Abs(parsed) < 0.0001d;
                default:
                    return false;
            }
        }

        private static object? GetFirstExistingValue(PLCData data, IEnumerable<string> keys)
        {
            foreach (var key in keys)
            {
                if (data.Data.TryGetValue(key, out var value))
                {
                    return value;
                }
            }

            return null;
        }
        
        private async Task HandleStoppageRecordsRequest(HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";

                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();

                // Aktif iş başlangıç zamanını al - aktif iş yoksa kayıt döndürme
                DateTime? fromTime = null;
                try
                {
                    var activeCycle = await GetActiveJobCycleRecordAsync();
                    if (activeCycle != null && activeCycle.TryGetValue("cycle_start_time", out var startObj) && startObj is DateTime cycleStart)
                    {
                        fromTime = cycleStart;
                        LogMessage($"📊 Duruş kayıtları aktif iş başlangıcından itibaren getiriliyor: {fromTime:yyyy-MM-dd HH:mm:ss}");
                    }
                    else
                    {
                        LogMessage("📊 Aktif iş bulunamadı, duruş kaydı döndürülmeyecek");
                    }
                }
                catch (Exception ex)
                {
                    LogMessage($"⚠️ Aktif iş başlangıç zamanı alınamadı, duruş kaydı döndürülmeyecek: {ex.Message}");
                }

                // Aktif iş yoksa boş liste döndür
                if (!fromTime.HasValue)
                {
                    var emptyResult = new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["data"] = new List<Dictionary<string, object>>(),
                        ["count"] = 0
                    };

                    var emptyJson = JsonSerializer.Serialize(emptyResult, new JsonSerializerOptions { WriteIndented = true });
                    var emptyBuffer = Encoding.UTF8.GetBytes(emptyJson);
                    response.ContentLength64 = emptyBuffer.Length;
                    await response.OutputStream.WriteAsync(emptyBuffer, 0, emptyBuffer.Length);
                    return;
                }

                // Aktif iş başlangıç zamanından itibaren duruş kayıtlarını getir
                var cmd = new SqlCommand(@"
                    SELECT TOP 50
                        id,
                        start_time,
                        end_time,
                        duration_seconds,
                        stoppage_reason,
                        created_at
                    FROM stoppage_records 
                    WHERE start_time >= @fromTime
                    ORDER BY start_time DESC", conn);
                cmd.Parameters.AddWithValue("@fromTime", fromTime.Value);
                
                var records = new List<Dictionary<string, object>>();
                
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var record = new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["start_time"] = reader["start_time"],
                        ["end_time"] = reader["end_time"],
                        ["duration_seconds"] = reader["duration_seconds"],
                        ["stoppage_reason"] = reader["stoppage_reason"],
                        ["created_at"] = reader["created_at"]
                    };
                    records.Add(record);
                }
                
                var result = new Dictionary<string, object>
                {
                    ["success"] = true,
                    ["data"] = records,
                    ["count"] = records.Count
                };
                
                var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Duruş kayıtları getirme hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleStoppageReasonRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            try
            {
                LogMessage($"🔍 HandleStoppageReasonRequest başladı, Body: {requestBody}");
                response.ContentType = "application/json";
                
                var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                LogMessage($"🔍 Parse edilen data: {JsonSerializer.Serialize(requestData)}");
                
                if (requestData?.ContainsKey("categoryId") == true && requestData?.ContainsKey("reasonId") == true)
                {
                    var categoryId = ((JsonElement)requestData["categoryId"]).GetInt32();
                    var reasonId = ((JsonElement)requestData["reasonId"]).GetInt32();
                    
                    LogMessage($"🔍 Sebep ID'leri: Kategori={categoryId}, Sebep={reasonId}");
                    
                    // DataProcessor'a sebep bilgilerini gönder
                    LogMessage($"🔍 DataProcessor: {(dataProcessor != null ? "Bulundu" : "NULL")}");
                    
                    if (dataProcessor != null)
                    {
                        dataProcessor.UpdateStoppageReason(categoryId, reasonId);
                        
                        var result = new Dictionary<string, object> { 
                            ["success"] = true,
                            ["message"] = "Duruş sebebi kaydedildi"
                        };
                        
                        var json = JsonSerializer.Serialize(result);
                        var buffer = Encoding.UTF8.GetBytes(json);
                        
                        response.ContentType = "application/json";
                        response.ContentLength64 = buffer.Length;
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                    else
                    {
                        response.StatusCode = 500;
                        var errorResult = new Dictionary<string, object>
                        {
                            ["success"] = false,
                            ["error"] = "DataProcessor bulunamadı"
                        };
                        var errorJson = JsonSerializer.Serialize(errorResult);
                        var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                        await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    }
                }
                else
                {
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "categoryId ve reasonId parametreleri gerekli"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ HandleStoppageReasonRequest hatası: {ex.Message}");
                LogMessage($"❌ Stack trace: {ex.StackTrace}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleJobWriteRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            try
            {
                LogMessage("🔌 PLC'ye iş emri verisi yazma işlemi başladı");
                LogMessage($"📥 Request body: {requestBody}");
                response.ContentType = "application/json";
                
                var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                
                if (requestData == null)
                {
                    LogMessage("❌ Geçersiz JSON verisi");
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "Geçersiz JSON verisi"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                LogMessage("✅ JSON verisi parse edildi, PLC'ye yazma işlemi başlatılıyor...");
                
                // PLC'ye veri yaz - Manuel bağlantı ile
                try
                {
                    var tempPlcWriter = new PLCWriter();
                    var connectResult = await tempPlcWriter.ConnectAsync();
                    
                    if (connectResult)
                    {
                        LogMessage("✅ PLC'ye bağlantı başarılı, veri yazılıyor...");
                        
                        var kalanMiktar = ParseIntValue(requestData.ContainsKey("kalan_miktar") ? requestData["kalan_miktar"] : null);
                        var setSayisi = ParseIntValue(requestData.ContainsKey("set_sayisi") ? requestData["set_sayisi"] : null);
                        var silindirCevresi = ParseFloatValue(requestData.ContainsKey("silindir_cevresi") ? requestData["silindir_cevresi"] : null);
                        var hedefHizValue = ParseIntValue(requestData.ContainsKey("hedef_hiz") ? requestData["hedef_hiz"] : null);
                        
                        LogMessage($"📝 PLC'ye yazılıyor: Kalan={kalanMiktar}, Set={setSayisi}, Silindir={silindirCevresi}, HedefHiz={hedefHizValue}");
                        
                        await tempPlcWriter.WriteDINTAsync(0, kalanMiktar); // Register 0-1 (targetProduction)
                        await tempPlcWriter.WriteDINTAsync(4, setSayisi);     // Register 4-5 (patternValue)
                        await tempPlcWriter.WriteDINTAsync(8, hedefHizValue);     // Register 8-9 (targetSpeed)
                        await tempPlcWriter.WriteREALAsync(12, silindirCevresi); // Register 12-13 (jobCylinderLength)
                        
                        LogMessage("✅ PLC'ye veri yazıldı");
                        
                        // Bağlantıyı kapat
                        tempPlcWriter.Disconnect();
                        LogMessage("🔌 PLC yazma bağlantısı kapatıldı");
                        
                        // Aktif JobCycle kaydını iş emri bilgileriyle güncelle
                        LogMessage("📝 Aktif JobCycle kaydı iş emri bilgileriyle güncelleniyor...");
                        var activeCycle = await GetActiveJobCycleRecordAsync();
                        if (activeCycle == null)
                        {
                            LogMessage("⚠️ Aktif JobCycle kaydı bulunamadı, yeni kayıt oluşturuluyor...");
                            // Aktif kayıt yoksa yeni bir kayıt oluştur
                            double totalEnergyKwhStart = 0.0;
                            
                            if (requestData.ContainsKey("totalEnergyKwhStart") && 
                                double.TryParse(requestData["totalEnergyKwhStart"]?.ToString(), out var parsedValue))
                            {
                                totalEnergyKwhStart = parsedValue;
                                LogMessage($"✅ totalEnergyKwhStart request'ten alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                            
                            if (totalEnergyKwhStart == 0.0)
                            {
                                lock (dataLock)
                                {
                                    if (lastData != null)
                                    {
                                        // Önce totalEnergyKwh key'ini dene
                                        if (lastData.Data.TryGetValue("totalEnergyKwh", out var rawEnergy))
                                        {
                                            totalEnergyKwhStart = ToDouble(rawEnergy);
                                            LogMessage($"✅ totalEnergyKwhStart PLC'den (totalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                        }
                                        // Yoksa TotalEnergy key'ini dene
                                        else if (lastData.Data.TryGetValue("TotalEnergy", out var rawEnergy2))
                                        {
                                            totalEnergyKwhStart = ToDouble(rawEnergy2);
                                            LogMessage($"✅ totalEnergyKwhStart PLC'den (TotalEnergy) alındı: {totalEnergyKwhStart:F2} kWh");
                                        }
                                        // Yoksa TotalEnergyKwh key'ini dene
                                        else if (lastData.Data.TryGetValue("TotalEnergyKwh", out var rawEnergy3))
                                        {
                                            totalEnergyKwhStart = ToDouble(rawEnergy3);
                                            LogMessage($"✅ totalEnergyKwhStart PLC'den (TotalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                                        }
                                    }
                                }
                            }
                            
                            PLCData? snapshot;
                            lock (dataLock)
                            {
                                snapshot = lastData?.Clone();
                            }
                            var cycleId = await CreateJobCycleRecordAsync(snapshot ?? new PLCData());
                            if (cycleId > 0)
                            {
                                LogMessage($"✅ Yeni JobCycle kaydı oluşturuldu (ID: {cycleId})");
                            }
                            else
                            {
                                LogMessage("❌ Yeni JobCycle kaydı oluşturulamadı");
                            }
                        }
                        
                        // Aktif kaydı iş emri bilgileriyle güncelle
                        var updateResult = await UpdateActiveJobCycleWithOrderAsync(requestData);
                        if (updateResult)
                        {
                            LogMessage("✅ Aktif JobCycle kaydı sipariş bilgileriyle güncellendi");
                        }
                        else
                        {
                            LogMessage("❌ Aktif JobCycle kaydı güncellenemedi - aktif kayıt bulunamadı veya güncelleme başarısız");
                        }
                        
                        // Cache'i güncelle
                        double totalEnergyKwhStartForCache = 0.0;
                        if (requestData.ContainsKey("totalEnergyKwhStart") && 
                            double.TryParse(requestData["totalEnergyKwhStart"]?.ToString(), out var parsedCacheValue))
                        {
                            totalEnergyKwhStartForCache = parsedCacheValue;
                        }
                        else
                        {
                            lock (dataLock)
                            {
                                if (lastData != null && lastData.Data.TryGetValue("totalEnergyKwh", out var rawEnergy))
                                {
                                    totalEnergyKwhStartForCache = ToDouble(rawEnergy);
                                }
                            }
                        }
                        
                        lock (jobDataLock)
                        {
                            if (lastJobData != null)
                            {
                                if (requestData.ContainsKey("jobStartTime"))
                                {
                                    lastJobData["jobStartTime"] = requestData["jobStartTime"];
                                }
                                lastJobData["totalEnergyKwhStart"] = totalEnergyKwhStartForCache;
                                
                                // İş emri bilgilerini de cache'e ekle
                                var orderNumber = "";
                                if (requestData.ContainsKey("siparis_no"))
                                {
                                    orderNumber = requestData["siparis_no"]?.ToString() ?? "";
                                }
                                else if (requestData.ContainsKey("orderNumber"))
                                {
                                    orderNumber = requestData["orderNumber"]?.ToString() ?? "";
                                }
                                if (!string.IsNullOrEmpty(orderNumber))
                                {
                                    lastJobData["siparis_no"] = orderNumber;
                                }
                                if (requestData.ContainsKey("kalan_miktar"))
                                {
                                    lastJobData["kalan_miktar"] = requestData["kalan_miktar"];
                                }
                                if (requestData.ContainsKey("set_sayisi"))
                                {
                                    lastJobData["set_sayisi"] = requestData["set_sayisi"];
                                }
                                if (requestData.ContainsKey("hedef_hiz"))
                                {
                                    lastJobData["hedef_hiz"] = requestData["hedef_hiz"];
                                }
                                if (requestData.ContainsKey("silindir_cevresi"))
                                {
                                    lastJobData["silindir_cevresi"] = requestData["silindir_cevresi"];
                                }
                                
                                LogMessage($"✅ Cache güncellendi - Sipariş: {orderNumber}, EnergyStart: {totalEnergyKwhStartForCache:F2} kWh");
                            }
                            else
                            {
                                // Cache'de veri yoksa yeni oluştur
                                var orderNumberForCache = "";
                                if (requestData.ContainsKey("siparis_no"))
                                {
                                    orderNumberForCache = requestData["siparis_no"]?.ToString() ?? "";
                                }
                                else if (requestData.ContainsKey("orderNumber"))
                                {
                                    orderNumberForCache = requestData["orderNumber"]?.ToString() ?? "";
                                }
                                lastJobData = new Dictionary<string, object>
                                {
                                    ["siparis_no"] = orderNumberForCache,
                                    ["kalan_miktar"] = requestData.ContainsKey("kalan_miktar") ? requestData["kalan_miktar"] : 0,
                                    ["set_sayisi"] = requestData.ContainsKey("set_sayisi") ? requestData["set_sayisi"] : "",
                                    ["hedef_hiz"] = requestData.ContainsKey("hedef_hiz") ? requestData["hedef_hiz"] : 0,
                                    ["silindir_cevresi"] = requestData.ContainsKey("silindir_cevresi") ? requestData["silindir_cevresi"] : "",
                                    ["totalEnergyKwhStart"] = totalEnergyKwhStartForCache
                                };
                                
                                if (requestData.ContainsKey("jobStartTime"))
                                {
                                    lastJobData["jobStartTime"] = requestData["jobStartTime"];
                                }
                                
                                LogMessage($"✅ Cache'e yeni veri oluşturuldu - Sipariş: {orderNumberForCache}, EnergyStart: {totalEnergyKwhStartForCache:F2} kWh");
                            }
                        }
                        
                        var result = new Dictionary<string, object>
                        {
                            ["success"] = true,
                            ["message"] = "İş emri verisi PLC'ye başarıyla yazıldı"
                        };
                        
                        var json = JsonSerializer.Serialize(result);
                        var buffer = Encoding.UTF8.GetBytes(json);
                        
                        response.ContentType = "application/json";
                        response.ContentLength64 = buffer.Length;
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                    else
                    {
                        LogMessage("❌ PLC'ye bağlantı kurulamadı");
                        response.StatusCode = 500;
                        var errorResult = new Dictionary<string, object>
                        {
                            ["success"] = false,
                            ["error"] = "PLC'ye bağlantı kurulamadı"
                        };
                        var errorJson = JsonSerializer.Serialize(errorResult);
                        var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                        await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    }
                    
                    tempPlcWriter.Dispose();
                }
                catch (Exception ex)
                {
                    LogMessage($"❌ PLC yazma hatası: {ex.Message}");
                    response.StatusCode = 500;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = $"PLC yazma hatası: {ex.Message}"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ HandleJobWriteRequest hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleJobEndRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            try
            {
                LogMessage("📊 İş sonu işlemi başladı");
                LogMessage($"📥 Request body: {requestBody}");
                response.ContentType = "application/json";
                
                var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                
                if (requestData == null)
                {
                    LogMessage("❌ Geçersiz JSON verisi");
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "Geçersiz JSON verisi"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                LogMessage($"📋 Parse edilen veri: {JsonSerializer.Serialize(requestData)}");
                
                // Gerekli alanları kontrol et
                if (!requestData.ContainsKey("orderNumber") || !requestData.ContainsKey("jobStartTime") || !requestData.ContainsKey("jobEndTime"))
                {
                    LogMessage("❌ Eksik parametreler: orderNumber, jobStartTime veya jobEndTime");
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "orderNumber, jobStartTime ve jobEndTime parametreleri gerekli"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                LogMessage("✅ Gerekli parametreler mevcut");
                
                // Kendi içindeki verileri kullan
                PLCData? currentData;
                Dictionary<string, object>? currentJobData;
                
                lock (dataLock)
                {
                    currentData = lastData;
                }
                
                lock (jobDataLock)
                {
                    currentJobData = lastJobData;
                }
                
                LogMessage($"🔍 PLC verisi: {(currentData != null ? "Mevcut" : "NULL")}");
                LogMessage($"🔍 İş emri verisi: {(currentJobData != null ? "Mevcut" : "NULL")}");
                
                if (currentData == null)
                {
                    LogMessage("❌ PLC verisi bulunamadı");
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "PLC verisi bulunamadı"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                // İş emri verisi cache'de yoksa, orderNumber ile tekrar çek
                if (currentJobData == null)
                {
                    LogMessage("⚠️ İş emri verisi cache'de yok, veritabanından tekrar çekiliyor...");
                    var orderNumber = requestData["orderNumber"].ToString();
                    var jobResult = await QueryJobDataAsync(orderNumber);
                    
                    if (jobResult["success"].Equals(true))
                    {
                        currentJobData = jobResult["data"] as Dictionary<string, object>;
                        LogMessage("✅ İş emri verisi veritabanından tekrar alındı");
                    }
                    else
                    {
                        LogMessage("❌ İş emri verisi veritabanından alınamadı");
                        response.StatusCode = 400;
                        var errorResult = new Dictionary<string, object>
                        {
                            ["success"] = false,
                            ["error"] = "İş emri verisi bulunamadı"
                        };
                        var errorJson = JsonSerializer.Serialize(errorResult);
                        var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                        await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                        return;
                    }
                }
                
                LogMessage("✅ Veriler mevcut, raporlama verileri hazırlanıyor");
                
                var activeCycle = await GetActiveJobCycleRecordAsync();
                
                // totalEnergyKwh değerlerini al
                double totalEnergyKwhStart = 0.0;
                double totalEnergyKwhEnd = 0.0;
                DateTime jobStartTime = DateTime.Now;
                
                if (activeCycle != null && activeCycle.TryGetValue("cycle_start_time", out var cycleStartObj) && cycleStartObj is DateTime cycleStartTime)
                {
                    jobStartTime = cycleStartTime;
                }
                else if (requestData.ContainsKey("jobStartTime"))
                {
                    jobStartTime = DateTime.Parse(requestData["jobStartTime"].ToString());
                }
                
                // Başlangıç değerini cache'den veya aktif kayıttan al
                if (currentJobData.ContainsKey("totalEnergyKwhStart"))
                {
                    var cacheValue = Convert.ToDouble(currentJobData["totalEnergyKwhStart"]);
                    if (cacheValue > 0.0)
                    {
                        totalEnergyKwhStart = cacheValue;
                        LogMessage($"✅ totalEnergyKwhStart cache'den alındı: {totalEnergyKwhStart:F2} kWh");
                    }
                }
                
                // Eğer başlangıç değeri hala 0 ise, initial_snapshot'tan almayı dene
                if (totalEnergyKwhStart == 0.0 && activeCycle != null && activeCycle.TryGetValue("initial_snapshot", out var initialSnapshotStr) && initialSnapshotStr != null)
                {
                    try
                    {
                        var initialSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(initialSnapshotStr.ToString() ?? "{}");
                        if (initialSnapshot != null)
                        {
                            // TotalEnergy, totalEnergyKwh veya TotalEnergyKwh key'lerini dene
                            if (initialSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyObj);
                                LogMessage($"✅ totalEnergyKwhStart initial_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                            else if (initialSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyKwhObj);
                                LogMessage($"✅ totalEnergyKwhStart initial_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                            else if (initialSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                            {
                                totalEnergyKwhStart = ToDouble(totalEnergyKwhObj2);
                                LogMessage($"✅ totalEnergyKwhStart initial_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhStart:F2} kWh");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"⚠️ initial_snapshot parse hatası: {ex.Message}");
                    }
                }
                
                // Son değeri PLC'den al - önce farklı key'leri dene
                if (currentData != null)
                {
                    if (currentData.Data.TryGetValue("TotalEnergy", out var rawEnergyEnd2))
                    {
                        var energyValue = ToDouble(rawEnergyEnd2);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            LogMessage($"✅ totalEnergyKwhEnd PLC'den (TotalEnergy) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                    else if (currentData.Data.TryGetValue("totalEnergyKwh", out var rawEnergyEnd))
                    {
                        var energyValue = ToDouble(rawEnergyEnd);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            LogMessage($"✅ totalEnergyKwhEnd PLC'den (totalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                    else if (currentData.Data.TryGetValue("TotalEnergyKwh", out var rawEnergyEnd3))
                    {
                        var energyValue = ToDouble(rawEnergyEnd3);
                        if (energyValue > 0.0)
                        {
                            totalEnergyKwhEnd = energyValue;
                            LogMessage($"✅ totalEnergyKwhEnd PLC'den (TotalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                        }
                    }
                }
                
                // Eğer son değer hala 0 ise ve final_snapshot varsa, ondan almayı dene
                if (totalEnergyKwhEnd == 0.0 && activeCycle != null && activeCycle.TryGetValue("final_snapshot", out var finalSnapshotStr) && finalSnapshotStr != null)
                {
                    try
                    {
                        var finalSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(finalSnapshotStr.ToString() ?? "{}");
                        if (finalSnapshot != null)
                        {
                            // TotalEnergy, totalEnergyKwh veya TotalEnergyKwh key'lerini dene
                            if (finalSnapshot.TryGetValue("TotalEnergy", out var totalEnergyObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyObj);
                                LogMessage($"✅ totalEnergyKwhEnd final_snapshot'tan (TotalEnergy) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("totalEnergyKwh", out var totalEnergyKwhObj))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj);
                                LogMessage($"✅ totalEnergyKwhEnd final_snapshot'tan (totalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                            else if (finalSnapshot.TryGetValue("TotalEnergyKwh", out var totalEnergyKwhObj2))
                            {
                                totalEnergyKwhEnd = ToDouble(totalEnergyKwhObj2);
                                LogMessage($"✅ totalEnergyKwhEnd final_snapshot'tan (TotalEnergyKwh) alındı: {totalEnergyKwhEnd:F2} kWh");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"⚠️ final_snapshot parse hatası: {ex.Message}");
                    }
                }
                
                // Enerji tüketimini hesapla (final - initial)
                double energyConsumptionKwh = 0.0;
                if (totalEnergyKwhEnd > 0.0 && totalEnergyKwhStart > 0.0)
                {
                    energyConsumptionKwh = totalEnergyKwhEnd - totalEnergyKwhStart;
                    LogMessage($"✅ Enerji tüketimi hesaplandı: {energyConsumptionKwh:F2} kWh (Final: {totalEnergyKwhEnd:F2} - Initial: {totalEnergyKwhStart:F2})");
                }
                else
                {
                    LogMessage($"⚠️ Enerji tüketimi hesaplanamadı - Start: {totalEnergyKwhStart:F2}, End: {totalEnergyKwhEnd:F2}");
                }
                
                // Raporlama verilerini hazırla
                var reportData = new Dictionary<string, object>
                {
                    // İş emri bilgileri
                    ["siparis_no"] = currentJobData["siparis_no"],
                    ["toplam_miktar"] = currentJobData["toplam_miktar"],
                    ["kalan_miktar"] = currentJobData["kalan_miktar"],
                    ["set_sayisi"] = currentJobData["set_sayisi"],
                    ["uretim_tipi"] = currentJobData["uretim_tipi"],
                    ["stok_adi"] = currentJobData["stok_adi"],
                    ["bundle"] = currentJobData["bundle"],
                    ["silindir_cevresi"] = currentJobData["silindir_cevresi"],
                    ["hedef_hiz"] = currentJobData["hedef_hiz"],
                    
                    // Üretim verileri (PLC'den)
                    ["ethylAlcoholConsumption"] = currentData.ethylAlcoholConsumption,
                    ["ethylAcetateConsumption"] = currentData.ethylAcetateConsumption,
                    ["paperConsumption"] = currentData.paperConsumption,
                    ["actualProduction"] = currentData.actualProduction,
                    ["remainingWork"] = currentData.remainingWork,
                    ["wastageBeforeDie"] = currentData.wastageBeforeDie,
                    ["wastageAfterDie"] = currentData.wastageAfterDie,
                    ["wastageRatio"] = currentData.wastageRatio,
                    ["totalStoppageDuration"] = currentData.totalStoppageDuration,
                    ["overProduction"] = currentData.overProduction,
                    ["completionPercentage"] = currentData.completionPercentage,
                    
                    // Enerji bilgileri
                    ["energyConsumptionKwh"] = energyConsumptionKwh,
                    
                    // Zaman bilgileri
                    ["jobStartTime"] = jobStartTime,
                    ["jobEndTime"] = requestData["jobEndTime"]
                };
                
                // Veritabanına kaydet
                LogMessage("💾 Veritabanına kaydediliyor...");
                var success = await SaveJobEndReportAsync(reportData);
                
                if (success)
                {
                    LogMessage("✅ Veritabanına kayıt başarılı");
                    
                    // PLC'ye reset sinyali gönder - Manuel bağlantı ile
                    try
                    {
                        var tempPlcWriter = new PLCWriter();
                        var connectResult = await tempPlcWriter.ConnectAsync();
                        
                        if (connectResult)
                        {
                            // GVL.g_Coils[0] = true (reset sinyali) - Coil yazma
                            await tempPlcWriter.WriteCoilAsync(0, true); // Coil 0'a true yaz (reset sinyali)
                            LogMessage("✅ PLC'ye reset sinyali gönderildi (GVL.g_Coils[0])");
                            
                            // 5 saniye bekle ve reset sinyalini kapat
                            await Task.Delay(5000);
                            await tempPlcWriter.WriteCoilAsync(0, false); // Coil 0'a false yaz (reset sinyali kapat)
                            LogMessage("✅ PLC reset sinyali kapatıldı");
                            
                            tempPlcWriter.Disconnect();
                        }
                        else
                        {
                            LogMessage("❌ PLC'ye bağlantı kurulamadı, reset sinyali gönderilemedi");
                        }
                        
                        tempPlcWriter.Dispose();
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"❌ PLC reset sinyali gönderme hatası: {ex.Message}");
                    }
                    
                    var result = new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["message"] = "İş sonu raporu başarıyla kaydedildi ve PLC'ye reset sinyali gönderildi"
                    };
                    
                    var json = JsonSerializer.Serialize(result);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    
                    response.ContentType = "application/json";
                    response.ContentLength64 = buffer.Length;
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else
                {
                    response.StatusCode = 500;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "İş sonu raporu kaydedilemedi"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ İş sonu işlemi hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleJobEndReportRequest(HttpListenerRequest request, HttpListenerResponse response, string requestBody)
        {
            try
            {
                LogMessage("📊 İş sonu raporu kaydı başladı");
                response.ContentType = "application/json";
                
                var requestData = JsonSerializer.Deserialize<Dictionary<string, object>>(requestBody);
                
                if (requestData == null)
                {
                    response.StatusCode = 400;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = "Geçersiz JSON verisi"
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                    return;
                }
                
                // Gerekli alanları kontrol et
                var requiredFields = new[] { "siparis_no", "toplam_miktar", "kalan_miktar", "set_sayisi", 
                                          "uretim_tipi", "stok_adi", "bundle", "silindir_cevresi", "hedef_hiz",
                                          "ethylAlcoholConsumption", "ethylAcetateConsumption", "paperConsumption",
                                          "actualProduction", "remainingWork", "wastageBeforeDie", "wastageAfterDie",
                                          "wastageRatio", "totalStoppageDuration", "overProduction", "completionPercentage",
                                          "jobStartTime", "jobEndTime" };
                
                foreach (var field in requiredFields)
                {
                    if (!requestData.ContainsKey(field))
                    {
                        response.StatusCode = 400;
                        var errorResult = new Dictionary<string, object>
                        {
                            ["success"] = false,
                            ["error"] = $"Eksik alan: {field}"
                        };
                        var errorJson = JsonSerializer.Serialize(errorResult);
                        var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                        await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                        return;
                    }
                }
                
                // Veritabanına kaydet
                var success = await SaveJobEndReportAsync(requestData);
                
                if (success)
                {
                    // PLC verilerini al
                    PLCData? currentData;
                    lock (dataLock)
                    {
                        currentData = lastData;
                    }
                    
                    // totalEnergyKwhEnd değerini requestData'dan veya PLC'den al
                    double totalEnergyKwhEnd = 0.0;
                    if (requestData.ContainsKey("totalEnergyKwhEnd"))
                    {
                        totalEnergyKwhEnd = Convert.ToDouble(requestData["totalEnergyKwhEnd"]);
                    }
                    else if (currentData != null && currentData.Data.TryGetValue("totalEnergyKwh", out var rawEnergyEnd))
                    {
                        totalEnergyKwhEnd = ToDouble(rawEnergyEnd);
                    }
                    
                    var jobEndTimeRequested = GetDateTime(requestData, "jobEndTime", DateTime.Now);
                    
                    // İş bitiş zamanında aktif duruş kaydını yeni iş döngüsüne aktar (eğer varsa)
                    // İş sonu zamanı = duruş başlangıcı - 1 saniye
                    // Yeni iş başlangıcı = duruş başlangıcı
                    DateTime actualJobEndTime = jobEndTimeRequested;
                    DateTime? newJobStartTime = null;
                    
                    if (dataProcessor != null)
                    {
                        var transferResult = await dataProcessor.ForceTransferStoppageToNewJobAsync(jobEndTimeRequested, "JobEnd");
                        if (transferResult.actualJobEndTime.HasValue)
                        {
                            actualJobEndTime = transferResult.actualJobEndTime.Value;
                            newJobStartTime = transferResult.newJobStartTime;
                            LogMessage($"🔄 İş bitiş zamanında aktif duruş kaydı yeni iş döngüsüne aktarıldı: İş sonu={actualJobEndTime:HH:mm:ss}, Yeni iş başlangıcı={newJobStartTime.Value:HH:mm:ss}");
                        }
                    }
                    
                    await CompleteActiveJobCycleAsync(actualJobEndTime, currentData);
                    
                    // PLC'ye reset sinyali gönder - Manuel bağlantı ile
                    try
                    {
                        var tempPlcWriter = new PLCWriter();
                        var connectResult = await tempPlcWriter.ConnectAsync();
                        
                        if (connectResult)
                        {
                            // GVL.g_Coils[0] = true (reset sinyali) - Coil yazma
                            await tempPlcWriter.WriteCoilAsync(0, true); // Coil 0'a true yaz (reset sinyali)
                            LogMessage("✅ PLC'ye reset sinyali gönderildi (GVL.g_Coils[0])");
                            
                            // 5 saniye bekle ve reset sinyalini kapat
                            await Task.Delay(5000);
                            await tempPlcWriter.WriteCoilAsync(0, false); // Coil 0'a false yaz (reset sinyali kapat)
                            LogMessage("✅ PLC reset sinyali kapatıldı");
                            
                            tempPlcWriter.Disconnect();
                            
                            // Reset tamamlandıktan sonra yeni JobCycle kaydı oluştur
                            await Task.Delay(500);
                            double nextCycleEnergyStart = 0.0;
                            PLCData? postResetSnapshot;
                            lock (dataLock)
                            {
                                postResetSnapshot = lastData?.Clone();
                                if (postResetSnapshot != null && postResetSnapshot.Data.TryGetValue("totalEnergyKwh", out var rawStart))
                                {
                                    nextCycleEnergyStart = ToDouble(rawStart);
                                }
                            }
                            
                            if (nextCycleEnergyStart <= 0)
                            {
                                nextCycleEnergyStart = Math.Max(0, totalEnergyKwhEnd);
                            }
                            
                            // Eğer duruş varsa, yeni iş başlangıcı = duruş başlangıcı
                            DateTime? newCycleStartTimeForJob2 = null;
                            if (newJobStartTime.HasValue)
                            {
                                newCycleStartTimeForJob2 = newJobStartTime.Value;
                                LogMessage($"📅 Yeni JobCycle başlangıcı duruş başlangıcına göre ayarlandı: {newCycleStartTimeForJob2.Value:HH:mm:ss}");
                            }
                            
                            await CreateJobCycleRecordAsync(postResetSnapshot ?? currentData, newCycleStartTimeForJob2);
                        }
                        else
                        {
                            LogMessage("❌ PLC'ye bağlantı kurulamadı, reset sinyali gönderilemedi");
                        }
                        
                        tempPlcWriter.Dispose();
                    }
                    catch (Exception ex)
                    {
                        LogMessage($"❌ PLC reset sinyali gönderme hatası: {ex.Message}");
                    }
                    
                    var result = new Dictionary<string, object>
                    {
                        ["success"] = true,
                        ["message"] = "İş sonu raporu başarıyla kaydedildi ve PLC'ye reset sinyali gönderildi"
                    };
                    
                    var json = JsonSerializer.Serialize(result);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    
                    response.ContentType = "application/json";
                    response.ContentLength64 = buffer.Length;
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else
                {
                    response.StatusCode = 500;
                    var errorResult = new Dictionary<string, object>
                    {
                        ["success"] = false,
                        ["error"] = string.IsNullOrEmpty(LastJobEndReportError) ? "İş sonu raporu kaydedilemedi" : LastJobEndReportError
                    };
                    var errorJson = JsonSerializer.Serialize(errorResult);
                    var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                    await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ İş sonu raporu kaydetme hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }
        
        private async Task<bool> SaveJobEndReportAsync(Dictionary<string, object> reportData)
        {
            try
            {
                lock (jobDataLock)
                {
                    lastJobEndReportError = null;
                }
                LogMessage($"🔌 Veritabanına bağlanılıyor: {connectionString}");
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                LogMessage("✅ Veritabanı bağlantısı başarılı");
                await EnsureJobEndReportsTableAsync(conn);
                
                var query = @"
                    INSERT INTO JobEndReports (
                        siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi, bundle,
                        silindir_cevresi, hedef_hiz, setup, qualified_bundle, defective_bundle, good_pallets, defective_pallets,
                        ethyl_alcohol_consumption, ethyl_acetate_consumption,
                        paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                        wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                        energy_consumption_kwh, job_start_time, job_end_time, created_at
                    ) VALUES (
                        @siparis_no, @toplam_miktar, @kalan_miktar, @set_sayisi, @uretim_tipi, @stok_adi, @bundle,
                        @silindir_cevresi, @hedef_hiz, @setup, @qualified_bundle, @defective_bundle, @good_pallets, @defective_pallets,
                        @ethyl_alcohol_consumption, @ethyl_acetate_consumption,
                        @paper_consumption, @actual_production, @remaining_work, @wastage_before_die, @wastage_after_die,
                        @wastage_ratio, @total_stoppage_duration, @over_production, @completion_percentage,
                        @energy_consumption_kwh, @job_start_time, @job_end_time, @created_at
                    )";
                
                using var cmd = new SqlCommand(query, conn);
                
                // Parametreleri ekle - JsonElement tipini güvenli şekilde dönüştür
                cmd.Parameters.AddWithValue("@siparis_no", GetString(reportData, "siparis_no"));
                cmd.Parameters.AddWithValue("@toplam_miktar", GetDecimal(reportData, "toplam_miktar"));
                cmd.Parameters.AddWithValue("@kalan_miktar", GetDecimal(reportData, "kalan_miktar"));
                cmd.Parameters.AddWithValue("@set_sayisi", GetInt(reportData, "set_sayisi"));
                cmd.Parameters.AddWithValue("@uretim_tipi", GetString(reportData, "uretim_tipi"));
                cmd.Parameters.AddWithValue("@stok_adi", GetString(reportData, "stok_adi"));
                cmd.Parameters.AddWithValue("@bundle", GetString(reportData, "bundle"));
                cmd.Parameters.AddWithValue("@silindir_cevresi", GetString(reportData, "silindir_cevresi"));
                cmd.Parameters.AddWithValue("@hedef_hiz", GetInt(reportData, "hedef_hiz"));
                cmd.Parameters.AddWithValue("@setup", GetDecimal(reportData, "setup"));
                cmd.Parameters.AddWithValue("@qualified_bundle", GetInt(reportData, "qualifiedBundle"));
                cmd.Parameters.AddWithValue("@defective_bundle", GetInt(reportData, "defectiveBundle"));
                cmd.Parameters.AddWithValue("@good_pallets", GetInt(reportData, "goodPallets"));
                cmd.Parameters.AddWithValue("@defective_pallets", GetInt(reportData, "defectivePallets"));
                cmd.Parameters.AddWithValue("@ethyl_alcohol_consumption", GetDecimal(reportData, "ethylAlcoholConsumption"));
                cmd.Parameters.AddWithValue("@ethyl_acetate_consumption", GetDecimal(reportData, "ethylAcetateConsumption"));
                cmd.Parameters.AddWithValue("@paper_consumption", GetDecimal(reportData, "paperConsumption"));
                cmd.Parameters.AddWithValue("@actual_production", GetInt(reportData, "actualProduction"));
                cmd.Parameters.AddWithValue("@remaining_work", GetInt(reportData, "remainingWork"));
                cmd.Parameters.AddWithValue("@wastage_before_die", GetDecimal(reportData, "wastageBeforeDie"));
                cmd.Parameters.AddWithValue("@wastage_after_die", GetDecimal(reportData, "wastageAfterDie"));
                cmd.Parameters.AddWithValue("@wastage_ratio", GetDecimal(reportData, "wastageRatio"));
                cmd.Parameters.AddWithValue("@total_stoppage_duration", GetDecimal(reportData, "totalStoppageDuration"));
                cmd.Parameters.AddWithValue("@over_production", GetInt(reportData, "overProduction"));
                cmd.Parameters.AddWithValue("@completion_percentage", GetDecimal(reportData, "completionPercentage"));
                cmd.Parameters.AddWithValue("@energy_consumption_kwh", GetDecimal(reportData, "energyConsumptionKwh"));
                
                cmd.Parameters.AddWithValue("@job_start_time", GetDateTime(reportData, "jobStartTime", DateTime.UtcNow));
                cmd.Parameters.AddWithValue("@job_end_time", GetDateTime(reportData, "jobEndTime", DateTime.UtcNow));
                cmd.Parameters.AddWithValue("@created_at", DateTime.Now);
                
                LogMessage("📝 SQL sorgusu çalıştırılıyor...");
                var rowsAffected = await cmd.ExecuteNonQueryAsync();
                LogMessage($"📊 Etkilenen satır sayısı: {rowsAffected}");
                
                if (rowsAffected > 0)
                {
                    LogMessage("✅ İş sonu raporu veritabanına kaydedildi");
                    
                    // Yeni rapor bildirimi gönder
                    await SendNewReportNotificationAsync(reportData);
                    
                    return true;
                }
                else
                {
                    var message = "İş sonu raporu kaydedilemedi: INSERT işlemi herhangi bir satırı etkilemedi";
                    LogMessage($"❌ {message}");
                    lock (jobDataLock)
                    {
                        lastJobEndReportError = message;
                    }
                    return false;
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ Veritabanı kaydetme hatası: {ex.Message}");
                lock (jobDataLock)
                {
                    lastJobEndReportError = ex.Message;
                }
                return false;
            }
        }

        private async Task<int> CreateJobCycleRecordAsync(PLCData snapshot, DateTime? cycleStartTime = null)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureJobCycleRecordsTableAsync(conn);

                // 1) Eğer zaten 'active' status'lü bir kayıt varsa YENİSİNİ OLUŞTURMA, onu kullan
                var checkActiveQuery = @"
                    SELECT TOP 1 id 
                    FROM JobCycleRecords
                    WHERE status = 'active'
                    ORDER BY cycle_start_time DESC";

                using (var checkCmd = new SqlCommand(checkActiveQuery, conn))
                {
                    var existingId = await checkCmd.ExecuteScalarAsync();
                    if (existingId != null && existingId != DBNull.Value)
                    {
                        var activeId = Convert.ToInt32(existingId);
                        LogMessage($"ℹ️ Zaten aktif JobCycle kaydı var, yenisi oluşturulmadı (ID: {activeId})");
                        return activeId;
                    }
                }

                // 2) Aktif kayıt yoksa yeni JobCycle kaydı oluştur
                // Eğer cycleStartTime belirtilmişse (duruş varsa), onu kullan
                // Yoksa şu anki zamanı kullan
                var actualCycleStartTime = cycleStartTime ?? DateTime.Now;
                
                var insertQuery = @"
                    INSERT INTO JobCycleRecords (
                        status,
                        cycle_start_time,
                        initial_snapshot,
                        created_at,
                        updated_at
                    ) OUTPUT INSERTED.id
                    VALUES (
                        'active',
                        @cycle_start_time,
                        @initial_snapshot,
                        @created_at,
                        @updated_at
                    )";
                
                using var cmd = new SqlCommand(insertQuery, conn);
                cmd.Parameters.AddWithValue("@cycle_start_time", actualCycleStartTime);
                cmd.Parameters.AddWithValue("@initial_snapshot", JsonSerializer.Serialize(snapshot?.Data ?? new Dictionary<string, object>()));
                cmd.Parameters.AddWithValue("@created_at", DateTime.Now);
                cmd.Parameters.AddWithValue("@updated_at", DateTime.Now);
                
                var insertedId = await cmd.ExecuteScalarAsync();
                return insertedId != null ? Convert.ToInt32(insertedId) : 0;
            }
            catch (Exception ex)
            {
                LogMessage($"❌ JobCycleRecord oluşturma hatası: {ex.Message}");
                return 0;
            }
        }
        
        public async Task<Dictionary<string, object>?> GetActiveJobCycleRecordAsync()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureJobCycleRecordsTableAsync(conn);
                
                var query = @"
                    SELECT TOP 1 *
                    FROM JobCycleRecords
                    WHERE status = 'active'
                    ORDER BY cycle_start_time DESC";
                
                using var cmd = new SqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                if (await reader.ReadAsync())
                {
                    return new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["status"] = reader["status"].ToString() ?? "active",
                        ["cycle_start_time"] = reader["cycle_start_time"],
                        ["cycle_end_time"] = reader["cycle_end_time"],
                        ["siparis_no"] = reader["siparis_no"],
                        ["job_info"] = reader["job_info"]?.ToString(),
                        ["initial_snapshot"] = reader["initial_snapshot"]?.ToString(),
                        ["final_snapshot"] = reader["final_snapshot"]?.ToString(),
                        ["created_at"] = reader["created_at"],
                        ["updated_at"] = reader["updated_at"]
                    };
                }
                
                return null;
            }
            catch (Exception ex)
            {
                LogMessage($"❌ Aktif JobCycleRecord okuma hatası: {ex.Message}");
                return null;
            }
        }

        private async Task<Dictionary<string, object>?> GetJobCycleRecordByOrderNumberAsync(string orderNumber)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureJobCycleRecordsTableAsync(conn);
                
                var query = @"
                    SELECT TOP 1 *
                    FROM JobCycleRecords
                    WHERE siparis_no = @siparis_no
                    ORDER BY cycle_start_time DESC";
                
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@siparis_no", orderNumber);
                using var reader = await cmd.ExecuteReaderAsync();
                
                if (await reader.ReadAsync())
                {
                    return new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["status"] = reader["status"].ToString() ?? "",
                        ["cycle_start_time"] = reader["cycle_start_time"],
                        ["cycle_end_time"] = reader["cycle_end_time"],
                        ["siparis_no"] = reader["siparis_no"],
                        ["job_info"] = reader["job_info"]?.ToString(),
                        ["initial_snapshot"] = reader["initial_snapshot"]?.ToString(),
                        ["final_snapshot"] = reader["final_snapshot"]?.ToString(),
                        ["created_at"] = reader["created_at"],
                        ["updated_at"] = reader["updated_at"]
                    };
                }
                
                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [GetJobCycleRecordByOrderNumberAsync] JobCycleRecord okuma hatası: {ex.Message}");
                return null;
            }
        }
        
        private async Task<bool> UpdateActiveJobCycleWithOrderAsync(Dictionary<string, object> orderData)
        {
            try
            {
                var orderNumber = "";
                if (orderData.ContainsKey("siparis_no"))
                {
                    orderNumber = orderData["siparis_no"]?.ToString() ?? "";
                }
                else if (orderData.ContainsKey("orderNumber"))
                {
                    orderNumber = orderData["orderNumber"]?.ToString() ?? "";
                }
                LogMessage($"📝 JobCycleRecord güncelleniyor - Sipariş: {orderNumber}");
                
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureJobCycleRecordsTableAsync(conn);
                
                var query = @"
                    UPDATE JobCycleRecords
                    SET 
                        siparis_no = @siparis_no,
                        job_info = @job_info,
                        updated_at = @updated_at
                    WHERE id = (
                        SELECT TOP 1 id FROM JobCycleRecords 
                        WHERE status = 'active'
                        ORDER BY cycle_start_time DESC
                    )";
                
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@siparis_no", orderNumber);
                var jobInfoJson = JsonSerializer.Serialize(orderData);
                cmd.Parameters.AddWithValue("@job_info", jobInfoJson);
                cmd.Parameters.AddWithValue("@updated_at", DateTime.Now);
                
                LogMessage($"📝 SQL sorgusu çalıştırılıyor - Sipariş: {orderNumber}");
                var rows = await cmd.ExecuteNonQueryAsync();
                LogMessage($"📊 Etkilenen satır sayısı: {rows}");
                
                if (rows > 0)
                {
                    LogMessage($"✅ JobCycleRecord başarıyla güncellendi - Sipariş: {orderNumber}");
                    return true;
                }
                else
                {
                    LogMessage($"⚠️ JobCycleRecord güncellenemedi - Aktif kayıt bulunamadı veya güncelleme yapılamadı");
                    return false;
                }
            }
            catch (Exception ex)
            {
                LogMessage($"❌ JobCycleRecord sipariş güncelleme hatası: {ex.Message}");
                LogMessage($"❌ StackTrace: {ex.StackTrace}");
                return false;
            }
        }
        
        private async Task<bool> CompleteActiveJobCycleAsync(DateTime jobEndTime, PLCData finalSnapshot)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                await EnsureJobCycleRecordsTableAsync(conn);
                
                var query = @"
                    UPDATE JobCycleRecords
                    SET 
                        status = 'completed',
                        cycle_end_time = @cycle_end_time,
                        final_snapshot = @final_snapshot,
                        updated_at = @updated_at
                    WHERE id = (
                        SELECT TOP 1 id FROM JobCycleRecords 
                        WHERE status = 'active'
                        ORDER BY cycle_start_time DESC
                    )";
                
                using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@cycle_end_time", jobEndTime);
                cmd.Parameters.AddWithValue("@final_snapshot", JsonSerializer.Serialize(finalSnapshot?.Data ?? new Dictionary<string, object>()));
                cmd.Parameters.AddWithValue("@updated_at", DateTime.Now);
                
                var rows = await cmd.ExecuteNonQueryAsync();
                return rows > 0;
            }
            catch (Exception ex)
            {
                LogMessage($"❌ JobCycleRecord tamamlama hatası: {ex.Message}");
                return false;
            }
        }
        
        private static async Task EnsureJobCycleRecordsTableAsync(SqlConnection connection)
        {
            var createTableQuery = @"
IF OBJECT_ID(N'JobCycleRecords', N'U') IS NULL
BEGIN
    CREATE TABLE JobCycleRecords (
        id INT IDENTITY(1,1) PRIMARY KEY,
        status NVARCHAR(20) NOT NULL DEFAULT 'active',
        cycle_start_time DATETIME2 NOT NULL,
        cycle_end_time DATETIME2 NULL,
        siparis_no NVARCHAR(50) NULL,
        job_info NVARCHAR(MAX) NULL,
        initial_snapshot NVARCHAR(MAX) NULL,
        final_snapshot NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_JobCycleRecords_status ON JobCycleRecords(status);
    CREATE INDEX IX_JobCycleRecords_siparis_no ON JobCycleRecords(siparis_no);
END";
            
            using var cmd = new SqlCommand(createTableQuery, connection);
            await cmd.ExecuteNonQueryAsync();
        }

        private async Task HandleGetReportsRequest(HttpListenerResponse response)
        {
            try
            {
                LogMessage("📊 Raporlar getiriliyor");
                response.ContentType = "application/json";
                
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // Son 10 iş sonu raporunu getir
                var query = @"
                    SELECT TOP 10
                        id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi,
                        bundle, silindir_cevresi, hedef_hiz, COALESCE(setup, 0) as setup, 
                        COALESCE(qualified_bundle, 0) as qualified_bundle,
                        COALESCE(defective_bundle, 0) as defective_bundle,
                        COALESCE(good_pallets, 0) as good_pallets,
                        COALESCE(defective_pallets, 0) as defective_pallets,
                        ethyl_alcohol_consumption, ethyl_acetate_consumption,
                        paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                        wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                        COALESCE(energy_consumption_kwh, 0) as energy_consumption_kwh,
                        job_start_time, job_end_time, created_at
                    FROM JobEndReports 
                    ORDER BY created_at DESC";
                
                using var cmd = new SqlCommand(query, conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                var reports = new List<Dictionary<string, object>>();
                
                while (await reader.ReadAsync())
                {
                    var report = new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["siparis_no"] = reader["siparis_no"],
                        ["toplam_miktar"] = reader["toplam_miktar"],
                        ["kalan_miktar"] = reader["kalan_miktar"],
                        ["set_sayisi"] = reader["set_sayisi"],
                        ["uretim_tipi"] = reader["uretim_tipi"],
                        ["stok_adi"] = reader["stok_adi"],
                        ["bundle"] = reader["bundle"],
                        ["silindir_cevresi"] = reader["silindir_cevresi"],
                        ["hedef_hiz"] = reader["hedef_hiz"],
                        ["setup"] = reader["setup"],
                        ["qualifiedBundle"] = reader["qualified_bundle"],
                        ["defectiveBundle"] = reader["defective_bundle"],
                        ["goodPallets"] = reader["good_pallets"],
                        ["defectivePallets"] = reader["defective_pallets"],
                        ["ethylAlcoholConsumption"] = reader["ethyl_alcohol_consumption"],
                        ["ethylAcetateConsumption"] = reader["ethyl_acetate_consumption"],
                        ["paperConsumption"] = reader["paper_consumption"],
                        ["actualProduction"] = reader["actual_production"],
                        ["remainingWork"] = reader["remaining_work"],
                        ["wastageBeforeDie"] = reader["wastage_before_die"],
                        ["wastageAfterDie"] = reader["wastage_after_die"],
                        ["wastageRatio"] = reader["wastage_ratio"],
                        ["totalStoppageDuration"] = reader["total_stoppage_duration"],
                        ["overProduction"] = reader["over_production"],
                        ["completionPercentage"] = reader["completion_percentage"],
                        ["energyConsumptionKwh"] = reader["energy_consumption_kwh"],
                        ["jobStartTime"] = reader["job_start_time"],
                        ["jobEndTime"] = reader["job_end_time"],
                        ["createdAt"] = reader["created_at"]
                    };
                    reports.Add(report);
                }
                
                var result = new Dictionary<string, object>
                {
                    ["success"] = true,
                    ["data"] = reports,
                    ["count"] = reports.Count
                };
                
                var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                
                LogMessage($"✅ {reports.Count} rapor getirildi");
            }
            catch (Exception ex)
            {
                LogMessage($"❌ Raporlar getirme hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Raporlar getirme hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private void LogMessage(string message)
        {
            if (!EnableVerboseLogging)
            {
                if (message.Contains("❌") || message.Contains("⚠️"))
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {message}");
                }
                return;
            }

            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {message}");
        }

        private static async Task EnsureJobEndReportsTableAsync(SqlConnection connection)
        {
            var ensureSql = @"
IF OBJECT_ID(N'JobEndReports', N'U') IS NULL
BEGIN
    CREATE TABLE JobEndReports (
        id INT IDENTITY(1,1) PRIMARY KEY,
        siparis_no NVARCHAR(50) NOT NULL,
        toplam_miktar DECIMAL(18,2) NOT NULL,
        kalan_miktar DECIMAL(18,2) NOT NULL,
        set_sayisi INT NOT NULL,
        uretim_tipi NVARCHAR(50) NULL,
        stok_adi NVARCHAR(255) NULL,
        bundle NVARCHAR(100) NULL,
        silindir_cevresi NVARCHAR(100) NULL,
        hedef_hiz INT NOT NULL,
        setup DECIMAL(18,2) NULL,
        qualified_bundle INT NULL,
        defective_bundle INT NULL,
        good_pallets INT NULL,
        defective_pallets INT NULL,
        ethyl_alcohol_consumption DECIMAL(18,4) NULL,
        ethyl_acetate_consumption DECIMAL(18,4) NULL,
        paper_consumption DECIMAL(18,4) NULL,
        actual_production INT NULL,
        remaining_work INT NULL,
        wastage_before_die DECIMAL(18,4) NULL,
        wastage_after_die DECIMAL(18,4) NULL,
        wastage_ratio DECIMAL(18,4) NULL,
        total_stoppage_duration DECIMAL(18,4) NULL,
        over_production INT NULL,
        completion_percentage DECIMAL(18,4) NULL,
        energy_consumption_kwh DECIMAL(18,4) NULL,
        job_start_time DATETIME2 NOT NULL,
        job_end_time DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
ELSE IF COLUMNPROPERTY(OBJECT_ID(N'JobEndReports', N'U'), 'id', 'IsIdentity') <> 1
BEGIN
    CREATE TABLE JobEndReports_temp (
        id INT IDENTITY(1,1) PRIMARY KEY,
        siparis_no NVARCHAR(50) NOT NULL,
        toplam_miktar DECIMAL(18,2) NOT NULL,
        kalan_miktar DECIMAL(18,2) NOT NULL,
        set_sayisi INT NOT NULL,
        uretim_tipi NVARCHAR(50) NULL,
        stok_adi NVARCHAR(255) NULL,
        bundle NVARCHAR(100) NULL,
        silindir_cevresi NVARCHAR(100) NULL,
        hedef_hiz INT NOT NULL,
        setup DECIMAL(18,2) NULL,
        qualified_bundle INT NULL,
        defective_bundle INT NULL,
        good_pallets INT NULL,
        defective_pallets INT NULL,
        ethyl_alcohol_consumption DECIMAL(18,4) NULL,
        ethyl_acetate_consumption DECIMAL(18,4) NULL,
        paper_consumption DECIMAL(18,4) NULL,
        actual_production INT NULL,
        remaining_work INT NULL,
        wastage_before_die DECIMAL(18,4) NULL,
        wastage_after_die DECIMAL(18,4) NULL,
        wastage_ratio DECIMAL(18,4) NULL,
        total_stoppage_duration DECIMAL(18,4) NULL,
        over_production INT NULL,
        completion_percentage DECIMAL(18,4) NULL,
        energy_consumption_kwh DECIMAL(18,4) NULL,
        job_start_time DATETIME2 NOT NULL,
        job_end_time DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    DECLARE @hasEnergyColumns BIT = 0;
    IF COL_LENGTH('JobEndReports', 'total_energy_kwh_start') IS NOT NULL 
       AND COL_LENGTH('JobEndReports', 'total_energy_kwh_end') IS NOT NULL
    BEGIN
        SET @hasEnergyColumns = 1;
    END

    IF EXISTS (SELECT 1 FROM JobEndReports)
    BEGIN
        SET IDENTITY_INSERT JobEndReports_temp ON;
        IF (@hasEnergyColumns = 1)
        BEGIN
            -- Dynamic SQL kullan çünkü kolonlar parse aşamasında kontrol edilmeden önce hata veriyor
            DECLARE @sql NVARCHAR(MAX);
            SET @sql = N'
            INSERT INTO JobEndReports_temp (
                id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi, bundle,
                silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                energy_consumption_kwh, job_start_time, job_end_time, created_at
            )
            SELECT
                id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi, bundle,
                silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                CASE 
                    WHEN total_energy_kwh_end IS NOT NULL AND total_energy_kwh_start IS NOT NULL 
                    THEN total_energy_kwh_end - total_energy_kwh_start 
                    ELSE NULL 
                END AS energy_consumption_kwh,
                job_start_time, job_end_time, created_at
            FROM JobEndReports
            ORDER BY id;';
            EXEC sp_executesql @sql;
        END
        ELSE
        BEGIN
            INSERT INTO JobEndReports_temp (
                id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi, bundle,
                silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                energy_consumption_kwh, job_start_time, job_end_time, created_at
            )
            SELECT
                id, siparis_no, toplam_miktar, kalan_miktar, set_sayisi, uretim_tipi, stok_adi, bundle,
                silindir_cevresi, hedef_hiz, ethyl_alcohol_consumption, ethyl_acetate_consumption,
                paper_consumption, actual_production, remaining_work, wastage_before_die, wastage_after_die,
                wastage_ratio, total_stoppage_duration, over_production, completion_percentage,
                NULL AS energy_consumption_kwh,
                job_start_time, job_end_time, created_at
            FROM JobEndReports
            ORDER BY id;
        END
        SET IDENTITY_INSERT JobEndReports_temp OFF;
    END

    DROP TABLE JobEndReports;
    EXEC sp_rename 'JobEndReports_temp', 'JobEndReports';
END
IF COL_LENGTH('JobEndReports', 'energy_consumption_kwh') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD energy_consumption_kwh DECIMAL(18,4) NULL;
END

IF COL_LENGTH('JobEndReports', 'setup') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD setup DECIMAL(18,2) NULL;
END

IF COL_LENGTH('JobEndReports', 'qualified_bundle') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD qualified_bundle INT NULL;
END

IF COL_LENGTH('JobEndReports', 'defective_bundle') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD defective_bundle INT NULL;
END

IF COL_LENGTH('JobEndReports', 'good_pallets') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD good_pallets INT NULL;
END

IF COL_LENGTH('JobEndReports', 'defective_pallets') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD defective_pallets INT NULL;
END
-- Mevcut kayıtlar için enerji tüketimini snapshot'lardan hesaplama C# tarafında yapılacak
-- JSON_VALUE SQL Server 2016+ gerektirir, bu yüzden migration script'te kaldırıldı
";
            using var ensureCmd = new SqlCommand(ensureSql, connection);
            await ensureCmd.ExecuteNonQueryAsync();
        }

        private static string GetString(Dictionary<string, object> data, string key, string defaultValue = "")
        {
            if (!data.TryGetValue(key, out var value) || value is null)
            {
                return defaultValue;
            }

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.String)
                {
                    return jsonElement.GetString() ?? defaultValue;
                }
                return jsonElement.ToString();
            }

            return value.ToString() ?? defaultValue;
        }

        private static int GetInt(Dictionary<string, object> data, string key, int defaultValue = 0)
        {
            if (!data.TryGetValue(key, out var value) || value is null)
            {
                return defaultValue;
            }

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetInt32(out var jsonNumber))
                {
                    return jsonNumber;
                }
                if (jsonElement.ValueKind == JsonValueKind.String && int.TryParse(jsonElement.GetString(), out var parsed))
                {
                    return parsed;
                }
                return defaultValue;
            }

            if (value is int intValue)
            {
                return intValue;
            }

            if (int.TryParse(value.ToString(), out var result))
            {
                return result;
            }

            return defaultValue;
        }

        private static decimal GetDecimal(Dictionary<string, object> data, string key, decimal defaultValue = 0m)
        {
            if (!data.TryGetValue(key, out var value) || value is null)
            {
                return defaultValue;
            }

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetDecimal(out var jsonNumber))
                {
                    return jsonNumber;
                }
                if (jsonElement.ValueKind == JsonValueKind.String && decimal.TryParse(jsonElement.GetString(), out var parsed))
                {
                    return parsed;
                }
                return defaultValue;
            }

            if (value is decimal decimalValue)
            {
                return decimalValue;
            }

            if (decimal.TryParse(value.ToString(), out var result))
            {
                return result;
            }

            return defaultValue;
        }

        private static DateTime GetDateTime(Dictionary<string, object> data, string key, DateTime defaultValue)
        {
            if (!data.TryGetValue(key, out var value) || value is null)
            {
                return defaultValue;
            }

            if (value is JsonElement jsonElement)
            {
                if (jsonElement.ValueKind == JsonValueKind.String && DateTime.TryParse(jsonElement.GetString(), out var parsedJson))
                {
                    return parsedJson;
                }
                if (jsonElement.ValueKind == JsonValueKind.Number && jsonElement.TryGetInt64(out var unix))
                {
                    return DateTimeOffset.FromUnixTimeMilliseconds(unix).DateTime;
                }
                return defaultValue;
            }

            if (value is DateTime dateTimeValue)
            {
                return dateTimeValue;
            }

            if (DateTime.TryParse(value.ToString(), out var parsed))
            {
                return parsed;
            }

            return defaultValue;
        }

        private async Task HandleStoppageCategoriesRequest(HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var cmd = new SqlCommand("SELECT id, name, description FROM stoppage_categories ORDER BY id", conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                var categories = new List<Dictionary<string, object>>();
                while (await reader.ReadAsync())
                {
                    var category = new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["name"] = reader["name"],
                        ["description"] = reader["description"]
                    };
                    categories.Add(category);
                }
                
                var result = new Dictionary<string, object>
                {
                    ["success"] = true,
                    ["data"] = categories,
                    ["count"] = categories.Count
                };
                
                var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                LogMessage($"❌ HandleStoppageCategoriesRequest hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        private async Task HandleStoppageReasonsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var query = "SELECT id, category_id, name, description FROM stoppage_reasons";
                var parameters = new List<SqlParameter>();
                
                // Kategori ID'si varsa filtrele
                var categoryIdParam = request.QueryString["categoryId"];
                if (!string.IsNullOrEmpty(categoryIdParam))
                {
                    query += " WHERE category_id = @categoryId";
                    parameters.Add(new SqlParameter("@categoryId", categoryIdParam));
                }
                
                query += " ORDER BY category_id, id";
                
                var cmd = new SqlCommand(query, conn);
                foreach (var param in parameters)
                {
                    cmd.Parameters.Add(param);
                }
                
                using var reader = await cmd.ExecuteReaderAsync();
                
                var reasons = new List<Dictionary<string, object>>();
                while (await reader.ReadAsync())
                {
                    var reason = new Dictionary<string, object>
                    {
                        ["id"] = reader["id"],
                        ["categoryId"] = reader["category_id"],
                        ["name"] = reader["name"],
                        ["description"] = reader["description"]
                    };
                    reasons.Add(reason);
                }
                
                var result = new Dictionary<string, object>
                {
                    ["success"] = true,
                    ["data"] = reasons,
                    ["count"] = reasons.Count
                };
                
                var json = JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
                var buffer = Encoding.UTF8.GetBytes(json);
                
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
            catch (Exception ex)
            {
                LogMessage($"❌ HandleStoppageReasonsRequest hatası: {ex.Message}");
                response.StatusCode = 500;
                var errorResult = new Dictionary<string, object>
                {
                    ["success"] = false,
                    ["error"] = $"Sunucu hatası: {ex.Message}"
                };
                var errorJson = JsonSerializer.Serialize(errorResult);
                var errorBuffer = Encoding.UTF8.GetBytes(errorJson);
                await response.OutputStream.WriteAsync(errorBuffer, 0, errorBuffer.Length);
            }
        }

        // API handlers for PLC Config
        private async Task HandlePLCConnectionsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    var connections = await dbContext!.PLCConnections.ToListAsync();
                    var json = JsonSerializer.Serialize(connections);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "PUT")
                {
                    // URL'den ID'yi çıkar: /api/plcconfig/connections/123
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0 && int.TryParse(pathSegments[pathSegments.Length - 1], out int id))
                    {
                        Console.WriteLine($"Updating PLC connection with ID: {id}");
                        
                        // Read request body
                        using (var reader = new StreamReader(request.InputStream))
                        {
                            var json = await reader.ReadToEndAsync();
                            var updateData = JsonSerializer.Deserialize<PLCConnection>(json);
                            
                            if (updateData != null)
                            {
                                var connection = await dbContext.PLCConnections.FindAsync(id);
                                if (connection != null)
                                {
                                    connection.Name = updateData.Name;
                                    connection.IpAddress = updateData.IpAddress;
                                    connection.Port = updateData.Port;
                                    connection.ReadIntervalMs = updateData.ReadIntervalMs;
                                    connection.IsActive = updateData.IsActive;
                                    connection.UpdatedAt = DateTime.Now;
                                    
                                    await dbContext.SaveChangesAsync();
                                    
                                    Console.WriteLine($"Successfully updated PLC connection with ID: {id}");
                                    response.StatusCode = 200;
                                    var result = JsonSerializer.Serialize(new { success = true, message = "PLC bağlantısı başarıyla güncellendi" });
                                    var buffer = Encoding.UTF8.GetBytes(result);
                                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                }
                                else
                                {
                                    Console.WriteLine($"No PLC connection found with ID: {id}");
                                    response.StatusCode = 404;
                                    var result = JsonSerializer.Serialize(new { success = false, message = "PLC bağlantısı bulunamadı" });
                                    var buffer = Encoding.UTF8.GetBytes(result);
                                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                }
                            }
                            else
                            {
                                response.StatusCode = 400;
                                var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz veri" });
                                var buffer = Encoding.UTF8.GetBytes(result);
                                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                            }
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz ID" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
                else if (request.HttpMethod == "DELETE")
                {
                    // URL'den ID'yi çıkar: /api/plcconfig/connections/123
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0 && int.TryParse(pathSegments[pathSegments.Length - 1], out int id))
                    {
                        Console.WriteLine($"Deleting PLC connection with ID: {id}");
                        
                        var connection = await dbContext.PLCConnections.FindAsync(id);
                        if (connection != null)
                        {
                            dbContext.PLCConnections.Remove(connection);
                            await dbContext.SaveChangesAsync();
                            
                            Console.WriteLine($"Successfully deleted PLC connection with ID: {id}");
                            response.StatusCode = 200;
                            var result = JsonSerializer.Serialize(new { success = true, message = "PLC bağlantısı başarıyla silindi" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                        else
                        {
                            Console.WriteLine($"No PLC connection found with ID: {id}");
                            response.StatusCode = 404;
                            var result = JsonSerializer.Serialize(new { success = false, message = "PLC bağlantısı bulunamadı" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz ID" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandlePLCDataDefinitionsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    // Console.WriteLine("Loading PLC data definitions...");
                    
                    // Basit SQL sorgusu ile veri çek
                    var definitions = new List<object>();
                    
                    using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                    {
                        await connection.OpenAsync();
                        var command = new Microsoft.Data.SqlClient.SqlCommand("SELECT * FROM plc_data_definitions", connection);
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                definitions.Add(new
                                {
                                    Id = Convert.ToInt32(reader["id"]),
                                    Name = reader["name"].ToString(),
                                    Description = reader["description"] == DBNull.Value ? null : reader["description"].ToString(),
                                    DataType = reader["data_type"].ToString(),
                                    RegisterAddress = Convert.ToInt32(reader["register_address"]),
                                    RegisterCount = Convert.ToInt32(reader["register_count"]),
                                    OperationType = reader["operation_type"].ToString(),
                                    PLCConnectionId = Convert.ToInt32(reader["plc_connection_id"]),
                                    IsActive = Convert.ToBoolean(reader["is_active"]),
                                    CreatedAt = Convert.ToDateTime(reader["created_at"]),
                                    UpdatedAt = Convert.ToDateTime(reader["updated_at"]),
                                    ApiEndpoint = reader["api_endpoint"] == DBNull.Value ? "/api/data" : reader["api_endpoint"].ToString(),
                                    SaveToDatabase = reader["SaveToDatabase"] == DBNull.Value ? (int?)null : Convert.ToInt32(reader["SaveToDatabase"]),
                                    SaveTableName = reader["SaveTableName"] == DBNull.Value ? null : reader["SaveTableName"].ToString(),
                                    SaveColumnName = reader["SaveColumnName"] == DBNull.Value ? null : reader["SaveColumnName"].ToString()
                                });
                            }
                        }
                    }
                    
                    Console.WriteLine($"Found {definitions.Count} data definitions");
                    
                    var json = JsonSerializer.Serialize(definitions);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "POST")
                {
                    // Console.WriteLine("Creating new PLC data definition...");
                    
                    // Read request body
                    string json = string.Empty;
                    try
                    {
                        Console.WriteLine($"Content-Length: {request.ContentLength64}");
                        Console.WriteLine($"HasEntityBody: {request.HasEntityBody}");
                        Console.WriteLine($"ContentType: {request.ContentType}");
                        
                        if (request.HasEntityBody && request.ContentLength64 > 0)
                        {
                            using (var reader = new StreamReader(request.InputStream, Encoding.UTF8))
                            {
                                json = await reader.ReadToEndAsync();
                            }
                        }
                        else
                        {
                            Console.WriteLine("No entity body or content length is 0");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error reading request body: {ex.Message}");
                        json = string.Empty;
                    }
                    
                    Console.WriteLine($"Received JSON: {json}");
                    Console.WriteLine($"JSON length: {json.Length}");
                    
                    if (string.IsNullOrEmpty(json))
                    {
                        Console.WriteLine("JSON is empty!");
                        response.StatusCode = 400;
                        var error = JsonSerializer.Serialize(new { error = "Empty JSON body" });
                        var buffer = Encoding.UTF8.GetBytes(error);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        return;
                    }
                    
                    var newData = JsonSerializer.Deserialize<PLCDataDefinition>(json, new JsonSerializerOptions 
                    { 
                        PropertyNameCaseInsensitive = true 
                    });
                    
                    Console.WriteLine($"Deserialized data: Name={newData?.Name}, DataType={newData?.DataType}");
                        
                        if (newData != null)
                        {
                            using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                            {
                                await connection.OpenAsync();
                                var command = new Microsoft.Data.SqlClient.SqlCommand(
                                    "INSERT INTO plc_data_definitions (name, description, data_type, register_address, register_count, operation_type, plc_connection_id, is_active, api_endpoint, created_at, updated_at) VALUES (@name, @description, @data_type, @register_address, @register_count, @operation_type, @plc_connection_id, @is_active, @api_endpoint, GETDATE(), GETDATE())",
                                    connection);
                                command.Parameters.AddWithValue("@name", newData.Name);
                                command.Parameters.AddWithValue("@description", (object)newData.Description ?? DBNull.Value);
                                command.Parameters.AddWithValue("@data_type", newData.DataType);
                                command.Parameters.AddWithValue("@register_address", newData.RegisterAddress);
                                command.Parameters.AddWithValue("@register_count", newData.RegisterCount);
                                command.Parameters.AddWithValue("@operation_type", newData.OperationType);
                                command.Parameters.AddWithValue("@plc_connection_id", newData.PLCConnectionId);
                                command.Parameters.AddWithValue("@is_active", newData.IsActive);
                                command.Parameters.AddWithValue("@api_endpoint", (object)newData.ApiEndpoint ?? "/api/data");
                                
                                int rowsAffected = await command.ExecuteNonQueryAsync();
                                
                                if (rowsAffected > 0)
                                {
                                    Console.WriteLine($"Successfully created PLC data definition: {newData.Name}");
                                    response.StatusCode = 201;
                                    var result = JsonSerializer.Serialize(new { success = true, message = "Veri tanımı başarıyla eklendi" });
                                    var buffer = Encoding.UTF8.GetBytes(result);
                                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                }
                                else
                                {
                                    Console.WriteLine("Failed to create PLC data definition");
                                    response.StatusCode = 500;
                                    var result = JsonSerializer.Serialize(new { success = false, message = "Veri tanımı eklenemedi" });
                                    var buffer = Encoding.UTF8.GetBytes(result);
                                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                }
                            }
                        }
                        else
                        {
                            response.StatusCode = 400;
                            var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz veri" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                }
                else if (request.HttpMethod == "PUT")
                {
                    // URL'den ID'yi çıkar: /api/plcconfig/data-definitions/123
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0 && int.TryParse(pathSegments[pathSegments.Length - 1], out int id))
                    {
                        Console.WriteLine($"Updating PLC data definition with ID: {id}");
                        
                        using (var reader = new StreamReader(request.InputStream))
                        {
                            var json = await reader.ReadToEndAsync();
                            var updateData = JsonSerializer.Deserialize<PLCDataDefinition>(json, new JsonSerializerOptions 
                            { 
                                PropertyNameCaseInsensitive = true 
                            });
                            
                            if (updateData != null)
                            {
                                using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                                {
                                    await connection.OpenAsync();
                                    var command = new Microsoft.Data.SqlClient.SqlCommand(
                                        "UPDATE plc_data_definitions SET name = @name, description = @description, data_type = @data_type, register_address = @register_address, register_count = @register_count, operation_type = @operation_type, plc_connection_id = @plc_connection_id, is_active = @is_active, api_endpoint = @api_endpoint, updated_at = GETDATE() WHERE id = @id",
                                        connection);
                                    command.Parameters.AddWithValue("@id", id);
                                    command.Parameters.AddWithValue("@name", updateData.Name);
                                    command.Parameters.AddWithValue("@description", (object)updateData.Description ?? DBNull.Value);
                                    command.Parameters.AddWithValue("@data_type", updateData.DataType);
                                    command.Parameters.AddWithValue("@register_address", updateData.RegisterAddress);
                                    command.Parameters.AddWithValue("@register_count", updateData.RegisterCount);
                                    command.Parameters.AddWithValue("@operation_type", updateData.OperationType);
                                    command.Parameters.AddWithValue("@plc_connection_id", updateData.PLCConnectionId);
                                    command.Parameters.AddWithValue("@is_active", updateData.IsActive);
                                    command.Parameters.AddWithValue("@api_endpoint", (object)updateData.ApiEndpoint ?? "/api/data");
                                    
                                    int rowsAffected = await command.ExecuteNonQueryAsync();
                                    
                                    if (rowsAffected > 0)
                                    {
                                        Console.WriteLine($"Successfully updated PLC data definition: {updateData.Name}");
                                        response.StatusCode = 200;
                                        var result = JsonSerializer.Serialize(new { success = true, message = "Veri tanımı başarıyla güncellendi" });
                                        var buffer = Encoding.UTF8.GetBytes(result);
                                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                    }
                                    else
                                    {
                                        Console.WriteLine("Failed to update PLC data definition - no rows affected");
                                        response.StatusCode = 404;
                                        var result = JsonSerializer.Serialize(new { success = false, message = "Veri tanımı bulunamadı" });
                                        var buffer = Encoding.UTF8.GetBytes(result);
                                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                                    }
                                }
                            }
                            else
                            {
                                response.StatusCode = 400;
                                var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz veri" });
                                var buffer = Encoding.UTF8.GetBytes(result);
                                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                            }
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz ID" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
                else if (request.HttpMethod == "DELETE")
                {
                    // URL'den ID'yi çıkar: /api/plcconfig/data-definitions/123
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0 && int.TryParse(pathSegments[pathSegments.Length - 1], out int id))
                    {
                        Console.WriteLine($"Deleting PLC data definition with ID: {id}");
                        
                        using (var connection = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;"))
                        {
                            await connection.OpenAsync();
                            var command = new Microsoft.Data.SqlClient.SqlCommand("DELETE FROM plc_data_definitions WHERE id = @id", connection);
                            command.Parameters.AddWithValue("@id", id);
                            
                            int rowsAffected = await command.ExecuteNonQueryAsync();
                            
                            if (rowsAffected > 0)
                            {
                                Console.WriteLine($"Successfully deleted PLC data definition with ID: {id}");
                                response.StatusCode = 200;
                                var result = JsonSerializer.Serialize(new { success = true, message = "Veri tanımı başarıyla silindi" });
                                var buffer = Encoding.UTF8.GetBytes(result);
                                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                            }
                            else
                            {
                                Console.WriteLine($"No PLC data definition found with ID: {id}");
                                response.StatusCode = 404;
                                var result = JsonSerializer.Serialize(new { success = false, message = "Veri tanımı bulunamadı" });
                                var buffer = Encoding.UTF8.GetBytes(result);
                                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                            }
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz ID" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in HandlePLCDataDefinitionsRequest: {ex.Message}");
                Console.WriteLine($"Stack trace: {ex.StackTrace}");
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message, stackTrace = ex.StackTrace });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandleSQLConnectionsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    var connections = await dbContext!.SQLConnections.ToListAsync();
                    var json = JsonSerializer.Serialize(connections);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "DELETE")
                {
                    // URL'den ID'yi çıkar: /api/plcconfig/sql-connections/123
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0 && int.TryParse(pathSegments[pathSegments.Length - 1], out int id))
                    {
                        Console.WriteLine($"Deleting SQL connection with ID: {id}");
                        
                        var connection = await dbContext.SQLConnections.FindAsync(id);
                        if (connection != null)
                        {
                            dbContext.SQLConnections.Remove(connection);
                            await dbContext.SaveChangesAsync();
                            
                            Console.WriteLine($"Successfully deleted SQL connection with ID: {id}");
                            response.StatusCode = 200;
                            var result = JsonSerializer.Serialize(new { success = true, message = "SQL bağlantısı başarıyla silindi" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                        else
                        {
                            Console.WriteLine($"No SQL connection found with ID: {id}");
                            response.StatusCode = 404;
                            var result = JsonSerializer.Serialize(new { success = false, message = "SQL bağlantısı bulunamadı" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz ID" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandleAPISettingsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    var settings = await dbContext!.APISettings.ToListAsync();
                    var json = JsonSerializer.Serialize(settings);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "DELETE")
                {
                    // URL'den key'i çıkar: /api/plcconfig/api-settings/api_port
                    var pathSegments = request.Url?.AbsolutePath.Split('/');
                    if (pathSegments != null && pathSegments.Length > 0)
                    {
                        var key = pathSegments[pathSegments.Length - 1];
                        Console.WriteLine($"Deleting API setting with key: {key}");
                        
                        var setting = await dbContext.APISettings.FirstOrDefaultAsync(s => s.SettingKey == key);
                        if (setting != null)
                        {
                            dbContext.APISettings.Remove(setting);
                            await dbContext.SaveChangesAsync();
                            
                            Console.WriteLine($"Successfully deleted API setting with key: {key}");
                            response.StatusCode = 200;
                            var result = JsonSerializer.Serialize(new { success = true, message = "API ayarı başarıyla silindi" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                        else
                        {
                            Console.WriteLine($"No API setting found with key: {key}");
                            response.StatusCode = 404;
                            var result = JsonSerializer.Serialize(new { success = false, message = "API ayarı bulunamadı" });
                            var buffer = Encoding.UTF8.GetBytes(result);
                            await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        }
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var result = JsonSerializer.Serialize(new { success = false, message = "Geçersiz key" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandleSystemLogsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    var logs = await dbContext!.SystemLogs
                        .OrderByDescending(l => l.CreatedAt)
                        .Take(100)
                        .ToListAsync();
                    var json = JsonSerializer.Serialize(logs);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandleRestartRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "POST")
                {
                    var result = JsonSerializer.Serialize(new { message = "PLC Data Collector yeniden başlatma komutu gönderildi" });
                    var buffer = Encoding.UTF8.GetBytes(result);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task HandleSaveSettingsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    // Veritabanından ayarları oku
                    var settings = await LoadSaveSettingsFromDatabase();
                    var json = JsonSerializer.Serialize(settings);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "POST")
                {
                    Console.WriteLine("🔧 Save settings POST request geldi");
                    
                    // Kayıt sıklığını güncelle
                    string json = "";
                    if (request.HasEntityBody)
                    {
                        using (var reader = new StreamReader(request.InputStream, Encoding.UTF8))
                        {
                            json = await reader.ReadToEndAsync();
                        }
                        Console.WriteLine($"🔧 JSON alındı: {json}");
                    }
                    else
                    {
                        Console.WriteLine("⚠️ HasEntityBody = false");
                    }
                    
                    if (string.IsNullOrEmpty(json))
                    {
                        Console.WriteLine("❌ JSON boş");
                        response.StatusCode = 400;
                        var error = JsonSerializer.Serialize(new { error = "Empty JSON body" });
                        var buffer = Encoding.UTF8.GetBytes(error);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        return;
                    }
                    
                    var settings = JsonSerializer.Deserialize<Dictionary<string, object>>(json);
                    Console.WriteLine($"🔧 Settings deserialize edildi: {settings.Count} key");
                    
                    foreach (var key in settings.Keys)
                    {
                        Console.WriteLine($"🔧 Key: {key} = {settings[key]}");
                    }
                    
                    if (settings.ContainsKey("SaveIntervalMs"))
                    {
                        Console.WriteLine("🔧 SaveIntervalMs key bulundu, işleniyor...");
                        int newInterval;
                        try
                        {
                            // JsonElement'ı int'e çevir
                            var jsonElement = (System.Text.Json.JsonElement)settings["SaveIntervalMs"];
                            newInterval = jsonElement.GetInt32();
                            Console.WriteLine($"🔧 Yeni interval: {newInterval}ms");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"❌ JsonElement.GetInt32() hatası: {ex.Message}");
                            throw;
                        }
                        
                        // Veritabanına kaydet
                        Console.WriteLine("🔧 Veritabanına kaydediliyor...");
                        try
                        {
                            await SaveSettingToDatabase("SaveIntervalMs", newInterval.ToString());
                            Console.WriteLine("✅ Veritabanına kaydedildi");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"❌ Veritabanı hatası: {ex.Message}");
                            throw; // Exception'ı yukarı fırlat
                        }
                        
                        // DataProcessor'daki SaveIntervalMs'yi güncelle
                        if (dataProcessor != null)
                        {
                            Console.WriteLine("🔧 DataProcessor güncelleniyor...");
                            dataProcessor.UpdateSaveInterval(newInterval); // Timer'ı da yeniden başlat
                            Console.WriteLine("✅ DataProcessor güncellendi");
                        }
                        else
                        {
                            Console.WriteLine("⚠️ DataProcessor null!");
                        }
                        
                        Console.WriteLine("🔧 Response hazırlanıyor...");
                        response.StatusCode = 200;
                        var result = JsonSerializer.Serialize(new { success = true, message = $"Kayıt sıklığı {newInterval}ms olarak güncellendi" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                        Console.WriteLine("✅ Response gönderildi");
                    }
                    else
                    {
                        Console.WriteLine("❌ SaveIntervalMs key bulunamadı!");
                    }
                    
                    if (settings.ContainsKey("PLCReadIntervalMs"))
                    {
                        var jsonElement = (System.Text.Json.JsonElement)settings["PLCReadIntervalMs"];
                        var newPLCInterval = jsonElement.GetInt32();
                        
                        // Veritabanına kaydet
                        await SaveSettingToDatabase("PLCReadIntervalMs", newPLCInterval.ToString());
                        
                        // PLC Reader'daki interval'ı güncelle
                        if (plcReader != null)
                        {
                            plcReader.UpdateReadInterval(newPLCInterval);
                        }
                        
                        response.StatusCode = 200;
                        var result = JsonSerializer.Serialize(new { success = true, message = $"PLC okuma sıklığı {newPLCInterval}ms olarak güncellendi" });
                        var buffer = Encoding.UTF8.GetBytes(result);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                    else
                    {
                        response.StatusCode = 400;
                        var error = JsonSerializer.Serialize(new { error = "SaveIntervalMs parametresi gerekli" });
                        var buffer = Encoding.UTF8.GetBytes(error);
                        await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                    }
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task<Dictionary<string, object>> LoadSaveSettingsFromDatabase()
        {
            try
            {
                // Önce tabloyu oluştur
                await EnsureSaveSettingsTableExists();
                
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var cmd = new SqlCommand("SELECT SettingKey, SettingValue FROM plc_save_settings", conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                var settings = new Dictionary<string, object>();
                while (await reader.ReadAsync())
                {
                    var key = reader["SettingKey"].ToString();
                    var value = reader["SettingValue"].ToString();
                    
                    if (key == "SaveIntervalMs" || key == "PLCReadIntervalMs")
                    {
                        settings[key] = int.Parse(value);
                    }
                    else
                    {
                        settings[key] = value;
                    }
                }
                
                // Varsayılan değerler
                if (!settings.ContainsKey("SaveIntervalMs"))
                    settings["SaveIntervalMs"] = 1000;
                if (!settings.ContainsKey("PLCReadIntervalMs"))
                    settings["PLCReadIntervalMs"] = 200;
                
                return settings;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Ayarlar yüklenemedi: {ex.Message}");
                return new Dictionary<string, object>
                {
                    ["SaveIntervalMs"] = 1000,
                    ["PLCReadIntervalMs"] = 200
                };
            }
        }

        private async Task SaveSettingToDatabase(string key, string value)
        {
            try
            {
                Console.WriteLine($"🔧 SaveSettingToDatabase çağrıldı: {key} = {value}");
                await EnsureSaveSettingsTableExists();
                Console.WriteLine("✅ Tablo kontrolü tamamlandı");
                
                using var conn = new SqlConnection(connectionString);
                Console.WriteLine("🔧 Veritabanı bağlantısı açılıyor...");
                await conn.OpenAsync();
                Console.WriteLine("✅ Veritabanı bağlantısı açıldı");
                
                var cmd = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM plc_save_settings WHERE SettingKey = @key)
                        UPDATE plc_save_settings SET SettingValue = @value, UpdatedAt = GETDATE() WHERE SettingKey = @key
                    ELSE
                        INSERT INTO plc_save_settings (SettingKey, SettingValue) VALUES (@key, @value)", conn);
                
                cmd.Parameters.AddWithValue("@key", key);
                cmd.Parameters.AddWithValue("@value", value);
                
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Ayar kaydedilemedi: {ex.Message}");
            }
        }

        private async Task EnsureSaveSettingsTableExists()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // Tablo var mı kontrol et
                var checkCmd = new SqlCommand(@"
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'plc_save_settings'", conn);
                var existsResult = await checkCmd.ExecuteScalarAsync();
                var exists = Convert.ToInt32(existsResult ?? 0) > 0;
                
                if (!exists)
                {
                    // Tabloyu oluştur
                    var createCmd = new SqlCommand(@"
                        CREATE TABLE plc_save_settings (
                            Id INT IDENTITY(1,1) PRIMARY KEY,
                            SettingKey NVARCHAR(50) NOT NULL UNIQUE,
                            SettingValue NVARCHAR(100) NOT NULL,
                            Description NVARCHAR(200) NULL,
                            CreatedAt DATETIME DEFAULT GETDATE(),
                            UpdatedAt DATETIME DEFAULT GETDATE()
                        )", conn);
                    await createCmd.ExecuteNonQueryAsync();
                    
                    // Varsayılan değerleri ekle
                    var insertCmd = new SqlCommand(@"
                        INSERT INTO plc_save_settings (SettingKey, SettingValue, Description) VALUES
                        ('SaveIntervalMs', '1000', 'Veritabanına kayıt sıklığı (milisaniye)'),
                        ('PLCReadIntervalMs', '200', 'PLC''den veri okuma sıklığı (milisaniye)')", conn);
                    await insertCmd.ExecuteNonQueryAsync();
                    
                    Console.WriteLine("✅ Kayıt ayarları tablosu oluşturuldu");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Tablo oluşturulamadı: {ex.Message}");
            }
        }

        private async Task HandleSaveStatisticsRequest(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                response.ContentType = "application/json";
                
                if (request.HttpMethod == "GET")
                {
                    // Kayıt istatistiklerini al
                    var statistics = await GetSaveStatistics();
                    var json = JsonSerializer.Serialize(statistics);
                    var buffer = Encoding.UTF8.GetBytes(json);
                    await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = 500;
                var error = JsonSerializer.Serialize(new { error = ex.Message });
                var buffer = Encoding.UTF8.GetBytes(error);
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
            }
        }

        private async Task<Dictionary<string, object>> GetSaveStatistics()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var statistics = new Dictionary<string, object>();
                
                // Toplam kayıt sayısı
                var totalCmd = new SqlCommand("SELECT COUNT(*) FROM dataRecords", conn);
                var totalRecordsResult = await totalCmd.ExecuteScalarAsync();
                statistics["TotalRecords"] = Convert.ToInt32(totalRecordsResult ?? 0);
                
                // Bugünkü kayıt sayısı
                var todayCmd = new SqlCommand(@"
                    SELECT COUNT(*) FROM dataRecords 
                    WHERE CAST(kayitZamani AS DATE) = CAST(GETDATE() AS DATE)", conn);
                var todayRecordsResult = await todayCmd.ExecuteScalarAsync();
                statistics["TodayRecords"] = Convert.ToInt32(todayRecordsResult ?? 0);
                
                // Kayıt edilen veri noktaları
                var dataPointsCmd = new SqlCommand(@"
                    SELECT COUNT(*) FROM plc_data_definitions 
                    WHERE is_active = 1 AND SaveToDatabase = 1", conn);
                var dataPointsResult = await dataPointsCmd.ExecuteScalarAsync();
                statistics["SavedDataPoints"] = Convert.ToInt32(dataPointsResult ?? 0);
                
                // Son kayıt zamanı
                var lastSaveCmd = new SqlCommand(@"
                    SELECT TOP 1 kayitZamani FROM dataRecords 
                    ORDER BY kayitZamani DESC", conn);
                var lastSave = await lastSaveCmd.ExecuteScalarAsync();
                statistics["LastSaveTimestamp"] = lastSave?.ToString() ?? "Henüz kayıt yok";
                
                return statistics;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ İstatistikler alınamadı: {ex.Message}");
                return new Dictionary<string, object>
                {
                    ["TotalRecords"] = 0,
                    ["TodayRecords"] = 0,
                    ["SavedDataPoints"] = 0,
                    ["LastSaveTimestamp"] = "Hata"
                };
            }
        }
        
        /// <summary>
        /// Yeni rapor oluşturulduğunda bildirim gönder
        /// </summary>
        private async Task SendNewReportNotificationAsync(Dictionary<string, object> reportData)
        {
            try
            {
                if (serviceProvider == null) return;
                
                using var scope = serviceProvider.CreateScope();
                var customNotificationService = scope.ServiceProvider
                    .GetServices<IHostedService>()
                    .OfType<CustomNotificationService>()
                    .FirstOrDefault();
                
                if (customNotificationService != null)
                {
                    // Makine adını al (reportData'dan veya mevcut makineden)
                    string? machineName = null;
                    int? machineId = null;
                    
                    // reportData'dan makine bilgisini al
                    if (reportData.TryGetValue("machineName", out var machineNameObj))
                    {
                        machineName = machineNameObj?.ToString();
                    }
                    
                    // Makine ID'sini bul
                    if (serviceProvider != null)
                    {
                        using var dbScope = serviceProvider.CreateScope();
                        var dashboardContext = dbScope.ServiceProvider.GetRequiredService<DashboardDbContext>();
                        
                        if (!string.IsNullOrEmpty(machineName))
                        {
                            var machine = await dashboardContext.MachineLists
                                .FirstOrDefaultAsync(m => m.MachineName == machineName || m.TableName == machineName);
                            if (machine != null)
                            {
                                machineId = machine.Id;
                                machineName = machine.MachineName;
                            }
                        }
                        else
                        {
                            // Aktif makineyi al
                            var activeMachine = await dashboardContext.MachineLists
                                .FirstOrDefaultAsync(m => m.IsActive);
                            if (activeMachine != null)
                            {
                                machineId = activeMachine.Id;
                                machineName = activeMachine.MachineName;
                            }
                        }
                    }
                    
                    if (machineId.HasValue && !string.IsNullOrEmpty(machineName))
                    {
                        await customNotificationService.NotifyNewReportAsync(machineId.Value, machineName);
                    }
                }
            }
            catch (Exception ex)
            {
                LogMessage($"⚠️ Yeni rapor bildirimi gönderilemedi: {ex.Message}");
            }
        }
    }
} 