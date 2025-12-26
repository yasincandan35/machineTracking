# Backend Windows Service'i kaldırmak için PowerShell script
# Yönetici olarak çalıştırılmalıdır

$serviceName = "MachineTrackingBackend"

Write-Host "Backend Windows Service Kaldırma" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if (-not $service) {
    Write-Host "`nService bulunamadı: $serviceName" -ForegroundColor Yellow
    exit 0
}

Write-Host "`nService durduruluyor..." -ForegroundColor Yellow
Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Service kaldırılıyor..." -ForegroundColor Yellow
sc.exe delete $serviceName

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Service başarıyla kaldırıldı!" -ForegroundColor Green
} else {
    Write-Host "`n✗ Service kaldırılamadı!" -ForegroundColor Red
}

