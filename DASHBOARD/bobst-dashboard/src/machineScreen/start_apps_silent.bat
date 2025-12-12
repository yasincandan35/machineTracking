@echo off
REM Sessiz başlatma - pencere açmadan çalışır

REM Uygulamaların bulunduğu dizinleri ayarla
set MACHINE_SCREEN_DIR=%~dp0
set PLC_COLLECTOR_DIR=%MACHINE_SCREEN_DIR%..\PLCDataCollector
set DASHBOARD_API_DIR=%MACHINE_SCREEN_DIR%..\BobstDashboardAPI

REM Port temizliği: 5199 (API) ve 3000 (React)
echo Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5199" ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 3 /nobreak > nul

REM 1. PLC Data Collector'ı başlat (pencere açmadan)
start /min "PLC Data Collector" cmd /c "cd /d %PLC_COLLECTOR_DIR% && dotnet run"
timeout /t 10 /nobreak > nul

REM 2. Dashboard API'yi başlat (pencere açmadan)
start /min "Dashboard API" cmd /c "cd /d %DASHBOARD_API_DIR%\BobstDashboardAPI && dotnet run"
timeout /t 15 /nobreak > nul

REM 3. Machine Screen'i başlat (pencere açmadan)
start /min "Machine Screen" cmd /c "cd /d %MACHINE_SCREEN_DIR% && npm start"
timeout /t 20 /nobreak > nul

REM Chrome'u kiosk modunda başlat (GPU hızlandırma açık)
start /min "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --disable-extensions --user-data-dir="C:\temp\chrome_kiosk" --enable-features=UseSkiaRenderer,CanvasOopRasterization,Accelerated2dCanvas --use-angle=d3d11 --ignore-gpu-blocklist --app=http://192.168.1.237:3000?kiosk=true
