@echo off
echo ========================================
echo Electron Desktop Uygulamasi Baslatiliyor
echo ========================================
echo.
echo NOT: Electron kendi icinde server baslatir
echo Eger baska bir server calisiyorsa once durdurun!
echo.
pause

cd /d %~dp0

if not exist node_modules (
    echo Node modules bulunamadi, yukleniyor...
    call npm install
    echo.
)

echo Electron uygulamasi baslatiliyor...
echo Pencere acilacak...
echo.

npm run electron

pause

