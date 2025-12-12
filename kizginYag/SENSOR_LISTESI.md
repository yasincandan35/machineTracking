# Kızgın Yağ Sistemi - Sensör Listesi ve Teknik Özellikler

## ÖZET

### SEÇENEK 1: Kalorimetre Çözümü (ÖNERİLEN) ⭐

**Toplam Cihaz Sayısı:** 5 adet (her makine için 1 kalorimetre)
- 5 adet Kalorimetre (Heat Meter / Energy Meter)
  - Her kalorimetre içinde: 1 Akış Ölçer + 2 Sıcaklık Sensörü (entegre)

**Avantajlar:**
- Direkt enerji çıkışı (kW ve kWh)
- Daha az montaj noktası
- Daha az kablolama
- Yüksek hassasiyet

### SEÇENEK 2: Ayrı Sensör Çözümü

**Toplam Sensör Sayısı:** 15 adet (5 makine × 3 sensör)
- 5 adet Akış Ölçer (Flow Meter)
- 10 adet Sıcaklık Sensörü (PT100 RTD)

---

## 1. KALORİMETRELER (Heat Meters / Energy Meters) ⭐ ÖNERİLEN

### 1.1. Genel Özellikler

| Özellik | Değer |
|---------|-------|
| **Tip** | Kalorimetre (Akış Ölçer + 2 Sıcaklık Sensörü Entegre) |
| **Akış Ölçüm Aralığı** | 0-200 L/min (hat çapına göre ayarlanacak) |
| **Sıcaklık Aralığı** | -40°C ile +400°C |
| **Basınç Aralığı** | 0-40 bar |
| **Hassasiyet (Enerji)** | ±0.5% - ±1% okuma değeri |
| **Hassasiyet (Akış)** | ±1% okuma değeri |
| **Hassasiyet (Sıcaklık)** | ±0.1°C |
| **Çıkış Sinyalleri** | 4-20 mA, Modbus RTU, Modbus TCP/IP |
| **Çıkış Değerleri** | Akış (L/min, m³/h), T_giriş (°C), T_çıkış (°C), ΔT (°C), **Güç (kW)**, **Enerji (kWh)** |
| **Besleme** | 24V DC veya 220V AC |
| **Bağlantı** | Flanşlı (DN25, DN32, DN40, DN50) |
| **Ekran** | Opsiyonel LCD ekran |
| **Adet** | 5 adet (her makine için 1 adet) |

### 1.2. Önerilen Modeller

#### Seçenek 1: Premium Segment
- **Kamstrup:** MULTICAL 402, MULTICAL 403
  - Özellikler: Yüksek hassasiyet, uzun ömür, kızgın yağ için optimize
  - Maliyet: ~60.000 - 80.000 TL/adet
  - Çıkış: Modbus RTU/TCP, 4-20 mA

- **Landis+Gyr:** ULTRAHEAT T550
  - Özellikler: Endüstriyel uygulamalar için, yüksek sıcaklık
  - Maliyet: ~55.000 - 75.000 TL/adet

#### Seçenek 2: Orta Segment (ÖNERİLEN)
- **Endress+Hauser:** Promass 80 + iTEMP TMT182 (entegre çözüm)
  - Özellikler: Güvenilir, yaygın kullanım
  - Maliyet: ~45.000 - 65.000 TL/adet

- **Siemens:** SITRANS F M MAG 3100 + SITRANS TH200 (entegre)
  - Özellikler: Siemens ekosistemi ile uyumlu
  - Maliyet: ~40.000 - 60.000 TL/adet

- **Krohne:** OPTIFLUX 2000 + OPTITEMP TRA-H (entegre)
  - Özellikler: Akış ölçümde uzman
  - Maliyet: ~45.000 - 65.000 TL/adet

#### Seçenek 3: Ekonomik Segment
- **Yerli:** Teknokontrol, Tekniker (kalorimetre modelleri)
  - Özellikler: Yerli üretim, uygun fiyat
  - Maliyet: ~30.000 - 45.000 TL/adet

**Not:** Bazı üreticiler kalorimetre olarak satmaz, akış ölçer + sıcaklık sensörlerini ayrı satıp entegre eder. Bu durumda PLC veya gateway'de hesaplama yapılır.

