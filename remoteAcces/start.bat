@echo off
echo ========================================
echo Remote Access Server Baslatiliyor...
echo ========================================
echo.

cd /d %~dp0

if not exist node_modules (
    echo Node modules bulunamadi, yukleniyor...
    call npm install
    echo.
)

echo Server baslatiliyor...
echo Port: 4000
echo.
echo Tarayicida acin: http://localhost:4000
echo.
echo Durdurmak icin Ctrl+C basin
echo.

node server.js

pause

