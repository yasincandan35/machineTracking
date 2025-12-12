# Gelecek Planlar - Roadmap

Bu dosya, gelecekte yapılacak özellikler ve geliştirmeleri içerir.

---

## 🎯 Periyodik Raporlama ve Canlı Özet Sistemi

### Genel Amaç
İş bazlı verileri zaman bazlı (günlük, haftalık, aylık, 3 aylık, yıllık) raporlara dönüştürmek ve canlı özet kartları oluşturmak. Veri kaybı olmadan, snapshot mekanizması ile doğru hesaplamalar yapmak.

---

## 📋 Backend Geliştirmeleri

### 1. Veritabanı Yapısı

#### 1.1 PeriodicSnapshots Tablosu
**Her makine veritabanında oluşturulacak:**
- `snapshot_type`: 'daily', 'monthly', 'quarterly', 'yearly'
- `snapshot_date`: Gün/ay/çeyrek/yıl başı zamanı
- `siparis_no`: Aktif işin sipariş numarası
- `cycle_start_time`: İşin başlangıç zamanı
- Kümülatif değerler: actual_production, total_stoppage_duration, energy_consumption_kwh, wastage değerleri, paper_consumption, vb.
- OEE için gerekli değerler: planned_time, run_time
- Index'ler: snapshot_type + snapshot_date, siparis_no, cycle_start_time

**Önemli Not:** Tablo her makine veritabanında ayrı ayrı oluşturulacak (MachineDatabaseService üzerinden).

---

### 2. PeriodicSnapshotService (Background Service)

#### 2.1 Görevler
- Belirlenen zamanlarda otomatik snapshot alma
- Tüm makineleri dolaşma (MachineLists üzerinden)
- Her makine için aktif iş kontrolü
- Canlı veri çekme ve kaydetme

#### 2.2 Snapshot Alma Zamanları
- **Günlük:** Her gün 00:00:00
- **Aylık:** Her ayın 1'i 00:00:00
- **Çeyreklik:** Ocak, Nisan, Temmuz, Ekim 1'i 00:00:00
- **Yıllık:** 1 Ocak 00:00:00

#### 2.3 Snapshot Alma Mantığı

**Kritik Nokta: Aktif İşin Canlı Verisini Alma**

1. **Aktif İş Kontrolü:**
   - JobCycleRecords tablosundan `status = 'active'` olan işi bul
   - Eğer aktif iş varsa:
     - `siparis_no` ve `cycle_start_time` kaydet
     - **`/api/plcdata/data?machine={machineName}` HTTP endpoint'inden canlı veriyi çek** (snapshot anındaki değerler)
     - Bu değerleri PeriodicSnapshots'a kaydet
   - Eğer aktif iş yoksa:
     - NULL değerlerle kayıt oluştur (veya kayıt oluşturma)

2. **Canlı Veri Kaynağı:**
   - **PLCDataController** üzerinden `/api/plcdata/data?machine={machineName}` HTTP endpoint'i kullanılacak
   - Bu endpoint zaten tüm gerekli verileri döndürüyor:
     - `actualProduction`: O anki üretim adedi
     - `totalStoppageDuration`: O ana kadar toplam duruş (ms)
     - `energyConsumptionKwh` veya `totalEnergyKwh`: O ana kadar toplam enerji
     - `wastageBeforeDie`, `wastageAfterDie`: O ana kadar fireler
     - `paperConsumption`: O ana kadar kağıt tüketimi
     - `ethylAlcoholConsumption`, `ethylAcetateConsumption`: O ana kadar tüketimler
     - OEE değerleri: `availability`, `performance`, `quality`, `overallOEE`
     - `plannedTime`, `runTime`: OEE hesaplama için gerekli değerler
   - Endpoint URL formatı: `http://{server}:{port}/api/plcdata/data?machine={machineTableName}`
   - Örnek: `http://192.168.1.44:5199/api/plcdata/data?machine=lemanic3_tracking`

3. **Kaydedilecek Veriler:**
   - `actual_production`: O anki üretim adedi
   - `total_stoppage_duration`: O ana kadar toplam duruş (ms)
   - `energy_consumption_kwh`: O ana kadar toplam enerji
   - `wastage_before_die`, `wastage_after_die`: O ana kadar fireler
   - `paper_consumption`: O ana kadar kağıt tüketimi
   - `ethyl_alcohol_consumption`, `ethyl_acetate_consumption`: O ana kadar tüketimler
   - OEE için: `planned_time`, `run_time` (hesaplanmış değerler)

