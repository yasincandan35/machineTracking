@echo off
echo [SYSTEM] Tum servisler baslatiliyor...
echo ========================================
echo [INFO] Backend API (Port: 5001)
echo [INFO] Frontend Dashboard (Port: 3000)
echo [INFO] Arduino IP: 192.168.1.140
echo ========================================

cd /d "C:\Users\yasin.candan\source\machineTracking\tempHumTest"

echo [1/2] Backend API baslatiliyor...
start "Backend API" cmd /k "run-backend.bat"

echo [INFO] Backend baslatiliyor, 5 saniye bekleniyor...
timeout /t 5 /nobreak >nul

echo [2/2] Frontend Dashboard baslatiliyor...
start "Frontend Dashboard" cmd /k "run-frontend.bat"

echo ========================================
echo [OK] Tum servisler baslatildi!
echo [INFO] Backend: http://localhost:5001/swagger
echo [INFO] Frontend: http://localhost:3000
echo [INFO] Arduino: http://192.168.1.140/data
echo ========================================
echo [INFO] Cikmak icin herhangi bir tusa basin...
pause >nul
