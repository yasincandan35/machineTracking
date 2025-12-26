# Backend'i Windows Service olarak yüklemek için PowerShell script
# Yönetici olarak çalıştırılmalıdır

$serviceName = "MachineTrackingBackend"
$displayName = "Machine Tracking Backend API"
$description = "Machine Tracking Dashboard Backend API Service"
$projectPath = $PSScriptRoot
$exePath = Join-Path $projectPath "bin\Release\net8.0\win-x64\publish\DashboardBackend.exe"

Write-Host "Backend Windows Service Kurulumu" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# .NET 8.0 Hosting Bundle kontrolü
Write-Host "`n.NET 8.0 Hosting Bundle kontrol ediliyor..." -ForegroundColor Yellow
$hostingBundle = Get-ItemProperty "HKLM:\SOFTWARE\dotnet\Setup\InstalledVersions\x64\sharedhost" -ErrorAction SilentlyContinue
if (-not $hostingBundle) {
    Write-Host "UYARI: .NET 8.0 Hosting Bundle yüklü değil!" -ForegroundColor Red
    Write-Host "İndir: https://dotnet.microsoft.com/download/dotnet/8.0" -ForegroundColor Yellow
    Write-Host "Devam etmek için Enter'a basın..."
    Read-Host
}

# Projeyi publish et
Write-Host "`nProje publish ediliyor..." -ForegroundColor Yellow
Set-Location $projectPath
dotnet publish -c Release -r win-x64 --self-contained false -o "bin\Release\net8.0\win-x64\publish"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish başarısız!" -ForegroundColor Red
    exit 1
}

# Mevcut service'i kaldır (varsa)
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "`nMevcut service durduruluyor..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    Write-Host "Mevcut service kaldırılıyor..." -ForegroundColor Yellow
    sc.exe delete $serviceName
    Start-Sleep -Seconds 2
}

# Yeni service'i oluştur
Write-Host "`nYeni service oluşturuluyor..." -ForegroundColor Yellow
$serviceAccount = "NT AUTHORITY\NETWORK SERVICE"
sc.exe create $serviceName binPath= "`"$exePath`"" DisplayName= "$displayName" start= auto
sc.exe description $serviceName "$description"
sc.exe config $serviceName obj= "$serviceAccount"

# Service'i başlat
Write-Host "`nService başlatılıyor..." -ForegroundColor Yellow
Start-Service -Name $serviceName

# Durum kontrolü
Start-Sleep -Seconds 3
$service = Get-Service -Name $serviceName
if ($service.Status -eq "Running") {
    Write-Host "`n✓ Service başarıyla başlatıldı!" -ForegroundColor Green
    Write-Host "Service Adı: $serviceName" -ForegroundColor Cyan
    Write-Host "Durum: $($service.Status)" -ForegroundColor Cyan
    Write-Host "`nService yönetimi için:" -ForegroundColor Yellow
    Write-Host "  Başlat: Start-Service -Name $serviceName" -ForegroundColor White
    Write-Host "  Durdur: Stop-Service -Name $serviceName" -ForegroundColor White
    Write-Host "  Durum: Get-Service -Name $serviceName" -ForegroundColor White
} else {
    Write-Host "`n✗ Service başlatılamadı! Durum: $($service.Status)" -ForegroundColor Red
    Write-Host "Event Viewer'ı kontrol edin: eventvwr.msc" -ForegroundColor Yellow
}

