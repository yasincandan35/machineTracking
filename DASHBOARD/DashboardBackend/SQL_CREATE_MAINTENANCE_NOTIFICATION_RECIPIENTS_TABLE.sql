-- MaintenanceNotificationRecipients tablosu oluşturma
-- Admin tarafından belirlenen bildirim alıcılarını saklamak için

USE Dashboard;
GO

-- =============================================
-- MaintenanceNotificationRecipients Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenanceNotificationRecipients]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenanceNotificationRecipients]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [UserName] NVARCHAR(100) NOT NULL,
        [UserEmail] NVARCHAR(255) NULL,
        [UserRole] NVARCHAR(50) NULL,
        [NotificationCategory] NVARCHAR(50) NOT NULL DEFAULT 'maintenance', -- "maintenance", "production", "quality"
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedByUserId] INT NOT NULL,
        [CreatedByUserName] NVARCHAR(100) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2 NULL,
        
        CONSTRAINT [FK_MaintenanceNotificationRecipients_Users] FOREIGN KEY ([UserId]) 
            REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenanceNotificationRecipients_UserId] ON [dbo].[MaintenanceNotificationRecipients]([UserId]);
    CREATE INDEX [IX_MaintenanceNotificationRecipients_IsActive] ON [dbo].[MaintenanceNotificationRecipients]([IsActive]);
    CREATE INDEX [IX_MaintenanceNotificationRecipients_Category] ON [dbo].[MaintenanceNotificationRecipients]([NotificationCategory]);
    
    -- Aynı kullanıcı ve kategori kombinasyonu için unique constraint
    CREATE UNIQUE INDEX [IX_MaintenanceNotificationRecipients_UserId_Category] 
    ON [dbo].[MaintenanceNotificationRecipients]([UserId], [NotificationCategory])
    WHERE [IsActive] = 1;
    
    PRINT 'MaintenanceNotificationRecipients tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenanceNotificationRecipients tablosu zaten mevcut.';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'MaintenanceNotificationRecipients tablosu başarıyla oluşturuldu!';
PRINT '========================================';
GO

