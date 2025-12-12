@echo off
echo [BACKEND] C# API baslatiliyor...
echo ========================================
cd /d "C:\Users\yasin.candan\source\machineTracking\tempHumTest\Backend"
echo [INFO] Backend klasorune gecildi
echo [INFO] NuGet paketleri yukleniyor...
dotnet restore
if %errorlevel% neq 0 (
    echo [HATA] NuGet restore basarisiz!
    pause
    exit /b 1
)
echo [INFO] Backend API baslatiliyor (Port: 5001)...
echo [INFO] Tarayicida: http://localhost:5001/swagger
echo [INFO] Cikmak icin Ctrl+C basin
echo ========================================
dotnet run --urls http://0.0.0.0:5001
pause
