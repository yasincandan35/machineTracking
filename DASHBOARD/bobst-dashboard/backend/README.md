# Job Passport Backend

## 🚀 Kurulum

### 1. Python Paketlerini Yükle
```bash
cd bobst-dashboard/backend
pip install -r requirements.txt
```

### 2. Backend'i Başlat
```bash
start_backend.bat
```

Bu sunucu sürekli çalışır durumda kalmalı!

## 🌐 API Endpoints

Backend `http://192.168.1.44:3000` üzerinde çalışır:

### Health Check
```
GET /api/health
```

### Search Job Data
```
POST /api/job-data
```

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

### Serve Images
```
GET /lpng/<filename>
```

## 🔧 Konfigürasyon

### Network Ayarları
- **Backend Port**: `3000`
- **Host**: `0.0.0.0` (tüm network erişebilir)
- **IP**: `192.168.1.44`

### Veritabanı
- **Server**: 192.168.0.251
- **Database**: EGEM2025
- **Table**: [EGEM_GRAVUR_SIPARIS_IZLEME]
- **User**: bakim
- **Password**: Bakim.2025

## 📝 Notlar

- ✅ Python backend sürekli çalışmalı (start_backend.bat ile başlat, açık bırak)
- ✅ Backend network'ten erişilebilir (host='0.0.0.0')
- ✅ Firewall'da port 3000 açık olmalı
- ✅ CORS tüm origin'lere izin veriyor
- ✅ PNG dosyaları `bobst-dashboard/public/lpng/` klasöründe
- ✅ React component backend status'u otomatik kontrol eder (10 sn'de bir)

