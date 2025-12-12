@echo off
echo ========================================
echo RobotJS Rebuild - Electron icin
echo ========================================
echo.

cd /d %~dp0

echo electron-rebuild yukleniyor...
call npm install electron-rebuild --save-dev

echo.
echo RobotJS Electron icin rebuild ediliyor...
echo Bu islem biraz zaman alabilir...
echo.

call npm run rebuild

echo.
echo Rebuild tamamlandi!
echo Simdi "npm run electron" ile uygulamayi baslatabilirsiniz.
echo.

pause

