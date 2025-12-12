# Kızgın Yağ Sistemi - Makine Bazlı Enerji Tüketim Ölçüm Projesi

## 1. PROJE ÖZETİ

### 1.1. Mevcut Durum
- **1 adet** kızgın yağ kazanı (doğalgazlı brülör)
- **5 adet** makine fırını ısıtılıyor
- Sadece toplam doğalgaz faturası görülüyor
- Makine bazlı tüketim bilgisi yok

### 1.2. Hedef
- Her makine için ayrı kızgın yağ enerji tüketim ölçümü
- Makine bazlı raporlama (fatura döneminde hangi makine ne kadar tüketmiş)
- İş bazlı tüketim analizi (aynı makinede farklı işler farklı tüketim yapabilir)

---

## 2. SİSTEM MİMARİSİ ANALİZİ

### 2.1. Kızgın Yağ Sistemi Akış Şeması

```
[Doğalgaz Brülör] → [Kızgın Yağ Kazanı] → [Ana Dağıtım Hattı]
                                                      ↓
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    ↓                                 ↓                                 ↓
            [Makine 1 Fırın]                  [Makine 2 Fırın]                  [Makine 3-5 Fırın]
                    ↓                                 ↓                                 ↓
            [Dönüş Hattı]                     [Dönüş Hattı]                     [Dönüş Hattı]
                    └─────────────────────────────────┼─────────────────────────────────┘
                                                      ↓
                                            [Kazan Dönüş Hattı]
```

### 2.2. Ölçüm Noktaları Stratejisi

**SEÇENEK 1: Kalorimetre ile Ölçüm (EN ÖNERİLEN) ⭐**
- Her makineye giden hat üzerinde 1 adet kalorimetre
- Kalorimetre içinde: Akış ölçer + 2 sıcaklık sensörü (giriş + çıkış)
- **Direkt enerji çıkışı:** kW ve kWh (hesaplama gerekmez)
- **Avantajlar:**
  - Tek cihaz, daha az montaj noktası
  - Direkt enerji değeri (hesaplama hatası yok)
  - Yüksek hassasiyet (%0.5-1%)
  - Daha az kablolama
  - Entegre çözüm, daha az arıza riski
- **Dezavantaj:** Biraz daha yüksek maliyet (ama daha az sensör sayısı)

**SEÇENEK 2: Her Makine Hattında Ayrı Akış Ölçer + Sıcaklık**
- Her makineye giden hat üzerinde akış ölçer
- Giriş ve çıkış sıcaklık ölçümü (ayrı sensörler)
- **Avantaj:** Direkt makine bazlı ölçüm, esnek konfigürasyon
- **Dezavantaj:** 15 adet sensör (5 akış + 10 sıcaklık), daha fazla kablolama

**SEÇENEK 3: Merkezi Ölçüm + Dağıtım Oranları**
- Ana hatta toplam akış ölçümü
- Her makine için sıcaklık farkı ölçümü
- Oranlama ile dağıtım
- **Avantaj:** Daha düşük maliyet
- **Dezavantaj:** Daha az hassas, makine bazlı tam ölçüm değil

**SEÇENEK 4: Hibrit Yaklaşım**
- Ana hatta toplam akış ölçümü
- Kritik makinelerde (yüksek tüketimli) direkt akış ölçümü
- Diğer makinelerde sıcaklık bazlı oranlama

---

## 3. SENSÖR SEÇİMİ VE TEKNİK ÖZELLİKLER

### 3.1. Kalorimetre (Heat Meter / Energy Meter) ⭐ ÖNERİLEN

#### 3.1.1. Kalorimetre Nedir?

Kalorimetre, **akış ölçer + 2 sıcaklık sensörü** içeren entegre bir cihazdır. Hem akış hızını hem de giriş-çıkış sıcaklık farkını ölçerek **direkt enerji değeri (kW veya kWh)** verir. Hesaplama yapmanıza gerek kalmaz, cihaz kendi içinde hesaplar.

**Çalışma Prensibi:**
```
Enerji (kW) = Akış (kg/h) × Özgül Isı (kJ/kg·K) × ΔT (K) / 3600
```
Bu hesaplama kalorimetre içinde otomatik yapılır.

