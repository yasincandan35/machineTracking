USE TemperatureHumidityDB;

-- ÖNCE TEST ET: Güncellenecek kayıtları görmek için bu sorguyu çalıştır
-- SELECT 
--     [Id],
--     [Timestamp],
--     [Temperature] AS MevcutSicaklik,
--     [Humidity] AS MevcutNem,
--     CASE 
--         WHEN [Temperature] > 25.00 THEN [Temperature] - 0.90
--         WHEN [Temperature] < 20.00 THEN [Temperature] + 0.90
--         ELSE [Temperature]
--     END AS YeniSicaklik,
--     CASE 
--         WHEN [Humidity] < 50.00 THEN [Humidity] + 0.90
--         ELSE [Humidity]
--     END AS YeniNem
-- FROM [TemperatureHumidityDB].[dbo].[SensorData]
-- WHERE [Timestamp] > '2025-11-21 11:45:00'
-- ORDER BY [Timestamp];

-- Güncellenecek kayıt sayısını görmek için:
-- SELECT COUNT(*) AS GuncellenecekKayitSayisi
-- FROM [TemperatureHumidityDB].[dbo].[SensorData]
-- WHERE [Timestamp] > '2025-11-21 11:45:00';

-- ============================================
-- GÜNCELLEME İŞLEMİ (Yukarıdaki test sorgularını çalıştırdıktan sonra bu satırın yorumunu kaldır)
-- ============================================
-- 2025-11-21 11:45:00'dan sonraki tüm kayıtlar için:
-- 1. Nem < 50.00 ise 0.90 ekle, değilse değişiklik yok
-- 2. Sıcaklık > 25.00 ise 0.90 çıkar
-- 3. Sıcaklık < 20.00 ise 0.90 ekle

-- UPDATE [TemperatureHumidityDB].[dbo].[SensorData]
-- SET 
--     [Humidity] = CASE 
--         WHEN [Humidity] < 50.00 THEN [Humidity] + 0.90
--         ELSE [Humidity]
--     END,
--     [Temperature] = CASE 
--         WHEN [Temperature] > 25.00 THEN [Temperature] - 0.90
--         WHEN [Temperature] < 20.00 THEN [Temperature] + 0.90
--         ELSE [Temperature]
--     END
-- WHERE [Timestamp] > '2025-11-21 11:45:00';

