USE TemperatureHumidityDB;

-- ÖNCE TEST ET: Silinecek kayıtları görmek için bu sorguyu çalıştır
-- Timestamp'in sonu .0000000 ile bitenleri SİLECEĞİZ (test/manuel veriler)
-- Gerçek kayıtlar milisaniye içerir: 11:45:00.3620209 -> KORUNACAK
-- Test verileri: 11:50:00.0000000 -> SİLİNECEK

SELECT 
    [Id],
    [Timestamp],
    CAST([Timestamp] AS VARCHAR(30)) AS TimestampString,
    CASE 
        WHEN CAST([Timestamp] AS VARCHAR(30)) LIKE '%.0000000' THEN 'SİLİNECEK'
        ELSE 'KORUNACAK'
    END AS Durum,
    [Temperature],
    [Humidity]
FROM [TemperatureHumidityDB].[dbo].[SensorData]
WHERE [Timestamp] > '2025-11-21 11:45:00'
ORDER BY [Timestamp];

-- Silinecek kayıt sayısını görmek için (.0000000 ile bitenler):
-- SELECT COUNT(*) AS SilinecekKayitSayisi
-- FROM [TemperatureHumidityDB].[dbo].[SensorData]
-- WHERE [Timestamp] > '2025-11-21 11:45:00'
--   AND CAST([Timestamp] AS VARCHAR(30)) LIKE '%.0000000';

-- KORUNACAK kayıt sayısını görmek için (gerçek kayıtlar, milisaniye içerenler):
-- SELECT COUNT(*) AS KorunacakKayitSayisi
-- FROM [TemperatureHumidityDB].[dbo].[SensorData]
-- WHERE [Timestamp] > '2025-11-21 11:45:00'
--   AND CAST([Timestamp] AS VARCHAR(30)) NOT LIKE '%.0000000';

-- ============================================
-- SİLME İŞLEMİ (Yukarıdaki test sorgularını çalıştırdıktan sonra bu satırın yorumunu kaldır)
-- ============================================
-- 2025-11-21 11:45:00'dan sonraki verilerden
-- Sadece timestamp'in sonu .0000000 ile bitenleri sil
-- Gerçek kayıtlar milisaniye içerir ve korunacak

-- DELETE FROM [TemperatureHumidityDB].[dbo].[SensorData]
-- WHERE [Timestamp] > '2025-11-21 11:45:00'
--   AND CAST([Timestamp] AS VARCHAR(30)) LIKE '%.0000000';

