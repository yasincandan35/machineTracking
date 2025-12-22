-- =============================================
-- JobEndReports Tablosuna planned_production_time Kolonu Ekleme
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- Kolonun var olup olmadığını kontrol et ve yoksa ekle
IF COL_LENGTH('JobEndReports', 'planned_production_time') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD planned_production_time DECIMAL(18,4) NULL;
    PRINT 'planned_production_time kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'planned_production_time kolonu zaten mevcut.';
END
GO

-- Eski işler için planned_production_time hesapla ve güncelle
-- planlananSure = (hesaplanacakMiktar / set_sayisi) * (silindir_cevresi / 1000) / hedef_hiz + setup
-- hesaplanacakMiktar = (kalan_miktar <= 0) ? toplam_miktar : kalan_miktar
UPDATE j
SET planned_production_time = 
    CASE 
        WHEN j.set_sayisi > 0 
         AND j.silindir_cevresi IS NOT NULL
         AND j.hedef_hiz > 0
         AND TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2)) > 0
        THEN 
            (
                (CASE WHEN j.kalan_miktar <= 0 THEN j.toplam_miktar ELSE j.kalan_miktar END) / j.set_sayisi
            ) * 
            (
                TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2)) / 1000
            ) / 
            j.hedef_hiz +
            ISNULL(j.setup, 0)
        ELSE NULL
    END
FROM JobEndReports j
WHERE j.planned_production_time IS NULL
  AND j.set_sayisi > 0
  AND j.silindir_cevresi IS NOT NULL
  AND j.hedef_hiz > 0;

PRINT 'planned_production_time hesaplamaları tamamlandı!';
GO

-- Sonuçları göster
SELECT TOP 20
    id,
    siparis_no,
    set_sayisi,
    silindir_cevresi,
    hedef_hiz,
    kalan_miktar,
    toplam_miktar,
    setup,
    planned_production_time,
    job_start_time,
    job_end_time,
    DATEDIFF(MINUTE, job_start_time, job_end_time) AS gercek_calisma_suresi_dakika
FROM JobEndReports
WHERE planned_production_time IS NOT NULL
ORDER BY job_end_time DESC;
GO

