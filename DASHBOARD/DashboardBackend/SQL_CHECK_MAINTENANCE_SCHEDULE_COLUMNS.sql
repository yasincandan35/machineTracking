-- MaintenanceSchedules tablosunun mevcut kolonlarını kontrol et

USE Dashboard;
GO

-- Mevcut kolonları listele
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'MaintenanceSchedules'
ORDER BY ORDINAL_POSITION;
GO

-- Mevcut index'leri listele
SELECT 
    i.name AS IndexName,
    i.type_desc AS IndexType,
    STRING_AGG(c.name, ', ') AS ColumnNames
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.MaintenanceSchedules')
GROUP BY i.name, i.type_desc
ORDER BY i.name;
GO

