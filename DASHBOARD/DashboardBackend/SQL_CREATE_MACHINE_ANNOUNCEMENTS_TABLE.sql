-- Makine duyurularını tutan tablo (SQL Server)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MachineAnnouncements]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MachineAnnouncements](
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Message] NVARCHAR(500) NOT NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        [CreatedBy] NVARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MachineAnnouncements_CreatedAt' AND object_id = OBJECT_ID('MachineAnnouncements'))
BEGIN
    CREATE INDEX IX_MachineAnnouncements_CreatedAt ON MachineAnnouncements (CreatedAt DESC);
END
GO

