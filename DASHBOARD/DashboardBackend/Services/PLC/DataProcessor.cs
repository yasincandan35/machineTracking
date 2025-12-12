using System;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Threading;
using Microsoft.Data.SqlClient;

namespace DashboardBackend.Services.PLC
{
    /// <summary>
    /// PLC verilerini işleyen ve veritabanına kaydeden servis
    /// </summary>
    public class DataProcessor : IDisposable
    {
        private readonly string connectionString;
        private PLCData? lastProcessedData;
        private readonly object dataLock = new object();
        private SqlProxy? sqlProxy;
        private int? cachedUndefinedCategoryId;
        private int? cachedUndefinedReasonId;
        private int UndefinedStoppageCategoryId => cachedUndefinedCategoryId ??= ResolveUndefinedCategoryId();
        private int UndefinedStoppageReasonId => cachedUndefinedReasonId ??= ResolveUndefinedReasonId(UndefinedStoppageCategoryId);
        private const string DefaultUndefinedCategorySettingKey = "DefaultUndefinedCategoryId";
        private const string DefaultUndefinedReasonSettingKey = "DefaultUndefinedReasonId";
        private static readonly string[] UndefinedCategoryTokens = new[] { "tanimsiz", "tanımsız" };
        private static readonly string[] UndefinedReasonTokens = new[] { "tanimsiz", "tanımsız" };
        private const string DefaultTrackingTable = "dataRecords";
        
        // Dinamik kayıt sıklığı ile timer
        private System.Threading.Timer? saveTimer;
        public int SaveIntervalMs { get; set; } = 1000; // Admin panelden ayarlanabilir (varsayılan: 1 saniye)
        
        // Stoppage tracking
        private bool? lastMachineStoppedState = null;
        private DateTime? stoppageStartTime = null;
        private int currentCategoryId = 0;
        private int currentReasonId = 0;
        private bool isStoppageRecordSaved = false; // Aynı duruş için tekrar kayıt yapılmasını engelle
        private const int MinimumStoppageDurationSeconds = 30;
        private readonly SemaphoreSlim stoppageSemaphore = new SemaphoreSlim(1, 1);

        public DataProcessor(SqlProxy sqlProxy)
        {
            this.sqlProxy = sqlProxy ?? throw new ArgumentNullException(nameof(sqlProxy));
            // SqlProxy'den connection string'i al
            this.connectionString = sqlProxy.ConnectionString 
                ?? throw new InvalidOperationException("SqlProxy connection string bulunamadı");
            // Önce ayarları yükle, sonra timer'ı başlat
            _ = LoadSettingsFromDatabaseAsync();
        }

        private int ResolveUndefinedCategoryId()
        {
            var databaseValue = TryGetUndefinedCategoryIdFromDatabase();
            if (databaseValue.HasValue)
            {
                PersistUndefinedSettingValue(DefaultUndefinedCategorySettingKey, databaseValue.Value);
                cachedUndefinedReasonId = null; // kategori değişirse sebebi yeniden hesapla
                return databaseValue.Value;
            }

            return GetUndefinedIdFromSettings(DefaultUndefinedCategorySettingKey, 16);
        }

        private int ResolveUndefinedReasonId(int categoryId)
        {
            var databaseValue = TryGetUndefinedReasonIdFromDatabase(categoryId);
            if (databaseValue.HasValue)
            {
                PersistUndefinedSettingValue(DefaultUndefinedReasonSettingKey, databaseValue.Value);
                return databaseValue.Value;
            }

            return GetUndefinedIdFromSettings(DefaultUndefinedReasonSettingKey, 35);
        }

        private int GetUndefinedIdFromSettings(string settingKey, int defaultValue)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                var selectCmd = new SqlCommand("SELECT SettingValue FROM plc_save_settings WHERE SettingKey = @key", conn);
                selectCmd.Parameters.AddWithValue("@key", settingKey);

                var result = selectCmd.ExecuteScalar();
                if (result != null && int.TryParse(result.ToString(), out var parsedValue))
                {
                    return parsedValue;
                }

                var upsertCmd = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM plc_save_settings WHERE SettingKey = @key)
                        UPDATE plc_save_settings SET SettingValue = @value WHERE SettingKey = @key;
                    ELSE
                        INSERT INTO plc_save_settings (SettingKey, SettingValue, Description)
                        VALUES (@key, @value, 'Varsayılan tanımsız duruş ID değeri');
                ", conn);