#### 3.1.2. Neden Kalorimetre?

**Avantajlar:**
- ✅ **Tek cihaz:** 1 kalorimetre = 1 akış ölçer + 2 sıcaklık sensörü
- ✅ **Direkt enerji çıkışı:** kW ve kWh değerleri hazır
- ✅ **Yüksek hassasiyet:** %0.5-1% (akış ölçerden daha hassas)
- ✅ **Daha az kablolama:** Tek cihaz, tek bağlantı
- ✅ **Entegre çözüm:** Daha az arıza riski, daha kolay bakım
- ✅ **Hesaplama hatası yok:** Cihaz içinde hesaplanır
- ✅ **Kızgın yağ için optimize:** Yüksek sıcaklık uygulamalarına uygun

**Dezavantajlar:**
- ❌ Biraz daha yüksek maliyet (ama daha az sensör sayısı ile dengelenir)
- ❌ Montaj için giriş ve çıkış hatlarının yakın olması gerekir

#### 3.1.3. Teknik Özellikler

| Özellik | Değer |
|---------|-------|
| **Akış Ölçüm Aralığı** | 0-200 L/min (hat çapına göre) |
| **Sıcaklık Aralığı** | -40°C ile +400°C |
| **Basınç Aralığı** | 0-40 bar |
| **Hassasiyet (Enerji)** | ±0.5% - ±1% okuma değeri |
| **Hassasiyet (Akış)** | ±1% okuma değeri |
| **Hassasiyet (Sıcaklık)** | ±0.1°C |
| **Çıkış Sinyalleri** | 4-20 mA, Modbus RTU, Modbus TCP/IP |
| **Çıkış Değerleri** | Akış (L/min, m³/h), Sıcaklık Giriş (°C), Sıcaklık Çıkış (°C), ΔT (°C), Güç (kW), Enerji (kWh) |
| **Besleme** | 24V DC veya 220V AC |
| **Bağlantı** | Flanşlı (DN15, DN20, DN25, DN32, DN40, DN50, DN65, DN80, DN100, DN125, DN150, DN200) |
| **Ekran** | Opsiyonel LCD ekran (yerinde okuma için) |

**Boru Çapı Dönüşüm Tablosu:**
| İnç | DN (Nominal Çap) | Gerçek Çap (mm) | Kalorimetre Uyumu |
|-----|------------------|------------------|-------------------|
| 1/2" | DN15 | 15 mm | ✅ Mevcut |
| 3/4" | DN20 | 20 mm | ✅ Mevcut |
| 1" | DN25 | 25 mm | ✅ Mevcut |
| 1 1/4" | DN32 | 32 mm | ✅ Mevcut |
| 1 1/2" | DN40 | 40 mm | ✅ Mevcut |
| **2"** | **DN50** | **50.8 mm** | **✅ Mevcut (Standart)** |
| 2 1/2" | DN65 | 65 mm | ✅ Mevcut |
| 3" | DN80 | 80 mm | ✅ Mevcut |
| **4"** | **DN100** | **101.6 mm** | **✅ Mevcut (Standart)** |
| 5" | DN125 | 125 mm | ✅ Mevcut |
| 6" | DN150 | 150 mm | ✅ Mevcut |
| 8" | DN200 | 200 mm | ✅ Mevcut |

**Önemli:** 2 inç (DN50) ve 4 inç (DN100) borular için kalorimetreler **standart olarak mevcuttur** ve yaygın kullanılır.

#### 3.1.4. Önerilen Markalar ve Modeller

##### Premium Segment
- **Kamstrup:** MULTICAL 402, MULTICAL 403
  - Özellikler: Yüksek hassasiyet, uzun ömür, kızgın yağ için uygun
  - Maliyet: ~60.000 - 80.000 TL/adet
  - Çıkış: Modbus RTU/TCP, 4-20 mA

- **Landis+Gyr:** ULTRAHEAT T550
  - Özellikler: Endüstriyel uygulamalar için, yüksek sıcaklık
  - Maliyet: ~55.000 - 75.000 TL/adet

