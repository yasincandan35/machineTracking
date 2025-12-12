-- =============================================
-- Bakım-Onarım Sistemi Tabloları
-- Dashboard Veritabanı için SQL Script
-- =============================================

USE [Dashboard];
GO

-- =============================================
-- 1. MaintenanceRequests Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenanceRequests]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenanceRequests]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MachineName] NVARCHAR(200) NOT NULL,
        [MachineTableName] NVARCHAR(100) NULL,
        [FaultType] NVARCHAR(100) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedByUserName] NVARCHAR(100) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [AcceptedAt] DATETIME2 NULL,
        [ArrivedAt] DATETIME2 NULL,
        [CompletedAt] DATETIME2 NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'pending'
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenanceRequests_Status] ON [dbo].[MaintenanceRequests]([Status]);
    CREATE INDEX [IX_MaintenanceRequests_MachineName] ON [dbo].[MaintenanceRequests]([MachineName]);
    CREATE INDEX [IX_MaintenanceRequests_CreatedAt] ON [dbo].[MaintenanceRequests]([CreatedAt]);
    CREATE INDEX [IX_MaintenanceRequests_CreatedByUserId] ON [dbo].[MaintenanceRequests]([CreatedByUserId]);
    
    PRINT 'MaintenanceRequests tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenanceRequests tablosu zaten mevcut.';
END
GO

-- =============================================
-- 2. MaintenanceAssignments Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenanceAssignments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenanceAssignments]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MaintenanceRequestId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [UserName] NVARCHAR(100) NOT NULL,
        [UserEmail] NVARCHAR(255) NULL,
        [AcceptedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign Key
        CONSTRAINT [FK_MaintenanceAssignments_MaintenanceRequests] 
            FOREIGN KEY ([MaintenanceRequestId]) 
            REFERENCES [dbo].[MaintenanceRequests]([Id]) 
            ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenanceAssignments_MaintenanceRequestId] ON [dbo].[MaintenanceAssignments]([MaintenanceRequestId]);
    CREATE INDEX [IX_MaintenanceAssignments_UserId] ON [dbo].[MaintenanceAssignments]([UserId]);
    
    PRINT 'MaintenanceAssignments tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenanceAssignments tablosu zaten mevcut.';
END
GO

-- =============================================
-- 3. MaintenanceComments Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenanceComments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenanceComments]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MaintenanceRequestId] INT NOT NULL,
        [UserId] INT NOT NULL,
        [UserName] NVARCHAR(100) NOT NULL,
        [Content] NVARCHAR(MAX) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2 NULL,
        
        -- Foreign Key
        CONSTRAINT [FK_MaintenanceComments_MaintenanceRequests] 
            FOREIGN KEY ([MaintenanceRequestId]) 
            REFERENCES [dbo].[MaintenanceRequests]([Id]) 
            ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenanceComments_MaintenanceRequestId] ON [dbo].[MaintenanceComments]([MaintenanceRequestId]);
    CREATE INDEX [IX_MaintenanceComments_UserId] ON [dbo].[MaintenanceComments]([UserId]);
    CREATE INDEX [IX_MaintenanceComments_CreatedAt] ON [dbo].[MaintenanceComments]([CreatedAt]);
    
    PRINT 'MaintenanceComments tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenanceComments tablosu zaten mevcut.';
END
GO

-- =============================================
-- 4. MaintenancePhotos Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenancePhotos]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenancePhotos]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MaintenanceRequestId] INT NOT NULL,
        [FilePath] NVARCHAR(500) NOT NULL,
        [FileName] NVARCHAR(500) NULL,
        [FileType] NVARCHAR(50) NULL,
        [FileSize] BIGINT NULL,
        [Annotations] NVARCHAR(MAX) NULL, -- JSON formatında işaretleme bilgileri
        [UploadedByUserId] INT NOT NULL,
        [UploadedByUserName] NVARCHAR(100) NOT NULL,
        [UploadedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Foreign Key
        CONSTRAINT [FK_MaintenancePhotos_MaintenanceRequests] 
            FOREIGN KEY ([MaintenanceRequestId]) 
            REFERENCES [dbo].[MaintenanceRequests]([Id]) 
            ON DELETE CASCADE
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenancePhotos_MaintenanceRequestId] ON [dbo].[MaintenancePhotos]([MaintenanceRequestId]);
    CREATE INDEX [IX_MaintenancePhotos_UploadedByUserId] ON [dbo].[MaintenancePhotos]([UploadedByUserId]);
    CREATE INDEX [IX_MaintenancePhotos_UploadedAt] ON [dbo].[MaintenancePhotos]([UploadedAt]);
    
    PRINT 'MaintenancePhotos tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenancePhotos tablosu zaten mevcut.';
END
GO

-- =============================================
-- 5. MaintenanceSchedules Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MaintenanceSchedules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MaintenanceSchedules]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MachineName] NVARCHAR(200) NOT NULL,
        [MachineTableName] NVARCHAR(100) NULL,
        [MaintenanceType] NVARCHAR(200) NOT NULL,
        [Description] NVARCHAR(500) NULL,
        [ScheduledDate] DATETIME2 NOT NULL,
        [Notify30DaysBefore] BIT NOT NULL DEFAULT 1,
        [Notify15DaysBefore] BIT NOT NULL DEFAULT 1,
        [Notify3DaysBefore] BIT NOT NULL DEFAULT 1,
        [Notification30DaysSentAt] DATETIME2 NULL,
        [Notification15DaysSentAt] DATETIME2 NULL,
        [Notification3DaysSentAt] DATETIME2 NULL,
        [IsCompleted] BIT NOT NULL DEFAULT 0,
        [CompletedAt] DATETIME2 NULL,
        [CreatedByUserId] INT NOT NULL,
        [CreatedByUserName] NVARCHAR(100) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME2 NULL,
        [IsRecurring] BIT NOT NULL DEFAULT 0,
        [RecurringIntervalDays] INT NULL
    );
    
    -- Index'ler
    CREATE INDEX [IX_MaintenanceSchedules_MachineName] ON [dbo].[MaintenanceSchedules]([MachineName]);
    CREATE INDEX [IX_MaintenanceSchedules_ScheduledDate] ON [dbo].[MaintenanceSchedules]([ScheduledDate]);
    CREATE INDEX [IX_MaintenanceSchedules_IsCompleted] ON [dbo].[MaintenanceSchedules]([IsCompleted]);
    CREATE INDEX [IX_MaintenanceSchedules_CreatedByUserId] ON [dbo].[MaintenanceSchedules]([CreatedByUserId]);
    
    PRINT 'MaintenanceSchedules tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MaintenanceSchedules tablosu zaten mevcut.';
END
GO

-- =============================================
-- Script Tamamlandı
-- =============================================
PRINT '';
PRINT '========================================';
PRINT 'Tüm bakım-onarım tabloları başarıyla oluşturuldu!';
PRINT '========================================';
GO

