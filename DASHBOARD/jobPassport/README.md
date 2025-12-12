# EGEM Makine Takip Sistemi - Job Passport API

Bu proje, EGEM2025 veritabanından SIPARIS_NO ile iş verilerini çekerek, Lemanic 12 ünite makine diyagramı ile birlikte interaktif bir web arayüzü sunar.

## Özellikler

- **Web API**: Flask tabanlı RESTful API servisi
- **Interaktif Arayüz**: SIPARIS_NO girişi ile anlık sorgulama
- **Veritabanı Entegrasyonu**: EGEM_GRAVUR_SIPARIS_IZLEME tablosundan veri çekme
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu web arayüzü
- **12 Ünite Desteği**: Sağdan sola doğru sıralanmış ünite bilgileri
- **Profesyonel Görünüm**: Modern CSS tasarımı ile şık arayüz

## Gereksinimler

- Python 3.7+
- Flask (Web framework)
- Flask-CORS (CORS desteği)
- MySQL Connector Python

## Kurulum

1. Gerekli paketleri yükleyin:
```bash
pip install -r requirements.txt
```

2. Veya Windows'ta `run_generator.bat` dosyasını çalıştırın.

## Kullanım

### Web Arayüzü ile:
1. `run_generator.bat` dosyasını çalıştırın
2. Tarayıcınızda `http://localhost:5000` adresine gidin
3. SIPARIS_NO girin (örn: 4252104)
4. "Sorgula" butonuna tıklayın

### API ile:
```bash
curl -X POST http://localhost:5000/api/job-data \
  -H "Content-Type: application/json" \
  -d '{"siparis_no": "4252104"}'
```

## Veritabanı Yapısı

API aşağıdaki veritabanı tablosunu ve alanlarını kullanır:

**Tablo**: `[EGEM2025].[dbo].[EGEM_GRAVUR_SIPARIS_IZLEME`

### Ana Bilgiler:
- `stok_kodu` → İşin Adı
- `hammadde_kodu` → Karton
- `silindir_cevresi` → Silindir Çevresi (2 hane)

### Silindir Çevresi (Öncelik Sırası):
1. `silindir_cevresi` (ana alan)
2. `silindir_cevre1` - `silindir_cevre12` (yedek alanlar)

### 12 Ünite Verileri:
- `RENK_SIRA1` - `RENK_SIRA12` → Renk Sıralaması
- `silindir_no1` - `silindir_no12` → Silindir S Kodu
- `MUREKKEP_KODU1` - `MUREKKEP_KODU12` → Mürekkep Kodu
- `VIZ_RENK_1` - `VIZ_RENK_12` → Vizkozite
- `INCELTICI1` - `INCELTICI12` → Solvent Oranı

## Web Arayüzü

Web arayüzü şu özellikleri sunar:

- **SIPARIS_NO Girişi**: Kolay arama formu
- **Anlık Sorgulama**: AJAX ile hızlı veri çekme
- **Lemanic 12 Ünite Diyagramı**: Görsel makine şeması
- **12 Ünite Bilgileri**: Sağdan sola doğru sıralanmış ünite detayları
- **Responsive Tasarım**: Mobil ve masaüstü uyumlu
- **Hata Yönetimi**: Kullanıcı dostu hata mesajları

## Veritabanı Bağlantısı

- **Host**: 192.168.0.251
- **Database**: EGEM2025
- **Username**: bakim
- **Password**: Bakim.2025

## Dosya Yapısı

```
jobPassport/
├── job_passport_generator.py  # Flask API servisi
├── requirements.txt           # Python bağımlılıkları
├── run_generator.bat         # Windows çalıştırma dosyası
├── README.md                 # Bu dosya
├── static/                   # Web dosyaları
│   └── index.html           # Ana web arayüzü
└── lpng/                     # Görsel dosyaları
    ├── lemanic12unit.png     # Ana makine diyagramı
    └── ...                   # Diğer görseller
```

## Sorun Giderme

### Veritabanı Bağlantı Hatası:
- Ağ bağlantısını kontrol edin
- Veritabanı sunucusunun çalıştığından emin olun
- Kullanıcı adı ve şifrenin doğru olduğunu kontrol edin

### Python Modül Hatası:
```bash
pip install --upgrade mysql-connector-python
```

### Görsel Yükleme Hatası:
- `lpng/lemanic12unit.png` dosyasının mevcut olduğundan emin olun
- Dosya yolunu kontrol edin

## Geliştirici Notları

- Flask API servisi port 5000'de çalışır
- SIPARIS_NO ile LIKE sorgusu yapılır (%4252104% formatında)
- Silindir çevresi için öncelik sırası: ana alan → yedek alanlar
- AJAX ile asenkron veri çekme
- CSS Grid ve Flexbox kullanılarak responsive tasarım sağlanır
- CORS desteği ile cross-origin istekler desteklenir

## Lisans

© 2024 EGEM Makine Takip Sistemi - Tüm hakları saklıdır.
