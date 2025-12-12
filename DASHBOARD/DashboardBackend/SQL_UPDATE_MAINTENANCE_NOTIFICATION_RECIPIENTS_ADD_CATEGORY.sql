-- MaintenanceNotificationRecipients tablosuna NotificationCategory kolonu ekleme
-- Eğer tablo zaten varsa ve kategori kolonu yoksa ekler

USE Dashboard;
GO

-- NotificationCategory kolonu yoksa ekle
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MaintenanceNotificationRecipients') AND name = 'NotificationCategory')
BEGIN
    ALTER TABLE [dbo].[MaintenanceNotificationRecipients]
    ADD [NotificationCategory] NVARCHAR(50) NOT NULL DEFAULT 'maintenance';
    PRINT 'NotificationCategory kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'NotificationCategory kolonu zaten mevcut.';
END
GO

-- Eski index'i kaldır (eğer varsa)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceNotificationRecipients_UserId' AND object_id = OBJECT_ID('dbo.MaintenanceNotificationRecipients'))
BEGIN
    DROP INDEX [IX_MaintenanceNotificationRecipients_UserId] ON [dbo].[MaintenanceNotificationRecipients];
    PRINT 'Eski unique index kaldırıldı.';
END
GO

-- Yeni index'leri oluştur
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceNotificationRecipients_Category' AND object_id = OBJECT_ID('dbo.MaintenanceNotificationRecipients'))
BEGIN
    CREATE INDEX [IX_MaintenanceNotificationRecipients_Category] 
    ON [dbo].[MaintenanceNotificationRecipients]([NotificationCategory]);
    PRINT 'IX_MaintenanceNotificationRecipients_Category index''i oluşturuldu.';
END
GO

-- Yeni unique index oluştur (UserId + Category kombinasyonu)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceNotificationRecipients_UserId_Category' AND object_id = OBJECT_ID('dbo.MaintenanceNotificationRecipients'))
BEGIN
    CREATE UNIQUE INDEX [IX_MaintenanceNotificationRecipients_UserId_Category] 
    ON [dbo].[MaintenanceNotificationRecipients]([UserId], [NotificationCategory])
    WHERE [IsActive] = 1;
    PRINT 'IX_MaintenanceNotificationRecipients_UserId_Category unique index''i oluşturuldu.';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'MaintenanceNotificationRecipients tablosu başarıyla güncellendi!';
PRINT '========================================';
GO

