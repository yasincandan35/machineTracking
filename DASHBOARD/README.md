# 🏭 EGEM Makine Takip Sistemi

<div align="center">

![Machine Tracking](https://img.shields.io/badge/Machine-Tracking-blue?style=for-the-badge)
![PLC Integration](https://img.shields.io/badge/PLC-Integration-green?style=for-the-badge)
![Real Time](https://img.shields.io/badge/Real--Time-Monitoring-orange?style=for-the-badge)

**Lemanic 3 Makinesi için Kapsamlı İzleme ve Yönetim Sistemi**

</div>

---

## 🎯 Proje Hakkında

**EGEM Makine Takip Sistemi**, Lemanic 3 makinesi için geliştirilmiş kapsamlı bir izleme ve yönetim platformudur. Gerçek zamanlı veri toplama, analiz, raporlama ve makine durumu takibi sağlar.

## ✨ Temel Özellikler

### 📊 **Gerçek Zamanlı İzleme**
- Makine hızı ve die hızı takibi
- Etil alkol/asetat tüketim analizi
- Üretim metrikleri ve hedef karşılaştırması
- Anlık makine durumu gösterimi

### 🛑 **Akıllı Duruş Yönetimi**
- Otomatik duruş tespiti (PLC sinyali)
- Kategorize duruş sebepleri
- PLC'den hassas süre ölçümü
- Detaylı duruş kayıt sistemi

### 📈 **İnteraktif Dashboard**
- Responsive web arayüzü
- Çoklu dil desteği (TR/EN/DE/FR)
- Dark/Light mode
- Kişiselleştirilebilir kart düzeni

---

## 🏗️ Sistem Mimarisi

```
[Lemanic 3 PLC] ←→ [PLCDataCollector] ←→ [SQL Server]
                           ↕                    ↕
[MachineScreen] ←→ [REST API] ←→ [Web Dashboard]
```

---

## 📁 Proje Yapısı

| Klasör | Açıklama | Teknoloji |
|--------|----------|-----------|
| `bobst-dashboard/` | Web Dashboard | React + Tailwind |
| `BobstDashboardAPI/` | Backend API | .NET Core 8 |
| `PLCDataCollector/` | PLC Veri Toplama | C# + Modbus TCP |
| `machineScreen/` | Operatör Arayüzü | React |
| `lem3_plc/` | PLC Programları | TwinCAT 3 |

---

## 🚀 Hızlı Başlangıç

### 1. **Veritabanı Kurulumu**
```sql
CREATE DATABASE SensorDB;
-- Tablo scriptlerini çalıştırın
```

### 2. **Backend Başlatma**
```bash
cd BobstDashboardAPI/BobstDashboardAPI
dotnet run  # Port: 5199
```

### 3. **PLC Servis Başlatma**
```bash
cd PLCDataCollector
dotnet run  # Port: 8080
```

### 4. **Frontend Başlatma**
```bash
cd bobst-dashboard
npm install && npm run dev  # Port: 3000
```

---

## 🔧 Konfigürasyon

### 🌐 **Network Ayarları**
- **PLC IP**: 192.168.0.104
- **API Server**: 192.168.1.44:8080
- **Dashboard**: localhost:3000

### 🗄️ **Veritabanı Bağlantıları**
- **SensorDB**: Sensor verileri
- **EGEM2025**: İş emri verileri

---

## 📊 Öne Çıkan Özellikler

### 🎪 **Duruş Takip Sistemi**
- ✅ Otomatik duruş tespiti
- ✅ Kategorize sebep yönetimi
- ✅ PLC hassas süre ölçümü
- ✅ Normalize veritabanı yapısı

### 📈 **Grafik Sistemi**
- ✅ Recharts entegrasyonu
- ✅ Zoom ve pan özelliği
- ✅ Gerçek zamanlı güncelleme
- ✅ Export fonksiyonları

### 🔌 **PLC Entegrasyonu**
- ✅ Modbus TCP iletişimi
- ✅ 200ms güncelleme hızı
- ✅ Otomatik bağlantı yenileme
- ✅ Hata toleranslı okuma

---

## 🛠️ Teknoloji Stack

### **Frontend**
- React 18, Tailwind CSS, Recharts, Lucide Icons

### **Backend**
- .NET 8, Entity Framework, SQL Server

### **PLC İletişimi**
- C# Modbus TCP, Real-time data processing

### **Veritabanı**
- SQL Server 2019+, Optimized indexing

---

## 🎨 Ekran Görüntüleri

*Dashboard ve MachineScreen ekran görüntüleri `screenshotApp/screenshots/` klasöründe mevcuttur.*

---

## 📈 Performans

- **PLC Response**: < 50ms
- **API Response**: < 100ms  
- **Dashboard Load**: < 2s
- **Real-time Updates**: 5Hz

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📞 İletişim

**EGEM Makine Takip Sistemi** - Endüstriyel Üretim Çözümleri

⭐ **Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!** ⭐

---

<div align="center">

**🚀 Modern Teknoloji ile Endüstriyel Üretimin Geleceği 🚀**

</div>