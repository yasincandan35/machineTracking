USE TemperatureHumidityDB;

-- ÖNCE TEST ET: Silinecek kayıtları görmek için bu sorguyu çalıştır
-- Device.DeviceId = "8" olan cihazın Device.Id'sini bul ve o Id'ye sahip SensorData kayıtlarını göster
-- SELECT 
--     sd.Id,
--     sd.DeviceId AS SensorDataDeviceId,
--     d.Id AS DeviceTableId,
--     d.DeviceId AS DeviceTableDeviceId,
--     d.Name,
--     d.Location,
--     sd.Temperature,
--     sd.Humidity,
--     sd.Timestamp
-- FROM [SensorData] sd
-- INNER JOIN [Devices] d ON sd.DeviceId = d.Id
-- WHERE d.DeviceId = '8'
-- ORDER BY sd.Timestamp DESC;

-- Silinecek kayıt sayısını görmek için:
-- SELECT COUNT(*) AS SilinecekKayitSayisi
-- FROM [SensorData] sd
-- INNER JOIN [Devices] d ON sd.DeviceId = d.Id
-- WHERE d.DeviceId = '8';

-- Device.DeviceId = "8" olan cihazın Device.Id'sini görmek için:
-- SELECT Id, Name, Location, DeviceId, IsActive
-- FROM [Devices]
-- WHERE DeviceId = '8';

-- ============================================
-- SİLME İŞLEMİ (Yukarıdaki test sorgularını çalıştırdıktan sonra bu satırın yorumunu kaldır)
-- ============================================
-- Device.DeviceId = "8" olan cihazın verilerini sil
-- SensorData.DeviceId aslında Device.Id'ye referans veriyor, bu yüzden JOIN kullanmalıyız

-- DELETE sd
-- FROM [SensorData] sd
-- INNER JOIN [Devices] d ON sd.DeviceId = d.Id
-- WHERE d.DeviceId = '8';

