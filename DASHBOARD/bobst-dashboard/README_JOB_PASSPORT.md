# İş Pasaportu - Dashboard Entegrasyonu

## 📋 Genel Bakış

İş Pasaportu modülü, EGEM Makine Takip Sistemi dashboard'una tam olarak entegre edilmiştir. Sadece **Admin** ve **Engineer** kullanıcıları erişebilir.

## 🚀 Başlatma

### 1. Python Backend'i Başlat

```bash
cd jobPassport
python job_passport_generator.py
```

Backend şu adreste çalışacak:
- **API**: `http://192.168.1.44:3000/api/job-data`
- **PNG Files**: `http://192.168.1.44:3000/lpng/`

### 2. Dashboard'u Başlat

```bash
cd bobst-dashboard
npm run dev
```

Dashboard şu adreste çalışacak:
- **Frontend**: `http://192.168.1.44:5173`

## 🔌 Network Erişimi

Python backend `host='0.0.0.0'` ile çalıştığı için network'teki **tüm cihazlar** erişebilir:

- Bilgisayar A: `http://192.168.1.44:3000` → ✅ Erişebilir
- Bilgisayar B: `http://192.168.1.44:3000` → ✅ Erişebilir
- Tablet/Telefon: `http://192.168.1.44:3000` → ✅ Erişebilir

## 📁 Dosya Yapısı

```
bobst-dashboard/
├── src/
│   ├── components/
│   │   └── JobPassport/
│   │       └── JobPassportViewer.jsx  ← React Component
│   └── pages/
│       └── JobPassportPage.jsx        ← Page Wrapper

jobPassport/
├── job_passport_generator.py          ← Python Backend
├── lpng/                               ← PNG Dosyaları
│   └── printingUnit.png
└── requirements.txt
```

## 🎯 Özellikler

### ✅ Tamamlanan
- Makina seçimi (Lemanic 1/2/3)
- Stok kodu arama
- Dinamik ünite gösterimi
- Renk çubukları (Canvas ile)
- Solvent ayarlama butonları (EAL/EAC)
- Medium ve Toner alanları
- Çoklu dil desteği
- Admin/Engineer yetkilendirmesi

### ⏳ Devam Eden
- Drag & Drop sistemi
- Boş slot gösterimi
- Print optimizasyonu

## 🔧 Kullanım

1. Dashboard'a giriş yap (Admin veya Engineer)
2. Sidebar'dan "İş Pasaportu" seç
3. Makina seç (Lemanic 1, 2, veya 3)
4. Stok kodu gir
5. "Sorgula" butonuna bas
6. Bilgi kartlarını görüntüle

## 📊 API Endpoints

### POST /api/job-data
**Request:**
```json
{
  "stok_kodu": "ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "is_adi": "...",
    "silindir_cevresi": "...",
    "karton": "...",
    "renk_siralama": [...],
    "silindir_kodlari": [...],
    "murekkep_kodlari": [...],
    "vizkozite": [...],
    "solvent_orani": [...],
    "medium_kodlari": [...],
    "toner_kodlari": [...]
  }
}
```

## 🗄️ Veritabanı

- **Server**: 192.168.0.251
- **Database**: EGEM2025
- **Table**: [EGEM2025].[dbo].[EGEM_GRAVUR_SIPARIS_IZLEME]
- **User**: bakim
- **Password**: Bakim.2025

## 📝 Notlar

- Python backend'i her zaman çalışıyor olmalı
- Firewall'da port 3000 açık olmalı
- CORS ayarları backend'de yapılmış durumda

