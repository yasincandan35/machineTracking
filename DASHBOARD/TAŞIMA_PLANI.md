# Dosya Taşıma Planı - Tek Backend Entegrasyonu

## 📋 Genel Strateji
- **BobstDashboardAPI** → **DashboardBackend** (Controller, Model, Data)
- **PLCDataCollector** → **DashboardBackend** (Background Service olarak)
- **machineScreen** → **Dashboard Frontend** (zaten var, kontrol et)

---

## 1️⃣ BobstDashboardAPI → DashboardBackend

### Controllers (Eksik olanları ekle)
```
Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\PLCConfigController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\

Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\SensorsController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\

Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\StoppageReasonsController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\

Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\ShiftManagementController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\

Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\ReportsController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\

Z:\BobstDashboardAPI\BobstDashboardAPI\Controllers\DatabaseController.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Controllers\
```

### Models (Eksik olanları ekle)
```
Z:\BobstDashboardAPI\BobstDashboardAPI\Model\PLCConnection.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\PLCDataDefinition.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\SQLConnection.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\SQLQueryDefinition.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\APISetting.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\SystemLog.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\SensorLog.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\LoginRequest.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\

Z:\BobstDashboardAPI\BobstDashboardAPI\Model\RegisterRequest.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
```

### Data
```
Z:\BobstDashboardAPI\BobstDashboardAPI\Data\SensorDbContext.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Data\
```

---

## 2️⃣ PLCDataCollector → DashboardBackend (Background Service)

### Yeni Klasör Oluştur
```
C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\
```

### Services/PLC (Taşı)
```
Z:\PLCDataCollector\PLCReader.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\PLCWriter.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\DataProcessor.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\SqlProxy.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\ConfigurationManager.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\PLCConfiguration.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\

Z:\PLCDataCollector\PLCData.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Services\PLC\
```

### Models (Eksik olanları ekle - zaten bazıları var)
```
Z:\PLCDataCollector\Models\APISetting.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
  (Zaten var mı kontrol et)

Z:\PLCDataCollector\Models\PLCConnection.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
  (Zaten var mı kontrol et)

Z:\PLCDataCollector\Models\PLCDataDefinition.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
  (Zaten var mı kontrol et)

Z:\PLCDataCollector\Models\SQLConnection.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
  (Zaten var mı kontrol et)

Z:\PLCDataCollector\Models\SystemLog.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Models\
  (Zaten var mı kontrol et)
```

### Data
```
Z:\PLCDataCollector\Data\PLCConfigDbContext.cs
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\Data\
```

### wwwroot
```
Z:\PLCDataCollector\wwwroot\adminpanel.html
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\DashboardBackend\wwwroot\
  (Eğer wwwroot klasörü yoksa oluştur)
```

---

## 3️⃣ machineScreen → Dashboard Frontend

### Kontrol Et (Zaten var gibi görünüyor)
```
C:\Users\yasin.candan\source\machineTracking\DASHBOARD\bobst-dashboard\src\machineScreen\
```

Eğer eksikse:
```
Z:\machineScreen\src\components\*
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\bobst-dashboard\src\machineScreen\components\

Z:\machineScreen\src\contexts\*
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\bobst-dashboard\src\machineScreen\contexts\

Z:\machineScreen\src\utils\*
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\bobst-dashboard\src\machineScreen\utils\

Z:\machineScreen\public\*
  → C:\Users\yasin.candan\source\machineTracking\DASHBOARD\bobst-dashboard\public\
```

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Namespace'leri değiştir**: Taşıdığın dosyalardaki namespace'leri `DashboardBackend` olarak güncelle
2. **Using'leri kontrol et**: Taşıdıktan sonra using statement'ları düzelt
3. **Duplicate kontrolü**: Bazı dosyalar zaten var olabilir (örn: User.cs, EmailService.cs), önce kontrol et
4. **Veritabanı bağlantıları**: Connection string'leri appsettings.json'a taşı, makine bazlı yapılandır
5. **Program.cs**: PLCDataCollector'ı Background Service olarak ekle

---

## 📝 Sonraki Adımlar (Taşıma Sonrası)

1. Namespace'leri düzelt
2. Using statement'ları güncelle
3. Program.cs'i güncelle (Background Service ekle)
4. appsettings.json'u güncelle (makine bazlı config)
5. Veritabanı context'lerini birleştir
6. Test et