##### Orta Segment (ÖNERİLEN)
- **Endress+Hauser:** Promass 80 + iTEMP TMT182 (entegre çözüm)
  - Özellikler: Güvenilir, yaygın kullanım
  - Maliyet: ~45.000 - 65.000 TL/adet

- **Siemens:** SITRANS F M MAG 3100 + SITRANS TH200 (entegre)
  - Özellikler: Siemens ekosistemi ile uyumlu
  - Maliyet: ~40.000 - 60.000 TL/adet

- **Krohne:** OPTIFLUX 2000 + OPTITEMP TRA-H (entegre)
  - Özellikler: Akış ölçümde uzman
  - Maliyet: ~45.000 - 65.000 TL/adet

##### Ekonomik Segment
- **Yerli:** Teknokontrol, Tekniker (kalorimetre modelleri)
  - Özellikler: Yerli üretim, uygun fiyat
  - Maliyet: ~30.000 - 45.000 TL/adet

**Not:** Bazı üreticiler kalorimetre olarak satmaz, akış ölçer + sıcaklık sensörlerini ayrı satıp entegre eder. Bu durumda PLC veya gateway'de hesaplama yapılır.

#### 3.1.5. Kurulum Şekli

Kalorimetre genellikle **giriş hattına** monte edilir ve **çıkış sıcaklık sensörü** ayrı bir kabloyla çıkış hattına bağlanır:

```
[Kazan] → [Ana Hat] → [Kalorimetre (Akış + Giriş Sıcaklık)] → [Makine Fırın] → [Çıkış Sıcaklık Sensörü] → [Dönüş]
```

Veya bazı modellerde **çift montaj** yapılabilir (giriş ve çıkış hatlarında ayrı ayrı).

#### 3.1.6. Maliyet Karşılaştırması

| Çözüm | Sensör Sayısı | Toplam Maliyet (5 Makine) |
|-------|---------------|---------------------------|
| **Kalorimetre** | 5 adet | ~200.000 - 325.000 TL |
| **Ayrı Akış + Sıcaklık** | 15 adet (5 akış + 10 sıcaklık) | ~240.000 TL |

**Sonuç:** Kalorimetre biraz daha pahalı olabilir ama:
- Daha az montaj noktası
- Daha az kablolama
- Daha az arıza riski
- Daha yüksek hassasiyet
- Direkt enerji çıkışı (hesaplama gerekmez)

---

### 3.2. Akış Ölçer (Flow Meter) - Alternatif Çözüm

#### 3.1.1. Önerilen Tip: Vortex Flow Meter (Girdap Akış Ölçer)

**Neden Vortex?**
- Yüksek sıcaklık uygulamalarına uygun (kızgın yağ 200-300°C)
- Yüksek basınç dayanımı
- Düşük bakım gereksinimi
- Orta seviye hassasiyet (%1-2)
- Orta seviye maliyet

**Teknik Özellikler:**
- **Sıcaklık Aralığı:** -40°C ile +400°C
- **Basınç Aralığı:** 0-40 bar
- **Hassasiyet:** ±1% okuma değeri
- **Çıkış Sinyali:** 4-20 mA veya Modbus RTU
- **Besleme:** 24V DC veya 220V AC
- **Bağlantı:** Flanşlı (DN15, DN20, DN25, DN32, DN40, DN50, DN65, DN80, DN100 - hat çapına göre)

**Boru Çapı Uyumu:**
- **2 inç (DN50):** ✅ Standart olarak mevcuttur
- **4 inç (DN100):** ✅ Standart olarak mevcuttur

**Alternatif Seçenekler:**
1. **Ultrasonik Akış Ölçer:** Daha hassas ama daha pahalı, bakım gerektirir
2. **Türbin Akış Ölçer:** Daha ucuz ama yüksek sıcaklıkta sorunlu
3. **Coriolis Akış Ölçer:** En hassas ama çok pahalı

