@echo off
chcp 65001 >nul
echo.
echo ============================================
echo EGEM Makine Takip Sistemi
echo Job Passport API Backend
echo ============================================
echo.

cd /d "%~dp0"

echo Python backend başlatılıyor...
echo API URL: http://192.168.1.44:3000
echo.

python job_passport_api.py

pause

