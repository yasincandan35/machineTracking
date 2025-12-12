@echo off
REM Görev çubuğunu gizle
powershell -command "& {$p = Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern int FindWindow(string lpClassName, string lpWindowName); [DllImport(\"user32.dll\")] public static extern int ShowWindow(int hWnd, int nCmdShow);' -Name 'Win32ShowWindowAsync' -Namespace 'Win32Functions' -PassThru; $hwnd = $p::FindWindow('Shell_TrayWnd', $null); $p::ShowWindow($hwnd, 0)}"

REM Başlat menüsünü devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoStartMenu" /t REG_DWORD /d 1 /f >nul 2>&1

REM Alt+Tab'ı devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoChangeStartMenu" /t REG_DWORD /d 1 /f >nul 2>&1

REM Windows tuşunu devre dışı bırak
reg add "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Keyboard Layout" /v "Scancode Map" /t REG_BINARY /d "00000000000000000300000000005BE000005CE000000000" /f >nul 2>&1

REM Dokunmatik hareketleri devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoViewOnDrive" /t REG_DWORD /d 1 /f >nul 2>&1

REM Kenar (edge) swipe hareketlerini devre dışı bırak - Start/Action Center açılmasını engelle
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v "AllowEdgeSwipe" /t REG_DWORD /d 0 /f >nul 2>&1
reg add "HKEY_CURRENT_USER\SOFTWARE\Policies\Microsoft\Windows\EdgeUI" /v "AllowEdgeSwipe" /t REG_DWORD /d 0 /f >nul 2>&1

REM Bildirim merkezini devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Explorer" /v "DisableNotificationCenter" /t REG_DWORD /d 1 /f >nul 2>&1

REM Cortana'yı devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Windows Search" /v "AllowCortana" /t REG_DWORD /d 0 /f >nul 2>&1

REM Windows tuşu kombinasyonlarını devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoWinKeys" /t REG_DWORD /d 1 /f >nul 2>&1

REM Alt+Tab'ı tamamen devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoChangeKeyboardNavigationIndicators" /t REG_DWORD /d 1 /f >nul 2>&1

REM Görev görünümünü devre dışı bırak
reg add "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer" /v "NoTaskGrouping" /t REG_DWORD /d 1 /f >nul 2>&1

REM Dokunmatik klavye devre dışı
reg add "HKEY_CURRENT_USER\Software\Microsoft\TabletTip\1.7" /v "EnableCompatibilityKeyboard" /t REG_DWORD /d 0 /f >nul 2>&1

echo Taskbar, Start Menu, and touch gestures disabled for kiosk mode