#### 3.1.2. Önerilen Markalar/Modeller
- **Endress+Hauser:** Promass 80 (Coriolis - premium), Promag 50 (elektromanyetik)
- **Krohne:** OPTIFLUX 2000 (elektromanyetik)
- **Siemens:** SITRANS F M MAG 3100 (elektromanyetik)
- **Yerli Alternatif:** Teknokontrol, Tekniker (daha ekonomik)

**Maliyet Tahmini:** 15.000 - 50.000 TL/adet (marka ve modeline göre)

### 3.2. Sıcaklık Sensörü (Temperature Sensor)

#### 3.2.1. Önerilen Tip: PT100 RTD (Resistance Temperature Detector)

**Neden PT100?**
- Yüksek hassasiyet (±0.1°C)
- Geniş sıcaklık aralığı (-200°C ile +600°C)
- Uzun ömürlü ve stabil
- Endüstriyel standart

**Teknik Özellikler:**
- **Sıcaklık Aralığı:** -200°C ile +600°C
- **Hassasiyet:** ±0.1°C (0-100°C), ±0.2°C (100-300°C)
- **Çıkış:** 4-20 mA (transmitter ile) veya Modbus RTU
- **Bağlantı:** 1/2" veya 3/4" dişli, termowell ile montaj
- **Besleme:** 24V DC

**Alternatif:** K tipi termokupl (daha ucuz ama daha az hassas)

#### 3.2.2. Önerilen Markalar
- **Endress+Hauser:** iTEMP TMT182
- **Wika:** TR10, TR20 serisi
- **Yerli:** Teknokontrol, Tekniker

**Maliyet Tahmini:** 2.000 - 8.000 TL/adet (transmitter dahil)

### 3.3. Basınç Sensörü (Opsiyonel - Doğrulama İçin)

**Kullanım Amacı:** Sistem sağlığı ve doğrulama için
- **Tip:** Piezoresistif basınç transmitter
- **Aralık:** 0-25 bar
- **Çıkış:** 4-20 mA
- **Maliyet:** 1.500 - 5.000 TL/adet

---

## 4. ÖLÇÜM NOKTALARI DETAYLI TASARIM

### 4.1. Her Makine İçin Ölçüm Noktaları

#### SEÇENEK A: Kalorimetre ile (ÖNERİLEN) ⭐

**Her Makine İçin:**
1. **Kalorimetre (Heat Meter)**
   - Konum: Makineye giden hat üzerinde (giriş hattı)
   - İçerik: Akış ölçer + Giriş sıcaklık sensörü (entegre)
   - Çıkış sıcaklık sensörü: Ayrı kabloyla çıkış hattına bağlı
   - Ölçüm: Akış (L/min), Giriş sıcaklığı (°C), Çıkış sıcaklığı (°C), ΔT (°C)
   - **Direkt Çıkış:** Güç (kW), Enerji (kWh)
   - Sinyal: Modbus RTU/TCP veya 4-20 mA

**TOPLAM:** Her makine için 1 kalorimetre
**5 Makine için:** 5 kalorimetre

**Kurulum Şeması:**
```
[Kazan] → [Ana Hat] → [Kalorimetre] → [Makine Fırın] → [Çıkış Sıcaklık Sensörü] → [Dönüş]
              ↓              ↓                                    ↓
          (Akış + Giriş T)  (Entegre)                    (Çıkış T - Kablolu)
```

#### SEÇENEK B: Ayrı Akış Ölçer + Sıcaklık Sensörleri

**Her Makine İçin:**
1. **Akış Ölçer (Flow Meter)**
   - Konum: Makineye giden hat üzerinde, vanadan önce
   - Ölçüm: Volumetrik akış (L/min veya m³/h)
   - Sinyal: 4-20 mA veya Modbus RTU

2. **Sıcaklık Sensörü (Giriş)**
   - Konum: Akış ölçerden hemen sonra
   - Ölçüm: Kızgın yağ giriş sıcaklığı (°C)
   - Sinyal: 4-20 mA veya Modbus RTU

3. **Sıcaklık Sensörü (Çıkış)**
   - Konum: Makineden çıkan hat üzerinde
   - Ölçüm: Kızgın yağ çıkış sıcaklığı (°C)
   - Sinyal: 4-20 mA veya Modbus RTU

