# Tablo Şemaları

## JobCycleRecords
**Amaç:** Aktif iş döngüsünü takip etmek

**Yeni iş başladığında (CreateJobCycleRecordAsync):**
- `status` = 'active'
- `cycle_start_time` = iş başlangıç zamanı
- `initial_snapshot` = İş başlangıcındaki PLC verilerinin JSON'u (tüm canlı veriler)
- `created_at`, `updated_at`

**İş bilgisi geldiğinde (UpdateJobCycleRecordWithOrderInfoAsync):**
- `siparis_no` = sipariş numarası
- `job_info` = İş bilgilerinin JSON'u (orderData)
- `updated_at`

**İş bittiğinde (CompleteActiveJobCycleAsync):**
- `status` = 'completed'
- `cycle_end_time` = iş bitiş zamanı
- `final_snapshot` = İş bitişindeki PLC verilerinin JSON'u (tüm canlı veriler)
- `updated_at`

**Kolonlar:**
- `id` (int, PK)
- `status` (nvarchar(20), default: 'active') - 'active' veya 'completed'
- `cycle_start_time` (datetime2, NOT NULL)
- `cycle_end_time` (datetime2, nullable)
- `siparis_no` (nvarchar(50), nullable)
- `job_info` (nvarchar(MAX), nullable) - İş bilgileri JSON
- `initial_snapshot` (nvarchar(MAX), nullable) - İş başlangıç snapshot JSON
- `final_snapshot` (nvarchar(MAX), nullable) - İş bitiş snapshot JSON
- `created_at` (datetime2, default: getdate())
- `updated_at` (datetime2, default: getdate())

## JobEndReports
**Amaç:** Bitmiş işlerin tam raporunu saklamak

**İş bittiğinde (SaveJobEndReportAsync):**
Tüm iş bilgileri ve son durum kaydedilir.

**Kolonlar:**
- `id` (int, PK)
- `siparis_no` (nvarchar(50), NOT NULL)
- `toplam_miktar` (decimal, NOT NULL) - İşin toplam miktarı
- `kalan_miktar` (decimal, NOT NULL) - Kalan miktar
- `set_sayisi` (int, NOT NULL) - Set sayısı (adet/tur)
- `uretim_tipi` (nvarchar(50), nullable)
- `stok_adi` (nvarchar(255), nullable)
- `bundle` (nvarchar(100), nullable)
- `silindir_cevresi` (nvarchar(100), nullable) ⚠️ NVARCHAR! - Silindir çevresi (mm)
- `hedef_hiz` (int, NOT NULL) - Hedef hız (m/dk)
- `ethyl_alcohol_consumption` (decimal, nullable) - Etil alkol tüketimi
- `ethyl_acetate_consumption` (decimal, nullable) - Etil asetat tüketimi
- `paper_consumption` (decimal, nullable) - Kağıt tüketimi
- `actual_production` (int, nullable) - Gerçek üretim (adet)
- `remaining_work` (int, nullable) - Kalan iş (adet)
- `wastage_before_die` (decimal, nullable) - Die öncesi fire
- `wastage_after_die` (decimal, nullable) - Die sonrası fire
- `wastage_ratio` (decimal, nullable) - Fire oranı (%)
- `total_stoppage_duration` (decimal, nullable) - Toplam duruş süresi (milisaniye)
- `over_production` (int, nullable) - Fazla üretim
- `completion_percentage` (decimal, nullable) - Tamamlanma yüzdesi
- `job_start_time` (datetime2, NOT NULL) - İş başlangıç zamanı
- `job_end_time` (datetime2, NOT NULL) - İş bitiş zamanı
- `created_at` (datetime2, default: sysutcdatetime())
- `energy_consumption_kwh` (decimal, nullable) - Enerji tüketimi (kWh)
- `setup` (decimal, nullable) - Setup süresi
- `qualified_bundle` (int, nullable) - Kaliteli bundle
- `defective_bundle` (int, nullable) - Hatalı bundle
- `good_pallets` (int, nullable) - İyi paletler
- `defective_pallets` (int, nullable) - Hatalı paletler

## PeriodicSnapshots (Mevcut)
- `id` (int, PK)
- `snapshot_type` (nvarchar(20)) - 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
- `snapshot_date` (datetime2)
- `siparis_no` (nvarchar(50), nullable)
- `cycle_start_time` (datetime2, nullable)
- `actual_production` (int, nullable)
- `total_stoppage_duration` (decimal(18,2), nullable) - milisaniye
- `energy_consumption_kwh` (decimal(18,2), nullable)
- `wastage_before_die` (decimal(18,2), nullable)
- `wastage_after_die` (decimal(18,2), nullable)
- `paper_consumption` (decimal(18,2), nullable)
- `ethyl_alcohol_consumption` (decimal(18,2), nullable)
- `ethyl_acetate_consumption` (decimal(18,2), nullable)
- `planned_time` (decimal(18,2), nullable) - dakika
- `run_time` (decimal(18,2), nullable) - dakika
- `full_live_data` (nvarchar(MAX), nullable) - JSON
- `created_at` (datetime2)

