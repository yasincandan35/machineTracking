USE TemperatureHumidityDB;

-- ============================================
-- DeviceId Kolonunu String'den Int'e Dönüştürme
-- ============================================

-- ÖNCE YEDEK AL! Bu işlem geri alınamaz!

-- 1. Mevcut DeviceId değerlerini kontrol et
SELECT 
    Id,
    Name,
    Location,
    DeviceId,
    IpAddress,
    IsActive
FROM Devices
ORDER BY Id;

-- 2. DeviceId değerlerinin int'e dönüştürülebilir olup olmadığını kontrol et
-- Eğer string değerler varsa (örn: "ARDUINO_001"), bunları önce düzeltmen gerekir
SELECT 
    Id,
    DeviceId,
    CASE 
        WHEN ISNUMERIC(DeviceId) = 1 THEN 'OK - Int''e dönüştürülebilir'
        ELSE 'HATA - Int''e dönüştürülemez: ' + DeviceId
    END AS Durum
FROM Devices
WHERE ISNUMERIC(DeviceId) = 0;

-- 3. Eğer yukarıdaki sorgu sonuç döndürürse, önce string değerleri düzelt:
-- Örnek: "ARDUINO_001" gibi değerleri int'e çevir
-- UPDATE Devices SET DeviceId = '1001' WHERE DeviceId = 'ARDUINO_001';

-- 4. SensorData tablosundaki foreign key constraint'i kaldır
-- (Eğer varsa)
IF EXISTS (
    SELECT * FROM sys.foreign_keys 
    WHERE name = 'FK_SensorData_Devices_DeviceId'
)
BEGIN
    ALTER TABLE SensorData DROP CONSTRAINT FK_SensorData_Devices_DeviceId;
    PRINT 'Foreign key constraint kaldırıldı.';
END

-- 5. Unique index'i kaldır (eğer varsa)
IF EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_Devices_DeviceId'
)
BEGIN
    DROP INDEX IX_Devices_DeviceId ON Devices;
    PRINT 'Unique index kaldırıldı.';
END

-- 6. DeviceId kolonunu int'e dönüştür
-- Önce geçici bir kolon oluştur
ALTER TABLE Devices ADD DeviceId_New INT NULL;

-- Mevcut değerleri int'e çevirip yeni kolona kopyala
UPDATE Devices 
SET DeviceId_New = CAST(DeviceId AS INT)
WHERE ISNUMERIC(DeviceId) = 1;

-- Eski kolonu sil
ALTER TABLE Devices DROP COLUMN DeviceId;

-- Yeni kolonu eski isimle yeniden adlandır
EXEC sp_rename 'Devices.DeviceId_New', 'DeviceId', 'COLUMN';

-- NOT NULL yap
ALTER TABLE Devices ALTER COLUMN DeviceId INT NOT NULL;

-- 7. Unique index'i yeniden oluştur
CREATE UNIQUE INDEX IX_Devices_DeviceId ON Devices(DeviceId);
PRINT 'Unique index oluşturuldu.';

-- 8. SensorData.DeviceId kolonunu da int'e dönüştür (eğer string ise)
-- Önce SensorData.DeviceId'nin tipini kontrol et
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'SensorData' 
    AND COLUMN_NAME = 'DeviceId' 
    AND DATA_TYPE != 'int'
)
BEGIN
    -- Geçici kolon oluştur
    ALTER TABLE SensorData ADD DeviceId_New INT NULL;
    
    -- Mevcut değerleri int'e çevirip yeni kolona kopyala
    UPDATE SensorData 
    SET DeviceId_New = CAST(DeviceId AS INT)
    WHERE ISNUMERIC(DeviceId) = 1;
    
    -- Eski kolonu sil
    ALTER TABLE SensorData DROP COLUMN DeviceId;
    
    -- Yeni kolonu eski isimle yeniden adlandır
    EXEC sp_rename 'SensorData.DeviceId_New', 'DeviceId', 'COLUMN';
    
    -- NOT NULL yap
    ALTER TABLE SensorData ALTER COLUMN DeviceId INT NOT NULL;
    
    PRINT 'SensorData.DeviceId int''e dönüştürüldü.';
END

-- 9. Foreign key constraint'i yeniden oluştur
-- (EF Core HasPrincipalKey kullanıyor, bu yüzden Device.DeviceId'ye referans veriyor)
ALTER TABLE SensorData
ADD CONSTRAINT FK_SensorData_Devices_DeviceId 
FOREIGN KEY (DeviceId) 
REFERENCES Devices(DeviceId)
ON DELETE CASCADE;

PRINT 'Foreign key constraint oluşturuldu.';

-- 10. Son kontrol
SELECT 
    'Devices' AS Tablo,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Devices' AND COLUMN_NAME = 'DeviceId'
UNION ALL
SELECT 
    'SensorData' AS Tablo,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'SensorData' AND COLUMN_NAME = 'DeviceId';

PRINT 'Migration tamamlandı!';

