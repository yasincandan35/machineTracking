# 🌡️ Sıcaklık - Nem Takip Sistemi

## 📋 Proje Açıklaması
Arduino Mega 2560 + AHT10 sensör + W5100 Ethernet modülü ile sıcaklık ve nem verilerini toplayan, C# Web API ile yöneten ve React Dashboard ile görselleştiren sistem.

## 🏗️ Proje Yapısı
```
tempHumTest/
├── Backend/          # C# Web API (Port: 5001)
├── Frontend/         # React Dashboard (Port: 3000)
├── Database/         # SQL Server veritabanı
└── Arduino/          # Arduino kodları
```

## 🚀 Kurulum ve Çalıştırma

### 1. Backend (C# API)
```bash
cd Backend
dotnet restore
dotnet run
```
**Port:** 5001
**API Endpoints:**
- `GET /api/devices` - Cihaz listesi
- `POST /api/devices` - Yeni cihaz ekle
- `GET /api/sensordata/latest` - Son veriler
- `POST /api/arduino/data` - Arduino'dan veri al

### 2. Frontend (React Dashboard)
```bash
cd Frontend
npm install
npm start
```
**Port:** 3000
**Özellikler:**
- 📊 Canlı veri kartları
- 📈 Grafik analizi
- ⚙️ Cihaz yönetimi
- 📋 Geçmiş veri tablosu

### 3. Arduino Kurulumu
1. Arduino IDE'de kodu yükle
2. IP adresini ayarla: `192.168.1.100`
3. Ethernet bağlantısını kontrol et
4. Sensör verileri otomatik gönderilir

## 🔧 Konfigürasyon

### Veritabanı Bağlantısı
`Backend/appsettings.json` dosyasında:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=DESKTOP-78GRV3R;Database=TemperatureHumidityDB;Trusted_Connection=true;TrustServerCertificate=true;"
  }
}
```

### Arduino IP Ayarları
```cpp
IPAddress ip(192, 168, 1, 100); // Cihaz IP'si
```

## 📊 Özellikler

### Backend API
- ✅ Cihaz yönetimi (CRUD)
- ✅ Sensör veri kaydetme
- ✅ Geçmiş veri sorgulama
- ✅ Tarih aralığı filtreleme
- ✅ Otomatik veritabanı oluşturma

### Frontend Dashboard
- ✅ Canlı veri görüntüleme
- ✅ Gerçek zamanlı grafikler
- ✅ Tarih bazlı analiz
- ✅ Cihaz yönetimi
- ✅ Responsive tasarım

### Arduino Entegrasyonu
- ✅ AHT10 sıcaklık/nem sensörü
- ✅ W5100 Ethernet modülü
- ✅ JSON API ile veri gönderimi
- ✅ Otomatik veri toplama

## 🔄 Veri Akışı
1. **Arduino** → AHT10 sensöründen veri okur
2. **Arduino** → HTTP POST ile API'ye gönderir
3. **Backend** → Veritabanına kaydeder
4. **Frontend** → Canlı verileri görüntüler
5. **Dashboard** → Grafik ve analiz sunar

## 🛠️ Geliştirme Notları
- Backend: .NET 8.0, Entity Framework Core
- Frontend: React 18, Recharts, Axios
- Arduino: AHT10, W5100, Ethernet
- Veritabanı: SQL Server

## 📱 Kullanım
1. Backend'i çalıştır (Port 5001)
2. Frontend'i çalıştır (Port 3000)
3. Arduino'yu bağla ve çalıştır
4. Dashboard'da cihaz ekle
5. Canlı verileri izle!
