@echo off
echo Removing Auto-Start (Task Scheduler) for Machine Screen...

set TASK_NAME=MachineScreen_Autostart

REM Görev var mı kontrol et
schtasks /Query /TN %TASK_NAME% >nul 2>&1
if %errorlevel% NEQ 0 (
    echo Scheduled task not found: %TASK_NAME%
    echo Nothing to remove.
    pause
    exit /b 0
)

REM Görevi sil
schtasks /Delete /TN %TASK_NAME% /F
if %errorlevel% EQU 0 (
    echo Auto-start removed successfully!
) else (
    echo Failed to remove scheduled task. Try running as administrator.
)

pause