4. **Hata Yönetimi:**
   - Bir makine hata verirse, diğer makineler etkilenmemeli
   - Hatalar loglanmalı
   - Retry mekanizması (opsiyonel)

---

### 3. ReportsController - Yeni Endpoint'ler

#### 3.1 Periodic Summary Endpoint
```
GET /api/reports/periodic-summary
Query Parameters:
  - period: 'daily' | 'monthly' | 'quarterly' | 'yearly' (required)
  - start: DateTime? (opsiyonel, varsayılan: dönem başı)
  - end: DateTime? (opsiyonel, varsayılan: dönem sonu)
  - machine: string? (opsiyonel, varsayılan: tüm makineler)

Response:
{
  success: true,
  period: "monthly",
  startDate: "2024-12-01T00:00:00",
  endDate: "2024-12-31T23:59:59",
  machine: "lemanic3_tracking",
  summary: {
    actualProduction: 5000000,
    totalStoppageDuration: 120000, // ms
    energyConsumptionKwh: 2500.5,
    wastageBeforeDie: 150.2,
    wastageAfterDie: 50.8,
    paperConsumption: 12000.5,
    oee: 85.5,
    availability: 90.2,
    performance: 92.1,
    quality: 94.3
  },
  breakdown: [
    {
      date: "2024-12-01",
      actualProduction: 150000,
      totalStoppageDuration: 5000,
      energyConsumptionKwh: 75.2,
      ...
    },
    ...
  ]
}
```

#### 3.2 Hesaplama Mantığı

**Dönem İçi Değer Hesaplama:**

1. **Tamamlanmış İşler:**
   - JobEndReports'tan dönem içinde biten işleri al
   - Her iş için:
     - Eğer iş dönem başından önce başladıysa:
       - Dönem başı snapshot'ını bul (siparis_no ile eşleştir)
       - Dönem içi değer = JobEndReports değeri - Snapshot değeri
     - Eğer iş dönem içinde başladıysa:
       - Dönem içi değer = JobEndReports değeri (tamamı)

