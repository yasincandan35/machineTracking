@echo off
REM Görev çubuğunu geri getir
powershell -command "& {$p = Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern int FindWindow(string lpClassName, string lpWindowName); [DllImport(\"user32.dll\")] public static extern int ShowWindow(int hWnd, int nCmdShow);' -Name 'Win32ShowWindowAsync' -Namespace 'Win32Functions' -PassThru; $hwnd = $p::FindWindow('Shell_TrayWnd', $null); $p::ShowWindow($hwnd, 1)}"

REM Başlat menüsünü geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoStartMenu" /f >nul 2>&1

REM Alt+Tab'ı geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoChangeStartMenu" /f >nul 2>&1

REM Windows tuşunu geri getir
reg delete "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Keyboard Layout" /v "Scancode Map" /f >nul 2>&1

REM Dokunmatik hareketleri geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoViewOnDrive" /f >nul 2>&1

REM Bildirim merkezini geri getir
reg delete "HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Explorer" /v "DisableNotificationCenter" /f >nul 2>&1

REM Cortana'yı geri getir
reg delete "HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Windows Search" /v "AllowCortana" /f >nul 2>&1

REM Windows tuşu kombinasyonlarını geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoWinKeys" /f >nul 2>&1

REM Alt+Tab'ı geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoChangeKeyboardNavigationIndicators" /f >nul 2>&1

REM Görev görünümünü geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoTaskGrouping" /f >nul 2>&1

REM Dokunmatik klavyeyi geri getir
reg delete "HKEY_CURRENT_USER\Software\Microsoft\TabletTip\1.7" /v "EnableCompatibilityKeyboard" /f >nul 2>&1

echo Taskbar, Start Menu, and touch gestures restored
pause
