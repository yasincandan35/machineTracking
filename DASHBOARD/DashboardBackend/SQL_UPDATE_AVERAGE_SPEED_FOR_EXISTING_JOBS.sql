-- =============================================
-- Eski İşler İçin Ortalama Hız ve RunTime Hesaplama
-- JobEndReports tablosundaki mevcut işler için
-- 65 m/dk threshold ile ortalama hız ve runTime hesaplanır
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- Ortalama Hız Hesaplama ve Güncelleme
-- =============================================

-- Önce average_speed ve run_time_seconds kolonlarının var olduğundan emin ol
IF COL_LENGTH('JobEndReports', 'average_speed') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD average_speed DECIMAL(18,2) NULL;
    PRINT 'average_speed kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'average_speed kolonu zaten mevcut.';
END

IF COL_LENGTH('JobEndReports', 'run_time_seconds') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD run_time_seconds INT NULL;
    PRINT 'run_time_seconds kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'run_time_seconds kolonu zaten mevcut.';
END
GO

-- Eski işler için ortalama hızı ve runTime'ı hesapla ve güncelle
-- Sadece average_speed veya run_time_seconds NULL olan kayıtları güncelle
UPDATE j
SET 
    average_speed = speedData.average_speed,
    run_time_seconds = speedData.run_time_seconds
FROM JobEndReports j
CROSS APPLY (
    SELECT 
        AVG(CAST(MachineSpeed AS FLOAT)) AS average_speed,
        COUNT(*) AS run_time_seconds
    FROM dataRecords d
    WHERE d.KayitZamani >= j.job_start_time 
      AND d.KayitZamani <= j.job_end_time
      AND d.MachineSpeed >= 65
      AND d.MachineSpeed IS NOT NULL
) AS speedData
WHERE (j.average_speed IS NULL OR j.average_speed = 0 OR j.run_time_seconds IS NULL)
  AND j.job_start_time IS NOT NULL
  AND j.job_end_time IS NOT NULL;

-- Sonuçları göster
SELECT 
    COUNT(*) AS toplam_is,
    COUNT(average_speed) AS hesaplanan_ortalama_hiz,
    COUNT(run_time_seconds) AS hesaplanan_runTime,
    COUNT(*) - COUNT(average_speed) AS hesaplanamayan_ortalama_hiz,
    COUNT(*) - COUNT(run_time_seconds) AS hesaplanamayan_runTime,
    AVG(average_speed) AS genel_ortalama_hiz,
    MIN(average_speed) AS min_ortalama_hiz,
    MAX(average_speed) AS max_ortalama_hiz,
    AVG(run_time_seconds) AS genel_ortalama_runTime_saniye,
    AVG(run_time_seconds / 60.0) AS genel_ortalama_runTime_dakika,
    MIN(run_time_seconds) AS min_runTime_saniye,
    MAX(run_time_seconds) AS max_runTime_saniye
FROM JobEndReports
WHERE job_start_time IS NOT NULL 
  AND job_end_time IS NOT NULL;

-- Detaylı sonuçlar (ilk 20 kayıt)
SELECT TOP 20
    id,
    siparis_no,
    job_start_time,
    job_end_time,
    average_speed,
    hedef_hiz,
    run_time_seconds,
    CAST(run_time_seconds / 60.0 AS DECIMAL(18,2)) AS run_time_dakika,
    DATEDIFF(SECOND, job_start_time, job_end_time) AS toplam_sure_saniye,
    CAST(DATEDIFF(SECOND, job_start_time, job_end_time) / 60.0 AS DECIMAL(18,2)) AS toplam_sure_dakika,
    CASE 
        WHEN average_speed IS NOT NULL AND hedef_hiz > 0 
        THEN CAST((average_speed / hedef_hiz * 100) AS DECIMAL(18,2))
        ELSE NULL
    END AS hiz_verimliligi_yuzde,
    CASE 
        WHEN run_time_seconds IS NOT NULL AND DATEDIFF(SECOND, job_start_time, job_end_time) > 0
        THEN CAST((run_time_seconds * 100.0 / DATEDIFF(SECOND, job_start_time, job_end_time)) AS DECIMAL(18,2))
        ELSE NULL
    END AS runTime_yuzdesi
FROM JobEndReports
WHERE job_start_time IS NOT NULL 
  AND job_end_time IS NOT NULL
ORDER BY job_end_time DESC;

PRINT 'Ortalama hız ve runTime hesaplama tamamlandı!';
GO

