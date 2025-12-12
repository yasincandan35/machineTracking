using System;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC'ye veri yazma servisi (Port 1502)
    /// </summary>
    public class PLCWriter : IDisposable
    {
        private TcpClient? tcpClient;
        private NetworkStream? networkStream;
        private readonly string plcIP;
        private readonly int port;
        private bool isConnected = false;

        // Varsayılan constructor (geriye uyumluluk için)
        public PLCWriter() : this("192.168.0.104", 1502)
        {
        }

        // Dinamik IP ve port ile constructor
        public PLCWriter(string ipAddress, int portNumber)
        {
            plcIP = ipAddress;
            port = portNumber;
        }

        public async Task<bool> ConnectAsync()
        {
            try
            {
                // System.Console.WriteLine($"🔌 PLC'ye bağlanmaya çalışılıyor: {plcIP}:{port}");
                tcpClient = new TcpClient();
                await tcpClient.ConnectAsync(plcIP, port);
                networkStream = tcpClient.GetStream();
                isConnected = true;
                System.Console.WriteLine($"✅ PLC'ye bağlantı başarılı: {plcIP}:{port}");
                return true;
            }
            catch (Exception ex)
            {
                System.Console.WriteLine($"❌ PLC'ye bağlantı başarısız: {plcIP}:{port} - Hata: {ex.Message}");
                isConnected = false;
                return false;
            }
        }

        public void Disconnect()
        {
            try
            {
                networkStream?.Close();
                tcpClient?.Close();
                isConnected = false;
            }
            catch { }
        }

        public async Task<bool> WriteDINTAsync(int address, int value)
        {
            System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔵 [PLCWriter] WriteDINTAsync çağrıldı - Address: {address}, Value: {value}");
            
            if (!isConnected || networkStream == null) 
            {
                System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [PLCWriter] Bağlantı yok, yeniden bağlanılıyor...");
                // Bağlantı yoksa yeniden bağlan
                await ConnectAsync();
                if (!isConnected)
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] Bağlantı kurulamadı!");
                    return false;
                }
            }

            // Retry mekanizması
            int maxRetries = 3;
            for (int retry = 0; retry < maxRetries; retry++)
            {
                try
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [PLCWriter] WriteDINTAsync deneme {retry + 1}/{maxRetries} - Address: {address}, Value: {value}");
                    
                    // DINT değerini 2 register'a çevir
                    var registers = ConvertDINTToRegisters(value);
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📊 [PLCWriter] DINT değeri register'lara çevrildi: [{registers[0]}, {registers[1]}]");
                    
                    // Modbus Write Multiple Registers (0x10)
                    var request = BuildModbusRequest(1, 0x10, (ushort)address, 2, registers);
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [PLCWriter] Modbus request gönderiliyor... (Length: {request.Length} bytes)");
                    await networkStream!.WriteAsync(request, 0, request.Length);
                    
                    // Response oku
                    var response = new byte[8];
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Modbus response bekleniyor...");
                    var bytesRead = await networkStream.ReadAsync(response, 0, response.Length);
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Response alındı: {bytesRead} bytes");
                    
                    if (bytesRead > 0)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Response bytes: {BitConverter.ToString(response, 0, bytesRead)}");
                    }
                    
                    if (bytesRead == 8 && response[7] == 0x10)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [PLCWriter] WriteDINTAsync başarılı - Address: {address}, Value: {value}");
                        return true;
                    }
                    else
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [PLCWriter] WriteDINTAsync başarısız - bytesRead: {bytesRead}, response[7]: {(bytesRead >= 8 ? response[7].ToString("X2") : "N/A")}");
                    }
                    
                    // Retry bekleme
                    if (retry < maxRetries - 1)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⏳ [PLCWriter] Retry için 100ms bekleniyor...");
                        await Task.Delay(100);
                    }
                }
                catch (Exception ex)
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteDINTAsync exception: {ex.Message}");
                    if (retry == maxRetries - 1)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteDINTAsync tüm denemeler başarısız!");
                        return false;
                    }
                    
                    // Bağlantıyı yenile
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [PLCWriter] Bağlantı yenileniyor...");
                    await ConnectAsync();
                    await Task.Delay(100);
                }
            }
            
            System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteDINTAsync başarısız - Address: {address}, Value: {value}");
            return false;
        }

        public async Task<bool> WriteREALAsync(int address, float value)
        {
            if (!isConnected || networkStream == null) 
            {
                await ConnectAsync();
                if (!isConnected) return false;
            }

            int maxRetries = 3;
            for (int retry = 0; retry < maxRetries; retry++)
            {
                try
                {
                    // REAL değeri 2 register'a çevir
                    byte[] bytes = BitConverter.GetBytes(value);
                    ushort lowWord = BitConverter.ToUInt16(bytes, 0);
                    ushort highWord = BitConverter.ToUInt16(bytes, 2);
                    
                    var registers = new int[] { lowWord, highWord };
                    
                    // Modbus Write Multiple Registers (0x10)
                    var request = BuildModbusRequest(1, 0x10, (ushort)address, 2, registers);
                    await networkStream!.WriteAsync(request, 0, request.Length);
                    
                    // Response oku
                    var response = new byte[8];
                    var bytesRead = await networkStream.ReadAsync(response, 0, response.Length);
                    
                    if (bytesRead == 8 && response[7] == 0x10)
                    {
                        return true;
                    }
                    
                    if (retry < maxRetries - 1)
                    {
                        await Task.Delay(100);
                    }
                }
                catch
                {
                    if (retry == maxRetries - 1) return false;
                    
                    await ConnectAsync();
                    await Task.Delay(100);
                }
            }
            
            return false;
        }

        /// <summary>
        /// Modbus Write Single Coil (Function Code 05)
        /// </summary>
        public async Task<bool> WriteCoilAsync(int address, bool value)
        {
            System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔵 [PLCWriter] WriteCoilAsync çağrıldı - Address: {address}, Value: {value}");
            
            if (!isConnected || networkStream == null) 
            {
                System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [PLCWriter] Bağlantı yok, yeniden bağlanılıyor...");
                await ConnectAsync();
                if (!isConnected)
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] Bağlantı kurulamadı!");
                    return false;
                }
            }

            int maxRetries = 3;
            for (int retry = 0; retry < maxRetries; retry++)
            {
                try
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [PLCWriter] WriteCoilAsync deneme {retry + 1}/{maxRetries} - Address: {address}, Value: {value}");
                    
                    // Modbus Write Single Coil (0x05)
                    var request = BuildWriteSingleCoilRequest(1, 0x05, (ushort)address, value);
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📤 [PLCWriter] Modbus Write Single Coil request gönderiliyor... (Length: {request.Length} bytes)");
                    await networkStream!.WriteAsync(request, 0, request.Length);
                    
                    // Response oku
                    var response = new byte[8];
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Modbus response bekleniyor...");
                    var bytesRead = await networkStream.ReadAsync(response, 0, response.Length);
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Response alındı: {bytesRead} bytes");
                    
                    if (bytesRead > 0)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 📥 [PLCWriter] Response bytes: {BitConverter.ToString(response, 0, bytesRead)}");
                    }
                    
                    if (bytesRead == 8 && response[7] == 0x05)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ✅ [PLCWriter] WriteCoilAsync başarılı - Address: {address}, Value: {value}");
                        return true;
                    }
                    else
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⚠️ [PLCWriter] WriteCoilAsync başarısız - bytesRead: {bytesRead}, response[7]: {(bytesRead >= 8 ? response[7].ToString("X2") : "N/A")}");
                    }
                    
                    if (retry < maxRetries - 1)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ⏳ [PLCWriter] Retry için 100ms bekleniyor...");
                        await Task.Delay(100);
                    }
                }
                catch (Exception ex)
                {
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteCoilAsync exception: {ex.Message}");
                    if (retry == maxRetries - 1)
                    {
                        System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteCoilAsync tüm denemeler başarısız!");
                        return false;
                    }
                    
                    System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] 🔄 [PLCWriter] Bağlantı yenileniyor...");
                    await ConnectAsync();
                    await Task.Delay(100);
                }
            }
            
            System.Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] ❌ [PLCWriter] WriteCoilAsync başarısız - Address: {address}, Value: {value}");
            return false;
        }

        private byte[] BuildWriteSingleCoilRequest(byte slaveId, byte functionCode, ushort address, bool value)
        {
            var request = new byte[12];
            var index = 0;

            // Transaction ID
            request[index++] = 0x00;
            request[index++] = 0x01;

            // Protocol ID
            request[index++] = 0x00;
            request[index++] = 0x00;

            // Length
            request[index++] = 0x00;
            request[index++] = 0x06;

            // Unit ID
            request[index++] = slaveId;

            // Function Code
            request[index++] = functionCode;

            // Coil Address
            request[index++] = (byte)(address >> 8);
            request[index++] = (byte)(address & 0xFF);

            // Coil Value (0x0000 = OFF, 0xFF00 = ON)
            if (value)
            {
                request[index++] = 0xFF;
                request[index++] = 0x00;
            }
            else
            {
                request[index++] = 0x00;
                request[index++] = 0x00;
            }

            return request;
        }

        private int[] ConvertDINTToRegisters(int value)
        {
            return new int[] { value & 0xFFFF, (value >> 16) & 0xFFFF };
        }

        private byte[] BuildModbusRequest(byte slaveId, byte functionCode, ushort startAddress, ushort registerCount, int[] values)
        {
            var request = new byte[13 + values.Length * 2];
            var index = 0;

            // Transaction ID
            request[index++] = 0x00;
            request[index++] = 0x01;

            // Protocol ID
            request[index++] = 0x00;
            request[index++] = 0x00;

            // Length
            var length = (ushort)(7 + values.Length * 2);
            request[index++] = (byte)(length >> 8);
            request[index++] = (byte)(length & 0xFF);

            // Unit ID
            request[index++] = slaveId;

            // Function Code
            request[index++] = functionCode;

            // Start Address
            request[index++] = (byte)(startAddress >> 8);
            request[index++] = (byte)(startAddress & 0xFF);

            // Register Count
            request[index++] = (byte)(registerCount >> 8);
            request[index++] = (byte)(registerCount & 0xFF);

            // Byte Count
            request[index++] = (byte)(values.Length * 2);

            // Values
            foreach (var value in values)
            {
                request[index++] = (byte)(value >> 8);
                request[index++] = (byte)(value & 0xFF);
            }

            return request;
        }

        public void Dispose()
        {
            Disconnect();
            tcpClient?.Dispose();
        }
    }
} 