                upsertCmd.Parameters.AddWithValue("@key", settingKey);
                upsertCmd.Parameters.AddWithValue("@value", defaultValue.ToString());
                upsertCmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ {settingKey} değeri alınamadı: {ex.Message}");
            }

            return defaultValue;
        }

        private void PersistUndefinedSettingValue(string settingKey, int value)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                var cmd = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM plc_save_settings WHERE SettingKey = @key)
                        UPDATE plc_save_settings SET SettingValue = @value WHERE SettingKey = @key;
                    ELSE
                        INSERT INTO plc_save_settings (SettingKey, SettingValue, Description)
                        VALUES (@key, @value, 'Varsayılan tanımsız duruş ID değeri');
                ", conn);

                cmd.Parameters.AddWithValue("@key", settingKey);
                cmd.Parameters.AddWithValue("@value", value.ToString());
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ {settingKey} değeri kaydedilemedi: {ex.Message}");
            }
        }

        private int? TryGetUndefinedCategoryIdFromDatabase()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                var cmd = new SqlCommand(@"
                    SELECT TOP 1 id
                    FROM stoppage_categories
                    WHERE LOWER(category_code) IN (@code1, @code2)
                       OR LOWER(display_name) IN (@code1, @code2)
                    ORDER BY id;
                ", conn);

                cmd.Parameters.AddWithValue("@code1", UndefinedCategoryTokens[0]);
                cmd.Parameters.AddWithValue("@code2", UndefinedCategoryTokens.Length > 1 ? UndefinedCategoryTokens[1] : UndefinedCategoryTokens[0]);

                var result = cmd.ExecuteScalar();
                if (result != null && int.TryParse(result.ToString(), out var parsedValue))
                {
                    return parsedValue;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Tanımsız kategori ID bulunamadı: {ex.Message}");
            }

            return null;
        }

        private int? TryGetUndefinedReasonIdFromDatabase(int categoryId)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                conn.Open();

                var cmd = new SqlCommand(@"
                    SELECT TOP 1 id
                    FROM stoppage_reasons
                    WHERE category_id = @categoryId
                      AND LOWER(reason_name) IN (@name1, @name2)
                    ORDER BY id;
                ", conn);

                cmd.Parameters.AddWithValue("@categoryId", categoryId);
                cmd.Parameters.AddWithValue("@name1", UndefinedReasonTokens[0]);
                cmd.Parameters.AddWithValue("@name2", UndefinedReasonTokens.Length > 1 ? UndefinedReasonTokens[1] : UndefinedReasonTokens[0]);

                var result = cmd.ExecuteScalar();
                if (result != null && int.TryParse(result.ToString(), out var parsedValue))
                {
                    return parsedValue;
                }

                var fallbackCmd = new SqlCommand(@"
                    SELECT TOP 1 id
                    FROM stoppage_reasons
                    WHERE LOWER(reason_name) IN (@name1, @name2)
                    ORDER BY id;
                ", conn);

                fallbackCmd.Parameters.AddWithValue("@name1", UndefinedReasonTokens[0]);
                fallbackCmd.Parameters.AddWithValue("@name2", UndefinedReasonTokens.Length > 1 ? UndefinedReasonTokens[1] : UndefinedReasonTokens[0]);

                var fallbackResult = fallbackCmd.ExecuteScalar();
                if (fallbackResult != null && int.TryParse(fallbackResult.ToString(), out var fallbackId))
                {
                    return fallbackId;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Tanımsız sebep ID bulunamadı: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Veritabanından kayıt ayarlarını yükle
        /// </summary>
        private async Task LoadSettingsFromDatabaseAsync()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // Önce tabloyu oluştur
                var checkCmd = new SqlCommand(@"
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'plc_save_settings'", conn);
                var exists = (int)await checkCmd.ExecuteScalarAsync() > 0;
                
                if (!exists)
                {
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
                    
                    var insertCmd = new SqlCommand(@"
                        INSERT INTO plc_save_settings (SettingKey, SettingValue, Description) VALUES
                        ('SaveIntervalMs', '1000', 'Veritabanına kayıt sıklığı (milisaniye)'),
                        ('PLCReadIntervalMs', '200', 'PLC''den veri okuma sıklığı (milisaniye)')", conn);
                    await insertCmd.ExecuteNonQueryAsync();
                }
                
                // Ayarları oku
                var cmd = new SqlCommand("SELECT SettingKey, SettingValue FROM plc_save_settings", conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    var key = reader.GetString("SettingKey");
                    var value = reader.GetString("SettingValue");
                    
                    if (key == "SaveIntervalMs")
                    {
                        SaveIntervalMs = int.Parse(value);
                        // Console.WriteLine($"✅ Kayıt sıklığı yüklendi: {SaveIntervalMs}ms");
                    }
                }
                
                // Ayarlar yüklendikten sonra timer'ı başlat
                InitializeSaveTimer();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Ayarlar yüklenemedi: {ex.Message}");
                // Hata durumunda varsayılan değerle timer'ı başlat
                InitializeSaveTimer();
            }
        }
        
        /// <summary>
        /// Veritabanından gelen veri tanımlarına göre dinamik olarak 0 değerler ata
        /// </summary>
        private async Task InitializeDefaultValuesAsync(PLCData data)
        {
            try
            {
                // Veritabanından veri tanımlarını al
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var cmd = new SqlCommand("SELECT name, data_type FROM plc_data_definitions WHERE is_active = 1", conn);
                using var reader = await cmd.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    var name = reader.GetString("name");
                    var dataType = reader.GetString("data_type");
                    
                    // Veri tipine göre 0 değer ata
                    object defaultValue = dataType.ToUpper() switch
                    {
                        "DINT" => 0,
                        "INT" => (short)0,
                        "REAL" => 0f,
                        "BOOL" => false,
                        "WORD" => (ushort)0,
                        _ => 0
                    };
                    
                    data.SetValue(name, defaultValue);
                }
                
                Console.WriteLine($"✅ Dinamik olarak {data.Data.Count} veri tanımı için 0 değer atandı");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Dinamik 0 değer atama hatası: {ex.Message}");
            }
        }
        
        /// <summary>
        /// Dinamik veri kaydetme - veritabanından SaveToDatabase=1 olan verileri kaydet
        /// </summary>
        private async Task SaveDynamicDataAsync(PLCData data)
        {
            try
            {
                // Önce tüm veri tanımlarını al (DataReader'ı kapat)
                var dataDefinitions = new List<(string Name, string DataType, string TableName, string ColumnName)>();
                
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    var cmd = new SqlCommand(@"
                        SELECT Name, data_type, SaveTableName, SaveColumnName 
                        FROM plc_data_definitions 
                        WHERE is_active = 1 AND SaveToDatabase = 1", conn);
                    using var reader = await cmd.ExecuteReaderAsync();
                    
                    while (await reader.ReadAsync())
                    {
                        var name = reader.GetString("Name");
                        var dataType = reader.GetString("data_type");
                        var tableName = reader.GetString("SaveTableName");
                        var columnName = reader.GetString("SaveColumnName");
                        
                        if (!string.IsNullOrEmpty(columnName) && !string.IsNullOrEmpty(tableName))
                        {
                            dataDefinitions.Add((name, dataType, tableName, columnName));
                        }
                    }
                } // DataReader burada kapatılıyor
                
                // Şimdi tablo/kolon kontrollerini yap
                foreach (var def in dataDefinitions)
                {
                    await EnsureTableAndColumnExistsAsync(def.TableName, def.ColumnName, def.DataType);
                }
                
                // Son olarak verileri kaydet
                if (dataDefinitions.Count > 0)
                {
                    using var conn = new SqlConnection(connectionString);
                    await conn.OpenAsync();
                    
                    var updateColumns = new List<string>();
                    var updateValues = new List<object>();
                    
                    // Kaldırılacak alanlar (kayıt edilmeyecek)
                    // hem Name hem ColumnName kontrolü yapıyoruz çünkü veritabanında farklı isimlerle olabilir
                    var excludedFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "id",
                        "dieSpeed", "diespeed", "DieSpeed",
                        "etilAsetat", "etilasetat", "EtilAsetat",
                        "etilAlkol", "etilalkol", "EtilAlkol",
                        "currentL1", "currentl1", "CurrentL1",
                        "currentL2", "currentl2", "CurrentL2",
                        "currentL3", "currentl3", "CurrentL3"
                    };
                    
                    foreach (var def in dataDefinitions)
                    {
                        // Kaldırılacak alanları atla (hem Name hem ColumnName kontrolü)
                        var defName = def.Name?.Trim() ?? "";
                        var defColumnName = def.ColumnName?.Trim() ?? "";
                        
                        // Özellikle dataRecords tablosu için bu alanları kesinlikle atla
                        if (def.TableName.Equals(DefaultTrackingTable, StringComparison.OrdinalIgnoreCase) && 
                            (excludedFields.Contains(defName) || excludedFields.Contains(defColumnName)))
                        {
                            continue; // Bu alanı kesinlikle atla
                        }
                        
                        // Diğer tablolar için de kontrol et
                        if (excludedFields.Contains(defName) || excludedFields.Contains(defColumnName))
                        {
                            continue; // Bu alanı atla
                        }
                            
                        if (data.Data.ContainsKey(def.Name))
                        {
                            var value = data.Data[def.Name];
                            updateColumns.Add($"{def.ColumnName} = @{def.ColumnName}");
                            updateValues.Add(new { Column = def.ColumnName, Value = value });
                        }
                    }
                    
                    // dataRecords tablosu için özel alanlar (machineSpeed ve activePowerW)
                    bool isDefaultTrackingTable = false;
                    foreach (var def in dataDefinitions)
                    {
                        if (def.TableName.Equals(DefaultTrackingTable, StringComparison.OrdinalIgnoreCase))
                        {
                            isDefaultTrackingTable = true;
                            break;
                        }
                    }
                    
                    if (isDefaultTrackingTable)
                    {
                        // machineSpeed'i her zaman ekle (dataRecords tablosunun ana kolonu)
                        if (!updateColumns.Any(c => c.Contains("machineSpeed", StringComparison.OrdinalIgnoreCase)))
                        {
                            var machineSpeedValue = data.machineSpeed; // Property'den al
                            updateColumns.Add($"MachineSpeed = @MachineSpeed");
                            updateValues.Add(new { Column = "MachineSpeed", Value = machineSpeedValue });
                        }
                        
                        // activePowerW'yi ekle - önce data.Data içinde ara, yoksa synonym'lerde ara
                        object? activePowerValue = null;
                        string? foundKey = null;
                        
                        // Tüm olası key'leri kontrol et
                        var possibleKeys = new[] { "activePowerW", "ActivePower", "ActivePowerW", "activepowerw", "ACTIVEPOWERW" };
                        foreach (var key in possibleKeys)
                        {
                            if (data.Data.ContainsKey(key))
                            {
                                activePowerValue = data.Data[key];
                                foundKey = key;
                                break;
                            }
                        }
                        
                        // activePowerW'yi her zaman ekle (dataRecords tablosu için zorunlu)
                        // Eğer veri bulunamazsa NULL kaydet (kayıt yapılması için)
                        if (!updateColumns.Any(c => c.Contains("activePowerW", StringComparison.OrdinalIgnoreCase)))
                        {
                            updateColumns.Add($"activePowerW = @activePowerW");
                            updateValues.Add(new { Column = "activePowerW", Value = activePowerValue });
                        }
                        
                        // Tablo ve kolon kontrollerini yap
                        await EnsureTableAndColumnExistsAsync(DefaultTrackingTable, "activePowerW", "REAL");
                    }
                    
                    if (updateColumns.Count > 0)
                    {
                        var columnNames = updateColumns.Select(c => c.Split('=')[0].Trim()).ToList();
                        var parameterNames = columnNames.Select(c => "@" + c).ToList();

                        int? explicitIdValue = null;
                        bool requiresExplicitId = await RequiresExplicitIdAsync(conn, DefaultTrackingTable);
                        if (requiresExplicitId)
                        {
                            try
                                {
                                    explicitIdValue = await GetNextIdValueAsync(conn, DefaultTrackingTable);
                                    if (explicitIdValue.HasValue && explicitIdValue.Value > 0)
                                    {
                                        columnNames.Insert(0, "Id");
                                        parameterNames.Insert(0, "@Id");
                                    }
                                    else
                                    {
                                    // Id değeri alınamadı, IDENTITY kullan veya Id kolonunu ekleme
                                        requiresExplicitId = false;
                                    explicitIdValue = null;
                                    }
                                }
                            catch (Exception ex)
                                {
                                // ID değeri alınamazsa IDENTITY kullanılacak veya Id kolonunu ekleme
                                    requiresExplicitId = false;
                                explicitIdValue = null;
                                // Log hatayı ama devam et
                                Console.WriteLine($"⚠️ GetNextIdValueAsync hatası: {ex.Message}");
                                }
                        }

                        var timestampColumn = await GetExistingTimestampColumnAsync(conn, DefaultTrackingTable);
                        var insertColumnsBuilder = new StringBuilder();
                        insertColumnsBuilder.Append(string.Join(", ", columnNames));
                        if (!string.IsNullOrEmpty(timestampColumn))
                        {
                            insertColumnsBuilder.Append($", {timestampColumn}");
                        }

                        var valuesBuilder = new StringBuilder();
                        valuesBuilder.Append(string.Join(", ", parameterNames));
                        if (!string.IsNullOrEmpty(timestampColumn))
                        {
                            valuesBuilder.Append(", GETDATE()");
                        }

                        var insertSql = $@"INSERT INTO {DefaultTrackingTable} ({insertColumnsBuilder}) VALUES ({valuesBuilder})";

                        var insertCmd = new SqlCommand(insertSql, conn);

                        // Sadece explicitIdValue geçerli bir değere sahipse ekle
                        if (requiresExplicitId && explicitIdValue.HasValue && explicitIdValue.Value > 0)
                        {
                            insertCmd.Parameters.Add("@Id", SqlDbType.Int).Value = explicitIdValue.Value;
                        }

                        foreach (var param in updateValues)
                        {
                            var columnName = ((dynamic)param).Column;
                            var value = ((dynamic)param).Value;
                            
                            // machineSpeed için Int, diğerleri için Float
                            if (columnName.Equals("MachineSpeed", StringComparison.OrdinalIgnoreCase))
                                {
                                    insertCmd.Parameters.Add($"@{columnName}", SqlDbType.Int).Value = value ?? 0;
                            }
                            else if (columnName.Equals("activePowerW", StringComparison.OrdinalIgnoreCase))
                            {
                                // NULL değerleri handle et
                                float? floatValue = value as float?;
                                if (value == null || floatValue == null || !floatValue.HasValue)
                                {
                                    var paramObj = insertCmd.Parameters.Add($"@{columnName}", SqlDbType.Float);
                                    paramObj.Value = DBNull.Value;
                                }
                                else
                                {
                                    var doubleValue = Convert.ToDouble(value);
                                    insertCmd.Parameters.Add($"@{columnName}", SqlDbType.Float).Value = doubleValue;
                                }
                            }
                            else
                            {
                                // NULL değerleri handle et
                                float? floatValue = value as float?;
                                if (value == null || floatValue == null || !floatValue.HasValue)
                                {
                                    var paramObj = insertCmd.Parameters.Add($"@{columnName}", SqlDbType.Float);
                                    paramObj.Value = DBNull.Value;
                                }
                                else
                                {
                                    insertCmd.Parameters.Add($"@{columnName}", SqlDbType.Float).Value = Convert.ToDouble(value);
                                }
                            }
                        }

                        await insertCmd.ExecuteNonQueryAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                // Dinamik veri kaydetme hatası - sessizce geç
            }
        }
        
        /// <summary>
        /// Tablo ve kolon var mı kontrol et, yoksa oluştur
        /// </summary>
        private async Task EnsureTableAndColumnExistsAsync(string tableName, string columnName, string dataType)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // Tablo var mı kontrol et
                var tableExistsCmd = new SqlCommand($@"
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = '{tableName}'", conn);
                var tableExists = (int)await tableExistsCmd.ExecuteScalarAsync() > 0;
                
                if (!tableExists)
                {
                    // Tablo yoksa oluştur
                    var createTableCmd = new SqlCommand($@"
                        CREATE TABLE {tableName} (
                            Id INT IDENTITY(1,1) PRIMARY KEY,
                            {columnName} {GetSqlDataType(dataType)} NULL,
                            KayitZamani DATETIME DEFAULT GETDATE()
                        )", conn);
                    await createTableCmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"✅ Tablo oluşturuldu: {tableName}");
                }
                else
                {
                    // Tablo var, kolon var mı kontrol et
                    var columnExistsCmd = new SqlCommand($@"
                        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_NAME = '{tableName}' AND COLUMN_NAME = '{columnName}'", conn);
                    var columnExists = (int)await columnExistsCmd.ExecuteScalarAsync() > 0;
                    
                    if (!columnExists)
                    {
                        // Kolon yoksa ekle
                        var addColumnCmd = new SqlCommand($@"
                            ALTER TABLE {tableName} 
                            ADD {columnName} {GetSqlDataType(dataType)} NULL", conn);
                        await addColumnCmd.ExecuteNonQueryAsync();
                        Console.WriteLine($"✅ Kolon eklendi: {tableName}.{columnName}");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Tablo/kolon oluşturma hatası: {ex.Message}");
            }
        }

        private async Task<string?> GetExistingTimestampColumnAsync(SqlConnection conn, string tableName)
        {
            var candidates = new[] { "KayitZamani", "Timestamp", "created_at", "CreatedAt" };

            foreach (var candidate in candidates)
            {
                using var cmd = new SqlCommand($@"
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @columnName", conn);
                cmd.Parameters.AddWithValue("@tableName", tableName);
                cmd.Parameters.AddWithValue("@columnName", candidate);

                var exists = (int)await cmd.ExecuteScalarAsync() > 0;
                if (exists)
                {
                    return candidate;
                }
            }

            return null;
        }
        
        /// <summary>
        /// Veri tipini SQL veri tipine çevir
        /// </summary>
        private string GetSqlDataType(string dataType)
        {
            return dataType.ToUpper() switch
            {
                "DINT" => "INT",
                "INT" => "SMALLINT", // 16-bit signed integer
                "REAL" => "FLOAT",
                "BOOL" => "BIT",
                "WORD" => "SMALLINT", // 16-bit unsigned integer
                _ => "NVARCHAR(100)"
            };
        }

        private async Task<bool> RequiresExplicitIdAsync(SqlConnection conn, string tableName)
        {
            var qualifiedTableName = tableName.Contains(".")
                ? tableName
                : $"dbo.{tableName}";

            using var identityCheckCmd = new SqlCommand(@"
                SELECT COLUMNPROPERTY(OBJECT_ID(@tableName), 'Id', 'IsIdentity')", conn);
            identityCheckCmd.Parameters.AddWithValue("@tableName", qualifiedTableName);
            var result = await identityCheckCmd.ExecuteScalarAsync();

            if (result == null || result == DBNull.Value)
            {
                return false;
            }

            var isIdentity = Convert.ToInt32(result) == 1;
            return !isIdentity;
        }

        private async Task<int?> GetNextIdValueAsync(SqlConnection conn, string tableName)
        {
            try
            {
                // Tablo adını qualify et (schema ile)
                var qualifiedTableName = tableName.Contains(".")
                    ? tableName
                    : $"dbo.{tableName}";
                    
                using var cmd = new SqlCommand($@"SELECT ISNULL(MAX(Id), 0) + 1 FROM {qualifiedTableName}", conn);
            var result = await cmd.ExecuteScalarAsync();
                
                if (result == null || result == DBNull.Value)
                {
                    return null;
                }
                
            return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ GetNextIdValueAsync hatası (tablo: {tableName}): {ex.Message}");
                return null;
            }
        }
        
        /// <summary>
        /// Kayıt sıklığını güncelle (admin panelden çağrılacak)
        /// </summary>
        public void UpdateSaveInterval(int intervalMs)
        {
            SaveIntervalMs = intervalMs;
            InitializeSaveTimer(); // Timer'ı yeniden başlat
            // Console.WriteLine($"✅ Kayıt sıklığı güncellendi: {SaveIntervalMs}ms");
        }

        public void SetSqlProxy(SqlProxy proxy)
        {
            sqlProxy = proxy;
        }

        /// <summary>
        /// MachineScreen'den gelen duruş sebebi ID'lerini güncelle
        /// </summary>
        public void UpdateStoppageReason(int categoryId, int reasonId)
        {
            stoppageSemaphore.Wait();
            try
            {
                // Sadece değer gerçekten değiştiğinde mesaj yaz
                if (currentCategoryId != categoryId || currentReasonId != reasonId)
                {
                    currentCategoryId = categoryId;
                    currentReasonId = reasonId;
                    Console.WriteLine($"📝 Duruş sebebi güncellendi: Kategori={categoryId}, Sebep={reasonId}");
                }
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }

        /// <summary>
        /// Aktif (henüz kaydedilmemiş) duruş sebebini getir
        /// </summary>
        public (int categoryId, int reasonId, DateTime? stoppageStartTime) GetCurrentStoppageReason()
        {
            stoppageSemaphore.Wait();
            try
            {
                return (currentCategoryId, currentReasonId, stoppageStartTime);
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }

        /// <summary>
        /// Aktif duruşu "paylaşımlı duruş" olarak böler:
        /// - Mevcut duruşu şu ana kadar kaydeder
        /// - Yeni duruşu mevcut andan başlatır (makine hala duruyorsa)
        /// </summary>
        public async Task<(bool success, string? error, DateTime? newStartTime, int savedDurationSeconds)> SplitActiveStoppageAsync(DateTime splitTimeUtc, int? categoryIdOverride = null, int? reasonIdOverride = null)
        {
            await stoppageSemaphore.WaitAsync();
            try
            {
                if (!stoppageStartTime.HasValue)
                {
                    return (false, "Aktif duruş bulunamadı, bölme yapılamadı.", null, 0);
                }

                // Mevcut duruş süresini hesapla
                var splitLocalTime = splitTimeUtc.ToLocalTime();
                var durationSeconds = (int)(splitLocalTime - stoppageStartTime.Value).TotalSeconds;
                if (durationSeconds < MinimumStoppageDurationSeconds)
                {
                    return (false, $"Duruş süresi çok kısa ({durationSeconds}s). Minimum {MinimumStoppageDurationSeconds} saniye gerek.", null, durationSeconds);
                }

                // Kayıt için kategori/sebep: override > mevcut > tanımsız
                var categoryIdToSave = categoryIdOverride ?? currentCategoryId;
                var reasonIdToSave = reasonIdOverride ?? currentReasonId;
                if (categoryIdToSave == 0 || reasonIdToSave == 0)
                {
                    categoryIdToSave = UndefinedStoppageCategoryId;
                    reasonIdToSave = UndefinedStoppageReasonId;
                }

                // Mevcut segmenti kaydet
                await SaveStoppageRecordAsync(stoppageStartTime.Value, splitLocalTime, durationSeconds, categoryIdToSave, reasonIdToSave);

                // Yeni duruşu başlat (makine hâlâ duruyorsa)
                stoppageStartTime = splitLocalTime;
                isStoppageRecordSaved = false;
                // Mevcut sebebi koru; operatör isterse yeni sebep seçer

                Console.WriteLine($"🔀 Paylaşımlı duruş bölündü: {splitLocalTime:HH:mm:ss} itibarıyla yeni duruş başladı. Önceki süre: {durationSeconds}s, Kategori={categoryIdToSave}, Sebep={reasonIdToSave}");

                return (true, null, stoppageStartTime, durationSeconds);
            }
            catch (Exception ex)
            {
                return (false, $"Paylaşımlı duruş bölünemedi: {ex.Message}", null, 0);
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }

        /// <summary>
        /// PLC verisini işle (her veri geldiğinde işle)
        /// </summary>
        public async Task ProcessDataAsync(PLCData data)
        {
            PLCData? dataToProcess = null;
            
            lock (dataLock)
            {
                if (data != null)
                {
                    // Önce SqlProxy'ye veri gönder (enerji verilerini eklemek için)
                    // UpdateData içinde enerji verileri data.Data'ya ekleniyor
                    sqlProxy?.UpdateData(data);
                    
                    // Enerji verileri eklendikten sonra klonla
                    lastProcessedData = data.Clone();
                    dataToProcess = data.Clone();
                }
                else
                {
                    // PLC verisi yoksa null olarak işaretle (timer 0 değerlerle yazacak)
                    lastProcessedData = null;
                    sqlProxy?.UpdateData(data);
                }
            }
            
            // Lock dışında async işlemleri yap
            if (dataToProcess != null)
            {
                await HandleStoppageTracking(dataToProcess);
            }
        }

        /// <summary>
        /// Veriyi veritabanına kaydet
        /// </summary>
        private async Task SaveToDatabaseAsync(PLCData data)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // activePowerW kolonunun var olduğundan emin ol
                await EnsureTableAndColumnExistsAsync(DefaultTrackingTable, "activePowerW", "REAL");
                
                var timestampColumn = await GetExistingTimestampColumnAsync(conn, DefaultTrackingTable);

                var columnList = new StringBuilder("machineSpeed");
                var valueList = new StringBuilder("@machineSpeed");

                // activePowerW varsa ekle
                if (data.Data.ContainsKey("activePowerW"))
                {
                    columnList.Append(", activePowerW");
                    valueList.Append(", @activePowerW");
                }

                if (!string.IsNullOrEmpty(timestampColumn))
                {
                    columnList.Append(", ").Append(timestampColumn);
                    valueList.Append(", GETDATE()");
                }

                var cmd = new SqlCommand($"INSERT INTO {DefaultTrackingTable} ({columnList}) VALUES ({valueList})", conn);
                
                cmd.Parameters.Add("@machineSpeed", SqlDbType.Int).Value = data.machineSpeed;
                
                // activePowerW varsa parametre ekle
                if (data.Data.ContainsKey("activePowerW"))
                {
                    var activePowerValue = data.Data["activePowerW"];
                    cmd.Parameters.Add("@activePowerW", SqlDbType.Float).Value = Convert.ToDouble(activePowerValue);
                }

                await cmd.ExecuteNonQueryAsync();
                
                // Log success (only for changed data)
                Console.WriteLine($"📊 Veritabanına kayıt yapıldı: [{data.Timestamp:HH:mm:ss}]");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Veritabanı hatası: {ex.Message}");
            }
        }

        /// <summary>
        /// Son işlenen veriyi al
        /// </summary>
        public PLCData? GetLastProcessedData()
        {
            lock (dataLock)
            {
                return lastProcessedData?.Clone();
            }
        }

        /// <summary>
        /// Veri istatistiklerini al
        /// </summary>
        public async Task<DataStatistics> GetStatisticsAsync()
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                var cmd = new SqlCommand(
                    "SELECT " +
                    "COUNT(*) as TotalRecords, " +
                    "MAX(KayitZamani) as LastRecordTime, " +
                    "AVG(machineSpeed) as AvgMachineSpeed, " +
                    "MAX(machineDieCounter) as MaxDieCounter " +
                    $"FROM {DefaultTrackingTable}", conn);

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    return new DataStatistics
                    {
                        TotalRecords = reader.GetInt32(0),
                        LastRecordTime = reader.IsDBNull(1) ? null : reader.GetDateTime(1),
                        AverageMachineSpeed = reader.IsDBNull(2) ? 0 : reader.GetDouble(2),
                        MaxDieCounter = reader.IsDBNull(3) ? 0 : reader.GetInt32(3)
                    };
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ İstatistik alma hatası: {ex.Message}");
            }

            return new DataStatistics();
        }

        public void InitializeSaveTimer()
        {
            try
            {
                // Eski timer'ı dispose et (eğer varsa)
                saveTimer?.Dispose();
                
                // Dinamik kayıt sıklığı ile yeni timer başlat
                saveTimer = new System.Threading.Timer(async _ => await SaveCurrentDataToDatabase(), null, SaveIntervalMs, SaveIntervalMs);
                Console.WriteLine($"⏰ Timer başlatıldı - Her {SaveIntervalMs}ms'de bir kayıt yapılacak");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Timer başlatma hatası: {ex.Message}");
            }
        }

        private async Task SaveCurrentDataToDatabase()
        {
            try
            {
                PLCData? dataToSave = null;
                lock (dataLock)
                {
                    if (lastProcessedData != null)
                    {
                        dataToSave = lastProcessedData.Clone();
                    }
                }

                // PLC verisi yoksa 0 değerlerle veri yaz
                if (dataToSave == null)
                {
                    // Dinamik olarak 0 değerlerle başlat
                    dataToSave = new PLCData
                    {
                        Timestamp = DateTime.Now
                    };
                    
                    // Dinamik olarak veritabanından gelen tüm veri tanımları için 0 değer ata
                    await InitializeDefaultValuesAsync(dataToSave);
                    
                    // 0 değerlerle veri kaydı yap (timer durdurma)
                    await SaveToDatabaseAsync(dataToSave);
                    return;
                }

                // PLC verisi varsa dinamik kayıt yap
                await SaveDynamicDataAsync(dataToSave);
            }
            catch (Exception)
            {
                // Timer kayıt hatalarında sessizce devam et
            }
        }

        /// <summary>
        /// Duruş takip mantığı - Temiz ve basit
        /// Diğer duruşlarla aynı mantık: Makine durduğunda başlangıç, çalıştığında kayıt
        /// Sebep seçilmemişse "Tanımsız" olarak kaydedilir
        /// </summary>
        private async Task HandleStoppageTracking(PLCData data)
        {
            await stoppageSemaphore.WaitAsync();
            try
            {
                // Makine durumu bit'ini kontrol et
                bool currentMachineStopped = (data.machineStatus & 0x0001) != 0;
                
                // İlk veri geldiğinde - sadece durumu kaydet, kayıt yapma
                if (lastMachineStoppedState == null)
                {
                    lastMachineStoppedState = currentMachineStopped;
                    if (currentMachineStopped)
                    {
                        stoppageStartTime = DateTime.Now;
                        isStoppageRecordSaved = false;
                    }
                    return;
                }
                
                // Makine durumu değişti mi kontrol et
                if (lastMachineStoppedState != currentMachineStopped)
                {
                    if (currentMachineStopped)
                    {
                        // Makine durdu - Sadece başlangıç zamanını kaydet
                        // Eğer zaten duruyorsa (stoppageStartTime set edilmişse) sadece mesaj yaz, zamanı güncelleme
                        if (!stoppageStartTime.HasValue)
                        {
                            stoppageStartTime = DateTime.Now;
                            isStoppageRecordSaved = false;
                        }
                        Console.WriteLine($"🛑 Makine durdu: {DateTime.Now:dd.MM.yyyy HH:mm:ss}");
                    }
                    else
                    {
                        // Makine çalışmaya başladı
                        Console.WriteLine($"▶️ Makine çalışmaya başladı: {DateTime.Now:dd.MM.yyyy HH:mm:ss}");
                        
                        // Kayıt yap
                        if (stoppageStartTime.HasValue && !isStoppageRecordSaved)
                        {
                            var stoppageEndTime = DateTime.Now;
                            var actualDuration = (int)(stoppageEndTime - stoppageStartTime.Value).TotalSeconds;
                            
                            // Minimum süre kontrolü
                            if (actualDuration < MinimumStoppageDurationSeconds)
                            {
                                Console.WriteLine($"⚠️ Duruş süresi çok kısa ({actualDuration}s), kayıt yapılmıyor");
                                stoppageStartTime = null;
                                isStoppageRecordSaved = false;
                                lastMachineStoppedState = currentMachineStopped;
                                return;
                            }
                            
                            // Gerçek duruş süresini kullan (zaman farkından hesaplanan)
                            var durationSeconds = actualDuration;
                            
                            // Sebep seçilmemişse "Tanımsız" olarak kaydet
                            int categoryIdToSave = currentCategoryId;
                            int reasonIdToSave = currentReasonId;
                            if (currentCategoryId == 0 || currentReasonId == 0)
                            {
                                categoryIdToSave = UndefinedStoppageCategoryId;
                                reasonIdToSave = UndefinedStoppageReasonId;
                            }
                            
                            // Kayıt yap
                            await SaveStoppageRecordAsync(stoppageStartTime.Value, stoppageEndTime, durationSeconds, categoryIdToSave, reasonIdToSave);
                            
                            Console.WriteLine($"✅ Duruş kaydedildi: {stoppageStartTime.Value:HH:mm:ss} - {stoppageEndTime:HH:mm:ss}, Süre: {durationSeconds}s, Kategori: {categoryIdToSave}, Sebep: {reasonIdToSave}");
                            
                            // Flag'i set et ve reset
                            isStoppageRecordSaved = true;
                            stoppageStartTime = null;
                            currentCategoryId = 0;
                            currentReasonId = 0;
                        }
                    }
                    
                    lastMachineStoppedState = currentMachineStopped;
                }
                // Makine durumu değişmedi - sebep bilgisi MachineScreen'den HTTP ile güncellenebilir
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Duruş takip hatası: {ex.Message}");
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }

        /// <summary>
        /// İş sonu basıldığında aktif duruşu yeni iş döngüsüne aktar
        /// Duruşun başlangıç zamanı değişmez (yeni iş başlangıcı = duruş başlangıcı)
        /// İş sonu zamanı = duruş başlangıcı - 1 saniye
        /// Duruş kaydı yeni iş döngüsüne ait olur
        /// </summary>
        public async Task<(DateTime? actualJobEndTime, DateTime? newJobStartTime)> ForceTransferStoppageToNewJobAsync(DateTime jobEndTime, string source = "JobEnd")
        {
            await stoppageSemaphore.WaitAsync();
            try
            {
                if (!stoppageStartTime.HasValue)
                {
                    Console.WriteLine($"ℹ️ [{source}] Aktif duruş kaydı bulunamadı, transfer yapılmadı.");
                    return (null, null);
                }

                var stoppageStart = stoppageStartTime.Value;
                
                // Duruşun başlangıç zamanı değişmez (yeni iş başlangıcı = duruş başlangıcı)
                // İş sonu zamanı = duruş başlangıcı - 1 saniye (eski işin bitişi)
                // Duruş kaydı yeni iş döngüsüne ait olur, devam eder
                var actualJobEndTime = stoppageStart.AddSeconds(-1); // İş sonu = duruş başlangıcı - 1 saniye
                var newJobStartTime = stoppageStart; // Yeni iş başlangıcı = duruş başlangıcı
                
                isStoppageRecordSaved = false; // Duruş kaydı henüz kaydedilmedi, devam ediyor
                
                Console.WriteLine($"🔄 [{source}] Duruş kaydı yeni iş döngüsüne aktarıldı: Duruş başlangıcı={stoppageStart:HH:mm:ss} (Yeni iş başlangıcı), İş sonu={actualJobEndTime:HH:mm:ss} (Eski iş bitişi)");
                
                return (actualJobEndTime, newJobStartTime);
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }

        /// <summary>
        /// Yeni iş başlangıcında duruş durumunu kontrol et
        /// Eğer duruş kaydı zaten varsa (iş sonu basıldığında aktarılmışsa), onu koru
        /// Eğer makine duruyorsa ve duruş kaydı yoksa, yeni duruş kaydı başlat
        /// </summary>
        public async Task EnsureStoppageStateForNewJobAsync(DateTime jobStartTime, bool machineStopped, string source = "JobStart")
        {
            await stoppageSemaphore.WaitAsync();
            try
            {
                // Eğer zaten bir duruş kaydı varsa (iş sonu basıldığında aktarılmışsa), onu koru
                if (stoppageStartTime.HasValue)
                {
                    Console.WriteLine($"ℹ️ [{source}] Mevcut duruş kaydı korunuyor: Başlangıç={stoppageStartTime.Value:HH:mm:ss} (Yeni iş başlangıcı={jobStartTime:HH:mm:ss})");
                    lastMachineStoppedState = machineStopped;
                    return;
                }

                // Eğer makine duruyorsa ve henüz duruş kaydı başlatılmamışsa, yeni duruş kaydı başlat
                if (machineStopped)
                {
                    stoppageStartTime = jobStartTime;
                    isStoppageRecordSaved = false;
                    lastMachineStoppedState = true;
                    Console.WriteLine($"🛑 [{source}] Yeni iş başlangıcında duruş kaydı başlatıldı: {jobStartTime:HH:mm:ss} (Makine duruyor)");
                }
                else
                {
                    // Makine çalışıyorsa, duruş durumunu sıfırla
                    lastMachineStoppedState = false;
                }
            }
            finally
            {
                stoppageSemaphore.Release();
            }
        }
        
        /// <summary>
        /// Duruş kaydını veritabanına kaydet
        /// </summary>
        private async Task SaveStoppageRecordAsync(DateTime startTime, DateTime endTime, int durationSeconds, int categoryId, int reasonId)
        {
            try
            {
                using var conn = new SqlConnection(connectionString);
                await conn.OpenAsync();
                
                // Önce tablonun var olup olmadığını kontrol et
                var checkTableCmd = new SqlCommand(@"
                    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'stoppage_records'", conn);
                var tableExists = (int)await checkTableCmd.ExecuteScalarAsync() > 0;
                
                if (!tableExists)
                {
                    Console.WriteLine("📋 stoppage_records tablosu yok, oluşturuluyor...");
                    var createTableCmd = new SqlCommand(@"
                        CREATE TABLE stoppage_records (
                            id INT IDENTITY(1,1) PRIMARY KEY,
                            start_time DATETIME NOT NULL,
                            end_time DATETIME NOT NULL,
                            duration_seconds INT NOT NULL,
                            category_id INT NOT NULL,
                            reason_id INT NOT NULL,
                            created_at DATETIME DEFAULT GETDATE()
                        )", conn);
                    await createTableCmd.ExecuteNonQueryAsync();
                    Console.WriteLine("✅ stoppage_records tablosu oluşturuldu");
                }
                
                var ensureIdentitySql = @"
IF COL_LENGTH('stoppage_records', 'id') IS NULL
BEGIN
    ALTER TABLE stoppage_records ADD id INT IDENTITY(1,1) PRIMARY KEY;
END
ELSE IF COLUMNPROPERTY(OBJECT_ID(N'stoppage_records', N'U'), 'id', 'IsIdentity') <> 1
BEGIN
    CREATE TABLE stoppage_records_temp (
        id INT IDENTITY(1,1) PRIMARY KEY,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        duration_seconds INT NOT NULL,
        category_id INT NOT NULL,
        reason_id INT NOT NULL,
        created_at DATETIME DEFAULT GETDATE()
    );

    IF EXISTS (SELECT 1 FROM stoppage_records)
    BEGIN
        SET IDENTITY_INSERT stoppage_records_temp ON;
        INSERT INTO stoppage_records_temp (
            id, start_time, end_time, duration_seconds, category_id, reason_id, created_at
        )
        SELECT id, start_time, end_time, duration_seconds, category_id, reason_id, created_at
        FROM stoppage_records
        ORDER BY id;
        SET IDENTITY_INSERT stoppage_records_temp OFF;
    END

    DROP TABLE stoppage_records;
    EXEC sp_rename 'stoppage_records_temp', 'stoppage_records';
END
";
                using (var ensureCmd = new SqlCommand(ensureIdentitySql, conn))
                {
                    await ensureCmd.ExecuteNonQueryAsync();
                }

                var cmd = new SqlCommand(
                    "INSERT INTO stoppage_records " +
                    "(start_time, end_time, duration_seconds, category_id, reason_id, created_at) " +
                    "VALUES (@startTime, @endTime, @durationSeconds, @categoryId, @reasonId, GETDATE())", conn);
                
                cmd.Parameters.Add("@startTime", SqlDbType.DateTime).Value = startTime;
                cmd.Parameters.Add("@endTime", SqlDbType.DateTime).Value = endTime;
                cmd.Parameters.Add("@durationSeconds", SqlDbType.Int).Value = durationSeconds;
                cmd.Parameters.Add("@categoryId", SqlDbType.Int).Value = categoryId;
                cmd.Parameters.Add("@reasonId", SqlDbType.Int).Value = reasonId;

                await cmd.ExecuteNonQueryAsync();
                
                Console.WriteLine($"📊 Duruş kaydı veritabanına eklendi: {startTime:HH:mm:ss} - {endTime:HH:mm:ss} ({durationSeconds}s) Kategori: {categoryId}, Sebep: {reasonId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Duruş kaydı veritabanı hatası: {ex.Message}");
            }
        }

        public DateTime LastSaveTime => DateTime.MinValue; // Timer kaldırıldığı için bu değer artık geçerli değil
        public bool IsTimerHealthy => true; // Timer kaldırıldığı için bu değer artık geçerli değil

        public void Dispose()
        {
            // Timer'ı durdur ve temizle
            saveTimer?.Dispose();
        }
    }

    /// <summary>
    /// Veri istatistikleri
    /// </summary>
    public class DataStatistics
    {
        public int TotalRecords { get; set; }
        public DateTime? LastRecordTime { get; set; }
        public double AverageMachineSpeed { get; set; }
        public int MaxDieCounter { get; set; }
    }
} 