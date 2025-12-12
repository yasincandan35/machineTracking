# Bobst Dashboard

Modern ve kapsamlı bir makine takip dashboard'u.

## Özellikler

### 🎨 **Renk Ayarları**
- Kullanıcı özelleştirilebilir renk teması
- Dark/Light mode desteği
- Renk tercihleri kaydetme

### 📊 **Grafik Kartları**
- Speed Graph (Hız grafiği)
- Die Speed Graph (Die hız grafiği)
- Wastage Graph (Fire grafiği)
- Nem Graph (Nem grafiği)
- Sicaklik Graph (Sıcaklık grafiği)

### 🍩 **Donut Kartları**
- Nem Donut Kartı
- Sıcaklık Donut Kartı

### 📋 **Info Kartları**
- Sıcaklık Bilgi Kartı
- Nem Bilgi Kartı
- Hız Bilgi Kartı (Animasyonlu gauge)
- Fire Bilgi Kartı
- Makine Durumu Kartı (Animasyonlu dişli)
- Die Counter Kartı (Animasyonlu kalıp)
- Die Speed Bilgi Kartı
- Ethyl Acetate Tüketim Kartı (Damla animasyonu)
- Ethyl Alcohol Tüketim Kartı (Damla animasyonu)
- Duruş Süresi Kartı

### ⚙️ **Sistem Özellikleri**
- Makine seçimi ve değiştirme
- Kart ekleme/çıkarma sistemi
- User preferences yönetimi
- Real-time veri güncellemesi
- Responsive tasarım
- Zoom özelliği (grafiklerde)
- Data interpolation (eksik veri doldurma)

## Kurulum

### Frontend

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build
```

### Backend (Job Passport)

```bash
# Python paketlerini yükle
cd backend
pip install -r requirements.txt

# PNG dosyalarını kopyala
copy_images.bat

# Backend'i başlat
start_backend.bat
```

**Detaylı bilgi için**: `backend/README.md`

## Kullanım

1. **Giriş Yapın**: `/login` sayfasından giriş yapın
2. **Makine Seçin**: Üst menüden makine seçin
3. **Kartları Özelleştirin**: "Kart Ayarları" butonuna tıklayın
4. **Renkleri Özelleştirin**: Ayarlar sayfasından renk tercihlerinizi kaydedin

## Teknolojiler

- **Frontend**: React 18, Vite, Tailwind CSS
- **Grafikler**: Recharts
- **İkonlar**: Lucide React
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Routing**: React Router DOM

## Proje Yapısı

```
src/
├── components/
│   ├── Cards/
│   │   ├── Graphs/     # Grafik kartları
│   │   ├── Infos/      # Bilgi kartları
│   │   ├── Donuts/     # Donut kartları
│   │   └── Reports/    # Rapor kartları
│   ├── Common/         # Ortak bileşenler
│   ├── Modals/         # Modal bileşenleri
│   └── ui/             # UI bileşenleri
├── contexts/           # React Context'ler
├── pages/              # Sayfa bileşenleri
├── routes/             # Route bileşenleri
├── utils/              # Yardımcı fonksiyonlar
└── lib/                # Kütüphane fonksiyonları
```

## API Endpoints

- `POST /api/auth/login` - Giriş
- `GET /api/database/machines` - Makine listesi
- `GET /api/sensors/last` - Son veriler
- `GET /api/sensors/period` - Periyot verileri
- `GET /api/sensors/speed-periods` - Hız periyotları
- `GET /api/user/preferences` - Kullanıcı tercihleri
- `POST /api/user/preferences` - Tercihleri kaydet
- `GET /api/user/color-preferences` - Renk tercihleri
- `POST /api/user/color-preferences` - Renk tercihlerini kaydet

## Lisans

MIT 