# Windows Service loglarını canlı izlemek için PowerShell script
# Event Viewer'ı açıp logları canlı gösterir

Write-Host "Backend Log Viewer" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""

# Event Viewer'ı aç
Write-Host "Event Viewer açılıyor..." -ForegroundColor Yellow
Start-Process "eventvwr.msc"

Write-Host ""
Write-Host "Event Viewer'da:" -ForegroundColor Green
Write-Host "  1. Windows Logs > Application'a gidin" -ForegroundColor White
Write-Host "  2. Sağ tıklayın > 'Create Custom View...'" -ForegroundColor White
Write-Host "  3. 'Event sources' seçin" -ForegroundColor White
Write-Host "  4. 'MachineTrackingBackend' veya 'DashboardBackend' kaynağını seçin" -ForegroundColor White
Write-Host "  5. 'OK' tıklayın" -ForegroundColor White
Write-Host ""
Write-Host "Veya tüm Application loglarını görmek için:" -ForegroundColor Yellow
Write-Host "  Windows Logs > Application > 'Refresh' butonuna basın" -ForegroundColor White
Write-Host ""
Write-Host "Canlı izlemek için:" -ForegroundColor Yellow
Write-Host "  'Action' > 'Attach Task To This Custom View...' ile otomatik yenileme yapabilirsiniz" -ForegroundColor White
Write-Host ""

# Alternatif: Get-WinEvent ile son logları göster
Write-Host "Son 20 log kaydı:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""

try {
    $logs = Get-WinEvent -LogName Application -MaxEvents 20 -ErrorAction SilentlyContinue | 
        Where-Object { $_.ProviderName -like "*DashboardBackend*" -or $_.Message -like "*[DELETE]*" -or $_.Message -like "*[MIDDLEWARE]*" } |
        Select-Object -First 20
    
    if ($logs) {
        foreach ($log in $logs) {
            $time = $log.TimeCreated.ToString("HH:mm:ss")
            $level = switch ($log.LevelDisplayName) {
                "Error" { "🔴" }
                "Warning" { "🟡" }
                "Information" { "🟢" }
                default { "⚪" }
            }
            Write-Host "$level [$time] $($log.Message)" -ForegroundColor $(if ($log.LevelDisplayName -eq "Error") { "Red" } elseif ($log.LevelDisplayName -eq "Warning") { "Yellow" } else { "White" })
        }
    } else {
        Write-Host "Henüz log kaydı bulunamadı. Service'i başlatın ve bir işlem yapın." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Log okuma hatası: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Canlı izlemek için PowerShell'de şu komutu çalıştırabilirsiniz:" -ForegroundColor Cyan
Write-Host "  Get-WinEvent -LogName Application -MaxEvents 1 -Wait" -ForegroundColor White

