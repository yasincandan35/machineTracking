# MachineScreen - Makine Takip Sistemi

## Özellikler

### 🏭 Üretim Takibi
- PLC bağlantısı ile gerçek zamanlı veri okuma
- İş emri yönetimi ve takibi
- Üretim metrikleri (basım adet, kalan iş, tahmini süre)
- Duruş sebepleri kategorilendirme
- Makine durumu takibi (çalışıyor/durdu)

### 💾 Backup Sistemi
- Otomatik backup sağlık kontrolü
- Manuel backup alma
- Backup geri yükleme
- Backup durumu göstergesi (güncel/uyarı/hata)
- Backup ilerleme çubuğu

### 🎨 BOBST Kurumsal Tasarım
- Gerçek BOBST kurumsal renkleri (Kırmızı #E30613)
- Siyah-beyaz-kırmızı renk paleti
- Profesyonel endüstriyel görünüm
- Keskin köşeler ve modern flat design
- Büyük, net butonlar ve ikonlar

## Teknolojiler

- React 18
- Lucide React Icons
- CSS3 (CSS Variables, Grid, Flexbox)
- Modern JavaScript (ES6+)

## Kurulum

```bash
npm install
npm start
```

## Kullanım

### Backup Sistemi
1. **Backup Al**: Mevcut verileri yedekler
2. **Geri Yükle**: Önceki backup'tan veri geri yükler
3. **Otomatik Kontrol**: Sistem her dakika backup sağlığını kontrol eder

### İş Emri Yönetimi
1. İş emri numarası girin
2. PLCDataCollector'a gönderin
3. Üretim verilerini takip edin

### Duruş Sebepleri
1. Duruş sebebi butonuna tıklayın
2. Kategori seçin (İş Hazırlık, Arıza, Diğer)
3. Sebep seçin ve onaylayın

## Renk Paleti - BOBST Kurumsal

- **Ana Arka Plan**: Siyah (#000000)
- **İkincil Arka Plan**: Koyu Gri (#1A1A1A)
- **Üçüncül Arka Plan**: Orta Gri (#2D2D2D)
- **Kart Arka Planı**: Beyaz (#FFFFFF)
- **Metin**: Siyah (#000000)
- **Vurgu**: BOBST Kırmızı (#E30613)
- **Başarı**: Yeşil (#00A651)
- **Uyarı**: Turuncu (#FFA500)
- **Hata**: BOBST Kırmızı (#E30613)

## Ekran Boyutu

- **Genişlik**: 1200px
- **Yükseklik**: 800px
- **Responsive**: Mobil ve tablet uyumlu

## Geliştirme

```bash
# Development server
npm start

# Production build
npm run build

# Test
npm test
```

## Lisans

Bu proje özel kullanım için geliştirilmiştir. 