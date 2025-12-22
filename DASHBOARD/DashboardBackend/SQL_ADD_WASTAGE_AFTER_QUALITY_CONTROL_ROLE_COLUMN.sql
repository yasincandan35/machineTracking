-- =============================================
-- RoleSettings Tablosuna CanUpdateWastageAfterQualityControl Kolonu Ekleme
-- =============================================
-- Bu script DashboardBackend veritabanında çalıştırılmalıdır
-- Her makine veritabanında değil, sadece DashboardBackend veritabanında!

USE [DashboardBackend]; -- Veritabanı adını değiştirin
GO

-- Kolonun var olup olmadığını kontrol et ve yoksa ekle
IF COL_LENGTH('RoleSettings', 'CanUpdateWastageAfterQualityControl') IS NULL
BEGIN
    ALTER TABLE [dbo].[RoleSettings] 
    ADD [CanUpdateWastageAfterQualityControl] BIT NOT NULL DEFAULT (0);
    PRINT 'CanUpdateWastageAfterQualityControl kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'CanUpdateWastageAfterQualityControl kolonu zaten mevcut.';
END
GO

-- Mevcut rollere varsayılan değer atama (eğer NULL ise)
UPDATE [dbo].[RoleSettings]
SET [CanUpdateWastageAfterQualityControl] = 0
WHERE [CanUpdateWastageAfterQualityControl] IS NULL;
GO

-- Admin rolüne yetki ver (isteğe bağlı)
UPDATE [dbo].[RoleSettings]
SET [CanUpdateWastageAfterQualityControl] = 1
WHERE LOWER([Name]) = 'admin';
GO

-- Sonuçları kontrol et
SELECT 
    [Id],
    [Name],
    [DisplayName],
    [CanUpdateWastageAfterQualityControl]
FROM [dbo].[RoleSettings]
ORDER BY [Name];
GO

PRINT 'Kolon ekleme işlemi tamamlandı!';
PRINT 'NOT: Kullanıcıların yeni yetkileri görmesi için çıkış yapıp tekrar giriş yapmaları gerekebilir.';
GO

