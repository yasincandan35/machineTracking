-- =============================================
-- MachineIdleRecords Tablosu
-- Her Makine Veritabanında Oluşturulacak
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- MachineIdleRecords Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[MachineIdleRecords]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MachineIdleRecords]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        
        -- Boşta kalma zamanları
        [start_time] DATETIME2 NOT NULL, -- Boşta kalma başlangıç zamanı (iş sonu + 6 saat)
        [end_time] DATETIME2 NULL, -- Boşta kalma bitiş zamanı (yeni iş başladığında veya makine kapatıldığında)
        [duration_seconds] INT NULL, -- Toplam süre (saniye)
        
        -- Son iş bilgileri
        [last_job_end_time] DATETIME2 NOT NULL, -- Son işin bitiş zamanı
        [last_job_order_number] NVARCHAR(50) NULL, -- Son işin sipariş numarası
        
        -- Makine durumu
        [plc_connected] BIT NOT NULL DEFAULT 1, -- PLC bağlantısı vardı mı
        [machine_stopped] BIT NOT NULL DEFAULT 1, -- Makine durmuş muydu
        
        -- Durum bilgisi
        [status] NVARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' veya 'completed'
        [reason] NVARCHAR(200) NULL DEFAULT 'extended_idle_after_job_end', -- Boşta kalma sebebi
        
        -- Metadata
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- Index'ler
    CREATE INDEX [IX_MachineIdleRecords_status] ON [dbo].[MachineIdleRecords]([status]);
    CREATE INDEX [IX_MachineIdleRecords_start_time] ON [dbo].[MachineIdleRecords]([start_time]);
    CREATE INDEX [IX_MachineIdleRecords_last_job_end_time] ON [dbo].[MachineIdleRecords]([last_job_end_time]);
    CREATE INDEX [IX_MachineIdleRecords_status_start_time] ON [dbo].[MachineIdleRecords]([status], [start_time]);
    
    PRINT 'MachineIdleRecords tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'MachineIdleRecords tablosu zaten mevcut.';
    
    -- Eksik kolonları ekle (migration için)
    IF COL_LENGTH('MachineIdleRecords', 'duration_seconds') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD duration_seconds INT NULL;
    END
    
    IF COL_LENGTH('MachineIdleRecords', 'plc_connected') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD plc_connected BIT NOT NULL DEFAULT 1;
    END
    
    IF COL_LENGTH('MachineIdleRecords', 'machine_stopped') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD machine_stopped BIT NOT NULL DEFAULT 1;
    END
    
    IF COL_LENGTH('MachineIdleRecords', 'status') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD status NVARCHAR(20) NOT NULL DEFAULT 'active';
    END
    
    IF COL_LENGTH('MachineIdleRecords', 'reason') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD reason NVARCHAR(200) NULL DEFAULT 'extended_idle_after_job_end';
    END
    
    IF COL_LENGTH('MachineIdleRecords', 'updated_at') IS NULL
    BEGIN
        ALTER TABLE MachineIdleRecords ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
    END
END
GO

