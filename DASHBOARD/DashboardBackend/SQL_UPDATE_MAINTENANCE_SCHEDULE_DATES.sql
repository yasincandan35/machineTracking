-- MaintenanceSchedules tablosuna StartDate ve EndDate kolonları ekleme
-- ScheduledDate kolonunu kaldırma ve yeni kolonları ekleme

USE Dashboard;
GO

-- Önce ScheduledDate kolonunu yedekle (gerekirse)
-- ALTER TABLE MaintenanceSchedules ADD ScheduledDateBackup DATETIME;
-- UPDATE MaintenanceSchedules SET ScheduledDateBackup = ScheduledDate;

-- Önce ScheduledDate index'ini kaldır (eğer varsa)
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceSchedules_ScheduledDate' AND object_id = OBJECT_ID('dbo.MaintenanceSchedules'))
BEGIN
    DROP INDEX [IX_MaintenanceSchedules_ScheduledDate] ON [dbo].[MaintenanceSchedules];
    PRINT 'IX_MaintenanceSchedules_ScheduledDate index''i kaldırıldı.';
END
GO

-- StartDate kolonunu ekle (eğer yoksa)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MaintenanceSchedules' AND COLUMN_NAME = 'StartDate')
BEGIN
    ALTER TABLE MaintenanceSchedules
    ADD StartDate DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT 'StartDate kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'StartDate kolonu zaten mevcut.';
END
GO

-- EndDate kolonunu ekle (eğer yoksa)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MaintenanceSchedules' AND COLUMN_NAME = 'EndDate')
BEGIN
    ALTER TABLE MaintenanceSchedules
    ADD EndDate DATETIME2 NOT NULL DEFAULT GETDATE();
    PRINT 'EndDate kolonu eklendi.';
END
ELSE
BEGIN
    PRINT 'EndDate kolonu zaten mevcut.';
END
GO

-- Eğer ScheduledDate kolonu varsa ve StartDate/EndDate default değerlerine sahipse, verileri aktar
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MaintenanceSchedules' AND COLUMN_NAME = 'ScheduledDate')
BEGIN
    -- StartDate ve EndDate'nin default değerlerine sahip kayıtları güncelle
    UPDATE MaintenanceSchedules 
    SET StartDate = ScheduledDate, 
        EndDate = DATEADD(DAY, 1, ScheduledDate)
    WHERE StartDate = CAST(GETDATE() AS DATETIME2) 
       OR EndDate = CAST(GETDATE() AS DATETIME2)
       OR (StartDate IS NULL OR EndDate IS NULL);
    
    PRINT 'ScheduledDate verileri StartDate ve EndDate''e aktarıldı.';
    
    -- ScheduledDate kolonunu kaldır
    ALTER TABLE MaintenanceSchedules
    DROP COLUMN ScheduledDate;
    PRINT 'ScheduledDate kolonu kaldırıldı.';
END
ELSE
BEGIN
    PRINT 'ScheduledDate kolonu bulunamadı (zaten kaldırılmış olabilir).';
END
GO

-- Yeni kolonlar için index'ler oluştur
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceSchedules_StartDate' AND object_id = OBJECT_ID('dbo.MaintenanceSchedules'))
BEGIN
    CREATE INDEX [IX_MaintenanceSchedules_StartDate] ON [dbo].[MaintenanceSchedules]([StartDate]);
    PRINT 'IX_MaintenanceSchedules_StartDate index''i oluşturuldu.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MaintenanceSchedules_EndDate' AND object_id = OBJECT_ID('dbo.MaintenanceSchedules'))
BEGIN
    CREATE INDEX [IX_MaintenanceSchedules_EndDate] ON [dbo].[MaintenanceSchedules]([EndDate]);
    PRINT 'IX_MaintenanceSchedules_EndDate index''i oluşturuldu.';
END
GO

PRINT 'MaintenanceSchedules tablosu başarıyla güncellendi. StartDate ve EndDate kolonları eklendi.';