2. **Devam Eden İşler:**
   - JobCycleRecords'tan `status = 'active'` olan işleri al
   - Dönem başı snapshot'ını bul
   - **Canlı veriyi çek** (`/api/plcdata/data?machine={machineName}` endpoint'inden)
   - Dönem içi değer = Canlı değer - Snapshot değeri

3. **OEE Hesaplama:**
   - Her dönem için ayrı OEE hesaplanır
   - Dönem içi toplam süre, üretim, duruş değerleri kullanılır
   - Mevcut OEE hesaplama mantığı (ReportsController.GetOEECalculation) kullanılabilir

---

## 🎨 Frontend Geliştirmeleri

### 4. Yeni Kart Bileşenleri

#### 4.1 PeriodicSummaryCard.jsx (Genel)
**Props:**
- `period`: 'daily' | 'monthly' | 'quarterly' | 'yearly'
- `data`: API'den gelen summary objesi
- `darkMode`: boolean
- `colorSettings`: object
- `currentLanguage`: 'tr' | 'en'

**Gösterilecekler:**
- Dönem başlığı (örn: "Aralık 2024 Özeti")
- Üretim adedi
- OEE (gauge veya yüzde)
- Duruş süresi
- Enerji tüketimi
- Fire oranı
- Trend göstergesi (önceki dönemle karşılaştırma - opsiyonel)

#### 4.2 DailySummaryCard.jsx
- Bugünün özeti (canlı)
- Gün başı snapshot + canlı veri
- 24 saatlik grafik (opsiyonel)

#### 4.3 MonthlySummaryCard.jsx
- Bu ayın özeti (canlı)
- Ay başı snapshot + canlı veri
- Aylık trend grafiği (opsiyonel)

#### 4.4 QuarterlySummaryCard.jsx
- Bu çeyreğin özeti (canlı)
- Çeyrek başı snapshot + canlı veri

#### 4.5 YearlySummaryCard.jsx
- Bu yılın özeti (canlı)
- Yıl başı snapshot + canlı veri
- Yıllık trend grafiği (opsiyonel)

---

### 5. API Entegrasyonu

#### 5.1 usePeriodicSummary Hook
```javascript
const usePeriodicSummary = (period, machine, options = {}) => {
  // period: 'daily' | 'monthly' | 'quarterly' | 'yearly'
  // machine: string | null
  // options: { autoRefresh: true, refreshInterval: 30000 }
  
  // API çağrısı
  // Cache mekanizması
  // Auto-refresh (canlı güncelleme)
  // Error handling
}
```

**Özellikler:**
- Otomatik yenileme (30 saniyede bir)
- Cache mekanizması (gereksiz API çağrılarını önle)
- Loading ve error state'leri
- Optimistic updates

---

### 6. Dashboard Entegrasyonu

#### 6.1 Kart Ayarlarına Ekleme
- Mevcut `wastageInfoCard` gibi yeni kartlar eklenebilir
- Kullanıcı seçebilir: Günlük, Aylık, 3 Aylık, Yıllık özet kartları
- JOB kartı sabit kalır (mevcut mantık korunur)

#### 6.2 Kart Yerleşimi
- Yeni kartlar grid sistemine entegre edilir
- Responsive tasarım
- Drag & drop desteği (varsa)

---

## 🔄 Canlı Veri Akışı

### 7. Canlı Özet Hesaplama

**Mantık:**
```
Canlı Dönem Özeti = Snapshot Değeri + (Şu Anki Canlı Değer - Snapshot Anındaki Değer)
```

**Örnek Senaryo (Aylık):**
- Ay başı snapshot: 2,500,000 adet üretim
- Şu anki canlı veri: 2,750,000 adet üretim
- Bu ay üretimi: 2,750,000 - 2,500,000 = 250,000 adet

**Devam Eden İşler İçin:**
- İş 30 Kasım'da başladı, hala devam ediyor
- 1 Aralık snapshot'ında: 2,500,000 adet (o anki değer)
- Şu an: 2,750,000 adet
- Aralık ayı üretimi: 250,000 adet

**Tamamlanmış İşler İçin:**
- İş 30 Kasım'da başladı, 2 Aralık'ta bitti
- Toplam üretim: 7,000,000 adet
- 1 Aralık snapshot'ında: 2,500,000 adet
- Aralık ayı üretimi: 7,000,000 - 2,500,000 = 4,500,000 adet

---

## 📊 Veri Akış Diyagramı

```
[Background Service - PeriodicSnapshotService]
         ↓
[Her Makine DB - MachineLists üzerinden]
         ↓
[Aktif İş Kontrolü - JobCycleRecords]
         ↓
[Canlı Veri Çekme - /api/plcdata/data HTTP endpoint]
         ↓
[PeriodicSnapshots Tablosuna Kaydet]
         ↓
[Frontend Request - usePeriodicSummary Hook]
         ↓
[ReportsController - Periodic Summary Endpoint]
         ↓
[Hesaplama: JobEndReports + Snapshot + Canlı Veri]
         ↓
[JSON Response]
         ↓
[Frontend Cards - PeriodicSummaryCard]
```

---

## ✅ Uygulama Adımları

### Faz 1: Backend Altyapı
1. ✅ PeriodicSnapshots tablosu oluşturma (migration script)
2. ✅ PeriodicSnapshotService oluşturma (Background Service)
3. ✅ Snapshot alma mantığı (aktif iş + canlı veri)
4. ✅ ReportsController'a yeni endpoint'ler
5. ✅ Hesaplama mantığı (dönem içi değerler)
6. ✅ Test ve doğrulama

### Faz 2: Frontend Geliştirme
1. ✅ usePeriodicSummary hook
2. ✅ PeriodicSummaryCard bileşenleri
3. ✅ Dashboard entegrasyonu
4. ✅ Kart ayarlarına ekleme
5. ✅ Test ve doğrulama

### Faz 3: Deployment ve İzleme
1. ✅ Background service'i başlatma
2. ✅ İlk snapshot'ları manuel alma (opsiyonel)
3. ✅ Monitoring ve loglama
4. ✅ Kullanıcı eğitimi (gerekirse)

---

## 🎯 Başarı Kriterleri

- ✅ Veri kaybı olmadan zaman bazlı raporlama
- ✅ Canlı özet kartları çalışıyor
- ✅ Tüm makineler için snapshot alınıyor
- ✅ Ay sınırını aşan işler doğru hesaplanıyor
- ✅ Performans sorunları yok
- ✅ Hata durumlarında sistem çalışmaya devam ediyor

---

## 📝 Notlar

- **Önemli:** Snapshot alma anında aktif işin canlı verisini almak kritik. Bu veri kaybını önler.
- **Performans:** Snapshot'lar önceden hesaplanmış olduğu için raporlama hızlı olacak.
- **Ölçeklenebilirlik:** Yeni makineler eklendiğinde otomatik olarak snapshot alınacak.
- **Veri Tutarlılığı:** Snapshot alınırken aktif iş yoksa NULL değerler kaydedilebilir veya kayıt oluşturulmayabilir.

---

*Son güncelleme: 2024-12-XX*
*Durum: Planlama Aşaması*

