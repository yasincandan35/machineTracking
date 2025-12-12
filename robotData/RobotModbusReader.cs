using System;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;

namespace RobotDataCollector
{
    /// <summary>
    /// Robot PLC ile Modbus TCP haberleşmesi yapan sınıf
    /// ETOR üzerinden RS485'ten Ethernet'e dönüştürülmüş bağlantı
    /// </summary>
    public class RobotModbusReader : IDisposable
    {
        private TcpClient? _tcpClient;
        private NetworkStream? _networkStream;
        private ushort _transactionId = 0;
        private readonly object _lockObject = new object();

        // Modbus ayarları
        public string IpAddress { get; set; } = "192.168.1.31"; // ETOR IP adresi
        public int Port { get; set; } = 502; // Modbus TCP port
        public byte SlaveId { get; set; } = 0x01; // Station Number (hex 01)
        
        // Byte order seçeneği (0=High-Low, 1=Low-High, 2=Swap)
        public int ByteOrderVariant { get; set; } = 0;
        
        // Debug modu
        public bool DebugMode { get; set; } = true;
        
        // Debug log event
        public event EventHandler<string>? DebugLog;

        /// <summary>
        /// PLC'ye bağlan
        /// </summary>
        public async Task<bool> ConnectAsync()
        {
            try
            {
                if (_tcpClient?.Connected == true)
                    return true;

                _tcpClient?.Close();
                _tcpClient = new TcpClient();
                await _tcpClient.ConnectAsync(IpAddress, Port);
                _networkStream = _tcpClient.GetStream();
                _networkStream.ReadTimeout = 2000;
                _networkStream.WriteTimeout = 2000;

                Console.WriteLine($"✅ 已连接到机器人PLC / Connected to Robot PLC: {IpAddress}:{Port}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 机器人PLC连接错误 / Robot PLC connection error: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Bağlantıyı kapat
        /// </summary>
        public void Disconnect()
        {
            try
            {
                _networkStream?.Close();
                _networkStream = null;
                _tcpClient?.Close();
                _tcpClient = null;
                Console.WriteLine("🔌 机器人PLC连接已关闭 / Robot PLC connection closed");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ 关闭连接错误 / Connection close error: {ex.Message}");
            }
        }

        /// <summary>
        /// Coil okuma (Function Code 01)
        /// </summary>
        public async Task<bool?> ReadCoilAsync(ushort address)
        {
            try
            {
                if (_networkStream == null || _tcpClient?.Connected != true)
                {
                    if (!await ConnectAsync())
                        return null;
                }

                // Modbus TCP Request oluştur
                byte[] request = new byte[12];
                lock (_lockObject)
                {
                    _transactionId++;
                    if (_transactionId == 0) _transactionId = 1;
                }

                request[0] = (byte)(_transactionId >> 8);      // Transaction ID High
                request[1] = (byte)(_transactionId & 0xFF);    // Transaction ID Low
                request[2] = 0x00;                             // Protocol ID High
                request[3] = 0x00;                             // Protocol ID Low
                request[4] = 0x00;                             // Length High
                request[5] = 0x06;                             // Length Low (6 bytes)
                request[6] = SlaveId;                          // Unit ID (Slave Station Number)
                request[7] = 0x01;                             // Function Code (Read Coils)
                request[8] = (byte)(address >> 8);             // Start Address High
                request[9] = (byte)(address & 0xFF);           // Start Address Low
                request[10] = 0x00;                            // Quantity High
                request[11] = 0x01;                            // Quantity Low (1 coil)

                // Request gönder
                await _networkStream!.WriteAsync(request, 0, request.Length);
                await _networkStream!.FlushAsync();

                // Response oku
                byte[] response = new byte[10]; // MBAP Header (6) + Function (1) + Byte Count (1) + Data (1)
                int totalRead = 0;
                while (totalRead < 10)
                {
                    int read = await _networkStream!.ReadAsync(response, totalRead, 10 - totalRead);
                    if (read == 0) return null;
                    totalRead += read;
                }

                // Response kontrolü
                if (response[7] == 0x01 && response[8] == 0x01) // Function Code + Byte Count
                {
                    byte coilValue = response[9];
                    return (coilValue & 0x01) != 0;
                }
                else if (response[7] >= 0x80) // Error response
                {
                    Console.WriteLine($"❌ Modbus错误 / Modbus error: 功能码 / Function Code {response[7]:X2}, 异常码 / Exception Code {response[8]:X2}");
                    return null;
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 线圈读取错误 / Coil read error (地址 / Address {address}): {ex.Message}");
                Disconnect();
                return null;
            }
        }

        /// <summary>
        /// Coil yazma (Function Code 05 - Write Single Coil)
        /// </summary>
        public async Task<bool> WriteCoilAsync(ushort address, bool value)
        {
            try
            {
                if (_networkStream == null || _tcpClient?.Connected != true)
                {
                    if (!await ConnectAsync())
                        return false;
                }

                // Modbus TCP Request oluştur
                byte[] request = new byte[12];
                lock (_lockObject)
                {
                    _transactionId++;
                    if (_transactionId == 0) _transactionId = 1;
                }

                request[0] = (byte)(_transactionId >> 8);      // Transaction ID High
                request[1] = (byte)(_transactionId & 0xFF);    // Transaction ID Low
                request[2] = 0x00;                             // Protocol ID High
                request[3] = 0x00;                             // Protocol ID Low
                request[4] = 0x00;                             // Length High
                request[5] = 0x06;                             // Length Low (6 bytes)
                request[6] = SlaveId;                          // Unit ID (Slave Station Number)
                request[7] = 0x05;                             // Function Code (Write Single Coil)
                request[8] = (byte)(address >> 8);             // Start Address High
                request[9] = (byte)(address & 0xFF);           // Start Address Low
                request[10] = value ? (byte)0xFF : (byte)0x00; // Value High (0xFF = ON, 0x00 = OFF)
                request[11] = 0x00;                            // Value Low (always 0x00 for single coil)

                // Request gönder
                await _networkStream!.WriteAsync(request, 0, request.Length);
                await _networkStream!.FlushAsync();

                // Response oku
                byte[] response = new byte[12]; // MBAP Header (6) + Function (1) + Address (2) + Value (2) + CRC (1)
                int totalRead = 0;
                while (totalRead < 12)
                {
                    int read = await _networkStream!.ReadAsync(response, totalRead, 12 - totalRead);
                    if (read == 0) return false;
                    totalRead += read;
                }

                // Response kontrolü - Echo kontrolü (request ile aynı olmalı)
                if (response[7] == 0x05 && 
                    response[8] == request[8] && response[9] == request[9] &&
                    response[10] == request[10] && response[11] == request[11])
                {
                    if (DebugMode)
                    {
                        string debugMsg = $"✅ 线圈 {address} 写入成功 / Coil {address} write successful: {(value ? "ON" : "OFF")}";
                        Console.WriteLine(debugMsg);
                        DebugLog?.Invoke(this, debugMsg);
                    }
                    return true;
                }
                else if (response[7] >= 0x80) // Error response
                {
                    Console.WriteLine($"❌ Modbus写入错误 / Modbus write error: 功能码 / Function Code {response[7]:X2}, 异常码 / Exception Code {response[8]:X2}");
                    return false;
                }

                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 线圈写入错误 / Coil write error (地址 / Address {address}): {ex.Message}");
                Disconnect();
                return false;
            }
        }

        /// <summary>
        /// Hold Register okuma (Function Code 03) - Farklı byte sıralaması varyantlarıyla
        /// </summary>
        public async Task<ushort?> ReadHoldRegisterAsync(ushort address)
        {
            try
            {
                if (_networkStream == null || _tcpClient?.Connected != true)
                {
                    if (!await ConnectAsync())
                        return null;
                }

                // Modbus TCP Request oluştur
                byte[] request = new byte[12];
                lock (_lockObject)
                {
                    _transactionId++;
                    if (_transactionId == 0) _transactionId = 1;
                }

                request[0] = (byte)(_transactionId >> 8);      // Transaction ID High
                request[1] = (byte)(_transactionId & 0xFF);    // Transaction ID Low
                request[2] = 0x00;                             // Protocol ID High
                request[3] = 0x00;                             // Protocol ID Low
                request[4] = 0x00;                             // Length High
                request[5] = 0x06;                             // Length Low (6 bytes)
                request[6] = SlaveId;                          // Unit ID (Slave Station Number)
                request[7] = 0x03;                             // Function Code (Read Holding Registers)
                request[8] = (byte)(address >> 8);             // Start Address High
                request[9] = (byte)(address & 0xFF);           // Start Address Low
                request[10] = 0x00;                            // Quantity High
                request[11] = 0x01;                            // Quantity Low (1 register)

                // Request gönder
                await _networkStream!.WriteAsync(request, 0, request.Length);
                await _networkStream!.FlushAsync();

                // Response oku - önce header'ı oku
                byte[] header = new byte[9];
                int totalRead = 0;
                while (totalRead < 9)
                {
                    int read = await _networkStream!.ReadAsync(header, totalRead, 9 - totalRead);
                    if (read == 0) return null;
                    totalRead += read;
                }

                // Response kontrolü
                if (header[7] >= 0x80) // Error response
                {
                    Console.WriteLine($"❌ Modbus错误 / Modbus error (地址 / Address {address}): 功能码 / Function Code {header[7]:X2}, 异常码 / Exception Code {header[8]:X2}");
                    return null;
                }

                if (header[7] != 0x03) // Function Code kontrolü
                {
                    Console.WriteLine($"❌ 意外的功能码 / Unexpected Function Code: {header[7]:X2} (地址 / Address {address})");
                    return null;
                }

                byte byteCount = header[8];
                if (byteCount != 0x02) // 1 register = 2 byte
                {
                    Console.WriteLine($"❌ 意外的字节数 / Unexpected byte count: {byteCount} (地址 / Address {address})");
                    return null;
                }

                // Data bytes'ları oku
                byte[] data = new byte[2];
                totalRead = 0;
                while (totalRead < 2)
                {
                    int read = await _networkStream!.ReadAsync(data, totalRead, 2 - totalRead);
                    if (read == 0) return null;
                    totalRead += read;
                }

                // Tüm varyantları hesapla
                ushort value1 = (ushort)((data[0] << 8) | data[1]); // High-Low (Big Endian - Standart Modbus)
                ushort value2 = (ushort)((data[1] << 8) | data[0]); // Low-High (Little Endian)
                ushort value3 = (ushort)(data[0] | (data[1] << 8)); // Swap

                // Seçilen varyanta göre değeri hesapla
                ushort result = ByteOrderVariant switch
                {
                    1 => value2, // Low-High
                    2 => value3, // Swap
                    _ => value1  // High-Low (varsayılan)
                };

                // DEBUG: Response'u hex olarak yazdır
                if (DebugMode)
                {
                    string debugMsg1 = $"🔍 寄存器 {address} 响应 / Register {address} Response: {BitConverter.ToString(header).Replace("-", " ")} {BitConverter.ToString(data).Replace("-", " ")}";
                    string debugMsg2 = $"  变体1 (高-低) / Variant 1 (High-Low): {value1} | 变体2 (低-高) / Variant 2 (Low-High): {value2} | 变体3 (交换) / Variant 3 (Swap): {value3} | 已选择 / Selected: {result}";
                    
                    Console.WriteLine(debugMsg1);
                    Console.WriteLine(debugMsg2);
                    DebugLog?.Invoke(this, debugMsg1);
                    DebugLog?.Invoke(this, debugMsg2);
                }

                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 寄存器读取错误 / Register read error (地址 / Address {address}): {ex.Message}");
                Disconnect();
                return null;
            }
        }

        /// <summary>
        /// Tüm robot verilerini oku
        /// </summary>
        public async Task<RobotData?> ReadAllDataAsync()
        {
            try
            {
                var data = new RobotData { Timestamp = DateTime.Now };

                // Alarm durumlarını oku (Coil 0-6)
                data.IsometricBeltAlarm = await ReadCoilAsync(0) ?? false;
                data.GoodProductGantryAlarm = await ReadCoilAsync(1) ?? false;
                data.SidePushMechanism1Alarm = await ReadCoilAsync(2) ?? false;
                data.SidePushMechanism2Alarm = await ReadCoilAsync(3) ?? false;
                data.FormingPlatformAlarm = await ReadCoilAsync(4) ?? false;
                data.RejectMechanismAlarm = await ReadCoilAsync(5) ?? false;
                data.PalletLineAlarm = await ReadCoilAsync(6) ?? false;

                // Reset Counter (Coil 20)
                data.ResetCounter = await ReadCoilAsync(20) ?? false;

                // Running durumlarını oku (Coil 50-52)
                data.IsometricBeltRunning = await ReadCoilAsync(50) ?? false;
                data.PalletisingMechanismRunning = await ReadCoilAsync(51) ?? false;
                data.PalletLineRunning = await ReadCoilAsync(52) ?? false;

                // Veri register'larını oku (Register 0-5)
                data.QualifiedItemsCount = await ReadHoldRegisterAsync(0) ?? 0;
                data.DefectiveItemsCount = await ReadHoldRegisterAsync(1) ?? 0;
                data.GoodPalletsCount = await ReadHoldRegisterAsync(2) ?? 0;
                data.DefectivePalletsCount = await ReadHoldRegisterAsync(3) ?? 0;
                data.EquidistantBeltStatus = await ReadHoldRegisterAsync(4) ?? 0;
                data.PalletisingMechanismStatus = await ReadHoldRegisterAsync(5) ?? 0;

                return data;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 数据读取错误 / Data read error: {ex.Message}");
                return null;
            }
        }

        public void Dispose()
        {
            Disconnect();
        }
    }
}

