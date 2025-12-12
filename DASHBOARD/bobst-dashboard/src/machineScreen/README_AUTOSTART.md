# Otomatik Başlatma Sistemi

Bu sistem PC açıldığında otomatik olarak 3 uygulamayı başlatır:
- Machine Screen (React uygulaması)
- PLC Data Collector (Node.js uygulaması)  
- Bobst Dashboard API (Node.js uygulaması)

## Kurulum

### 1. Otomatik Başlatmayı Etkinleştir
```bash
# Yönetici olarak çalıştır
install_autostart.bat
```

### 2. Manuel Başlatma
```bash
# Tüm uygulamaları manuel başlat (Chrome kiosk ile)
start_apps.bat

# Sessiz başlatma (pencere açmadan)
start_apps_silent.bat

# Sadece kiosk modu (sadece Machine Screen)
start_kiosk_only.bat
```

### 3. Kiosk Modundan Çıkış
```bash
# Kiosk modunu kapat
exit_kiosk.bat
```

### 4. Otomatik Başlatmayı Kaldır
```bash
remove_autostart.bat
```

## Dosya Yapısı
```
machineScreen/
├── start_apps.bat              # Manuel başlatma (Chrome kiosk ile)
├── start_apps_silent.bat       # Sessiz başlatma (Chrome kiosk ile)
├── start_kiosk_only.bat        # Sadece kiosk modu
├── exit_kiosk.bat              # Kiosk modundan çıkış
├── install_autostart.bat       # Otomatik başlatma kurulumu
├── remove_autostart.bat        # Otomatik başlatma kaldırma
└── README_AUTOSTART.md         # Bu dosya
```

## Kiosk Modu Özellikleri
- **Tam Ekran**: Chrome tam ekran modunda açılır
- **Kiosk Modu**: Alt+Tab, Windows tuşu, başlat menüsü devre dışı
- **IP Adresi**: 192.168.1.237:3000 (localhost değil)
- **Güvenlik**: Uzantılar, eklentiler devre dışı
- **Çıkış**: exit_kiosk.bat ile kapatılabilir

## Gereksinimler
- Windows 10/11
- Node.js yüklü olmalı
- Google Chrome yüklü olmalı
- Uygulamalar aynı seviyede dizinlerde olmalı:
  ```
  project/
  ├── machineScreen/
  ├── plcDataCollector/
  └── bobstdashboardapi/
  ```

## Sorun Giderme
- Uygulamalar başlamazsa: `install_autostart.bat` dosyasını yönetici olarak çalıştırın
- Otomatik başlatmayı kapatmak için: `remove_autostart.bat` çalıştırın
- Manuel test için: `start_apps.bat` çalıştırın

## Notlar
- Uygulamalar sırayla başlatılır (5-10 saniye aralıklarla)
- Her uygulama ayrı cmd penceresinde çalışır
- Sessiz modda pencere açılmaz (arka planda çalışır)