### 1.3. Kurulum Noktaları

| Makine | Cihaz Kodu | Konum | Hat Çapı |
|--------|------------|-------|----------|
| Makine 1 | CAL-001 | Makine 1 giriş hattı | DN32 (tahmini) |
| Makine 2 | CAL-002 | Makine 2 giriş hattı | DN32 (tahmini) |
| Makine 3 | CAL-003 | Makine 3 giriş hattı | DN32 (tahmini) |
| Makine 4 | CAL-004 | Makine 4 giriş hattı | DN32 (tahmini) |
| Makine 5 | CAL-005 | Makine 5 giriş hattı | DN32 (tahmini) |

**Not:** 
- Kalorimetre giriş hattına monte edilir
- Çıkış sıcaklık sensörü ayrı kabloyla çıkış hattına bağlanır
- Hat çapı fiziksel ölçüm ile doğrulanmalıdır

---

## 2. AKIŞ ÖLÇERLER (Flow Meters) - Alternatif Çözüm

### 1.1. Genel Özellikler

| Özellik | Değer |
|---------|-------|
| **Tip** | Vortex Flow Meter (Girdap Akış Ölçer) |
| **Ölçüm Aralığı** | 0-200 L/min (hat çapına göre ayarlanacak) |
| **Hassasiyet** | ±1% okuma değeri |
| **Sıcaklık Aralığı** | -40°C ile +400°C |
| **Basınç Aralığı** | 0-40 bar |
| **Çıkış Sinyali** | 4-20 mA (veya Modbus RTU) |
| **Besleme** | 24V DC |
| **Bağlantı** | Flanşlı (DN25, DN32, DN40) |
| **Adet** | 5 adet (her makine için 1 adet) |

### 1.2. Önerilen Modeller

#### Seçenek 1: Premium (Yüksek Hassasiyet)
- **Endress+Hauser:** Promass 80 (Coriolis) - ~50.000 TL/adet
- **Krohne:** OPTIFLUX 2000 - ~40.000 TL/adet

#### Seçenek 2: Orta Segment (Önerilen)
- **Siemens:** SITRANS F M MAG 3100 - ~30.000 TL/adet
- **Yokogawa:** YEWFLO - ~25.000 TL/adet

#### Seçenek 3: Ekonomik
- **Yerli:** Teknokontrol Vortex Flow Meter - ~15.000 TL/adet
- **Yerli:** Tekniker Vortex Flow Meter - ~18.000 TL/adet

### 1.3. Kurulum Noktaları

| Makine | Sensör Kodu | Konum | Hat Çapı |
|--------|-------------|-------|----------|
| Makine 1 | FO-001 | Makine 1 giriş hattı | DN32 (tahmini) |
| Makine 2 | FO-002 | Makine 2 giriş hattı | DN32 (tahmini) |
| Makine 3 | FO-003 | Makine 3 giriş hattı | DN32 (tahmini) |
| Makine 4 | FO-004 | Makine 4 giriş hattı | DN32 (tahmini) |
| Makine 5 | FO-005 | Makine 5 giriş hattı | DN32 (tahmini) |

**Not:** Hat çapı fiziksel ölçüm ile doğrulanmalıdır.

---

## 3. SICAKLIK SENSÖRLERİ (Temperature Sensors) - Alternatif Çözüm

### 2.1. Genel Özellikler

| Özellik | Değer |
|---------|-------|
| **Tip** | PT100 RTD (Resistance Temperature Detector) |
| **Ölçüm Aralığı** | -200°C ile +600°C |
| **Hassasiyet** | ±0.1°C (0-100°C), ±0.2°C (100-300°C) |
| **Çıkış Sinyali** | 4-20 mA (transmitter ile) veya Modbus RTU |
| **Besleme** | 24V DC |
| **Bağlantı** | 1/2" veya 3/4" dişli, termowell ile |
| **Adet** | 10 adet (her makine için 2 adet: giriş + çıkış) |

### 2.2. Önerilen Modeller

#### Seçenek 1: Premium
- **Endress+Hauser:** iTEMP TMT182 - ~8.000 TL/adet
- **Wika:** TR10 serisi - ~6.000 TL/adet