**TOPLAM:** Her makine için 3 sensör (1 akış + 2 sıcaklık)
**5 Makine için:** 15 sensör (5 akış + 10 sıcaklık)

### 4.2. Merkezi Ölçüm Noktaları (Opsiyonel - Doğrulama)

**KAZAN ÇIKIŞI:**
- Toplam akış ölçümü (doğrulama için)
- Kazan çıkış sıcaklığı

**KAZAN DÖNÜŞÜ:**
- Dönüş sıcaklığı
- Toplam dönüş akışı (doğrulama için)

---

## 5. ENERJİ HESAPLAMA YÖNTEMİ

### 5.1. Enerji Tüketim Formülü

#### Kalorimetre Kullanılıyorsa:
**Hesaplama gerekmez!** Kalorimetre direkt olarak şu değerleri verir:
- Güç (kW) - anlık
- Enerji (kWh) - kümülatif
- Akış (L/min veya m³/h)
- Giriş sıcaklığı (°C)
- Çıkış sıcaklığı (°C)
- ΔT (°C)

Sadece kalorimetreden okuma yapılır, hesaplama yapılmaz.

#### Ayrı Sensörler Kullanılıyorsa:

Her makine için enerji tüketimi:

```
Q = m × cp × ΔT

Q = Enerji (kW veya kWh)
m = Kütle akışı (kg/s veya kg/h)
cp = Özgül ısı kapasitesi (kJ/kg·K) - Kızgın yağ için ~2.5 kJ/kg·K
ΔT = Sıcaklık farkı (T_giriş - T_çıkış) (°C veya K)
```

### 5.2. Hesaplama Adımları

1. **Volumetrik Akış → Kütle Akışı Dönüşümü:**
   ```
   m (kg/h) = V (m³/h) × ρ (kg/m³)
   ```
   - ρ (yoğunluk) sıcaklığa bağlı değişir
   - Kızgın yağ için: ~850-900 kg/m³ (ortalama sıcaklıkta)

2. **Anlık Güç Hesaplama:**
   ```
   P (kW) = m (kg/s) × cp (kJ/kg·K) × ΔT (K) / 3600
   ```

3. **Enerji Tüketimi (Zaman İçinde):**
   ```
   E (kWh) = ∫ P(t) dt
   ```
   - Pratikte: Her ölçüm periyodunda (örn. 1 dakika) güç hesaplanır
   - Toplam enerji = Σ (P_ortalama × Δt)

### 5.3. Örnek Hesaplama

**Varsayımlar:**
- Akış: 50 L/min = 3 m³/h
- Giriş sıcaklığı: 250°C
- Çıkış sıcaklığı: 230°C
- ΔT = 20°C
- Yoğunluk (ortalama 240°C): 870 kg/m³
- cp = 2.5 kJ/kg·K

**Hesaplama:**
1. Kütle akışı: m = 3 m³/h × 870 kg/m³ = 2,610 kg/h = 0.725 kg/s
2. Anlık güç: P = 0.725 × 2.5 × 20 / 3600 = 0.0101 kW = 10.1 kW
3. 1 saatlik enerji: E = 10.1 kWh

---

## 6. VERİ TOPLAMA SİSTEMİ MİMARİSİ

### 6.1. Sensör → Veri Toplama → Veritabanı Akışı

```
[Sensörler] → [Sinyal Dönüştürücü/Transmitter] → [Veri Toplama Cihazı] → [Veritabanı]
     ↓                    ↓                              ↓                    ↓
  4-20 mA            Modbus RTU                    PLC/SCADA          SQL Server
  veya Modbus        veya Ethernet                 veya Gateway       veya MySQL
```

### 6.2. Veri Toplama Cihazı Seçenekleri

#### SEÇENEK 1: PLC (Programmable Logic Controller) - ÖNERİLEN

**Avantajlar:**
- Endüstriyel ortam için tasarlanmış
- Güvenilir ve dayanıklı
- Modbus RTU/Ethernet desteği
- Mevcut sisteminizle entegre edilebilir

