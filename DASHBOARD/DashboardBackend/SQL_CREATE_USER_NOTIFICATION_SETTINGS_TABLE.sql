-- UserNotificationSettings tablosu oluşturma
-- Kullanıcıların makina bazlı özelleştirilebilir bildirim ayarlarını saklamak için

USE Dashboard;
GO

-- Önce Users tablosunun primary key'ini kontrol et
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.Users') AND type = 'PK')
BEGIN
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Id')
    BEGIN
        ALTER TABLE [dbo].[Users]
        ADD CONSTRAINT [PK_Users] PRIMARY KEY ([Id]);
        PRINT 'Users tablosuna primary key eklendi.';
    END
END
GO

-- MachineLists tablosunun primary key'ini kontrol et
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.MachineLists') AND type = 'PK')
BEGIN
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.MachineLists') AND name = 'Id')
    BEGIN
        ALTER TABLE [dbo].[MachineLists]
        ADD CONSTRAINT [PK_MachineLists] PRIMARY KEY ([Id]);
        PRINT 'MachineLists tablosuna primary key eklendi.';
    END
END
GO

-- =============================================
-- UserNotificationSettings Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[UserNotificationSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[UserNotificationSettings]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [MachineId] INT NULL, -- NULL = tüm makineler için
        [NotificationType] NVARCHAR(50) NOT NULL, -- "stoppage_duration", "speed_reached", "new_report", "production_complete", vb.
        [IsEnabled] BIT NOT NULL DEFAULT 1,
        [Threshold] DECIMAL(18,2) NULL, -- Eşik değeri (dakika, yüzde, vb.)
        [ThresholdUnit] NVARCHAR(20) NULL, -- "minutes", "percent", "count", vb.
        [NotificationTitle] NVARCHAR(200) NULL, -- Özelleştirilebilir başlık
        [NotificationBody] NVARCHAR(500) NULL, -- Özelleştirilebilir mesaj
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2 NULL,
        
        CONSTRAINT [FK_UserNotificationSettings_Users] FOREIGN KEY ([UserId]) 
            REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserNotificationSettings_MachineLists] FOREIGN KEY ([MachineId]) 
            REFERENCES [dbo].[MachineLists]([Id]) ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_UserNotificationSettings_UserId] ON [dbo].[UserNotificationSettings]([UserId]);
    CREATE INDEX [IX_UserNotificationSettings_MachineId] ON [dbo].[UserNotificationSettings]([MachineId]);
    CREATE INDEX [IX_UserNotificationSettings_NotificationType] ON [dbo].[UserNotificationSettings]([NotificationType]);
    CREATE INDEX [IX_UserNotificationSettings_IsEnabled] ON [dbo].[UserNotificationSettings]([IsEnabled]);
    
    -- Aynı kullanıcı, makina ve bildirim tipi kombinasyonu için unique constraint
    CREATE UNIQUE INDEX [IX_UserNotificationSettings_UserId_MachineId_Type] 
    ON [dbo].[UserNotificationSettings]([UserId], [MachineId], [NotificationType])
    WHERE [MachineId] IS NOT NULL;
    
    -- Tüm makineler için (MachineId NULL) unique constraint
    CREATE UNIQUE INDEX [IX_UserNotificationSettings_UserId_Type_AllMachines] 
    ON [dbo].[UserNotificationSettings]([UserId], [NotificationType])
    WHERE [MachineId] IS NULL;
    
    PRINT 'UserNotificationSettings tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'UserNotificationSettings tablosu zaten mevcut.';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'UserNotificationSettings tablosu başarıyla oluşturuldu!';
PRINT '========================================';
GO

