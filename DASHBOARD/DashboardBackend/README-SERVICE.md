# Backend Windows Service Kurulumu

Backend'i Windows Service olarak çalıştırmak için aşağıdaki adımları izleyin.

## Gereksinimler

1. **.NET 8.0 Hosting Bundle** yüklü olmalı
   - İndir: https://dotnet.microsoft.com/download/dotnet/8.0
   - "Hosting Bundle" seçeneğini indirin ve yükleyin

2. **PowerShell Yönetici Yetkisi**
   - Script'leri çalıştırmak için PowerShell'i "Yönetici olarak çalıştır" seçeneğiyle açın

## Kurulum

1. PowerShell'i **Yönetici olarak** açın
2. Proje dizinine gidin:
   ```powershell
   cd C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend
   ```
3. Kurulum script'ini çalıştırın:
   ```powershell
   .\install-service.ps1
   ```

Script otomatik olarak:
- Projeyi publish eder
- Windows Service'i oluşturur
- Service'i başlatır

## Service Yönetimi

### Service Durumunu Kontrol Etme
```powershell
Get-Service -Name MachineTrackingBackend
```

### Service'i Başlatma
```powershell
Start-Service -Name MachineTrackingBackend
```

### Service'i Durdurma
```powershell
Stop-Service -Name MachineTrackingBackend
```

### Service'i Yeniden Başlatma
```powershell
Restart-Service -Name MachineTrackingBackend
```

### Service Loglarını Canlı İzleme

**Yöntem 1: PowerShell Script ile (Önerilen)**
```powershell
.\view-logs.ps1
```
Bu script Event Viewer'ı açar ve son logları gösterir.

**Yöntem 2: Event Viewer ile**
1. **Event Viewer** açın: `eventvwr.msc`
2. **Windows Logs > Application** bölümüne gidin
3. **Action > Refresh** ile logları yenileyin
4. **Action > Create Custom View** ile filtre oluşturun:
   - Event sources: `MachineTrackingBackend` veya `DashboardBackend`
   - Log level: Information, Warning, Error

**Yöntem 3: PowerShell ile Canlı İzleme**
```powershell
# Son 50 log kaydını göster
Get-WinEvent -LogName Application -MaxEvents 50 | 
    Where-Object { $_.Message -like "*[DELETE]*" -or $_.Message -like "*[MIDDLEWARE]*" } |
    Format-Table TimeCreated, LevelDisplayName, Message -AutoSize

# Canlı izleme (yeni loglar geldikçe gösterir)
Get-WinEvent -LogName Application -MaxEvents 1 -Wait
```

**Yöntem 4: Console Modunda Çalıştırma (Geliştirme için)**
Service olarak değil, normal console olarak çalıştırmak için:
```powershell
cd bin\Release\net8.0\win-x64\publish
.\DashboardBackend.exe
```
Bu şekilde loglar direkt console'da görünür.

## Kaldırma

Service'i kaldırmak için:
```powershell
.\uninstall-service.ps1
```

## Alternatif: Task Scheduler ile Otomatik Başlatma

Windows Service yerine Task Scheduler kullanmak isterseniz:

1. **Task Scheduler** açın: `taskschd.msc`
2. **Create Basic Task** seçin
3. **Trigger**: "When the computer starts"
4. **Action**: "Start a program"
5. **Program**: `C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\bin\Release\net8.0\win-x64\publish\DashboardBackend.exe`
6. **Start in**: `C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\bin\Release\net8.0\win-x64\publish`

## Sorun Giderme

### Service Başlamıyorsa
1. Event Viewer'ı kontrol edin
2. Service'in çalıştığı kullanıcı hesabını kontrol edin (varsayılan: NETWORK SERVICE)
3. Port 5199'un kullanılabilir olduğundan emin olun

### Port Zaten Kullanımda
```powershell
# Port 5199'u kullanan process'i bulun
netstat -ano | findstr :5199

# Process'i sonlandırın (PID'yi yukarıdaki komuttan alın)
taskkill /PID <PID> /F
```

