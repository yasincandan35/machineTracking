@echo off
echo ========================================
echo Robot Data Collector - EXE Olusturma
echo ========================================
echo.

echo Temizleme yapiliyor...
dotnet clean
echo.

echo EXE dosyasi olusturuluyor...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

echo.
echo ========================================
echo EXE dosyasi olusturuldu!
echo Konum: bin\Release\net8.0-windows\win-x64\publish\RobotDataCollector.exe
echo ========================================
pause

