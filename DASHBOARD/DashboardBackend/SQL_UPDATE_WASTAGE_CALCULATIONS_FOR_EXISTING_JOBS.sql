-- =============================================
-- Eski İşler İçin Fire Hesaplamaları
-- JobEndReports tablosundaki mevcut işler için
-- total_wastage_package ve total_wastage_meters hesaplanır
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- Fire Hesaplamaları ve Güncelleme
-- =============================================

-- Önce kolonların var olduğundan emin ol
IF COL_LENGTH('JobEndReports', 'total_wastage_package') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD total_wastage_package DECIMAL(18,4) NULL;
    PRINT 'total_wastage_package kolonu eklendi.';
END

IF COL_LENGTH('JobEndReports', 'total_wastage_meters') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD total_wastage_meters DECIMAL(18,4) NULL;
    PRINT 'total_wastage_meters kolonu eklendi.';
END

IF COL_LENGTH('JobEndReports', 'wastage_after_quality_control') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD wastage_after_quality_control DECIMAL(18,4) NULL;
    PRINT 'wastage_after_quality_control kolonu eklendi.';
END

IF COL_LENGTH('JobEndReports', 'wastage_after_quality_control_updated_by') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD wastage_after_quality_control_updated_by NVARCHAR(100) NULL;
    PRINT 'wastage_after_quality_control_updated_by kolonu eklendi.';
END

IF COL_LENGTH('JobEndReports', 'wastage_after_quality_control_updated_at') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD wastage_after_quality_control_updated_at DATETIME2 NULL;
    PRINT 'wastage_after_quality_control_updated_at kolonu eklendi.';
END
GO

-- Eski işler için fire hesaplamalarını yap ve güncelle
-- totalWastagePackage = wastageAfterDie + ((wastageBeforeDie*1000/silindir_cevresi)*set_sayisi)
-- wastageBeforeDie metre, silindir_cevresi mm -> wastageBeforeDie*1000/silindir_cevresi = tabaka sayısı
-- tabaka sayısı * set_sayisi = toplam adet (her tabakada set_sayisi kadar adet var)
-- totalWastageMeters = ((wastageAfterDie/set_sayisi)*silindir_cevresi)/1000
-- wastageAfterDie paket, silindir_cevresi mm -> metreyi bulmak için 1000'e böl
UPDATE j
SET 
    total_wastage_package = CASE 
        WHEN j.wastage_after_die IS NOT NULL 
         AND j.wastage_before_die IS NOT NULL 
         AND j.set_sayisi > 0 
         AND j.silindir_cevresi IS NOT NULL
         AND TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2)) > 0
        THEN j.wastage_after_die + ((j.wastage_before_die * 1000 / TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2))) * j.set_sayisi)
        ELSE NULL
    END,
    total_wastage_meters = CASE 
        WHEN j.wastage_after_die IS NOT NULL 
         AND j.set_sayisi > 0 
         AND j.silindir_cevresi IS NOT NULL
         AND TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2)) > 0
        THEN ((j.wastage_after_die / j.set_sayisi) * TRY_CAST(REPLACE(j.silindir_cevresi, ',', '.') AS DECIMAL(18,2))) / 1000
        ELSE NULL
    END
FROM JobEndReports j
WHERE j.wastage_after_die IS NOT NULL
  AND j.set_sayisi > 0
  AND j.silindir_cevresi IS NOT NULL;

-- Sonuçları göster
SELECT 
    COUNT(*) AS toplam_is,
    COUNT(total_wastage_package) AS hesaplanan_total_wastage_package,
    COUNT(total_wastage_meters) AS hesaplanan_total_wastage_meters,
    AVG(total_wastage_package) AS genel_ortalama_total_wastage_package,
    AVG(total_wastage_meters) AS genel_ortalama_total_wastage_meters,
    MIN(total_wastage_package) AS min_total_wastage_package,
    MAX(total_wastage_package) AS max_total_wastage_package,
    MIN(total_wastage_meters) AS min_total_wastage_meters,
    MAX(total_wastage_meters) AS max_total_wastage_meters
FROM JobEndReports
WHERE wastage_after_die IS NOT NULL 
  AND set_sayisi > 0
  AND silindir_cevresi IS NOT NULL;

-- Detaylı sonuçlar (ilk 20 kayıt)
SELECT TOP 20
    id,
    siparis_no,
    wastage_before_die,
    wastage_after_die,
    set_sayisi,
    silindir_cevresi,
    total_wastage_package,
    total_wastage_meters,
    CASE 
        WHEN total_wastage_package IS NOT NULL AND wastage_after_die IS NOT NULL
        THEN CAST((total_wastage_package / wastage_after_die * 100) AS DECIMAL(18,2))
        ELSE NULL
    END AS total_wastage_package_yuzdesi
FROM JobEndReports
WHERE wastage_after_die IS NOT NULL 
  AND set_sayisi > 0
  AND silindir_cevresi IS NOT NULL
ORDER BY job_end_time DESC;

PRINT 'Fire hesaplamaları tamamlandı!';
GO

