-- UserActivityLogs Tablosu
-- Kullanıcı aktivitelerini detaylı olarak takip etmek için

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserActivityLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[UserActivityLogs] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [UserId] INT NOT NULL,
        [EventType] NVARCHAR(50) NOT NULL, -- 'page_view', 'tab_change', 'subtab_change', 'machine_selected', 'action', 'time_spent'
        [Page] NVARCHAR(100) NULL, -- "/", "/machine-screen", "/admin"
        [Tab] NVARCHAR(100) NULL, -- "home", "analysis", "reports", "admin", vb.
        [SubTab] NVARCHAR(100) NULL, -- Home için: "dashboard", "periodicSummaries", "operatorPerformance"
        [MachineId] INT NULL,
        [MachineName] NVARCHAR(200) NULL,
        [Action] NVARCHAR(100) NULL, -- "view_live_stream", "select_job", "view_data_analysis", vb.
        [Details] NVARCHAR(MAX) NULL, -- JSON formatında ek detaylar
        [Duration] INT NULL, -- Saniye cinsinden süre (sayfada geçirilen süre için)
        [Timestamp] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [SessionId] NVARCHAR(100) NULL, -- Aynı oturumu gruplamak için
        
        CONSTRAINT [FK_UserActivityLogs_Users] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id]) ON DELETE CASCADE
    );

    -- Index'ler (performans için)
    CREATE INDEX [IX_UserActivityLogs_UserId] ON [UserActivityLogs]([UserId]);
    CREATE INDEX [IX_UserActivityLogs_Timestamp] ON [UserActivityLogs]([Timestamp]);
    CREATE INDEX [IX_UserActivityLogs_EventType] ON [UserActivityLogs]([EventType]);
    CREATE INDEX [IX_UserActivityLogs_SessionId] ON [UserActivityLogs]([SessionId]);
    CREATE INDEX [IX_UserActivityLogs_UserId_Timestamp] ON [UserActivityLogs]([UserId], [Timestamp] DESC);
END
GO