**Önerilen Modeller:**
- **Siemens:** S7-1200, S7-1500
- **Allen-Bradley:** CompactLogix
- **Schneider:** M221, M241
- **Yerli:** Teknokontrol PLC'leri

**Maliyet:** 10.000 - 30.000 TL

#### SEÇENEK 2: Veri Toplama Modülü (Data Logger)

**Avantajlar:**
- Daha ekonomik
- Kolay kurulum
- Modbus gateway özelliği

**Önerilen Modeller:**
- **Advantech:** ADAM-6000 serisi
- **Moxa:** ioLogik serisi
- **Yerli:** Teknokontrol gateway'leri

**Maliyet:** 5.000 - 15.000 TL

#### SEÇENEK 3: SCADA Sistemi

**Avantajlar:**
- Görselleştirme dahil
- Raporlama özellikleri
- Alarm yönetimi

**Maliyet:** 50.000 - 200.000 TL (yazılım + donanım)

### 6.3. Veri Toplama Periyodu

**Önerilen Ölçüm Sıklığı:**
- **Anlık Ölçüm:** Her 1-5 saniye (sensörlerden okuma)
- **Kayıt Periyodu:** Her 1 dakika (ortalama değerler)
- **Raporlama:** Günlük, haftalık, aylık

**Neden 1 dakika?**
- Enerji hesaplaması için yeterli hassasiyet
- Veritabanı boyutunu kontrol altında tutar
- Trend analizi için yeterli veri noktası

---

## 7. VERİTABANI YAPISI (TASLAK)

### 7.1. Tablolar

#### `HotOilMachines` (Makine Tanımları)
- `MachineId` (int, PK)
- `MachineName` (varchar)
- `MachineNumber` (int)
- `IsActive` (bit)
- `InstallationDate` (datetime)

#### `HotOilSensors` (Sensör Tanımları)
- `SensorId` (int, PK)
- `MachineId` (int, FK)
- `SensorType` (varchar) - 'Flow', 'TemperatureIn', 'TemperatureOut'
- `SensorAddress` (varchar) - Modbus adresi
- `CalibrationFactor` (float) - Kalibrasyon katsayısı

#### `HotOilMeasurements` (Ölçüm Verileri)
- `MeasurementId` (bigint, PK)
- `MachineId` (int, FK)
- `Timestamp` (datetime)
- `FlowRate` (float) - L/min veya m³/h
- `TemperatureIn` (float) - °C
- `TemperatureOut` (float) - °C
- `DeltaT` (float) - °C (hesaplanan)
- `Power` (float) - kW (hesaplanan)
- `Energy` (float) - kWh (kümülatif)

#### `HotOilEnergyConsumption` (Enerji Tüketim Özeti)
- `ConsumptionId` (bigint, PK)
- `MachineId` (int, FK)
- `Date` (date)
- `Hour` (int) - 0-23
- `TotalEnergy` (float) - kWh
- `AveragePower` (float) - kW
- `AverageFlowRate` (float) - L/min
- `AverageDeltaT` (float) - °C

#### `HotOilJobs` (İş Bazlı Tüketim - Opsiyonel)
- `JobId` (bigint, PK)
- `MachineId` (int, FK)
- `JobName` (varchar)
- `StartTime` (datetime)
- `EndTime` (datetime)
- `TotalEnergy` (float) - kWh
- `JobType` (varchar)

---

## 8. MALİYET ANALİZİ

### 8.1. Kalorimetre Çözümü Maliyeti (ÖNERİLEN) ⭐

#### 8.1.1. Her Makine İçin

| Sensör Tipi | Adet | Birim Fiyat (TL) | Toplam (TL) |
|------------|------|------------------|-------------|
| Kalorimetre (Orta Segment) | 1 | 50.000 | 50.000 |
| **Toplam (1 Makine)** | **1** | - | **50.000** |

#### 8.1.2. 5 Makine İçin Toplam

| Kalem | Adet | Toplam (TL) |
|-------|------|-------------|
| Kalorimetre | 5 | 250.000 |
| **Sensör Toplamı** | **5** | **250.000** |

**Not:** Kalorimetre içinde akış ölçer + 2 sıcaklık sensörü entegre olduğu için ayrı sensör gerekmez.

