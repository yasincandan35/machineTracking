using System;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace AnalizorTest
{
    public sealed class EnergyModbusReader : IDisposable
    {
        private TcpClient? _tcpClient;
        private NetworkStream? _stream;
        private ushort _transactionId = 1;
        private readonly object _lock = new();

        public string IpAddress { get; set; } = "192.168.1.239";
        public int Port { get; set; } = 502;
        public byte SlaveId { get; set; } = 1;
        public bool DebugMode { get; set; }
            = true;

        public event EventHandler<string>? DebugLog;

        public enum ModbusFunctionCode : byte
        {
            ReadHoldingRegisters = 0x03,
            ReadInputRegisters = 0x04
        }

        public async Task<bool> ConnectAsync()
        {
            try
            {
                if (_tcpClient?.Connected == true)
                    return true;

                Disconnect();

                _tcpClient = new TcpClient();
                await _tcpClient.ConnectAsync(IpAddress, Port);
                _stream = _tcpClient.GetStream();
                _stream.ReadTimeout = 2000;
                _stream.WriteTimeout = 2000;
                Log($"Bağlantı kuruldu: {IpAddress}:{Port}");
                return true;
            }
            catch (Exception ex)
            {
                Log($"Bağlantı hatası: {ex.Message}");
                return false;
            }
        }

        public void Disconnect()
        {
            try
            {
                _stream?.Close();
                _tcpClient?.Close();
            }
            catch (Exception ex)
            {
                Log($"Bağlantı kapatma hatası: {ex.Message}");
            }
            finally
            {
                _stream = null;
                _tcpClient = null;
            }
        }

        public async Task<byte[]?> ReadRegistersAsync(ModbusFunctionCode function, ushort address, ushort quantity)
        {
            if (quantity == 0)
                throw new ArgumentOutOfRangeException(nameof(quantity), "Quantity >= 1 olmalı");

            if (_stream == null || _tcpClient?.Connected != true)
            {
                var connected = await ConnectAsync();
                if (!connected) return null;
            }

            var request = BuildRequest(function, address, quantity);
            try
            {
                await _stream!.WriteAsync(request, 0, request.Length);
                await _stream.FlushAsync();

                var header = new byte[9];
                if (!await ReadExactAsync(header)) return null;

                if (header[7] >= 0x80)
                {
                    Log($"Modbus exception. Function=0x{header[7]:X2}, Code=0x{header[8]:X2}");
                    return null;
                }

                if (header[7] != (byte)function)
                {
                    Log($"Beklenmeyen FunctionCode: 0x{header[7]:X2}");
                    return null;
                }

                int byteCount = header[8];
                if (byteCount != quantity * 2)
                {
                    Log($"Beklenmeyen byte sayısı: {byteCount}");
                    return null;
                }

                var payload = new byte[byteCount];
                if (!await ReadExactAsync(payload)) return null;

                Log($"Function {(byte)function:X2}, Start={address}, Qty={quantity} => {BitConverter.ToString(payload)}");
                return payload;
            }
            catch (Exception ex)
            {
                Log($"Register okuma hatası: {ex.Message}");
                Disconnect();
                return null;
            }
        }

        private byte[] BuildRequest(ModbusFunctionCode function, ushort startAddress, ushort quantity)
        {
            var buffer = new byte[12];

            lock (_lock)
            {
                _transactionId++;
                if (_transactionId == 0)
                    _transactionId = 1;
            }

            buffer[0] = (byte)(_transactionId >> 8);
            buffer[1] = (byte)(_transactionId & 0xFF);
            buffer[2] = 0;
            buffer[3] = 0;
            buffer[4] = 0;
            buffer[5] = 6;
            buffer[6] = SlaveId;
            buffer[7] = (byte)function;
            buffer[8] = (byte)(startAddress >> 8);
            buffer[9] = (byte)(startAddress & 0xFF);
            buffer[10] = (byte)(quantity >> 8);
            buffer[11] = (byte)(quantity & 0xFF);

            return buffer;
        }

        private async Task<bool> ReadExactAsync(byte[] buffer)
        {
            int offset = 0;
            while (offset < buffer.Length)
            {
                int read = await _stream!.ReadAsync(buffer, offset, buffer.Length - offset);
                if (read == 0)
                {
                    Log("Akış kapandı");
                    return false;
                }
                offset += read;
            }
            return true;
        }

        private void Log(string message)
        {
            if (!DebugMode) return;
            DebugLog?.Invoke(this, message);
        }

        public void Dispose()
        {
            Disconnect();
        }
    }
}

