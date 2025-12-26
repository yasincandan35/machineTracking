-- Users tablosuna CurrentPage ve CurrentTab kolonlarını ekle
IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'CurrentPage' AND Object_ID = Object_ID(N'Users'))
BEGIN
    ALTER TABLE Users ADD CurrentPage NVARCHAR(200);
    PRINT 'Column CurrentPage added to Users.';
END
ELSE
BEGIN
    PRINT 'Column CurrentPage already exists in Users.';
END

IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'CurrentTab' AND Object_ID = Object_ID(N'Users'))
BEGIN
    ALTER TABLE Users ADD CurrentTab NVARCHAR(200);
    PRINT 'Column CurrentTab added to Users.';
END
ELSE
BEGIN
    PRINT 'Column CurrentTab already exists in Users.';
END

