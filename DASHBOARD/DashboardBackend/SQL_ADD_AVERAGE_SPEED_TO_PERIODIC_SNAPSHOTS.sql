-- =============================================
-- PeriodicSnapshots Tablosuna average_speed Kolonu Ekleme
-- Her Makine Veritabanında Çalıştırılacak
-- =============================================
-- Bu script her makine veritabanında çalıştırılmalıdır
-- Örnek: lemanic3_tracking, lemanic1_tracking, vb.

-- USE [DatabaseName]; -- Her makine için veritabanı adını değiştirin
-- GO

-- =============================================
-- average_speed Kolonu Ekleme
-- =============================================
IF COL_LENGTH('PeriodicSnapshots', 'average_speed') IS NULL
BEGIN
    ALTER TABLE [dbo].[PeriodicSnapshots]
    ADD [average_speed] DECIMAL(18,2) NULL;
    
    PRINT 'average_speed kolonu PeriodicSnapshots tablosuna eklendi.';
END
ELSE
BEGIN
    PRINT 'average_speed kolonu PeriodicSnapshots tablosunda zaten mevcut.';
END
GO

