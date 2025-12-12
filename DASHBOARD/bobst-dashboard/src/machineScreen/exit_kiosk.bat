@echo off
echo Exiting Kiosk Mode...

REM Chrome kiosk modunu kapat
taskkill /f /im chrome.exe 2>nul

REM React uygulamasını kapat
taskkill /f /im node.exe 2>nul

REM Geçici Chrome verilerini temizle
rmdir /s /q "C:\temp\chrome_kiosk" 2>nul

echo Kiosk mode exited!
pause
