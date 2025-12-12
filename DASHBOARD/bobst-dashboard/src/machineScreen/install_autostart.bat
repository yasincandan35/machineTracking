@echo off
echo Installing Auto-Start (Task Scheduler) for Machine Screen...

REM Script yolları
set SCRIPT_DIR=%~dp0
set START_SCRIPT=%SCRIPT_DIR%start_proper_sequence.bat
set TASK_NAME=MachineScreen_Autostart

REM Yönetici yetkisi kontrolü
whoami /groups | find "S-1-16-12288" >nul
if not %errorlevel%==0 (
    echo This installer should be run as Administrator. Right-click and select "Run as administrator".
    pause
    exit /b 1
)

REM Eski görev varsa sil
schtasks /Query /TN %TASK_NAME% >nul 2>&1
if %errorlevel%==0 (
    echo Existing scheduled task found. Removing...
    schtasks /Delete /TN %TASK_NAME% /F >nul 2>&1
)

REM Görevi oluştur (Kullanıcı oturum açtığında, en yuksek yetkiyle, pencere göstermeden)
echo Creating scheduled task to run on user logon...
schtasks /Create ^
  /TN %TASK_NAME% ^
  /TR "\"%START_SCRIPT%\"" ^
  /SC ONLOGON ^
  /RL HIGHEST ^
  /F

if %errorlevel% NEQ 0 (
    echo Failed to create scheduled task.
    pause
    exit /b 1
)

echo Auto-start installed successfully!
echo It will run after user logon with highest privileges.
echo Task Name: %TASK_NAME%
echo Script: %START_SCRIPT%
echo.
echo You can test now by signing out/in or restarting the PC.
pause
