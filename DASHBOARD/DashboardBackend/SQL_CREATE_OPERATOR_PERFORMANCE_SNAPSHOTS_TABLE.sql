-- =============================================
-- OperatorPerformanceSnapshots Tablosu
-- Her Makine Veritabanında Oluşturulacak
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- OperatorPerformanceSnapshots Tablosu
-- =============================================
IF OBJECT_ID(N'[dbo].[OperatorPerformanceSnapshots]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[OperatorPerformanceSnapshots]
    (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        
        -- Operatör bilgileri
        [employee_id] INT NOT NULL,
        [employee_name] NVARCHAR(200) NOT NULL,
        [position] NVARCHAR(200) NULL, -- 'SORUMLU OPERATÖR', 'OPERATÖR YARDIMCISI', vb.
        
        -- Vardiya bilgileri
        [shift_date] DATE NOT NULL,
        [template_id] INT NOT NULL,
        [template_name] NVARCHAR(200) NULL,
        [shift_start_time] TIME NOT NULL,
        [shift_end_time] TIME NOT NULL,
        [shift_start_datetime] DATETIME2 NOT NULL, -- Gerçek başlangıç zamanı (gece vardiyaları için)
        [shift_end_datetime] DATETIME2 NOT NULL, -- Gerçek bitiş zamanı (gece vardiyaları için)
        
        -- Performans metrikleri (vardiya boyunca)
        [actual_production] INT NULL DEFAULT 0, -- Toplam üretim adedi
        [total_stoppage_duration] DECIMAL(18,2) NULL DEFAULT 0, -- Toplam duruş süresi (milisaniye)
        [stoppage_count] INT NULL DEFAULT 0, -- Duruş sayısı
        [wastage_before_die] DECIMAL(18,2) NULL DEFAULT 0, -- Die öncesi fire
        [wastage_after_die] DECIMAL(18,2) NULL DEFAULT 0, -- Die sonrası fire
        [wastage_ratio] DECIMAL(18,4) NULL DEFAULT 0, -- Fire oranı (%)
        [paper_consumption] DECIMAL(18,2) NULL DEFAULT 0, -- Kağıt tüketimi
        [ethyl_alcohol_consumption] DECIMAL(18,2) NULL DEFAULT 0, -- Etil alkol tüketimi
        [ethyl_acetate_consumption] DECIMAL(18,2) NULL DEFAULT 0, -- Etil asetat tüketimi
        [energy_consumption_kwh] DECIMAL(18,2) NULL DEFAULT 0, -- Enerji tüketimi (kWh)
        
        -- OEE değerleri
        [planned_time] DECIMAL(18,2) NULL DEFAULT 0, -- Planlanan süre (dakika)
        [run_time] DECIMAL(18,2) NULL DEFAULT 0, -- Çalışma süresi (dakika)
        [availability] DECIMAL(18,4) NULL DEFAULT 0, -- Erişilebilirlik (%)
        [performance] DECIMAL(18,4) NULL DEFAULT 0, -- Performans (%)
        [quality] DECIMAL(18,4) NULL DEFAULT 0, -- Kalite (%)
        [oee] DECIMAL(18,4) NULL DEFAULT 0, -- OEE (%)
        
        -- Hız metrikleri
        [average_speed] DECIMAL(18,2) NULL DEFAULT 0, -- Ortalama hız (mpm)
        [max_speed] DECIMAL(18,2) NULL DEFAULT 0, -- Maksimum hız (mpm)
        [min_speed] DECIMAL(18,2) NULL DEFAULT 0, -- Minimum hız (mpm)
        
        -- İş bilgileri (vardiya boyunca çalışılan işler)
        [jobs_worked] INT NULL DEFAULT 0, -- Çalışılan iş sayısı
        [jobs_completed] INT NULL DEFAULT 0, -- Tamamlanan iş sayısı
        
        -- Tüm canlı veriler JSON olarak (ileride kullanılmak üzere)
        [full_live_data] NVARCHAR(MAX) NULL, -- API'den gelen tüm veriler JSON formatında
        
        -- Metadata
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- Index'ler
    CREATE INDEX [IX_OperatorPerformanceSnapshots_employee_date] ON [dbo].[OperatorPerformanceSnapshots]([employee_id], [shift_date]);
    CREATE INDEX [IX_OperatorPerformanceSnapshots_shift_date] ON [dbo].[OperatorPerformanceSnapshots]([shift_date]);
    CREATE INDEX [IX_OperatorPerformanceSnapshots_template] ON [dbo].[OperatorPerformanceSnapshots]([template_id]);
    CREATE INDEX [IX_OperatorPerformanceSnapshots_shift_datetime] ON [dbo].[OperatorPerformanceSnapshots]([shift_start_datetime], [shift_end_datetime]);
    
    PRINT 'OperatorPerformanceSnapshots tablosu oluşturuldu.';
END
ELSE
BEGIN
    PRINT 'OperatorPerformanceSnapshots tablosu zaten mevcut.';
    
    -- Eksik kolonları ekle (migration için)
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'stoppage_count') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD stoppage_count INT NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'wastage_ratio') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD wastage_ratio DECIMAL(18,4) NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'average_speed') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD average_speed DECIMAL(18,2) NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD max_speed DECIMAL(18,2) NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD min_speed DECIMAL(18,2) NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'jobs_worked') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD jobs_worked INT NULL DEFAULT 0;
        ALTER TABLE OperatorPerformanceSnapshots ADD jobs_completed INT NULL DEFAULT 0;
    END
    
    IF COL_LENGTH('OperatorPerformanceSnapshots', 'updated_at') IS NULL
    BEGIN
        ALTER TABLE OperatorPerformanceSnapshots ADD updated_at DATETIME2 NOT NULL DEFAULT GETDATE();
    END
END
GO

