@echo off
echo ========================================
echo Remote Access Desktop Uygulamasi
echo ========================================
echo.

cd /d %~dp0

if not exist node_modules (
    echo Node modules bulunamadi, yukleniyor...
    call npm install
    echo.
)

echo Electron uygulamasi baslatiliyor...
echo.

npm run electron

pause