#### Seçenek 2: Orta Segment (Önerilen)
- **Siemens:** SITRANS TH200 - ~5.000 TL/adet
- **Yokogawa:** YTA serisi - ~4.500 TL/adet

#### Seçenek 3: Ekonomik
- **Yerli:** Teknokontrol PT100 + Transmitter - ~2.500 TL/adet
- **Yerli:** Tekniker PT100 + Transmitter - ~3.000 TL/adet

### 2.3. Kurulum Noktaları

| Makine | Sensör Kodu | Konum | Tip |
|--------|-------------|-------|-----|
| Makine 1 | TI-001 | Makine 1 giriş hattı (akış ölçerden sonra) | Giriş |
| Makine 1 | TO-001 | Makine 1 çıkış hattı | Çıkış |
| Makine 2 | TI-002 | Makine 2 giriş hattı (akış ölçerden sonra) | Giriş |
| Makine 2 | TO-002 | Makine 2 çıkış hattı | Çıkış |
| Makine 3 | TI-003 | Makine 3 giriş hattı (akış ölçerden sonra) | Giriş |
| Makine 3 | TO-003 | Makine 3 çıkış hattı | Çıkış |
| Makine 4 | TI-004 | Makine 4 giriş hattı (akış ölçerden sonra) | Giriş |
| Makine 4 | TO-004 | Makine 4 çıkış hattı | Çıkış |
| Makine 5 | TI-005 | Makine 5 giriş hattı (akış ölçerden sonra) | Giriş |
| Makine 5 | TO-005 | Makine 5 çıkış hattı | Çıkış |

---

## 4. OPSİYONEL SENSÖRLER (Doğrulama İçin)

### 3.1. Ana Hatt Akış Ölçer (Kazan Çıkışı)

| Özellik | Değer |
|---------|-------|
| **Tip** | Vortex Flow Meter |
| **Konum** | Kazan çıkış hattı (ana dağıtım öncesi) |
| **Amaç** | Toplam akış doğrulama |
| **Adet** | 1 adet (opsiyonel) |

### 3.2. Ana Hatt Sıcaklık Sensörleri

| Sensör | Konum | Amaç |
|--------|-------|------|
| TI-MAIN | Kazan çıkış hattı | Toplam giriş sıcaklığı |
| TO-MAIN | Kazan dönüş hattı | Toplam dönüş sıcaklığı |

---

## 5. VERİ TOPLAMA CİHAZI

### 4.1. PLC veya Data Logger

| Özellik | Değer |
|---------|-------|
| **Tip** | PLC (Programmable Logic Controller) veya Data Logger |
| **Giriş Sayısı** | En az 15 analog giriş (4-20 mA) |
| **İletişim** | Modbus RTU/Ethernet |
| **Besleme** | 24V DC veya 220V AC |
| **Adet** | 1 adet |

### 4.2. Önerilen Modeller

#### Seçenek 1: PLC
- **Siemens:** S7-1200 (CPU 1214C) - ~15.000 TL
- **Allen-Bradley:** CompactLogix L16ER - ~20.000 TL
- **Schneider:** M241 - ~12.000 TL

#### Seçenek 2: Data Logger
- **Advantech:** ADAM-6017 (8 kanal analog) - ~8.000 TL
- **Moxa:** ioLogik E2214 - ~10.000 TL

---

## 6. KABLOLAMA VE AKSESUARLAR

### 5.1. Kablolama İhtiyacı

| Kalem | Miktar | Açıklama |
|-------|--------|----------|
| **Sinyal Kablosu** | ~500-1000 m | 4-20 mA sinyal kablosu (shielded) |
| **Güç Kablosu** | ~200-300 m | 24V DC besleme kablosu |
| **Ethernet Kablosu** | ~50-100 m | PLC-IT ağı bağlantısı (Cat6) |
| **Kablo Kanalı** | ~100-200 m | Kabloların korunması için |

### 5.2. Aksesuarlar

| Kalem | Miktar | Açıklama |
|-------|--------|----------|
| **Termowell** | 10 adet | Sıcaklık sensörleri için |
| **Flanş Adaptörleri** | 5 adet | Akış ölçer montajı için |
| **Montaj Braketleri** | 15 adet | Sensör montajı için |
| **Junction Box** | 5-10 adet | Kablolama bağlantıları için |
| **Güç Kaynağı** | 2-3 adet | 24V DC güç kaynağı (yedekli) |

