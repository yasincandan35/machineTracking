@echo off
echo Starting Machine Screen in Kiosk Mode...

REM Machine Screen'i başlat (pencere açmadan)
start /min "Machine Screen" cmd /c "cd /d %~dp0 && set BROWSER=none && npm start"

REM 20 saniye bekle (React uygulaması başlasın)
echo Waiting for React app to start...
timeout /t 20 /nobreak > nul

REM Chrome'u kiosk modunda başlat (GPU hızlandırma açık)
echo Starting Chrome in Kiosk Mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --disable-extensions --user-data-dir="C:\temp\chrome_kiosk" --enable-features=UseSkiaRenderer,CanvasOopRasterization,Accelerated2dCanvas --use-angle=d3d11 --ignore-gpu-blocklist --app=http://192.168.1.237:3000?kiosk=true

echo Kiosk mode started!
echo Press Ctrl+Alt+Q to exit kiosk mode