### 8.2. Ayrı Sensör Çözümü Maliyeti (Alternatif)

#### 8.2.1. Her Makine İçin

| Sensör Tipi | Adet | Birim Fiyat (TL) | Toplam (TL) |
|------------|------|------------------|-------------|
| Vortex Akış Ölçer | 1 | 25.000 | 25.000 |
| PT100 Sıcaklık (Giriş) | 1 | 5.000 | 5.000 |
| PT100 Sıcaklık (Çıkış) | 1 | 5.000 | 5.000 |
| **Toplam (1 Makine)** | **3** | - | **35.000** |

#### 8.2.2. 5 Makine İçin Toplam

| Kalem | Adet | Toplam (TL) |
|-------|------|-------------|
| Akış Ölçer | 5 | 125.000 |
| Sıcaklık Sensörü | 10 | 50.000 |
| **Sensör Toplamı** | **15** | **175.000** |

### 8.3. Veri Toplama ve Altyapı

| Kalem | Adet | Birim Fiyat (TL) | Toplam (TL) |
|-------|------|------------------|-------------|
| PLC veya Data Logger | 1 | 20.000 | 20.000 |
| Modbus RTU/Ethernet Kablolama | - | - | 10.000 |
| Montaj ve Kurulum | - | - | 15.000 |
| Yazılım Geliştirme | - | - | 30.000 |
| **Altyapı Toplamı** | - | - | **75.000** |

### 8.4. TOPLAM PROJE MALİYETİ

#### SEÇENEK 1: Kalorimetre Çözümü (ÖNERİLEN) ⭐

| Kategori | Maliyet (TL) |
|----------|--------------|
| Kalorimetreler (5 adet) | 250.000 |
| Veri Toplama Altyapısı | 50.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **330.000** |

#### SEÇENEK 2: Ayrı Sensör Çözümü

| Kategori | Maliyet (TL) |
|----------|--------------|
| Sensörler (15 adet) | 175.000 |
| Veri Toplama Altyapısı | 75.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **280.000** |

**Not:** 
- Kalorimetre çözümü biraz daha pahalı ama daha az kablolama, daha yüksek hassasiyet ve direkt enerji çıkışı sağlar.
- Bu maliyetler yaklaşık değerlerdir. Marka, model ve kurulum zorluğuna göre değişebilir.
- Ekonomik segment kalorimetrelerle maliyet ~250.000 TL'ye düşebilir.

### 8.5. Alternatif Düşük Maliyetli Çözüm

**SEÇENEK: Merkezi Ölçüm + Oranlama**
- 1 adet ana akış ölçer: 25.000 TL
- 10 adet sıcaklık sensörü: 50.000 TL
- Veri toplama: 75.000 TL
- **Toplam:** ~150.000 TL

**Dezavantaj:** Makine bazlı direkt ölçüm değil, oranlama ile tahmin.

---

## 9. KURULUM PLANI

### 9.1. Faz 1: Pilot Uygulama (1 Makine)
1. 1 makine için sensör kurulumu
2. Veri toplama sistemi kurulumu
3. Test ve doğrulama (1-2 hafta)
4. Hesaplama doğruluğunun kontrolü

### 9.2. Faz 2: Tam Kurulum (Kalan 4 Makine)
1. Kalan 4 makine için sensör kurulumu
2. Sistem entegrasyonu
3. Toplam doğrulama (kazan çıkışı ile karşılaştırma)

### 9.3. Faz 3: Raporlama ve Optimizasyon
1. Dashboard geliştirme
2. Raporlama sistemi
3. Alarm ve uyarı sistemi

---

## 10. DOĞRULAMA VE KALİBRASYON

### 10.1. Doğrulama Yöntemleri

1. **Toplam Kontrol:**
   - 5 makine toplam tüketimi = Kazan çıkış akışı × ΔT
   - %5-10 tolerans kabul edilebilir

2. **Kalibrasyon:**
   - İlk kurulumda profesyonel kalibrasyon
   - Yıllık periyodik kalibrasyon
   - Akış ölçerler için flow bench testi

