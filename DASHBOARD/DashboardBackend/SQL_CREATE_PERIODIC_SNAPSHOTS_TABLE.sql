-- =============================================
-- PeriodicSnapshots Tablosu
-- Her Makine Veritabanında Oluşturulacak
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- PeriodicSnapshots Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[PeriodicSnapshots]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PeriodicSnapshots]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        
        -- Snapshot bilgileri
        [snapshot_type] NVARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
        [snapshot_date] DATETIME2 NOT NULL, -- Gün/ay/çeyrek/yıl başı zamanı
        
        -- Aktif iş bilgileri (snapshot anında)
        [siparis_no] NVARCHAR(50) NULL, -- Aktif işin sipariş numarası
        [cycle_start_time] DATETIME2 NULL, -- İşin başlangıç zamanı
        
        -- Kümülatif değerler (snapshot anındaki toplam değerler)
        [actual_production] INT NULL, -- O anki üretim adedi
        [total_stoppage_duration] DECIMAL(18,2) NULL, -- O ana kadar toplam duruş (milisaniye)
        [energy_consumption_kwh] DECIMAL(18,2) NULL, -- O ana kadar toplam enerji
        [wastage_before_die] DECIMAL(18,2) NULL, -- O ana kadar die öncesi fire
        [wastage_after_die] DECIMAL(18,2) NULL, -- O ana kadar die sonrası fire
        [paper_consumption] DECIMAL(18,2) NULL, -- O ana kadar kağıt tüketimi
        [ethyl_alcohol_consumption] DECIMAL(18,2) NULL, -- O ana kadar etil alkol tüketimi
        [ethyl_acetate_consumption] DECIMAL(18,2) NULL, -- O ana kadar etil asetat tüketimi
        
        -- OEE için gerekli değerler
        [planned_time] DECIMAL(18,2) NULL, -- Planlanan süre (dakika)
        [run_time] DECIMAL(18,2) NULL, -- Çalışma süresi (dakika)
        
        -- Tüm canlı veriler JSON olarak (ileride kullanılmak üzere)
        [full_live_data] NVARCHAR(MAX) NULL, -- API'den gelen tüm veriler JSON formatında
        
        -- Metadata
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- Index'ler
    CREATE INDEX [IX_PeriodicSnapshots_type_date] ON [dbo].[PeriodicSnapshots]([snapshot_type], [snapshot_date]);
    CREATE INDEX [IX_PeriodicSnapshots_siparis_no] ON [dbo].[PeriodicSnapshots]([siparis_no]);
    CREATE INDEX [IX_PeriodicSnapshots_cycle_start] ON [dbo].[PeriodicSnapshots]([cycle_start_time]);
    CREATE INDEX [IX_PeriodicSnapshots_snapshot_date] ON [dbo].[PeriodicSnapshots]([snapshot_date]);
    
    PRINT 'PeriodicSnapshots tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'PeriodicSnapshots tablosu zaten mevcut.';
END
GO

