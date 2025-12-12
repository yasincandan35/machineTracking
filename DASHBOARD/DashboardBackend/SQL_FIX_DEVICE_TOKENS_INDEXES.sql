-- DeviceTokens tablosundaki index uyarılarını düzeltme
-- Token kolonu çok uzun olduğu için index'leri optimize et

USE Dashboard;
GO

-- Mevcut problematik index'leri kaldır
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceTokens_Token' AND object_id = OBJECT_ID('dbo.DeviceTokens'))
BEGIN
    DROP INDEX [IX_DeviceTokens_Token] ON [dbo].[DeviceTokens];
    PRINT 'IX_DeviceTokens_Token index''i kaldırıldı.';
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceTokens_UserId_Token' AND object_id = OBJECT_ID('dbo.DeviceTokens'))
BEGIN
    DROP INDEX [IX_DeviceTokens_UserId_Token] ON [dbo].[DeviceTokens];
    PRINT 'IX_DeviceTokens_UserId_Token index''i kaldırıldı.';
END
GO

-- TokenHash computed column ekle (eğer yoksa)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DeviceTokens') AND name = 'TokenHash')
BEGIN
    ALTER TABLE [dbo].[DeviceTokens] 
    ADD [TokenHash] AS CHECKSUM([Token]) PERSISTED;
    PRINT 'TokenHash computed column eklendi.';
END
ELSE
BEGIN
    PRINT 'TokenHash computed column zaten mevcut.';
END
GO

-- Optimize edilmiş unique index oluştur (UserId + TokenHash)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_DeviceTokens_UserId_TokenHash' AND object_id = OBJECT_ID('dbo.DeviceTokens'))
BEGIN
    CREATE UNIQUE INDEX [IX_DeviceTokens_UserId_TokenHash] 
    ON [dbo].[DeviceTokens]([UserId], [TokenHash]);
    PRINT 'IX_DeviceTokens_UserId_TokenHash unique index''i oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'IX_DeviceTokens_UserId_TokenHash index''i zaten mevcut.';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'DeviceTokens index''leri başarıyla optimize edildi!';
PRINT '========================================';
GO

