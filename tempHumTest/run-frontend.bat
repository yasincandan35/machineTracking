@echo off
echo [FRONTEND] React Dashboard baslatiliyor...
echo ========================================
cd /d "C:\Users\yasin.candan\source\machineTracking\tempHumTest\Frontend"
echo [INFO] Frontend klasorune gecildi

if not exist node_modules (
    echo [INFO] Node modules yukleniyor (ilk calistirma)...
    npm install
    if %errorlevel% neq 0 (
        echo [HATA] npm install basarisiz!
        pause
        exit /b 1
    )
) else (
    echo [INFO] Node modules mevcut
)

echo [INFO] React Dashboard baslatiliyor (Port: 3000)...
echo [INFO] Tarayicida: http://localhost:3000
echo [INFO] Cikmak icin Ctrl+C basin
echo ========================================
npm start
pause
