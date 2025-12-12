-- JobEndReports tablosuna eksik kolonları ekle
-- Bu script'i veritabanında çalıştırarak eksik kolonları ekleyebilirsiniz

USE [YourDatabaseName]; -- Veritabanı adınızı buraya yazın
GO

-- energy_consumption_kwh kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'energy_consumption_kwh') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD energy_consumption_kwh DECIMAL(18,4) NULL;
    PRINT 'energy_consumption_kwh kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'energy_consumption_kwh kolonu zaten mevcut';
END
GO

-- setup kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'setup') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD setup DECIMAL(18,2) NULL;
    PRINT 'setup kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'setup kolonu zaten mevcut';
END
GO

-- qualified_bundle kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'qualified_bundle') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD qualified_bundle INT NULL;
    PRINT 'qualified_bundle kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'qualified_bundle kolonu zaten mevcut';
END
GO

-- defective_bundle kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'defective_bundle') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD defective_bundle INT NULL;
    PRINT 'defective_bundle kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'defective_bundle kolonu zaten mevcut';
END
GO

-- good_pallets kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'good_pallets') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD good_pallets INT NULL;
    PRINT 'good_pallets kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'good_pallets kolonu zaten mevcut';
END
GO

-- defective_pallets kolonu yoksa ekle
IF COL_LENGTH('JobEndReports', 'defective_pallets') IS NULL
BEGIN
    ALTER TABLE JobEndReports
    ADD defective_pallets INT NULL;
    PRINT 'defective_pallets kolonu eklendi';
END
ELSE
BEGIN
    PRINT 'defective_pallets kolonu zaten mevcut';
END
GO

PRINT 'Tüm kolonlar kontrol edildi ve eksik olanlar eklendi!';
GO

