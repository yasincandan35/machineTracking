-- DeviceTokens tablosu oluşturma
-- Kullanıcıların mobil cihaz token'larını saklamak için

USE Dashboard;
GO

-- Önce Users tablosunun primary key'ini kontrol et
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE parent_object_id = OBJECT_ID('dbo.Users') AND type = 'PK')
BEGIN
    -- Users tablosunda primary key yoksa, Id kolonuna primary key ekle
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'Id')
    BEGIN
        ALTER TABLE [dbo].[Users]
        ADD CONSTRAINT [PK_Users] PRIMARY KEY ([Id]);
        PRINT 'Users tablosuna primary key eklendi.';
    END
    ELSE
    BEGIN
        PRINT 'HATA: Users tablosunda Id kolonu bulunamadı!';
    END
END
ELSE
BEGIN
    PRINT 'Users tablosunda primary key mevcut.';
END
GO

-- =============================================
-- DeviceTokens Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[DeviceTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[DeviceTokens]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [UserId] INT NOT NULL,
        [Token] NVARCHAR(500) NOT NULL,
        [Platform] NVARCHAR(20) NOT NULL, -- "ios", "android", "web"
        [DeviceName] NVARCHAR(200) NULL,
        [AppVersion] NVARCHAR(100) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [LastUsedAt] DATETIME2 NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        
        CONSTRAINT [FK_DeviceTokens_Users] FOREIGN KEY ([UserId]) 
            REFERENCES [dbo].[Users]([Id]) ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_DeviceTokens_UserId] ON [dbo].[DeviceTokens]([UserId]);
    -- Token index'i kaldırıldı (çok uzun, 900 byte limitini aşıyor)
    -- Token araması için UserId+Token kombinasyonu kullanılacak
    CREATE INDEX [IX_DeviceTokens_IsActive] ON [dbo].[DeviceTokens]([IsActive]);
    CREATE INDEX [IX_DeviceTokens_Platform] ON [dbo].[DeviceTokens]([Platform]);
    
    -- Aynı kullanıcı ve token kombinasyonu için unique constraint
    -- Token çok uzun olduğu için hash kullanarak unique constraint oluştur
    ALTER TABLE [dbo].[DeviceTokens] 
    ADD [TokenHash] AS CHECKSUM([Token]) PERSISTED;
    
    CREATE UNIQUE INDEX [IX_DeviceTokens_UserId_TokenHash] 
    ON [dbo].[DeviceTokens]([UserId], [TokenHash]);
    
    PRINT 'DeviceTokens tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'DeviceTokens tablosu zaten mevcut.';
END
GO

PRINT '';
PRINT '========================================';
PRINT 'DeviceTokens tablosu başarıyla oluşturuldu!';
PRINT '========================================';
GO

