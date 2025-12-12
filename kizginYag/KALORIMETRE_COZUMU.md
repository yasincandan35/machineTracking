# Kalorimetre ile Ölçüm Çözümü - Özet

## 🎯 KALORİMETRE NEDİR?

Kalorimetre (Heat Meter / Energy Meter), **akış ölçer + 2 sıcaklık sensörünü** tek bir cihazda birleştiren entegre bir ölçüm cihazıdır.

### Nasıl Çalışır?

1. **Akış ölçer:** Kızgın yağın akış hızını ölçer (L/min veya m³/h)
2. **Giriş sıcaklık sensörü:** Kızgın yağın giriş sıcaklığını ölçer (°C)
3. **Çıkış sıcaklık sensörü:** Kızgın yağın çıkış sıcaklığını ölçer (°C)
4. **İç hesaplama:** Cihaz içinde otomatik olarak enerji hesaplar

### Direkt Çıkış Değerleri

Kalorimetre şu değerleri **direkt olarak** verir:
- ✅ **Güç (kW)** - Anlık enerji tüketimi
- ✅ **Enerji (kWh)** - Kümülatif enerji tüketimi
- ✅ Akış (L/min, m³/h)
- ✅ Giriş sıcaklığı (°C)
- ✅ Çıkış sıcaklığı (°C)
- ✅ Sıcaklık farkı ΔT (°C)

**Önemli:** Hesaplama yapmanıza gerek yok! Cihaz kendi içinde hesaplar.

---

## 💡 NEDEN KALORİMETRE?

### Avantajlar

| Özellik | Kalorimetre | Ayrı Sensörler |
|---------|-------------|----------------|
| **Cihaz Sayısı** | 5 adet | 15 adet (5 akış + 10 sıcaklık) |
| **Montaj Noktası** | 5 nokta | 15 nokta |
| **Kablolama** | Daha az | Daha fazla |
| **Hassasiyet** | %0.5-1% | %1-2% |
| **Enerji Çıkışı** | Direkt (kW/kWh) | Hesaplama gerekir |
| **Arıza Riski** | Daha düşük (entegre) | Daha yüksek (ayrı sensörler) |
| **Bakım** | Daha kolay | Daha zor |

### Dezavantajlar

- ❌ Biraz daha yüksek maliyet (ama daha az sensör sayısı ile dengelenir)
- ❌ Montaj için giriş ve çıkış hatlarının yakın olması gerekir

---

## 📊 KURULUM ŞEMASI

```
[Kızgın Yağ Kazanı]
        ↓
[Ana Dağıtım Hattı]
        ↓
┌───────┼───────┼───────┼───────┼───────┐
↓       ↓       ↓       ↓       ↓
[KAL-1] [KAL-2] [KAL-3] [KAL-4] [KAL-5]  ← Kalorimetreler (Giriş Hattı)
↓       ↓       ↓       ↓       ↓
[M1]    [M2]    [M3]    [M4]    [M5]     ← Makine Fırınları
↓       ↓       ↓       ↓       ↓
[T1]    [T2]    [T3]    [T4]    [T5]     ← Çıkış Sıcaklık Sensörleri (Kablolu)
↓       ↓       ↓       ↓       ↓
[Dönüş Hatları]
        ↓
[Kazan Dönüş Hattı]
```

**Açıklama:**
- **KAL-1...5:** Kalorimetreler (giriş hattına monte)
- **M1...5:** Makine fırınları
- **T1...5:** Çıkış sıcaklık sensörleri (kalorimetreye kabloyla bağlı)

---

## 🔧 TEKNİK ÖZELLİKLER

### Genel Özellikler

| Özellik | Değer |
|---------|-------|
| **Akış Ölçüm Aralığı** | 0-200 L/min |
| **Sıcaklık Aralığı** | -40°C ile +400°C |
| **Basınç Aralığı** | 0-40 bar |
| **Hassasiyet (Enerji)** | ±0.5% - ±1% |
| **Hassasiyet (Akış)** | ±1% |
| **Hassasiyet (Sıcaklık)** | ±0.1°C |
| **Çıkış Sinyalleri** | Modbus RTU/TCP, 4-20 mA |
| **Besleme** | 24V DC veya 220V AC |
| **Bağlantı** | Flanşlı (DN15, DN20, DN25, DN32, DN40, DN50, DN65, DN80, DN100, DN125, DN150, DN200) |

### Boru Çapı Uyumu

**2 inç ve 4 inç Borular İçin:**
- ✅ **2 inç (DN50):** Standart olarak mevcuttur, yaygın kullanılır
- ✅ **4 inç (DN100):** Standart olarak mevcuttur, yaygın kullanılır

**Boru Çapı Dönüşüm Tablosu:**
| İnç | DN | Gerçek Çap | Kalorimetre Uyumu |
|-----|----|-----------|-------------------|
| 1/2" | DN15 | 15 mm | ✅ |
| 3/4" | DN20 | 20 mm | ✅ |
| 1" | DN25 | 25 mm | ✅ |
| 1 1/4" | DN32 | 32 mm | ✅ |
| 1 1/2" | DN40 | 40 mm | ✅ |
| **2"** | **DN50** | **50.8 mm** | **✅ Standart** |
| 2 1/2" | DN65 | 65 mm | ✅ |
| 3" | DN80 | 80 mm | ✅ |
| **4"** | **DN100** | **101.6 mm** | **✅ Standart** |
| 5" | DN125 | 125 mm | ✅ |
| 6" | DN150 | 150 mm | ✅ |
| 8" | DN200 | 200 mm | ✅ |

