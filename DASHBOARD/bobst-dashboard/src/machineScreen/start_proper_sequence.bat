@echo off
echo Starting Machine Screen Applications in proper sequence...
echo.

REM Pre-clean: kill processes on ports 5199 and 3000 if any
echo Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5199" ^| findstr LISTENING') do (
  echo Port 5199 in use by PID %%a. Killing...
  taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr LISTENING') do (
  echo Port 3000 in use by PID %%a. Killing...
  taskkill /PID %%a /F >nul 2>&1
)
timeout /t 3 /nobreak > nul

REM Uygulamaların bulunduğu dizinleri ayarla
set MACHINE_SCREEN_DIR=%~dp0
set PLC_COLLECTOR_DIR=%MACHINE_SCREEN_DIR%..\PLCDataCollector
set DASHBOARD_API_DIR=%MACHINE_SCREEN_DIR%..\BobstDashboardAPI

REM 1. PLC Data Collector'ı başlat (pencere açmadan)
echo [1/3] Starting PLC Data Collector...
start /min "PLC Data Collector" cmd /c "cd /d %PLC_COLLECTOR_DIR% && dotnet run"
timeout /t 5 /nobreak > nul

REM 2. Dashboard API'yi başlat (pencere açmadan)
echo [2/3] Starting Dashboard API...
start /min "Dashboard API" cmd /c "cd /d %DASHBOARD_API_DIR%\BobstDashboardAPI && dotnet run"
timeout /t 5 /nobreak > nul

REM 3. Machine Screen'i başlat (konsol tutmadan, minimize)
echo [3/3] Starting Machine Screen...
start /min "Machine Screen" cmd /c "cd /d %MACHINE_SCREEN_DIR% && npm run start:kiosk"
timeout /t 8 /nobreak > nul

REM Görev çubuğunu gizle
echo Hiding taskbar and disabling Start Menu...
call "%~dp0hide_taskbar.bat"

REM Explorer'ı kapatma (GPU kompozisyonu ve hızlandırma için açık kalsın)
echo Skipping killing Windows Explorer shell to preserve GPU composition...

REM Chrome'u kiosk modunda başlat (GPU hızlandırma açık)
echo Starting Chrome in Kiosk Mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --no-first-run --disable-infobars --disable-session-crashed-bubble --disable-extensions --user-data-dir="C:\temp\chrome_kiosk" --enable-features=UseSkiaRenderer,CanvasOopRasterization,Accelerated2dCanvas --use-angle=d3d11 --ignore-gpu-blocklist --app=http://192.168.1.237:3000?kiosk=true

REM Chrome penceresini en öne getir ve topmost yap
powershell -NoProfile -ExecutionPolicy Bypass -Command "
$sig = @'
using System;
using System.Runtime.InteropServices;
public static class WinAPI {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public const uint SWP_NOSIZE = 0x0001; public const uint SWP_NOMOVE = 0x0002; public const uint SWP_SHOWWINDOW = 0x0040;
}
'@;
Add-Type -TypeDefinition $sig;
$deadline = (Get-Date).AddSeconds(20);
do {
  Start-Sleep -Milliseconds 300;
  $proc = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1;
} while(-not $proc -and (Get-Date) -lt $deadline);
if ($proc) {
  [WinAPI]::SetWindowPos($proc.MainWindowHandle, [WinAPI]::HWND_TOPMOST, 0,0,0,0, [WinAPI]::SWP_NOMOVE -bor [WinAPI]::SWP_NOSIZE -bor [WinAPI]::SWP_SHOWWINDOW) | Out-Null;
  [WinAPI]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null;
}
"

echo.
echo All applications started successfully!
echo Press Ctrl+Alt+Q to exit kiosk mode
echo.
echo Done.
