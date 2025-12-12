# Kızgın Yağ Sistemi - Makine Bazlı Enerji Tüketim Ölçüm Projesi

## 📋 PROJE ÖZETİ

Bu proje, 5 adet makine fırınını ısıtan kızgın yağ sisteminde, her makine için ayrı enerji tüketim ölçümü yapılmasını amaçlamaktadır. Böylece fatura geldiğinde hangi makinenin ne kadar tüketim yaptığı görülebilecek.

### Mevcut Durum
- 1 adet kızgın yağ kazanı (doğalgazlı brülör)
- 5 adet makine fırını ısıtılıyor
- Sadece toplam doğalgaz faturası görülüyor

### Hedef
- Her makine için ayrı kızgın yağ enerji tüketim ölçümü
- Makine bazlı raporlama
- İş bazlı tüketim analizi

---

## 📁 DOKÜMANTASYON

### 1. [PROJE_DOKUMANI.md](PROJE_DOKUMANI.md)
Ana proje dokümantasyonu. İçerik:
- Sistem mimarisi analizi
- Sensör seçimi ve teknik özellikler
- Enerji hesaplama yöntemi
- Veri toplama sistemi mimarisi
- Veritabanı yapısı
- Maliyet analizi
- Doğrulama ve kalibrasyon

### 2. [SENSOR_LISTESI.md](SENSOR_LISTESI.md)
Detaylı sensör listesi ve teknik özellikler:
- Akış ölçerler (5 adet)
- Sıcaklık sensörleri (10 adet)
- Veri toplama cihazı
- Kablolama ve aksesuarlar
- Maliyet özeti

### 3. [KURULUM_PLANI.md](KURULUM_PLANI.md)
Kurulum planı ve kontrol listesi:
- Proje fazları
- Kurulum adımları
- Test ve doğrulama
- Risk yönetimi
- Bakım planı

---

## 🎯 ÖNERİLEN ÇÖZÜM

### Sensör Konfigürasyonu (ÖNERİLEN) ⭐

**Kalorimetre Çözümü:**
**Her Makine İçin:**
- 1 adet Kalorimetre (Heat Meter)
  - İçerik: Akış ölçer + 2 sıcaklık sensörü (entegre)
  - Direkt çıkış: Güç (kW) ve Enerji (kWh)

**Toplam:**
- 5 adet Kalorimetre
- 1 adet PLC/Data Logger

**Avantajlar:**
- Direkt enerji çıkışı (hesaplama gerekmez)
- Daha az montaj noktası
- Daha az kablolama
- Yüksek hassasiyet

### Alternatif: Ayrı Sensör Çözümü

**Her Makine İçin:**
- 1 adet Vortex Akış Ölçer (giriş hattı)
- 1 adet PT100 Sıcaklık Sensörü (giriş)
- 1 adet PT100 Sıcaklık Sensörü (çıkış)

**Toplam:**
- 5 adet Akış Ölçer
- 10 adet Sıcaklık Sensörü

**Enerji Hesaplama (Ayrı Sensörler İçin):**
```
Enerji (kWh) = Akış (kg/h) × Özgül Isı (kJ/kg·K) × Sıcaklık Farkı (K) / 3600
```

---

## 💰 MALİYET TAHMİNİ

### SEÇENEK 1: Kalorimetre Çözümü (ÖNERİLEN) ⭐

| Kategori | Maliyet (TL) |
|----------|--------------|
| Kalorimetreler (5 adet) | 250.000 |
| Veri Toplama ve Altyapı | 50.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **330.000** |

### SEÇENEK 2: Ayrı Sensör Çözümü

| Kategori | Maliyet (TL) |
|----------|--------------|
| Sensörler (15 adet) | 165.000 |
| Veri Toplama ve Altyapı | 45.000 |
| Yazılım Geliştirme | 30.000 |
| **TOPLAM** | **240.000** |

*Fiyatlar yaklaşık değerlerdir. Marka ve model seçimine göre değişebilir. Ekonomik segment kalorimetrelerle maliyet ~250.000 TL'ye düşebilir.*

---

## ⏱️ SÜRE TAHMİNİ

| Faz | Süre |
|-----|------|
| Hazırlık ve Planlama | 1-2 hafta |
| Pilot Uygulama (1 makine) | 2-3 hafta |
| Tam Kurulum (4 makine) | 3-4 hafta |
| Raporlama ve Optimizasyon | 2-3 hafta |
| **TOPLAM** | **8-12 hafta (2-3 ay)** |

---

## 📏 BORU ÇAPI UYUMU

### 2 İnç ve 4 İnç Borular İçin

✅ **2 inç (DN50):** Kalorimetreler standart olarak mevcuttur  
✅ **4 inç (DN100):** Kalorimetreler standart olarak mevcuttur  

**Detaylı bilgi için:** [BORU_CAPI_BILGILERI.md](BORU_CAPI_BILGILERI.md)

---

## 📊 ÖLÇÜM NOKTALARI

```
[Kazan] → [Ana Hat] → [Makine 1] → [Akış Ölçer + Sıcaklık] → [Fırın] → [Sıcaklık] → [Dönüş]
                              ↓
                         [Makine 2] → [Akış Ölçer + Sıcaklık] → [Fırın] → [Sıcaklık] → [Dönüş]
                              ↓
                         [Makine 3-5] → ...
```

---

## 🔧 SONRAKİ ADIMLAR

1. **Teknik Onay:** Proje dokümantasyonunun teknik ekip tarafından gözden geçirilmesi
2. **Bütçe Onayı:** Maliyet analizinin yönetim tarafından onaylanması
3. **Tedarikçi Seçimi:** Sensör ve cihaz tedarikçilerinin belirlenmesi
4. **Kurulum Planı:** Detaylı kurulum takvimi oluşturulması
5. **Yazılım Geliştirme:** Veri toplama ve raporlama yazılımı geliştirilmesi

---

## ❓ SIK SORULAN SORULAR

### Neden kalorimetre öneriliyor?
Kalorimetre, akış ölçer + 2 sıcaklık sensörünü tek cihazda birleştirir ve direkt enerji (kW/kWh) değeri verir. Hesaplama gerekmez, daha az montaj noktası ve daha yüksek hassasiyet sağlar.

### Sadece sıcaklık ölçümü yeterli olmaz mı?
Hayır. Akış hızı bilinmeden enerji hesaplanamaz. Sadece sıcaklık farkı, akış olmadan anlamsızdır.

### Doğalgaz tüketimi ile nasıl ilişkilendireceğiz?
Kızgın yağ enerji tüketimi (kWh) × kazan verimliliği = Doğalgaz enerji eşdeğeri. Kazan verimliliği %80-90 arası olabilir.

### İş bazlı tüketim nasıl takip edilecek?
Makine üzerindeki iş bilgisi (job bilgisi) ile enerji tüketimi eşleştirilerek. Mevcut sisteminizde iş takibi varsa entegre edilebilir.

---

## 📞 İLETİŞİM VE DESTEK

Proje hakkında sorularınız için:
- Teknik dokümantasyon: [PROJE_DOKUMANI.md](PROJE_DOKUMANI.md)
- Sensör detayları: [SENSOR_LISTESI.md](SENSOR_LISTESI.md)
- Kurulum planı: [KURULUM_PLANI.md](KURULUM_PLANI.md)

---

**Proje Durumu:** 🟡 Planlama Aşaması  
**Son Güncelleme:** 2025-01-27  
**Versiyon:** 1.0

