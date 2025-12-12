-- Son duruş sebeplerini kontrol et
-- Makine veritabanında çalıştırılmalı (örn: lemanic3_tracking)

USE lemanic3_tracking; -- Makine veritabanı adını değiştirin
GO

-- Son 50 duruş kaydını göster (kategori ve sebep adlarıyla birlikte)
SELECT TOP 50
    sr.id,
    sr.start_time AS 'Başlangıç',
    sr.end_time AS 'Bitiş',
    sr.duration_seconds AS 'Süre (Saniye)',
    CAST(sr.duration_seconds / 60.0 AS DECIMAL(10, 2)) AS 'Süre (Dakika)',
    sr.category_id AS 'Kategori ID',
    sc.category_name AS 'Kategori Adı',
    sr.reason_id AS 'Sebep ID',
    sre.reason_name AS 'Sebep Adı',
    sr.created_at AS 'Kayıt Zamanı'
FROM stoppage_records sr
LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
ORDER BY sr.start_time DESC;
GO

-- Bugünkü duruş kayıtlarını göster
SELECT 
    sr.id,
    sr.start_time AS 'Başlangıç',
    sr.end_time AS 'Bitiş',
    sr.duration_seconds AS 'Süre (Saniye)',
    CAST(sr.duration_seconds / 60.0 AS DECIMAL(10, 2)) AS 'Süre (Dakika)',
    sc.category_name AS 'Kategori',
    sre.reason_name AS 'Sebep',
    sr.created_at AS 'Kayıt Zamanı'
FROM stoppage_records sr
LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
WHERE CAST(sr.start_time AS DATE) = CAST(GETDATE() AS DATE)
ORDER BY sr.start_time DESC;
GO

-- Kategori ve sebep bazında özet
SELECT 
    sc.category_name AS 'Kategori',
    sre.reason_name AS 'Sebep',
    COUNT(*) AS 'Kayıt Sayısı',
    SUM(sr.duration_seconds) AS 'Toplam Süre (Saniye)',
    CAST(SUM(sr.duration_seconds) / 60.0 AS DECIMAL(10, 2)) AS 'Toplam Süre (Dakika)',
    CAST(AVG(sr.duration_seconds) / 60.0 AS DECIMAL(10, 2)) AS 'Ortalama Süre (Dakika)'
FROM stoppage_records sr
LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
WHERE CAST(sr.start_time AS DATE) = CAST(GETDATE() AS DATE)
GROUP BY sc.category_name, sre.reason_name
ORDER BY COUNT(*) DESC;
GO

-- Undefined (tanımsız) duruş kayıtlarını göster
SELECT 
    sr.id,
    sr.start_time AS 'Başlangıç',
    sr.end_time AS 'Bitiş',
    sr.duration_seconds AS 'Süre (Saniye)',
    CAST(sr.duration_seconds / 60.0 AS DECIMAL(10, 2)) AS 'Süre (Dakika)',
    sr.category_id AS 'Kategori ID',
    sc.category_name AS 'Kategori Adı',
    sr.reason_id AS 'Sebep ID',
    sre.reason_name AS 'Sebep Adı'
FROM stoppage_records sr
LEFT JOIN stoppage_categories sc ON sr.category_id = sc.id
LEFT JOIN stoppage_reasons sre ON sr.reason_id = sre.id
WHERE sc.category_name LIKE '%Undefined%' OR sre.reason_name LIKE '%Undefined%' OR sc.category_name IS NULL OR sre.reason_name IS NULL
ORDER BY sr.start_time DESC;
GO