**Not:** Kalorimetreler genellikle DN15'ten DN200'e kadar tüm standart çaplarda üretilir. 2 inç ve 4 inç borular endüstriyel uygulamalarda çok yaygın olduğu için bu çaplarda kalorimetre bulmakta sorun olmaz.

---

## 💰 MALİYET KARŞILAŞTIRMASI

### Kalorimetre Çözümü

| Kalem | Adet | Birim Fiyat | Toplam |
|-------|------|-------------|--------|
| Kalorimetre (Orta Segment) | 5 | 50.000 TL | 250.000 TL |
| Veri Toplama Altyapısı | - | - | 50.000 TL |
| Yazılım Geliştirme | - | - | 30.000 TL |
| **TOPLAM** | - | - | **330.000 TL** |

### Ayrı Sensör Çözümü

| Kalem | Adet | Birim Fiyat | Toplam |
|-------|------|-------------|--------|
| Akış Ölçer | 5 | 25.000 TL | 125.000 TL |
| Sıcaklık Sensörü | 10 | 4.000 TL | 40.000 TL |
| Veri Toplama Altyapısı | - | - | 45.000 TL |
| Yazılım Geliştirme | - | - | 30.000 TL |
| **TOPLAM** | - | - | **240.000 TL** |

**Fark:** Kalorimetre çözümü ~90.000 TL daha pahalı ama:
- Daha az montaj noktası (5 vs 15)
- Daha az kablolama
- Daha yüksek hassasiyet
- Direkt enerji çıkışı (hesaplama gerekmez)
- Daha az arıza riski

**Ekonomik Segment:** Yerli kalorimetrelerle maliyet ~250.000 TL'ye düşebilir.

---

## 🏭 ÖNERİLEN MARKALAR

### Premium Segment
- **Kamstrup:** MULTICAL 402, MULTICAL 403
  - Maliyet: ~60.000 - 80.000 TL/adet
  - Yüksek hassasiyet, uzun ömür

- **Landis+Gyr:** ULTRAHEAT T550
  - Maliyet: ~55.000 - 75.000 TL/adet
  - Endüstriyel uygulamalar için

### Orta Segment (ÖNERİLEN)
- **Endress+Hauser:** Promass 80 + iTEMP TMT182 (entegre)
  - Maliyet: ~45.000 - 65.000 TL/adet
  - Güvenilir, yaygın kullanım

- **Siemens:** SITRANS F M MAG 3100 + SITRANS TH200 (entegre)
  - Maliyet: ~40.000 - 60.000 TL/adet
  - Siemens ekosistemi ile uyumlu

- **Krohne:** OPTIFLUX 2000 + OPTITEMP TRA-H (entegre)
  - Maliyet: ~45.000 - 65.000 TL/adet
  - Akış ölçümde uzman

### Ekonomik Segment
- **Yerli:** Teknokontrol, Tekniker
  - Maliyet: ~30.000 - 45.000 TL/adet
  - Yerli üretim, uygun fiyat

---

## 📡 VERİ TOPLAMA

### Çıkış Sinyalleri

Kalorimetreler şu protokollerle veri verir:
- **Modbus RTU:** Seri iletişim (RS485)
- **Modbus TCP/IP:** Ethernet üzerinden
- **4-20 mA:** Analog sinyal (opsiyonel)

### Okunan Değerler

Her kalorimetreden şu değerler okunur:
1. **Akış (Flow):** L/min veya m³/h
2. **Giriş Sıcaklığı (T_in):** °C
3. **Çıkış Sıcaklığı (T_out):** °C
4. **Sıcaklık Farkı (ΔT):** °C
5. **Güç (Power):** kW ⭐
6. **Enerji (Energy):** kWh ⭐

**⭐ İşaretli değerler:** Direkt enerji değerleri, hesaplama gerekmez!

### Veri Toplama Periyodu

- **Anlık Ölçüm:** Her 1-5 saniye
- **Kayıt Periyodu:** Her 1 dakika (ortalama değerler)
- **Raporlama:** Günlük, haftalık, aylık

---

## ✅ SONUÇ

### Kalorimetre Çözümü Neden Öneriliyor?

1. ✅ **Tek cihaz:** 1 kalorimetre = 1 akış ölçer + 2 sıcaklık sensörü
2. ✅ **Direkt enerji:** kW ve kWh değerleri hazır
3. ✅ **Yüksek hassasiyet:** %0.5-1% (akış ölçerden daha hassas)
4. ✅ **Daha az montaj:** 5 nokta vs 15 nokta
5. ✅ **Daha az kablolama:** Tek cihaz, tek bağlantı
6. ✅ **Entegre çözüm:** Daha az arıza riski
7. ✅ **Hesaplama hatası yok:** Cihaz içinde hesaplanır

### Ne Zaman Ayrı Sensörler Tercih Edilmeli?

- Bütçe çok kısıtlıysa
- Mevcut sistemde zaten akış ölçerler varsa
- Esnek konfigürasyon gerekiyorsa

---

## 📞 SONRAKİ ADIMLAR

1. **Teknik Onay:** Kalorimetre çözümünün teknik ekip tarafından değerlendirilmesi
2. **Tedarikçi Görüşmesi:** Kalorimetre tedarikçileri ile görüşme
3. **Teklif Alma:** Farklı markalar için teklif alma
4. **Pilot Uygulama:** 1 makine için pilot uygulama
5. **Tam Kurulum:** Başarılı pilot sonrası kalan 4 makine

---

**Hazırlanma Tarihi:** 2025-01-27  
**Versiyon:** 1.0