---

## 7. MALİYET ÖZETİ

### 7.1. Kalorimetre Çözümü Maliyetleri (ÖNERİLEN) ⭐

| Kalem | Adet | Birim Fiyat (TL) | Toplam (TL) |
|-------|------|------------------|-------------|
| Kalorimetre (Orta Segment) | 5 | 50.000 | 250.000 |
| **Cihaz Toplamı** | **5** | - | **250.000** |

**Not:** Kalorimetre içinde akış ölçer + 2 sıcaklık sensörü entegre olduğu için ayrı sensör gerekmez.

### 7.2. Ayrı Sensör Çözümü Maliyetleri (Alternatif)

| Kalem | Adet | Birim Fiyat (TL) | Toplam (TL) |
|-------|------|------------------|-------------|
| Vortex Akış Ölçer | 5 | 25.000 | 125.000 |
| PT100 Sıcaklık Sensörü | 10 | 4.000 | 40.000 |
| **Sensör Toplamı** | **15** | - | **165.000** |

### 7.3. Veri Toplama ve Altyapı

| Kalem | Adet | Birim Fiyat (TL) | Toplam (TL) |
|-------|------|------------------|-------------|
| PLC (S7-1200) | 1 | 15.000 | 15.000 |
| Kablolama ve Aksesuarlar | - | - | 15.000 |
| Montaj ve Kurulum | - | - | 15.000 |
| **Altyapı Toplamı** | - | - | **45.000** |

### 7.4. TOPLAM MALİYET

#### SEÇENEK 1: Kalorimetre Çözümü (ÖNERİLEN) ⭐

| Kategori | Maliyet (TL) |
|----------|--------------|
| Kalorimetreler (5 adet) | 250.000 |
| Veri Toplama ve Altyapı | 50.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **330.000** |

#### SEÇENEK 2: Ayrı Sensör Çözümü

| Kategori | Maliyet (TL) |
|----------|--------------|
| Sensörler (15 adet) | 165.000 |
| Veri Toplama ve Altyapı | 45.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **240.000** |

**Not:** 
- Kalorimetre çözümü biraz daha pahalı ama daha az kablolama, daha yüksek hassasiyet ve direkt enerji çıkışı sağlar.
- Ekonomik segment kalorimetrelerle maliyet ~250.000 TL'ye düşebilir.
- Fiyatlar yaklaşık değerlerdir. Tedarikçi ve marka seçimine göre değişebilir.

---

## 8. TEDARİKÇİ ÖNERİLERİ

### 7.1. Yerli Tedarikçiler
- **Teknokontrol:** Yerli üretim, uygun fiyat
- **Tekniker:** Yerli üretim, orta segment
- **Endüstriyel Otomasyon:** Distribütör, çok marka

### 7.2. Uluslararası Markalar (Türkiye Distribütörleri)
- **Endress+Hauser:** Premium, yüksek hassasiyet
- **Siemens:** Orta-premium, güvenilir
- **Krohne:** Premium, akış ölçümde uzman
- **Wika:** Orta segment, basınç ve sıcaklık

---

## 9. KURULUM ÖNCESİ HAZIRLIK

### 8.1. Fiziksel Ölçümler
- [ ] Her makine hattının çapı ölçülecek
- [ ] Hat basıncı ölçülecek
- [ ] Çalışma sıcaklık aralığı belirlenecek
- [ ] Montaj noktaları belirlenecek
- [ ] Kablolama yolu belirlenecek

### 8.2. Teknik Dokümantasyon
- [ ] P&ID (Piping & Instrumentation Diagram) hazırlanacak
- [ ] Elektrik şeması hazırlanacak
- [ ] Montaj planı hazırlanacak
- [ ] Kablolama planı hazırlanacak

### 8.3. İzinler ve Onaylar
- [ ] Üretim müdürlüğü onayı
- [ ] Bakım müdürlüğü onayı
- [ ] İSG (İş Sağlığı ve Güvenliği) onayı
- [ ] Bütçe onayı

---

**Hazırlanma Tarihi:** 2025-01-27  
**Versiyon:** 1.0

