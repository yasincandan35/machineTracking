using System;
using System.Drawing;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace RobotDataCollector
{
    public partial class MainForm : Form
    {
        private RobotModbusReader? _reader;
        private CancellationTokenSource? _cancellationTokenSource;
        private bool _isReading = false;

        // Bağlantı kontrolleri
        private TextBox txtIpAddress = null!;
        private TextBox txtPort = null!;
        private TextBox txtSlaveId = null!;
        private TextBox txtInterval = null!;
        private ComboBox cmbByteOrder = null!;
        private Button btnConnect = null!;
        private Button btnDisconnect = null!;
        private Label lblConnectionStatus = null!;

        // Alarm durumları
        private Panel pnlAlarms = null!;
        private Label[] alarmLabels = Array.Empty<Label>();

        // Running durumları
        private Panel pnlRunning = null!;
        private Label[] runningLabels = Array.Empty<Label>();

        // Veri gösterimi
        private Panel pnlData = null!;
        private Label[] dataLabels = Array.Empty<Label>();

        // Status gösterimi
        private Panel pnlStatus = null!;
        private Label[] statusLabels = Array.Empty<Label>();

        // Log
        private TextBox txtLog = null!;

        // Reset butonu
        private Button btnReset = null!;

        public MainForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "🤖 机器人数据收集器 / Robot Data Collector - Modbus TCP";
            this.Size = new Size(1200, 900);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(240, 242, 245); // Modern açık gri arka plan
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Bağlantı paneli - Modern tasarım (2 satır)
            var pnlConnection = new Panel
            {
                Dock = DockStyle.Top,
                Height = 160,
                BackColor = Color.FromArgb(255, 255, 255),
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(15)
            };

            // Başlık
            var lblTitle = new Label
            {
                Text = "🔌 连接设置 / Connection Settings",
                Location = new Point(15, 10),
                Width = 250,
                Font = new Font("Segoe UI", 11F, FontStyle.Bold),
                ForeColor = Color.FromArgb(52, 73, 94)
            };

            // İlk satır
            var lblIp = new Label 
            { 
                Text = "🌐 IP地址 / IP Address:", 
                Location = new Point(15, 40), 
                Width = 140,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(52, 73, 94)
            };
            txtIpAddress = new TextBox 
            { 
                Text = "192.168.1.31", 
                Location = new Point(160, 37), 
                Width = 150,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9F)
            };

            var lblPort = new Label 
            { 
                Text = "🔌 端口 / Port:", 
                Location = new Point(320, 40), 
                Width = 90,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(52, 73, 94)
            };
            txtPort = new TextBox 
            { 
                Text = "502", 
                Location = new Point(415, 37), 
                Width = 80,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9F)
            };

            var lblSlaveId = new Label 
            { 
                Text = "🆔 从站ID / Slave ID:", 
                Location = new Point(510, 40), 
                Width = 120,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(52, 73, 94)
            };
            txtSlaveId = new TextBox 
            { 
                Text = "1", 
                Location = new Point(635, 37), 
                Width = 60,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9F)
            };

            var lblInterval = new Label 
            { 
                Text = "⏱️ 间隔(毫秒) / Interval (ms):", 
                Location = new Point(710, 40), 
                Width = 180,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(52, 73, 94)
            };
            txtInterval = new TextBox 
            { 
                Text = "2000", 
                Location = new Point(895, 37), 
                Width = 80,
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Consolas", 9F)
            };

            // İkinci satır
            var lblByteOrder = new Label 
            { 
                Text = "🔧 字节顺序 / Byte Order:", 
                Location = new Point(15, 80), 
                Width = 150,
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(52, 73, 94)
            };
            cmbByteOrder = new ComboBox
            {
                Location = new Point(170, 77),
                Width = 450,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Font = new Font("Segoe UI", 9F),
                FlatStyle = FlatStyle.Flat
            };
            cmbByteOrder.Items.AddRange(new string[] {
                "变体1: 高-低 (大端序 - 标准) / Variant 1: High-Low (Big Endian - Standard)",
                "变体2: 低-高 (小端序) / Variant 2: Low-High (Little Endian)",
                "变体3: 交换 / Variant 3: Swap"
            });
            cmbByteOrder.SelectedIndex = 0;

            btnConnect = new Button
            {
                Text = "✅ 连接 / Connect",
                Location = new Point(630, 75),
                Size = new Size(130, 35),
                BackColor = Color.FromArgb(46, 204, 113), // Modern yeşil
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnConnect.FlatAppearance.BorderSize = 0;
            btnConnect.FlatAppearance.MouseOverBackColor = Color.FromArgb(39, 174, 96);
            btnConnect.Click += BtnConnect_Click;

            btnDisconnect = new Button
            {
                Text = "❌ 断开连接 / Disconnect",
                Location = new Point(770, 75),
                Size = new Size(150, 35),
                BackColor = Color.FromArgb(231, 76, 60), // Modern kırmızı
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            btnDisconnect.FlatAppearance.BorderSize = 0;
            btnDisconnect.FlatAppearance.MouseOverBackColor = Color.FromArgb(192, 57, 43);
            btnDisconnect.Click += BtnDisconnect_Click;

            btnReset = new Button
            {
                Text = "🔄 复位 / Reset",
                Location = new Point(930, 75),
                Size = new Size(130, 35),
                BackColor = Color.FromArgb(241, 196, 15), // Modern sarı/turuncu
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5F, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            btnReset.FlatAppearance.BorderSize = 0;
            btnReset.FlatAppearance.MouseOverBackColor = Color.FromArgb(243, 156, 18);
            btnReset.Click += BtnReset_Click;

            lblConnectionStatus = new Label
            {
                Text = "🔴 未连接 / Not Connected",
                Location = new Point(15, 120),
                Width = 600,
                ForeColor = Color.FromArgb(231, 76, 60),
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                BackColor = Color.Transparent
            };

            pnlConnection.Controls.AddRange(new Control[] {
                lblTitle, lblIp, txtIpAddress, lblPort, txtPort, lblSlaveId, txtSlaveId,
                lblInterval, txtInterval, btnConnect, btnDisconnect, btnReset, lblConnectionStatus,
                lblByteOrder, cmbByteOrder
            });

            // Ana içerik paneli (ortada)
            var pnlMain = new Panel 
            { 
                Dock = DockStyle.Fill, 
                Padding = new Padding(15),
                BackColor = Color.FromArgb(240, 242, 245)
            };
            
            // Log paneli - En alta, tüm genişlikte
            var pnlLog = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 200,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White
            };

            var lblLogTitle = new Label
            {
                Text = "📝 日志 / LOG",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(52, 73, 94),
                ForeColor = Color.White
            };

            txtLog = new TextBox
            {
                Dock = DockStyle.Fill,
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Font = new Font("Consolas", 8.5F),
                BackColor = Color.FromArgb(44, 62, 80),
                ForeColor = Color.FromArgb(236, 240, 241),
                BorderStyle = BorderStyle.None,
                Padding = new Padding(8)
            };

            pnlLog.Controls.Add(txtLog);
            pnlLog.Controls.Add(lblLogTitle);

            // Sol panel - Alarm ve Running
            var pnlLeft = new Panel
            {
                Dock = DockStyle.Left,
                Width = 500,
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(5)
            };

            // Alarm paneli
            pnlAlarms = new Panel
            {
                Dock = DockStyle.Top,
                Height = 220,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12),
                BackColor = Color.White
            };

            var lblAlarmsTitle = new Label
            {
                Text = "🚨 报警状态 / ALARM STATUS",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(231, 76, 60),
                ForeColor = Color.White
            };

            alarmLabels = new Label[7];
            string[] alarmNames = {
                "等距皮带报警 (线圈0) / Isometric Belt Alarm (Coil 0)",
                "好品桁架报警 (线圈1) / Good Product Gantry Alarm (Coil 1)",
                "侧推机构1报警 (线圈2) / Side Push Mechanism 1 Alarm (Coil 2)",
                "侧推机构2报警 (线圈3) / Side Push Mechanism 2 Alarm (Coil 3)",
                "整形平台报警 (线圈4) / Forming Platform Alarm (Coil 4)",
                "废品机构报警 (线圈5) / Reject Mechanism Alarm (Coil 5)",
                "栈板线报警 (线圈6) / Pallet Line Alarm (Coil 6)"
            };

            for (int i = 0; i < alarmLabels.Length; i++)
            {
                alarmLabels[i] = new Label
                {
                    Text = $"{alarmNames[i]}: -",
                    Location = new Point(12, 40 + i * 25),
                    Width = 460,
                    Height = 22,
                    AutoSize = false,
                    Font = new Font("Segoe UI", 9F),
                    Padding = new Padding(5, 0, 0, 0)
                };
                pnlAlarms.Controls.Add(alarmLabels[i]);
            }

            pnlAlarms.Controls.Add(lblAlarmsTitle);

            // Running paneli
            pnlRunning = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12),
                BackColor = Color.White
            };

            var lblRunningTitle = new Label
            {
                Text = "⚙️ 运行状态 / RUNNING STATUS",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(46, 204, 113),
                ForeColor = Color.White
            };

            runningLabels = new Label[3];
            string[] runningNames = {
                "等距皮带运行中 (线圈50) / Isometric Belt Running (Coil 50)",
                "码垛机构运行中 (线圈51) / Palletising Mechanism Running (Coil 51)",
                "栈板线运行中 (线圈52) / Pallet Line Running (Coil 52)"
            };

            for (int i = 0; i < runningLabels.Length; i++)
            {
                runningLabels[i] = new Label
                {
                    Text = $"{runningNames[i]}: -",
                    Location = new Point(12, 40 + i * 25),
                    Width = 460,
                    Height = 22,
                    AutoSize = false,
                    Font = new Font("Segoe UI", 9F),
                    Padding = new Padding(5, 0, 0, 0)
                };
                pnlRunning.Controls.Add(runningLabels[i]);
            }

            pnlRunning.Controls.Add(lblRunningTitle);

            pnlLeft.Controls.Add(pnlRunning);
            pnlLeft.Controls.Add(pnlAlarms);

            // Sağ panel - Veri ve Status
            var pnlRight = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                Padding = new Padding(5)
            };

            // Veri paneli
            pnlData = new Panel
            {
                Dock = DockStyle.Top,
                Height = 220,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12),
                BackColor = Color.White
            };

            var lblDataTitle = new Label
            {
                Text = "📊 数据 / DATA",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(52, 152, 219),
                ForeColor = Color.White
            };

            dataLabels = new Label[4];
            string[] dataNames = {
                "合格品数量 (寄存器0) / Qualified Items (Register 0)",
                "残次品数量 (寄存器1) / Defective Items (Register 1)",
                "好品托盘数 (寄存器2) / Good Pallets (Register 2)",
                "次品托盘数 (寄存器3) / Defective Pallets (Register 3)"
            };

            for (int i = 0; i < dataLabels.Length; i++)
            {
                dataLabels[i] = new Label
                {
                    Text = $"{dataNames[i]}: -",
                    Location = new Point(12, 40 + i * 40),
                    Width = 560,
                    Height = 35,
                    AutoSize = false,
                    Font = new Font("Segoe UI", 9.5F),
                    Padding = new Padding(5, 0, 0, 0)
                };
                pnlData.Controls.Add(dataLabels[i]);
            }

            pnlData.Controls.Add(lblDataTitle);

            // Status paneli
            pnlStatus = new Panel
            {
                Dock = DockStyle.Fill,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(12),
                BackColor = Color.White
            };

            var lblStatusTitle = new Label
            {
                Text = "🔧 设备状态 / DEVICE STATUS",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Segoe UI", 10.5F, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(155, 89, 182),
                ForeColor = Color.White
            };

            statusLabels = new Label[2];
            string[] statusNames = {
                "等距皮带设备状态 (寄存器4) / Equidistant Belt Status (Register 4)",
                "码垛机构设备状态 (寄存器5) / Palletising Mechanism Status (Register 5)"
            };

            for (int i = 0; i < statusLabels.Length; i++)
            {
                statusLabels[i] = new Label
                {
                    Text = $"{statusNames[i]}: -",
                    Location = new Point(12, 40 + i * 40),
                    Width = 560,
                    Height = 35,
                    AutoSize = false,
                    Font = new Font("Segoe UI", 9.5F),
                    Padding = new Padding(5, 0, 0, 0)
                };
                pnlStatus.Controls.Add(statusLabels[i]);
            }

            pnlStatus.Controls.Add(lblStatusTitle);

            pnlRight.Controls.Add(pnlStatus);
            pnlRight.Controls.Add(pnlData);

            // Ana içerik panellerini ekle (log değil, log ayrı)
            pnlMain.Controls.Add(pnlRight);
            pnlMain.Controls.Add(pnlLeft);

            // Form'a ekle: Önce log (en alta), sonra main (ortada), sonra connection (en üstte)
            this.Controls.Add(pnlLog);
            this.Controls.Add(pnlMain);
            this.Controls.Add(pnlConnection);

            this.FormClosing += MainForm_FormClosing;
        }

        private async void BtnConnect_Click(object? sender, EventArgs e)
        {
            try
            {
                if (!byte.TryParse(txtSlaveId.Text, out byte slaveId))
                {
                    MessageBox.Show("从站ID必须是有效数字！/ Slave ID must be a valid number!", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                if (!int.TryParse(txtPort.Text, out int port))
                {
                    MessageBox.Show("端口必须是有效数字！/ Port must be a valid number!", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                if (!int.TryParse(txtInterval.Text, out int interval) || interval < 100)
                {
                    MessageBox.Show("间隔必须至少100毫秒！/ Interval must be at least 100ms!", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                _reader = new RobotModbusReader
                {
                    IpAddress = txtIpAddress.Text,
                    Port = port,
                    SlaveId = slaveId,
                    ByteOrderVariant = cmbByteOrder.SelectedIndex,
                    DebugMode = true
                };

                // Debug log event'ini bağla
                _reader.DebugLog += (sender, msg) => {
                    if (this.InvokeRequired)
                        this.Invoke(new Action(() => AddLog(msg)));
                    else
                        AddLog(msg);
                };

                string byteOrderName = cmbByteOrder.SelectedItem?.ToString() ?? "变体1 / Variant 1";
                AddLog($"连接中 / Connecting: {txtIpAddress.Text}:{port} (从站ID / Slave ID: {slaveId}, {byteOrderName})...");
                AddLog($"📊 实时数据读取 / LIVE DATA READING: 每{interval}毫秒持续读取 / Continuous reading every {interval}ms");

                if (await _reader.ConnectAsync())
                {
                    _isReading = true;
                    _cancellationTokenSource = new CancellationTokenSource();

                btnConnect.Enabled = false;
                btnDisconnect.Enabled = true;
                btnReset.Enabled = true;
                txtIpAddress.Enabled = false;
                txtPort.Enabled = false;
                txtSlaveId.Enabled = false;
                txtInterval.Enabled = false;
                cmbByteOrder.Enabled = false;

                    lblConnectionStatus.Text = "🟢 已连接 ✓ - 实时数据读取中 / Connected ✓ - Live Data Reading";
                    lblConnectionStatus.ForeColor = Color.FromArgb(46, 204, 113);

                    AddLog("✅ 连接成功！开始数据读取... / Connection successful! Starting data reading...");

                    // Okuma döngüsünü başlat
                    _ = Task.Run(async () => await ReadDataLoopAsync(interval, _cancellationTokenSource.Token));
                }
                else
                {
                    AddLog("❌ 连接失败！/ Connection failed!");
                    MessageBox.Show("无法连接到PLC！/ Unable to connect to PLC!", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            catch (Exception ex)
            {
                AddLog($"❌ 错误 / Error: {ex.Message}");
                MessageBox.Show($"连接错误 / Connection Error: {ex.Message}", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void BtnDisconnect_Click(object? sender, EventArgs e)
        {
            try
            {
                _isReading = false;
                _cancellationTokenSource?.Cancel();
                _reader?.Disconnect();
                _reader = null;

                btnConnect.Enabled = true;
                btnDisconnect.Enabled = false;
                btnReset.Enabled = false;
                txtIpAddress.Enabled = true;
                txtPort.Enabled = true;
                txtSlaveId.Enabled = true;
                txtInterval.Enabled = true;
                cmbByteOrder.Enabled = true;

                lblConnectionStatus.Text = "🔴 未连接 / Not Connected";
                lblConnectionStatus.ForeColor = Color.FromArgb(231, 76, 60);

                // Tüm değerleri sıfırla
                ClearAllData();

                AddLog("连接已断开 / Connection disconnected.");
            }
            catch (Exception ex)
            {
                AddLog($"❌ 断开连接错误 / Disconnect error: {ex.Message}");
            }
        }

        private async Task ReadDataLoopAsync(int intervalMs, CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested && _isReading)
            {
                try
                {
                    if (_reader == null) break;

                    var data = await _reader.ReadAllDataAsync();
                    if (data != null)
                    {
                        // UI güncellemesi için Invoke kullan
                        if (this.InvokeRequired)
                        {
                            this.Invoke(new Action(() => UpdateUI(data)));
                        }
                        else
                        {
                            UpdateUI(data);
                        }
                        
                        // Her 10 okumada bir log (çok fazla log olmasın)
                        // İsterseniz bu satırı kaldırabilirsiniz
                    }
                    else
                    {
                        if (this.InvokeRequired)
                            this.Invoke(new Action(() => AddLog("⚠️ 无法读取数据 / Unable to read data")));
                        else
                            AddLog("⚠️ 无法读取数据 / Unable to read data");
                    }

                    await Task.Delay(intervalMs, cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    AddLog($"❌ 读取错误 / Read error: {ex.Message}");
                    await Task.Delay(1000, cancellationToken);
                }
            }
        }

        private void UpdateUI(RobotData data)
        {
            try
            {
                // Alarm durumları
                alarmLabels[0].Text = $"等距皮带报警 (线圈0) / Isometric Belt Alarm (Coil 0): {(data.IsometricBeltAlarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[0].ForeColor = data.IsometricBeltAlarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[1].Text = $"好品桁架报警 (线圈1) / Good Product Gantry Alarm (Coil 1): {(data.GoodProductGantryAlarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[1].ForeColor = data.GoodProductGantryAlarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[2].Text = $"侧推机构1报警 (线圈2) / Side Push Mechanism 1 Alarm (Coil 2): {(data.SidePushMechanism1Alarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[2].ForeColor = data.SidePushMechanism1Alarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[3].Text = $"侧推机构2报警 (线圈3) / Side Push Mechanism 2 Alarm (Coil 3): {(data.SidePushMechanism2Alarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[3].ForeColor = data.SidePushMechanism2Alarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[4].Text = $"整形平台报警 (线圈4) / Forming Platform Alarm (Coil 4): {(data.FormingPlatformAlarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[4].ForeColor = data.FormingPlatformAlarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[5].Text = $"废品机构报警 (线圈5) / Reject Mechanism Alarm (Coil 5): {(data.RejectMechanismAlarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[5].ForeColor = data.RejectMechanismAlarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                alarmLabels[6].Text = $"栈板线报警 (线圈6) / Pallet Line Alarm (Coil 6): {(data.PalletLineAlarm ? "🔴 报警 / ALARM" : "🟢 正常 / OK")}";
                alarmLabels[6].ForeColor = data.PalletLineAlarm ? Color.FromArgb(231, 76, 60) : Color.FromArgb(46, 204, 113);

                // Running durumları
                runningLabels[0].Text = $"等距皮带运行中 (线圈50) / Isometric Belt Running (Coil 50): {(data.IsometricBeltRunning ? "🟢 运行中 / RUNNING" : "⚪ 停止 / STOPPED")}";
                runningLabels[0].ForeColor = data.IsometricBeltRunning ? Color.FromArgb(46, 204, 113) : Color.FromArgb(149, 165, 166);

                runningLabels[1].Text = $"码垛机构运行中 (线圈51) / Palletising Mechanism Running (Coil 51): {(data.PalletisingMechanismRunning ? "🟢 运行中 / RUNNING" : "⚪ 停止 / STOPPED")}";
                runningLabels[1].ForeColor = data.PalletisingMechanismRunning ? Color.FromArgb(46, 204, 113) : Color.FromArgb(149, 165, 166);

                runningLabels[2].Text = $"栈板线运行中 (线圈52) / Pallet Line Running (Coil 52): {(data.PalletLineRunning ? "🟢 运行中 / RUNNING" : "⚪ 停止 / STOPPED")}";
                runningLabels[2].ForeColor = data.PalletLineRunning ? Color.FromArgb(46, 204, 113) : Color.FromArgb(149, 165, 166);

                // Veriler
                dataLabels[0].Text = $"合格品数量 (寄存器0) / Qualified Items (Register 0): {data.QualifiedItemsCount:N0}";
                dataLabels[1].Text = $"残次品数量 (寄存器1) / Defective Items (Register 1): {data.DefectiveItemsCount:N0}";
                dataLabels[2].Text = $"好品托盘数 (寄存器2) / Good Pallets (Register 2): {data.GoodPalletsCount:N0}";
                dataLabels[3].Text = $"次品托盘数 (寄存器3) / Defective Pallets (Register 3): {data.DefectivePalletsCount:N0}";

                // Status
                statusLabels[0].Text = $"等距皮带设备状态 (寄存器4) / Equidistant Belt Status (Register 4): {data.GetStatusString(data.EquidistantBeltStatus)} ({data.EquidistantBeltStatus})";
                statusLabels[1].Text = $"码垛机构设备状态 (寄存器5) / Palletising Mechanism Status (Register 5): {data.GetStatusString(data.PalletisingMechanismStatus)} ({data.PalletisingMechanismStatus})";

                // Reset Counter
                if (data.ResetCounter)
                {
                    AddLog($"⚠️ 复位计数器激活！/ Reset Counter active! - {data.Timestamp:HH:mm:ss.fff}");
                }
            }
            catch (Exception ex)
            {
                AddLog($"❌ UI更新错误 / UI update error: {ex.Message}");
            }
        }

        private void ClearAllData()
        {
            foreach (var label in alarmLabels)
            {
                label.Text = label.Text.Split(':')[0] + ": -";
                label.ForeColor = Color.FromArgb(52, 73, 94);
            }

            foreach (var label in runningLabels)
            {
                label.Text = label.Text.Split(':')[0] + ": -";
                label.ForeColor = Color.FromArgb(52, 73, 94);
            }

            foreach (var label in dataLabels)
            {
                label.Text = label.Text.Split(':')[0] + ": -";
                label.ForeColor = Color.FromArgb(52, 73, 94);
            }

            foreach (var label in statusLabels)
            {
                label.Text = label.Text.Split(':')[0] + ": -";
                label.ForeColor = Color.FromArgb(52, 73, 94);
            }
        }

        private void AddLog(string message)
        {
            if (txtLog.InvokeRequired)
            {
                txtLog.Invoke(new Action(() => AddLog(message)));
                return;
            }

            string logMessage = $"[{DateTime.Now:HH:mm:ss.fff}] {message}\r\n";
            txtLog.AppendText(logMessage);
            txtLog.SelectionStart = txtLog.Text.Length;
            txtLog.ScrollToCaret();

            // Log çok uzarsa temizle (son 1000 satır)
            if (txtLog.Lines.Length > 1000)
            {
                var lines = txtLog.Lines;
                var newLines = new string[1000];
                Array.Copy(lines, lines.Length - 1000, newLines, 0, 1000);
                txtLog.Lines = newLines;
            }
        }

        private async void BtnReset_Click(object? sender, EventArgs e)
        {
            try
            {
                if (_reader == null)
                {
                    MessageBox.Show("请先连接到PLC！/ Please connect to PLC first!", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                btnReset.Enabled = false;
                AddLog("🔄 正在复位计数器 (线圈20) / Resetting counter (Coil 20)...");

                // Reset butonuna bas (Coil 20 = true)
                bool success = await _reader.WriteCoilAsync(20, true);
                
                if (success)
                {
                    AddLog("✅ 复位计数器已激活 / Reset counter activated!");
                    
                    // 200ms sonra reset'i kapat (pulse)
                    await Task.Delay(200);
                    await _reader.WriteCoilAsync(20, false);
                    AddLog("✅ 复位计数器已释放 / Reset counter released!");
                }
                else
                {
                    AddLog("❌ 复位失败！/ Reset failed!");
                    MessageBox.Show("复位失败！请检查连接。/ Reset failed! Please check connection.", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }

                btnReset.Enabled = true;
            }
            catch (Exception ex)
            {
                AddLog($"❌ 复位错误 / Reset error: {ex.Message}");
                MessageBox.Show($"复位错误 / Reset Error: {ex.Message}", "错误 / Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                btnReset.Enabled = true;
            }
        }

        private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
        {
            _isReading = false;
            _cancellationTokenSource?.Cancel();
            _reader?.Dispose();
        }
    }
}

