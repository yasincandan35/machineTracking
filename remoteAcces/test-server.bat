@echo off
echo ========================================
echo Server Test - Web Tarayicisinda Ac
echo ========================================
echo.

cd /d %~dp0

if not exist node_modules (
    echo Node modules bulunamadi, yukleniyor...
    call npm install
    echo.
)

echo Server baslatiliyor...
echo Web tarayicisinda acin: http://localhost:4000
echo.
echo Durdurmak icin Ctrl+C basin
echo.

node server.js

pause

