@echo off
echo Starting Machine Screen Applications...

REM Uygulamaların bulunduğu dizinleri ayarla
set MACHINE_SCREEN_DIR=%~dp0
set PLC_COLLECTOR_DIR=%MACHINE_SCREEN_DIR%..\plcDataCollector
set DASHBOARD_API_DIR=%MACHINE_SCREEN_DIR%..\bobstdashboardapi

REM Machine Screen'i başlat
echo Starting Machine Screen...
start "Machine Screen" cmd /k "cd /d %MACHINE_SCREEN_DIR% && set BROWSER=none && npm start"

REM 15 saniye bekle (React uygulaması başlasın)
timeout /t 15 /nobreak > nul

REM Chrome'u kiosk modunda başlat
echo Starting Chrome in Kiosk Mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --disable-infobars --disable-session-crashed-bubble --disable-dev-shm-usage --no-first-run --no-default-browser-check --disable-extensions --disable-plugins --disable-web-security --user-data-dir="C:\temp\chrome_kiosk" --app=http://192.168.1.237:3000?kiosk=true

REM 5 saniye bekle
timeout /t 5 /nobreak > nul

REM PLC Data Collector'ı başlat
echo Starting PLC Data Collector...
start "PLC Data Collector" cmd /k "cd /d %PLC_COLLECTOR_DIR% && npm start"

REM 5 saniye bekle
timeout /t 5 /nobreak > nul

REM Dashboard API'yi başlat
echo Starting Dashboard API...
start "Dashboard API" cmd /k "cd /d %DASHBOARD_API_DIR%\BobstDashboardAPI && dotnet run"

echo All applications started successfully!
pause