3. **Kros Kontrol:**
   - Farklı zamanlarda manuel ölçüm
   - Referans cihazlarla karşılaştırma

---

## 11. BAKIM VE İZLEME

### 11.1. Periyodik Bakım

- **Günlük:** Veri akışı kontrolü, alarm kontrolü
- **Haftalık:** Sensör değerlerinin mantıklılık kontrolü
- **Aylık:** Fiziksel kontrol, temizlik
- **Yıllık:** Kalibrasyon, profesyonel bakım

### 11.2. Alarm Noktaları

- Akış ölçer hatası
- Sıcaklık sensörü hatası
- Anormal tüketim (beklenenin %50 üstü/altı)
- Sıcaklık farkı çok düşük (sistem verimsizliği)

---

## 12. SONUÇ VE ÖNERİLER

### 12.1. Önerilen Çözüm ⭐

**Kalorimetre ile Direkt Ölçüm (EN ÖNERİLEN):**
- 5 adet Kalorimetre (her makine için 1 adet)
- Her kalorimetre: Akış ölçer + 2 sıcaklık sensörü (entegre)
- Direkt enerji çıkışı (kW ve kWh)
- PLC tabanlı veri toplama
- SQL veritabanı ile entegrasyon

**Neden Bu Çözüm?**
- ✅ En doğru ölçüm (yüksek hassasiyet)
- ✅ Direkt enerji değeri (hesaplama gerekmez)
- ✅ Daha az montaj noktası (tek cihaz)
- ✅ Daha az kablolama
- ✅ Daha az arıza riski (entegre çözüm)
- ✅ Makine bazlı detaylı analiz
- ✅ İş bazlı tüketim takibi mümkün
- ✅ Uzun vadede en değerli veri

**Alternatif:** Ayrı akış ölçer + sıcaklık sensörleri (daha ekonomik ama daha fazla montaj noktası)

### 12.2. Alternatif (Bütçe Kısıtlı İse)

**Merkezi Ölçüm + Oranlama:**
- 1 ana akış ölçer
- 10 sıcaklık sensörü
- Sıcaklık farkına göre oranlama

### 12.3. Sonraki Adımlar

1. **Teknik Onay:** Bu dokümanın teknik ekip tarafından gözden geçirilmesi
2. **Bütçe Onayı:** Maliyet analizinin yönetim tarafından onaylanması
3. **Tedarikçi Seçimi:** Sensör ve cihaz tedarikçilerinin belirlenmesi
4. **Kurulum Planı:** Detaylı kurulum takvimi
5. **Yazılım Geliştirme:** Veri toplama ve raporlama yazılımı

---

## 13. SORULAR VE CEVAPLAR

### S1: Neden her makine için ayrı akış ölçer?
**C:** En doğru ölçüm için. Oranlama yöntemi tahmin yapar, direkt ölçüm gerçek değeri verir.

### S2: Sadece sıcaklık ölçümü yeterli olmaz mı?
**C:** Hayır. Akış hızı bilinmeden enerji hesaplanamaz. Sadece sıcaklık farkı, akış olmadan anlamsızdır.

### S3: Doğalgaz tüketimi ile nasıl ilişkilendireceğiz?
**C:** Kızgın yağ enerji tüketimi (kWh) × kazan verimliliği = Doğalgaz enerji eşdeğeri. Kazan verimliliği %80-90 arası olabilir.

### S4: İş bazlı tüketim nasıl takip edilecek?
**C:** Makine üzerindeki iş bilgisi (job bilgisi) ile enerji tüketimi eşleştirilerek. Mevcut sisteminizde iş takibi varsa entegre edilebilir.

### S5: Veri kaybı olursa ne olur?
**C:** Veri toplama sistemi offline olursa, o süre için tahmin yapılabilir (ortalama değerler) veya boş bırakılabilir. PLC'ler genelde güvenilirdir.

---

**Doküman Versiyonu:** 1.0  
**Hazırlanma Tarihi:** 2025-01-27  
**Hazırlayan:** AI Assistant  
**Durum:** Taslak - Teknik Onay Bekliyor

