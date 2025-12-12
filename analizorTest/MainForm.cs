using System;
using System.Collections.Generic;
using System.Drawing;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AnalizorTest
{
    public class MainForm : Form
    {
        private readonly TextBox _txtIp = new() { Text = "192.168.1.239", Width = 140 };
        private readonly TextBox _txtPort = new() { Text = "502", Width = 80 };
        private readonly TextBox _txtSlave = new() { Text = "1", Width = 60 };
        private readonly TextBox _txtAddress = new() { Text = "106", Width = 100 };
        private readonly NumericUpDown _numCount = new() { Minimum = 1, Maximum = 8, Value = 2 };
        private readonly CheckBox _chkOneBased = new() { Text = "1-Tabanlı varyantları da dene", Checked = true, AutoSize = true };
        private readonly ComboBox _cmbByteVariant = new();
        private readonly ComboBox _cmbWordVariant = new();
        private readonly Button _btnConnect = new() { Text = "Bağlan" };
        private readonly Button _btnDisconnect = new() { Text = "Bağlantıyı Kes", Enabled = false };
        private readonly Button _btnRead = new() { Text = "Oku" };
        private readonly TextBox _txtLog = new() { Multiline = true, ScrollBars = ScrollBars.Vertical, ReadOnly = true, Dock = DockStyle.Fill, BackColor = Color.FromArgb(44, 62, 80), ForeColor = Color.FromArgb(236, 240, 241), Font = new Font("Consolas", 9F) };
        private readonly TextBox _txtResult = new() { Multiline = true, ScrollBars = ScrollBars.Vertical, ReadOnly = true, Dock = DockStyle.Fill, Font = new Font("Consolas", 9F) };
        private readonly Label _lblStatus = new()
        {
            Text = "Bağlı Değil",
            ForeColor = Color.DarkRed,
            AutoSize = true
        };

        private EnergyModbusReader? _reader;

        public MainForm()
        {
            Text = "⚡ Enerji Analizörü Modbus Test";
            Size = new Size(1100, 750);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 9F);

            var mainLayout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 1,
                RowCount = 3
            };
            mainLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
            mainLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 50));

            mainLayout.Controls.Add(BuildConnectionPanel(), 0, 0);

            var resultGroup = new GroupBox
            {
                Text = "📈 Variant Sonuçları",
                Dock = DockStyle.Fill,
                Padding = new Padding(8)
            };
            resultGroup.Controls.Add(_txtResult);

            var logGroup = new GroupBox
            {
                Text = "📝 Log",
                Dock = DockStyle.Fill,
                Padding = new Padding(8)
            };
            logGroup.Controls.Add(_txtLog);

            mainLayout.Controls.Add(resultGroup, 0, 1);
            mainLayout.Controls.Add(logGroup, 0, 2);

            Controls.Add(mainLayout);

            _cmbByteVariant.DropDownStyle = ComboBoxStyle.DropDownList;
            _cmbByteVariant.Items.AddRange(new object[]
            {
                "Standard (AB)",
                "Byte Swap (BA)"
            });
            _cmbByteVariant.SelectedIndex = 0;

            _cmbWordVariant.DropDownStyle = ComboBoxStyle.DropDownList;
            _cmbWordVariant.Items.AddRange(new object[]
            {
                "Normal Sıra",
                "Word Swap"
            });
            _cmbWordVariant.SelectedIndex = 0;

            _btnConnect.Click += async (_, _) => await ConnectAsync();
            _btnDisconnect.Click += (_, _) => Disconnect();
            _btnRead.Click += async (_, _) => await ReadAsync();

            FormClosing += (_, _) => Disconnect();
        }

        private Control BuildConnectionPanel()
        {
            var panel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 210,
                Padding = new Padding(10),
                BackColor = Color.WhiteSmoke
            };

            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                ColumnCount = 6,
                RowCount = 4,
                AutoSize = true
            };

            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 110));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 160));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 130));
            layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));

            layout.Controls.Add(new Label { Text = "IP Adresi", Anchor = AnchorStyles.Left, AutoSize = true }, 0, 0);
            layout.Controls.Add(_txtIp, 1, 0);
            layout.Controls.Add(new Label { Text = "Port", Anchor = AnchorStyles.Left, AutoSize = true }, 2, 0);
            layout.Controls.Add(_txtPort, 3, 0);
            layout.Controls.Add(new Label { Text = "Slave ID", Anchor = AnchorStyles.Left, AutoSize = true }, 4, 0);
            layout.Controls.Add(_txtSlave, 5, 0);

            layout.Controls.Add(new Label { Text = "Başlangıç Register", Anchor = AnchorStyles.Left, AutoSize = true }, 0, 1);
            layout.Controls.Add(_txtAddress, 1, 1);
            layout.Controls.Add(new Label { Text = "Register Sayısı", Anchor = AnchorStyles.Left, AutoSize = true }, 2, 1);
            layout.Controls.Add(_numCount, 3, 1);
            layout.Controls.Add(_chkOneBased, 4, 1);
            layout.SetColumnSpan(_chkOneBased, 2);

            layout.Controls.Add(new Label { Text = "Byte Sırası", Anchor = AnchorStyles.Left, AutoSize = true }, 0, 2);
            layout.Controls.Add(_cmbByteVariant, 1, 2);
            layout.Controls.Add(new Label { Text = "Word Sırası", Anchor = AnchorStyles.Left, AutoSize = true }, 2, 2);
            layout.Controls.Add(_cmbWordVariant, 3, 2);

            var buttonPanel = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.LeftToRight,
                AutoSize = true
            };

            buttonPanel.Controls.Add(_btnConnect);
            buttonPanel.Controls.Add(_btnDisconnect);
            buttonPanel.Controls.Add(_btnRead);
            buttonPanel.Controls.Add(_lblStatus);

            layout.Controls.Add(buttonPanel, 0, 3);
            layout.SetColumnSpan(buttonPanel, 6);

            panel.Controls.Add(layout);
            return panel;
        }

        private async Task ConnectAsync()
        {
            try
            {
                if (!int.TryParse(_txtPort.Text, out var port))
                {
                    MessageBox.Show("Port sayısal olmalı", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                if (!byte.TryParse(_txtSlave.Text, out var slave))
                {
                    MessageBox.Show("Slave ID 0-255 arası olmalı", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                _reader?.Dispose();
                _reader = new EnergyModbusReader
                {
                    IpAddress = _txtIp.Text,
                    Port = port,
                    SlaveId = slave,
                    DebugMode = true
                };
                _reader.DebugLog += (_, msg) => AppendLog(msg);

                AppendLog($"Bağlanılıyor: {_txtIp.Text}:{port} (Slave {slave})");

                if (await _reader.ConnectAsync())
                {
                    AppendLog("Bağlantı başarılı");
                    _lblStatus.Text = "Bağlı";
                    _lblStatus.ForeColor = Color.ForestGreen;
                    _btnConnect.Enabled = false;
                    _btnDisconnect.Enabled = true;
                }
                else
                {
                    AppendLog("Bağlantı başarısız");
                    _lblStatus.Text = "Bağlı Değil";
                    _lblStatus.ForeColor = Color.DarkRed;
                }
            }
            catch (Exception ex)
            {
                AppendLog($"Bağlantı hatası: {ex.Message}");
                MessageBox.Show(ex.Message, "Bağlantı Hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void Disconnect()
        {
            try
            {
                _reader?.Dispose();
                _reader = null;
                AppendLog("Bağlantı kapatıldı");
            }
            catch (Exception ex)
            {
                AppendLog($"Bağlantı kapatma hatası: {ex.Message}");
            }
            finally
            {
                _btnConnect.Enabled = true;
                _btnDisconnect.Enabled = false;
                _lblStatus.Text = "Bağlı Değil";
                _lblStatus.ForeColor = Color.DarkRed;
            }
        }

        private async Task ReadAsync()
        {
            if (_reader == null)
            {
                MessageBox.Show("Önce bağlantı kur", "Uyarı", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            if (!long.TryParse(_txtAddress.Text, out var rawAddress))
            {
                MessageBox.Show("Adres sayısal olmalı", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            if (rawAddress < 0)
            {
                MessageBox.Show("Adres negatif olamaz", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var quantity = (ushort)_numCount.Value;
            var hypotheses = BuildAddressHypotheses(rawAddress, quantity);

            if (hypotheses.Count == 0)
            {
                MessageBox.Show("Bu adres için denenebilecek varyant bulunamadı", "Uyarı", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var reportBuilder = new StringBuilder();

            _btnRead.Enabled = false;
            Cursor = Cursors.WaitCursor;

            try
            {
                foreach (var hypothesis in hypotheses)
                {
                    AppendLog($"Deneme: {hypothesis.Description} | FC=0x{((byte)hypothesis.Function):X2} | Başlangıç={hypothesis.StartAddress} | Count={hypothesis.Quantity}");
                    var raw = await _reader.ReadRegistersAsync(hypothesis.Function, hypothesis.StartAddress, hypothesis.Quantity);

                    reportBuilder.AppendLine("====================================================");
                    reportBuilder.AppendLine(hypothesis.Description);
                    reportBuilder.AppendLine($"Fonksiyon: 0x{((byte)hypothesis.Function):X2} ({hypothesis.Function})");
                    reportBuilder.AppendLine($"Başlangıç (0-baz): {hypothesis.StartAddress}");
                    reportBuilder.AppendLine($"Register Sayısı: {hypothesis.Quantity}");

                    if (raw == null)
                    {
                        reportBuilder.AppendLine("Sonuç: Okuma başarısız.");
                    }
                    else
                    {
                        reportBuilder.AppendLine(BuildVariantDetails(raw, hypothesis.Quantity));
                    }

                    reportBuilder.AppendLine();
                }

                _txtResult.Text = reportBuilder.ToString();
            }
            catch (Exception ex)
            {
                AppendLog($"Okuma hatası: {ex.Message}");
            }
            finally
            {
                _btnRead.Enabled = true;
                Cursor = Cursors.Default;
            }
        }

        private string BuildVariantDetails(byte[] raw, ushort registerCount)
        {
            var sb = new StringBuilder();
            sb.AppendLine($"Raw ({raw.Length} byte): {BitConverter.ToString(raw)}");
            sb.AppendLine();

            bool selectedByteSwap = _cmbByteVariant.SelectedIndex == 1;
            bool selectedWordSwap = _cmbWordVariant.SelectedIndex == 1;

            var selectedVariant = ApplyVariant(raw, registerCount, selectedByteSwap, selectedWordSwap);
            sb.AppendLine($"Seçili varyant (ByteSwap={(selectedByteSwap ? "Evet" : "Hayır")}, WordSwap={(selectedWordSwap ? "Evet" : "Hayır")}):");
            AppendDataTypeInterpretation(sb, selectedVariant, registerCount);
            sb.AppendLine();

            sb.AppendLine("Tüm kombinasyonlar:");
            foreach (var bytesOption in new[] { false, true })
            {
                foreach (var wordsOption in new[] { false, true })
                {
                    if (bytesOption == selectedByteSwap && wordsOption == selectedWordSwap)
                        continue;

                    var variant = ApplyVariant(raw, registerCount, bytesOption, wordsOption);
                    var tag = $"  • ByteSwap={(bytesOption ? "Evet" : "Hayır")}, WordSwap={(wordsOption ? "Evet" : "Hayır")}";
                    sb.AppendLine(tag);
                    AppendDataTypeInterpretation(sb, variant, registerCount);
                    sb.AppendLine();
                }
            }

            return sb.ToString();
        }

        private static byte[] ApplyVariant(byte[] raw, int registerCount, bool swapBytes, bool swapWords)
        {
            var buffer = new byte[raw.Length];
            Buffer.BlockCopy(raw, 0, buffer, 0, raw.Length);

            if (swapBytes)
            {
                for (int i = 0; i < registerCount; i++)
                {
                    int index = i * 2;
                    (buffer[index], buffer[index + 1]) = (buffer[index + 1], buffer[index]);
                }
            }

            if (swapWords && registerCount > 1)
            {
                for (int i = 0; i < registerCount / 2; i++)
                {
                    int left = i * 2;
                    int right = (registerCount - 1 - i) * 2;

                    (buffer[left], buffer[right]) = (buffer[right], buffer[left]);
                    (buffer[left + 1], buffer[right + 1]) = (buffer[right + 1], buffer[left + 1]);
                }
            }

            return buffer;
        }

        private void AppendDataTypeInterpretation(StringBuilder sb, byte[] data, int registerCount)
        {
            sb.AppendLine($"Hex: {BitConverter.ToString(data)}");

            if (registerCount >= 1)
            {
                ushort u16 = ReadUInt16BigEndian(data, 0);
                short i16 = unchecked((short)u16);
                sb.AppendLine($"  - UInt16: {u16}");
                sb.AppendLine($"  -  Int16: {i16}");
            }
            else
            {
                sb.AppendLine("  - UInt16 / Int16: (En az 1 register gerekli)");
            }

            if (registerCount >= 2)
            {
                uint u32 = ReadUInt32BigEndian(data, 0);
                int i32 = unchecked((int)u32);
                float f32 = ReadSingleBigEndian(data, 0);
                sb.AppendLine($"  - UInt32: {u32}");
                sb.AppendLine($"  -  Int32: {i32}");
                sb.AppendLine($"  - Float32: {f32}");
            }
            else
            {
                sb.AppendLine("  - UInt32 / Int32 / Float32: (En az 2 register gerekli)");
            }

            if (registerCount >= 4)
            {
                ulong u64 = ReadUInt64BigEndian(data, 0);
                long i64 = unchecked((long)u64);
                double f64 = ReadDoubleBigEndian(data, 0);
                sb.AppendLine($"  - UInt64: {u64}");
                sb.AppendLine($"  -  Int64: {i64}");
                sb.AppendLine($"  - Float64: {f64}");
            }
            else
            {
                sb.AppendLine("  - UInt64 / Int64 / Float64: (En az 4 register gerekli)");
            }
        }

        private static ushort ReadUInt16BigEndian(byte[] buffer, int index)
        {
            return (ushort)((buffer[index] << 8) | buffer[index + 1]);
        }

        private static uint ReadUInt32BigEndian(byte[] buffer, int index)
        {
            return ((uint)buffer[index] << 24)
                 | ((uint)buffer[index + 1] << 16)
                 | ((uint)buffer[index + 2] << 8)
                 | buffer[index + 3];
        }

        private static float ReadSingleBigEndian(byte[] buffer, int index)
        {
            var bytes = new byte[4];
            bytes[0] = buffer[index + 3];
            bytes[1] = buffer[index + 2];
            bytes[2] = buffer[index + 1];
            bytes[3] = buffer[index];
            return BitConverter.ToSingle(bytes, 0);
        }

        private static ulong ReadUInt64BigEndian(byte[] buffer, int index)
        {
            return ((ulong)buffer[index] << 56)
                 | ((ulong)buffer[index + 1] << 48)
                 | ((ulong)buffer[index + 2] << 40)
                 | ((ulong)buffer[index + 3] << 32)
                 | ((ulong)buffer[index + 4] << 24)
                 | ((ulong)buffer[index + 5] << 16)
                 | ((ulong)buffer[index + 6] << 8)
                 | buffer[index + 7];
        }

        private static double ReadDoubleBigEndian(byte[] buffer, int index)
        {
            var bytes = new byte[8];
            for (int i = 0; i < 8; i++)
            {
                bytes[7 - i] = buffer[index + i];
            }
            return BitConverter.ToDouble(bytes, 0);
        }

        private sealed record AddressHypothesis(string Description, EnergyModbusReader.ModbusFunctionCode Function, ushort StartAddress, ushort Quantity);

        private List<AddressHypothesis> BuildAddressHypotheses(long rawAddress, ushort quantity)
        {
            var result = new List<AddressHypothesis>();
            var seen = new HashSet<string>();
            bool includeOneBased = _chkOneBased.Checked;

            void TryAdd(string description, EnergyModbusReader.ModbusFunctionCode function, long start)
            {
                if (start < 0 || start > ushort.MaxValue) return;
                if (start + quantity > 0x10000) return;
                string key = $"{(byte)function}:{start}";
                if (seen.Add(key))
                {
                    result.Add(new AddressHypothesis(description, function, (ushort)start, quantity));
                }
            }

            string FormatOffset(long offset) => offset switch
            {
                > 0 => $"+{offset}",
                0 => "0",
                _ => offset.ToString()
            };

            var fc03 = EnergyModbusReader.ModbusFunctionCode.ReadHoldingRegisters;
            var fc04 = EnergyModbusReader.ModbusFunctionCode.ReadInputRegisters;

            foreach (var offset in new[] { -2L, -1L, 0L, 1L, 2L })
            {
                long candidate = rawAddress + offset;
                string suffix = offset == 0 ? " (girilen)" : $" (girilen {FormatOffset(offset)})";
                TryAdd($"FC03 | 0-baz{suffix}", fc03, candidate);
                TryAdd($"FC04 | 0-baz{suffix}", fc04, candidate);
            }

            if (includeOneBased)
            {
                TryAdd("FC03 | 1-baz (girilen-1)", fc03, rawAddress - 1);
                TryAdd("FC04 | 1-baz (girilen-1)", fc04, rawAddress - 1);
            }

            long wordBase = SafeMul(rawAddress, 2);
            if (wordBase != long.MinValue)
            {
                TryAdd("FC03 | Word (girilen*2)", fc03, wordBase);
                TryAdd("FC04 | Word (girilen*2)", fc04, wordBase);
            }

            if (includeOneBased)
            {
                if (wordBase != long.MinValue)
                {
                    TryAdd("FC03 | Word 1-baz (girilen*2-1)", fc03, wordBase - 1);
                    TryAdd("FC04 | Word 1-baz (girilen*2-1)", fc04, wordBase - 1);
                }
            }

            if (rawAddress % 2 == 0)
            {
                TryAdd("FC03 | Word -> Register (girilen/2)", fc03, rawAddress / 2);
                TryAdd("FC04 | Word -> Register (girilen/2)", fc04, rawAddress / 2);
            }

            long fourBase = rawAddress - 40001;
            TryAdd("FC03 | 4xxxx -> değer-40001", fc03, fourBase);
            long fourBaseOne = rawAddress - 40000;
            if (includeOneBased)
                TryAdd("FC03 | 4xxxx -> değer-40000", fc03, fourBaseOne);
            long fourWord = SafeMul(fourBase, 2);
            if (fourWord != long.MinValue)
                TryAdd("FC03 | 4xxxx Word -> (değer-40001)*2", fc03, fourWord);
            if (includeOneBased)
            {
                long fourWordOneBased = SafeMul(fourBaseOne, 2);
                if (fourWordOneBased != long.MinValue)
                    TryAdd("FC03 | 4xxxx Word -> (değer-40000)*2", fc03, fourWordOneBased);
            }
            if (fourBase % 2 == 0)
                TryAdd("FC03 | 4xxxx Word -> (değer-40001)/2", fc03, fourBase / 2);

            long threeBase = rawAddress - 30001;
            TryAdd("FC04 | 3xxxx -> değer-30001", fc04, threeBase);
            long threeBaseOne = rawAddress - 30000;
            if (includeOneBased)
                TryAdd("FC04 | 3xxxx -> değer-30000", fc04, threeBaseOne);
            long threeWord = SafeMul(threeBase, 2);
            if (threeWord != long.MinValue)
                TryAdd("FC04 | 3xxxx Word -> (değer-30001)*2", fc04, threeWord);
            if (includeOneBased)
            {
                long threeWordOneBased = SafeMul(threeBaseOne, 2);
                if (threeWordOneBased != long.MinValue)
                    TryAdd("FC04 | 3xxxx Word -> (değer-30000)*2", fc04, threeWordOneBased);
            }
            if (threeBase % 2 == 0)
                TryAdd("FC04 | 3xxxx Word -> (değer-30001)/2", fc04, threeBase / 2);

            static long SafeMul(long value, long factor)
            {
                try
                {
                    return checked(value * factor);
                }
                catch (OverflowException)
                {
                    return long.MinValue;
                }
            }

            return result;
        }

        private void AppendLog(string message)
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => AppendLog(message)));
                return;
            }

            var line = $"[{DateTime.Now:HH:mm:ss.fff}] {message}{Environment.NewLine}";
            _txtLog.AppendText(line);
        }
    }
}

