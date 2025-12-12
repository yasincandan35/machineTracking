using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using System.Linq;

namespace DashboardBackend.Services.PLC
{
    public class PLCReader : IDisposable
    {
        private TcpClient? tcpClient;
        private NetworkStream? networkStream;
        private CancellationTokenSource? cancellationTokenSource;
        private System.Threading.Timer? readTimer;
        private bool isRunning = false;

        private static readonly bool DefaultVerboseLogging = string.Equals(
            Environment.GetEnvironmentVariable("PLC_VERBOSE_LOGGING"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        private readonly bool _verboseLogging = DefaultVerboseLogging;
        private readonly Dictionary<string, DateTime> _lastLogTimes = new();
        private readonly object _logLock = new();

        // Dinamik konfigürasyon
        private PLCConnectionConfig? _currentConnection;
        private List<PLCDataDefinitionConfig> _dataDefinitions = new List<PLCDataDefinitionConfig>();
        private byte _unitId = 1;
        private string _sourceType = "ModbusTCP";
        private ushort _transactionId = 0;
        
        // Event'ler
        public event EventHandler<PLCData>? DataReceived;
        public event EventHandler<Exception>? ErrorOccurred;
        
        // Properties
        public string IpAddress { get; private set; } = "192.168.0.104";
        public int Port { get; private set; } = 502;
        public int ReadIntervalMs { get; private set; } = 5000;
        public PLCData? LastData { get; private set; }
        public bool IsConnected => tcpClient?.Connected ?? false;
        
        /// <summary>
        /// PLC okuma sıklığını güncelle
        /// </summary>
        public void UpdateReadInterval(int intervalMs)
        {
            ReadIntervalMs = intervalMs;
            // Timer'ı yeniden başlat
            if (isRunning && readTimer != null)
            {
                readTimer.Dispose();
                readTimer = new System.Threading.Timer(ReadDataCallback, null, TimeSpan.Zero, TimeSpan.FromMilliseconds(ReadIntervalMs));
            }
        }
        
        /// <summary>
        /// Veritabanından PLC okuma sıklığını yükle
        /// </summary>
        private async Task LoadReadIntervalFromDatabase()
        {
            try
            {
                using var conn = new Microsoft.Data.SqlClient.SqlConnection("Server=DESKTOP-EU021M7\\LEMANIC3;Database=SensorDB;Integrated Security=True;TrustServerCertificate=True;");
                await conn.OpenAsync();
                
                var cmd = new Microsoft.Data.SqlClient.SqlCommand("SELECT SettingValue FROM plc_save_settings WHERE SettingKey = 'PLCReadIntervalMs'", conn);
                var result = await cmd.ExecuteScalarAsync();
                
                if (result != null)
                {
                    ReadIntervalMs = int.Parse(result.ToString());
                    // Console.WriteLine($"✅ PLC okuma sıklığı yüklendi: {ReadIntervalMs}ms");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ PLC okuma sıklığı yüklenemedi: {ex.Message}");
            }
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            try
            {
                isRunning = true;
                cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                
                // PLC okuma sıklığı artık UpdateConfiguration içinde güncelleniyor
                // await LoadReadIntervalFromDatabase(); // Artık gerekli değil
                
                // PLC'ye bağlan
                await ConnectAsync();
                
                // Sürekli döngü başlat (timer yok!)
                _ = Task.Run(async () => await ReadDataLoopAsync(cancellationTokenSource.Token), cancellationTokenSource.Token);
                
                // Console.WriteLine($"✅ PLC Reader başlatıldı: {IpAddress}:{Port}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC Reader başlatma hatası ({IpAddress}:{Port}): {ex.Message}");
                ErrorOccurred?.Invoke(this, ex);
            }
        }

        public async Task StopAsync()
        {
            try
            {
                isRunning = false;
                readTimer?.Dispose();
                cancellationTokenSource?.Cancel();
                
                if (networkStream != null)
                {
                    await networkStream.DisposeAsync();
                    networkStream = null;
                }
                
                tcpClient?.Close();
                tcpClient = null;
                
                // Console.WriteLine("✅ PLC Reader durduruldu");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC Reader durdurma hatası ({IpAddress}:{Port}): {ex.Message}");
            }
        }

        private async Task ConnectAsync()
        {
            try
            {
                tcpClient = new TcpClient();
                await tcpClient.ConnectAsync(IpAddress, Port);
                networkStream = tcpClient.GetStream();
                
                // Console.WriteLine($"✅ PLC'ye bağlantı başarılı: {IpAddress}:{Port}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC bağlantı hatası ({IpAddress}:{Port}): {ex.Message}");
                throw;
            }
        }

        private async Task DisconnectFromPLCAsync()
        {
            try
            {
                networkStream?.Close();
                networkStream = null;
                tcpClient?.Close();
                tcpClient = null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC bağlantısı kesilirken hata ({IpAddress}:{Port}): {ex.Message}");
            }
        }
        
        private async Task ReadDataLoopAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && isRunning)
            {
                var cycleStartTime = DateTime.Now;
                
                try
                {
                    // Her seferinde bağlantıyı kontrol et ve gerekirse yenile
                    if (tcpClient?.Connected != true || networkStream == null)
                    {
                        Console.WriteLine($"🔌 PLC bağlantısı kopmuş ({IpAddress}:{Port}), yeniden bağlanılıyor...");
                        await DisconnectFromPLCAsync();
                        await ConnectAsync();
                        Console.WriteLine($"✅ PLC bağlantısı yenilendi ({IpAddress}:{Port})");
                    }

                    var data = await ReadPLCDataAsync();
                    if (data != null)
                    {
                        // Her veri geldiğinde UI'ı güncelle
                        LastData = data;
                        DataReceived?.Invoke(this, data);
                        
                        // Cycle time hesapla (sadece hata durumunda göster)
                        var cycleTime = DateTime.Now - cycleStartTime;
                    }
                    else
                    {
                        // PLC'den veri okunamadı, bağlantıyı yenile
                        Console.WriteLine($"❌ PLC'den veri okunamadı ({IpAddress}:{Port}), bağlantı yenileniyor...");
                        await DisconnectFromPLCAsync();
                        await Task.Delay(1000, cancellationToken); // 1 saniye bekle
                        continue; // Döngüyü tekrar başlat
                    }

                    // Admin panelden girilen PLC Okuma Sıklığı kadar bekle
                    if (ReadIntervalMs > 0)
                    {
                        await Task.Delay(ReadIntervalMs, cancellationToken);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    var cycleTime = DateTime.Now - cycleStartTime;
                    Console.WriteLine($"❌ PLC okuma hatası: {ex.Message} | Cycle: {cycleTime.TotalMilliseconds:F1}ms");
                    await Task.Delay(1000, cancellationToken); // Hata durumunda 1 saniye bekle
                }
            }
        }

        private async void ReadDataCallback(object? state)
        {
            if (!isRunning || cancellationTokenSource?.Token.IsCancellationRequested == true)
                return;
                
            try
            {
                var data = await ReadPLCDataAsync();
                if (data != null)
                {
                    LastData = data;
                    DataReceived?.Invoke(this, data);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC veri okuma hatası: {ex.Message}");
                ErrorOccurred?.Invoke(this, ex);
            }
        }

        private async Task<PLCData?> ReadPLCDataAsync()
        {
            try
            {
                if (networkStream == null) 
                {
                    Console.WriteLine("❌ NetworkStream null - PLC bağlantısı yok!");
                    ErrorOccurred?.Invoke(this, new Exception("❌ NetworkStream null"));
                    return null;
                }

                // Console.WriteLine("✅ NetworkStream var - Dinamik sistem başlatılıyor...");
                // Dinamik sistem - veritabanından gelen konfigürasyona göre
                    return await ReadPLCDataDynamicAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ ReadPLCDataAsync hatası: {ex.Message}");
                ErrorOccurred?.Invoke(this, ex);
                return null;
            }
        }

        private async Task<PLCData?> ReadPLCDataDynamicAsync()
        {
            // Console.WriteLine($"🔄 Dinamik PLC veri okuma başladı: {_dataDefinitions.Count} veri tanımı");
            var data = new PLCData { Timestamp = DateTime.Now };
            var registerCache = new Dictionary<int, ushort[]>();

            var isEnergyAnalyzer = _sourceType.Equals("EnergyAnalyzer", StringComparison.OrdinalIgnoreCase)
                || _sourceType.Equals("EnergyAnalyser", StringComparison.OrdinalIgnoreCase)
                || _sourceType.Equals("EnergyAnalizor", StringComparison.OrdinalIgnoreCase)
                || _sourceType.Equals("EnergyAnalizör", StringComparison.OrdinalIgnoreCase);

            if (isEnergyAnalyzer)
            {
                bool allEnergyReadsSucceeded = true;

                foreach (var definition in _dataDefinitions.OrderBy(d => d.RegisterAddress))
                {
                    try
                    {
                        var registers = await ReadRegistersAsync((ushort)definition.RegisterAddress, (ushort)definition.RegisterCount);
                        if (registers == null)
                        {
                            allEnergyReadsSucceeded = false;
                            break;
                        }

                        registerCache[definition.RegisterAddress] = registers;
                        SetDataFromRegisters(data, definition, registers);
                    }
                    catch (Exception ex)
                    {
                        LogThrottled($"energy_error_{definition.Name}", TimeSpan.FromSeconds(10),
                            $"❌ Enerji analizörü okuma hatası: {definition.Name} - {ex.Message}");
                        allEnergyReadsSucceeded = false;
                        break;
                    }
                }

                if (!allEnergyReadsSucceeded)
                {
                    LogThrottled("energy_partial_fail", TimeSpan.FromSeconds(10),
                        "⚠️ Enerji analizörü verileri eksik okundu, değerler güncellenmedi");
                    return null;
                }

                return data;
            }

            // Register'ları grupla (100'ün katlarına göre)
            var registerGroups = _dataDefinitions
                .GroupBy(d => (d.RegisterAddress / 100) * 100) // 200, 400, 800 gibi
                .OrderBy(g => g.Key)
                .ToList();

            // Console.WriteLine($"🔍 Register grupları: {registerGroups.Count} adet");

            // Her grup için register'ları oku
            bool allGroupsSucceeded = true;

            foreach (var group in registerGroups)
            {
                var groupStart = group.Key;
                var groupRegisters = group.OrderBy(d => d.RegisterAddress).ToList();

                // Grup içindeki register'ları tek seferde oku
                var minAddress = groupRegisters.Min(d => d.RegisterAddress);
                var maxAddress = groupRegisters.Max(d => d.RegisterAddress + d.RegisterCount - 1);
                var count = maxAddress - minAddress + 1;

                // Console.WriteLine($"📖 Grup {groupStart}: {minAddress}-{maxAddress} ({count} register)");

                try
                {
                    var registers = await ReadRegistersAsync((ushort)minAddress, (ushort)count);
                    if (registers == null)
                    {
                        LogThrottled($"group_read_fail_{groupStart}", TimeSpan.FromSeconds(10),
                            $"❌ Grup okunamadı: {groupStart}-{groupStart + count - 1}");
                        allGroupsSucceeded = false;
                        break;
                    }

                    for (int i = 0; i < groupRegisters.Count; i++)
                    {
                        var def = groupRegisters[i];
                        var offset = def.RegisterAddress - minAddress;
                        var registerData = new ushort[def.RegisterCount];
                        Array.Copy(registers, offset, registerData, 0, def.RegisterCount);
                        registerCache[def.RegisterAddress] = registerData;
                    }
                }
                catch (Exception ex)
                {
                    LogThrottled($"group_exception_{groupStart}", TimeSpan.FromSeconds(10),
                        $"❌ Grup {groupStart} hatası: {ex.Message}");
                    allGroupsSucceeded = false;
                    break;
                }
            }

            if (!allGroupsSucceeded)
            {
                LogThrottled("group_all_fail", TimeSpan.FromSeconds(10),
                    "⚠️ Tüm register grupları başarıyla okunamadı; mevcut değerler korunuyor");
                return null;
            }

            // Veri tanımlarını işle
            foreach (var definition in _dataDefinitions)
            {
                try
                {
                    if (registerCache.TryGetValue(definition.RegisterAddress, out var registerData))
                    {
                        SetDataFromRegisters(data, definition, registerData);
                    }
                    else
                    {
                        LogThrottled($"register_missing_{definition.RegisterAddress}", TimeSpan.FromSeconds(30),
                            $"❌ Register bulunamadı: {definition.RegisterAddress}");
                        return null;
                    }
                }
                catch (Exception ex)
                {
                    LogThrottled($"definition_error_{definition.Name}", TimeSpan.FromSeconds(10),
                        $"❌ Veri tanımı okunamadı: {definition.Name} - {ex.Message}");
                    return null;
                }
            }

            // Console.WriteLine($"✅ Dinamik PLC veri okuma tamamlandı");
            return data;
        }

        private void SetDataFromRegisters(PLCData data, PLCDataDefinitionConfig definition, ushort[] registers)
        {
            try
            {
                object value = 0;
                
                // ByteOrder ve WordSwap ayarlarını al
                var byteOrder = definition.ByteOrder ?? "HighToLow";
                var wordSwap = definition.WordSwap;
                
                // Veri tipine göre convert işlemi
                switch (definition.DataType.ToUpper())
                {
                    case "DINT":
                        if (registers.Length >= 2)
                            value = ConvertRegistersToDINT(registers[0], registers[1], byteOrder, wordSwap);
                        break;
                    case "INT":
                        if (registers.Length >= 1)
                        {
                            // INT: 16-bit signed integer (1 register)
                            ushort regValue = registers[0];
                            // Byte order'a göre düzenle (WORD ile aynı mantık)
                            if (byteOrder.Equals("LowToHigh", StringComparison.OrdinalIgnoreCase) || 
                                byteOrder.Equals("LittleEndian", StringComparison.OrdinalIgnoreCase))
                            {
                                // Low byte ve High byte'ı swap et
                                regValue = (ushort)((regValue >> 8) | (regValue << 8));
                            }
                            // Signed integer'a çevir (-32768 to 32767)
                            value = (short)regValue;
                        }
                        break;
                    case "REAL":
                        if (registers.Length >= 2)
                            value = ConvertRegistersToFloat(registers[0], registers[1], byteOrder, wordSwap);
                        break;
                    case "DOUBLE":
                        if (registers.Length >= 4)
                            value = ConvertRegistersToDouble(registers, byteOrder, wordSwap);
                        break;
                    case "WORD":
                        if (registers.Length >= 1)
                            value = registers[0];
                        break;
                    case "BOOL":
                        if (registers.Length >= 1)
                            value = (registers[0] & 0x0001) != 0;
                        break;
                    default:
                        Console.WriteLine($"⚠️ Bilinmeyen veri tipi: {definition.DataType}");
                        break;
                }
                
                // PLCData objesine değeri ata
                SetDataProperty(data, definition.Name, value);

                if ((_sourceType.Equals("EnergyAnalyzer", StringComparison.OrdinalIgnoreCase)
                    || _sourceType.Equals("EnergyAnalyser", StringComparison.OrdinalIgnoreCase)
                    || _sourceType.Equals("EnergyAnalizor", StringComparison.OrdinalIgnoreCase)
                    || _sourceType.Equals("EnergyAnalizör", StringComparison.OrdinalIgnoreCase))
                    && (definition.Name.Equals("ActivePower", StringComparison.OrdinalIgnoreCase)
                        || definition.Name.Equals("TotalEnergy", StringComparison.OrdinalIgnoreCase)))
                {
                    if (_verboseLogging)
                    {
                        Console.WriteLine($"⚡ Enerji okuma -> {definition.Name}: {value} (Registers: {string.Join(",", registers.Select(r => r.ToString()))}, ByteOrder={byteOrder}, WordSwap={wordSwap})");
                    }
                }
                
                // Console.WriteLine($"✅ {definition.Name} okundu: {value} (Register {definition.RegisterAddress}, {definition.DataType}, ByteOrder: {byteOrder})");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Veri atama hatası: {definition.Name} - {ex.Message}");
            }
        }

        private void SetDataProperty(PLCData data, string propertyName, object value)
        {
            try
            {
                // Dinamik olarak Dictionary'ye ekle
                data.SetValue(propertyName, value);
                // Console.WriteLine($"✅ Dinamik veri eklendi: {propertyName} = {value}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Dinamik veri atama hatası: {propertyName} - {ex.Message}");
            }
        }
        
        public void UpdateConfiguration(PLCConnectionConfig connection, List<PLCDataDefinitionConfig> dataDefinitions)
        {
            _currentConnection = connection;
            _dataDefinitions = dataDefinitions;

            // Bağlantı bilgilerini güncelle
            if (!string.IsNullOrWhiteSpace(connection.IpAddress))
            {
                IpAddress = connection.IpAddress;
            }

            if (connection.Port > 0)
            {
                Port = connection.Port;
            }

            _sourceType = connection.SourceType ?? "ModbusTCP";
            var isEnergyAnalyzer = string.Equals(_sourceType, "EnergyAnalyzer", StringComparison.OrdinalIgnoreCase)
                || string.Equals(_sourceType, "EnergyAnalyser", StringComparison.OrdinalIgnoreCase)
                || string.Equals(_sourceType, "EnergyAnalizor", StringComparison.OrdinalIgnoreCase)
                || string.Equals(_sourceType, "EnergyAnalizör", StringComparison.OrdinalIgnoreCase);
            _unitId = isEnergyAnalyzer ? (byte)2 : (byte)1;

            // ReadIntervalMs'i güncelle
            if (connection.ReadIntervalMs > 0)
            {
                UpdateReadInterval(connection.ReadIntervalMs);
                Console.WriteLine($"✅ PLC okuma sıklığı güncellendi: {connection.ReadIntervalMs}ms");
            }
            
            // Console.WriteLine($"🔍 UpdateConfiguration çağrıldı: {dataDefinitions.Count} veri tanımı alındı");
            
            // Aktif olan veri tanımlarını filtrele
            _dataDefinitions = _dataDefinitions.Where(d => d.IsActive && d.OperationType.Contains("READ")).ToList();
            
            // Console.WriteLine($"🔍 Filtreleme sonrası: {_dataDefinitions.Count} aktif READ veri tanımı");
            
            // İlk 5 veri tanımını listele
            // foreach (var def in _dataDefinitions.Take(5))
            // {
            //     Console.WriteLine($"🔍 Veri tanımı: {def.Name}, IsActive: {def.IsActive}, OperationType: {def.OperationType}, Register: {def.RegisterAddress}");
            // }
            
            // Console.WriteLine($"🔄 PLC Reader konfigürasyonu güncellendi: {connection.Name} ({connection.IpAddress}:{connection.Port}), {_dataDefinitions.Count} veri tanımı");
        }
        
        private async Task<ushort[]?> ReadRegistersAsync(ushort startAddress, ushort count)
        {
            try
            {
                if (networkStream == null) return null;
                
                var functionCode = (byte)0x03;
                var txId = unchecked(++_transactionId);
 
                // Modbus TCP request oluştur
                var request = new byte[12];
                request[0] = (byte)(txId >> 8);
                request[1] = (byte)(txId & 0xFF);
                request[2] = 0x00; // Protocol ID
                request[3] = 0x00;
                request[4] = 0x00; // Length
                request[5] = 0x06;
                request[6] = _unitId; // Unit ID
                request[7] = functionCode; // Function Code
                request[8] = (byte)(startAddress >> 8); // Start Address High
                request[9] = (byte)(startAddress & 0xFF); // Start Address Low
                request[10] = (byte)(count >> 8); // Quantity High
                request[11] = (byte)(count & 0xFF); // Quantity Low
                
                // Request gönder
                await networkStream.WriteAsync(request, 0, request.Length);
                
                // Response oku
                var response = new byte[9 + count * 2];
                var bytesRead = await networkStream.ReadAsync(response, 0, response.Length);
                
                if (bytesRead >= 9)
                {
                    var result = new ushort[count];
                    for (int i = 0; i < count; i++)
                    {
                        result[i] = (ushort)((response[9 + i * 2] << 8) | response[10 + i * 2]);
                    }
                    return result;
                }
                
                return null;
            }
            catch (Exception ex)
            {
                LogThrottled($"register_error_{startAddress}", TimeSpan.FromSeconds(10),
                    $"❌ Register okuma hatası: {startAddress} - {ex.Message}");
                return null;
            }
        }

        private void LogThrottled(string key, TimeSpan interval, string message)
        {
            var now = DateTime.UtcNow;
            lock (_logLock)
            {
                if (_lastLogTimes.TryGetValue(key, out var last) && (now - last) < interval)
                {
                    return;
                }

                _lastLogTimes[key] = now;
            }

            Console.WriteLine(message);
        }

        private int ConvertRegistersToDINT(ushort reg0, ushort reg1, string byteOrder, bool wordSwap)
        {
            ushort word0 = reg0;
            ushort word1 = reg1;
            
            // WordSwap: 16-bit word'lerin yer değiştirmesi
            if (wordSwap)
            {
                var temp = word0;
                word0 = word1;
                word1 = temp;
            }
            
            // ByteOrder'a göre dönüşüm
            switch (byteOrder.ToUpper())
            {
                case "BIGENDIAN":
                    // BigEndian: [word0, word1] -> (word0 << 16) | word1
                    return ((int)word0 << 16) | word1;
                    
                case "LITTLEENDIAN":
                    // LittleEndian: [word1, word0] -> (word1 << 16) | word0
                    return ((int)word1 << 16) | word0;
                    
                case "HIGHToLOW":
                case "HIGH_TO_LOW":
                    // HighToLow: [low, high] -> (low << 16) | high (mevcut mantık)
                    return ((int)word1 << 16) | word0;
                    
                case "LOWTOHIGH":
                case "LOW_TO_HIGH":
                    // LowToHigh: [high, low] -> (high << 16) | low
                    return ((int)word0 << 16) | word1;
                    
                default:
                    // Varsayılan: HighToLow
                    return ((int)word1 << 16) | word0;
            }
        }
        
        private float ConvertRegistersToFloat(ushort reg0, ushort reg1, string byteOrder, bool wordSwap)
        {
            ushort word0 = reg0;
            ushort word1 = reg1;
            
            // WordSwap: 16-bit word'lerin yer değiştirmesi
            if (wordSwap)
            {
                var temp = word0;
                word0 = word1;
                word1 = temp;
            }
            
            uint bits;
            
            // ByteOrder'a göre dönüşüm
            switch (byteOrder.ToUpper())
            {
                case "BIGENDIAN":
                    // BigEndian: [word0, word1] -> (word0 << 16) | word1
                    bits = ((uint)word0 << 16) | word1;
                    break;
                    
                case "LITTLEENDIAN":
                    // LittleEndian: [word1, word0] -> (word1 << 16) | word0
                    bits = ((uint)word1 << 16) | word0;
                    break;
                    
                case "HIGHToLOW":
                case "HIGH_TO_LOW":
                    // HighToLow: [low, high] -> (low << 16) | high (mevcut mantık)
                    bits = ((uint)word1 << 16) | word0;
                    break;
                    
                case "LOWTOHIGH":
                case "LOW_TO_HIGH":
                    // LowToHigh: [high, low] -> (high << 16) | low
                    bits = ((uint)word0 << 16) | word1;
                    break;
                    
                default:
                    // Varsayılan: HighToLow
                    bits = ((uint)word1 << 16) | word0;
                    break;
            }
            
            // IEEE 754 float conversion
            byte[] bytes = BitConverter.GetBytes(bits);
            float value = BitConverter.ToSingle(bytes, 0);
            
            // Validity check
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                return 0f;
            }
            
            return value;
        }
        
        private double ConvertRegistersToDouble(ushort[] registers, string byteOrder, bool wordSwap)
        {
            if (registers.Length < 4)
                return 0.0;
            
            ushort[] words = new ushort[4];
            Array.Copy(registers, words, 4);
            
            // WordSwap: 16-bit word'lerin yer değiştirmesi (4 word için)
            if (wordSwap)
            {
                var temp = words[0];
                words[0] = words[3];
                words[3] = temp;
                temp = words[1];
                words[1] = words[2];
                words[2] = temp;
            }
            
            // 4 register → 8 bytes
            byte[] bytes = new byte[8];
            
            // ByteOrder'a göre byte dizisini oluştur
            switch (byteOrder.ToUpper())
            {
                case "BIGENDIAN":
                    // BigEndian: [word0, word1, word2, word3] -> bytes
                    bytes[0] = (byte)(words[0] >> 8);
                    bytes[1] = (byte)(words[0] & 0xFF);
                    bytes[2] = (byte)(words[1] >> 8);
                    bytes[3] = (byte)(words[1] & 0xFF);
                    bytes[4] = (byte)(words[2] >> 8);
                    bytes[5] = (byte)(words[2] & 0xFF);
                    bytes[6] = (byte)(words[3] >> 8);
                    bytes[7] = (byte)(words[3] & 0xFF);
                    // Reverse (EnergyAnalyzerReader'daki mantık)
                    Array.Reverse(bytes);
                    break;
                    
                case "LITTLEENDIAN":
                    // LittleEndian: [word3, word2, word1, word0] -> bytes
                    bytes[0] = (byte)(words[3] & 0xFF);
                    bytes[1] = (byte)(words[3] >> 8);
                    bytes[2] = (byte)(words[2] & 0xFF);
                    bytes[3] = (byte)(words[2] >> 8);
                    bytes[4] = (byte)(words[1] & 0xFF);
                    bytes[5] = (byte)(words[1] >> 8);
                    bytes[6] = (byte)(words[0] & 0xFF);
                    bytes[7] = (byte)(words[0] >> 8);
                    break;
                    
                default:
                    // Varsayılan: BigEndian with reverse (EnergyAnalyzerReader mantığı)
                    bytes[0] = (byte)(words[0] >> 8);
                    bytes[1] = (byte)(words[0] & 0xFF);
                    bytes[2] = (byte)(words[1] >> 8);
                    bytes[3] = (byte)(words[1] & 0xFF);
                    bytes[4] = (byte)(words[2] >> 8);
                    bytes[5] = (byte)(words[2] & 0xFF);
                    bytes[6] = (byte)(words[3] >> 8);
                    bytes[7] = (byte)(words[3] & 0xFF);
                    Array.Reverse(bytes);
                    break;
            }
            
            double value = BitConverter.ToDouble(bytes, 0);
            
            // Validity check
            if (double.IsNaN(value) || double.IsInfinity(value) || value < 0 || value > 1e12)
            {
                return 0.0;
            }
            
            // Enerji analizörü Wh olarak döner, kWh'ye çevir
            // Eğer değer çok büyükse (Wh), 1000'e böl
            if (value > 1000)
            {
                value = value / 1000.0;
            }
            
            return value;
        }

        public void Dispose()
        {
            try
            {
                isRunning = false;
                readTimer?.Dispose();
                cancellationTokenSource?.Cancel();
                
                if (networkStream != null)
                {
                    networkStream.Dispose();
                    networkStream = null;
                }
                
                tcpClient?.Close();
                tcpClient = null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ PLC Reader dispose hatası: {ex.Message}");
            }
        }
    }
}

