@echo off
echo Starting Machine Screen in Fullscreen Mode...
echo.

REM Machine Screen'i başlat (pencere açmadan)
echo Starting React app...
start /min "Machine Screen" cmd /c "cd /d %~dp0 && set BROWSER=none && npm start"

REM 20 saniye bekle (React uygulaması başlasın)
echo Waiting for React app to start...
timeout /t 20 /nobreak > nul

REM Chrome'u normal modda başlat (F11 ile fullscreen açılabilir)
echo Starting Chrome in Normal Mode...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --start-maximized --disable-infobars --disable-session-crashed-bubble --disable-extensions --user-data-dir="C:\temp\chrome_fullscreen" --app=http://192.168.1.237:3000

REM 3 saniye bekle (Chrome açılsın)
timeout /t 3 /nobreak > nul

REM Chrome penceresine F11 gönder (fullscreen aç)
echo Opening fullscreen...
powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.AppActivate('Google Chrome'); Start-Sleep -Milliseconds 500; $wshell.SendKeys('{F11}')"

echo.
echo Fullscreen mode activated!
echo Press F11 again to exit fullscreen
echo Press Alt+F4 or close Chrome to exit
pause

