-- Bakım rollerinin isimlerini lowercase'e çevir
USE dashboard;
GO

-- maintenanceStaff -> maintenancestaff
UPDATE RoleSettings 
SET Name = 'maintenancestaff' 
WHERE Name = 'maintenanceStaff' AND Id = 11;
GO

-- maintenanceEngineer -> maintenanceengineer
UPDATE RoleSettings 
SET Name = 'maintenanceengineer' 
WHERE Name = 'maintenanceEngineer' AND Id = 12;
GO

-- maintenanceManager -> maintenancemanager
UPDATE RoleSettings 
SET Name = 'maintenancemanager' 
WHERE Name = 'maintenanceManager' AND Id = 13;
GO

-- Kontrol et
SELECT Id, Name, DisplayName FROM RoleSettings WHERE Name LIKE '%maintenance%';
GO

