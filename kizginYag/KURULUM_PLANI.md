# Kızgın Yağ Sistemi - Kurulum Planı ve Kontrol Listesi

## PROJE FAZLARI

### FAZ 1: HAZIRLIK VE PLANLAMA (1-2 Hafta)

#### 1.1. Teknik Hazırlık
- [ ] Fiziksel ölçümler (hat çapı, basınç, sıcaklık)
- [ ] P&ID (Piping & Instrumentation Diagram) hazırlama
- [ ] Elektrik şeması hazırlama
- [ ] Montaj planı hazırlama
- [ ] Kablolama planı hazırlama

#### 1.2. Tedarik
- [ ] Sensör tedarikçisi seçimi
- [ ] PLC/Data Logger tedarikçisi seçimi
- [ ] Teklif alma ve değerlendirme
- [ ] Sipariş verme
- [ ] Teslimat takibi

#### 1.3. İzinler ve Onaylar
- [ ] Üretim müdürlüğü onayı
- [ ] Bakım müdürlüğü onayı
- [ ] İSG (İş Sağlığı ve Güvenliği) onayı
- [ ] Bütçe onayı

---

### FAZ 2: PILOT UYGULAMA - 1 MAKİNE (2-3 Hafta)

#### 2.1. Kurulum Öncesi
- [ ] Sistem durdurma planı (üretim etkilenmemeli)
- [ ] Montaj ekibi hazırlığı
- [ ] Malzeme kontrolü (1 makine için)
- [ ] Güvenlik önlemleri

#### 2.2. Fiziksel Kurulum
- [ ] Makine 1 giriş hattına akış ölçer montajı
- [ ] Makine 1 giriş sıcaklık sensörü montajı
- [ ] Makine 1 çıkış sıcaklık sensörü montajı
- [ ] Kablolama (sinyal + güç)
- [ ] Junction box montajı

#### 2.3. Elektrik Bağlantıları
- [ ] Sensörlerden PLC'ye sinyal kablosu bağlantısı
- [ ] 24V DC güç kaynağı bağlantısı
- [ ] Topraklama bağlantıları
- [ ] Güvenlik testleri

#### 2.4. PLC Programlama ve Konfigürasyon
- [ ] PLC konfigürasyonu
- [ ] Modbus adresleri atama
- [ ] Ölçüm periyodu ayarlama
- [ ] Test okumaları

#### 2.5. Yazılım Geliştirme (Temel)
- [ ] Veri okuma yazılımı (PLC'den)
- [ ] Veritabanı tabloları oluşturma
- [ ] Veri kaydetme yazılımı
- [ ] Temel görselleştirme

#### 2.6. Test ve Doğrulama
- [ ] Sensör okumaları testi
- [ ] Veri akışı testi
- [ ] Hesaplama doğruluğu testi
- [ ] 1 hafta sürekli çalışma testi
- [ ] Sonuçların değerlendirilmesi

**Başarı Kriterleri:**
- Tüm sensörler düzgün çalışıyor
- Veri kaybı yok
- Hesaplama doğruluğu %5 içinde
- Sistem stabil çalışıyor

---

### FAZ 3: TAM KURULUM - KALAN 4 MAKİNE (3-4 Hafta)

#### 3.1. Kurulum (Her Makine İçin Tekrarlanacak)
- [ ] Makine X giriş hattına akış ölçer montajı
- [ ] Makine X giriş sıcaklık sensörü montajı
- [ ] Makine X çıkış sıcaklık sensörü montajı
- [ ] Kablolama
- [ ] PLC'ye bağlantı

#### 3.2. Sistem Entegrasyonu
- [ ] Tüm sensörlerin PLC'de tanımlanması
- [ ] Modbus adreslerinin atanması
- [ ] Yazılım güncellemesi (tüm makineler için)
- [ ] Veritabanı güncellemesi

#### 3.3. Toplam Doğrulama
- [ ] 5 makine toplam tüketimi hesaplama
- [ ] Kazan çıkış akışı ile karşılaştırma (varsa)
- [ ] Tolerans kontrolü (%5-10 kabul edilebilir)
- [ ] Hata analizi ve düzeltme

---

### FAZ 4: RAPORLAMA VE OPTİMİZASYON (2-3 Hafta)

#### 4.1. Dashboard Geliştirme
- [ ] Anlık ölçüm görüntüleme
- [ ] Makine bazlı tüketim grafikleri
- [ ] Tarihsel veri görüntüleme
- [ ] Karşılaştırma grafikleri

#### 4.2. Raporlama Sistemi
- [ ] Günlük tüketim raporu
- [ ] Haftalık tüketim raporu
- [ ] Aylık tüketim raporu (fatura dönemi)
- [ ] Makine bazlı karşılaştırma raporu
- [ ] PDF/Excel export özelliği

#### 4.3. Alarm ve Uyarı Sistemi
- [ ] Sensör hata alarmları
- [ ] Anormal tüketim uyarıları
- [ ] Sıcaklık farkı düşük uyarısı
- [ ] E-posta/SMS bildirimleri (opsiyonel)

#### 4.4. İş Bazlı Tüketim (Opsiyonel)
- [ ] Makine iş bilgisi entegrasyonu
- [ ] İş bazlı tüketim hesaplama
- [ ] İş bazlı raporlama

---

## KURULUM KONTROL LİSTESİ

### Fiziksel Kurulum
- [ ] Tüm sensörler montajlandı
- [ ] Flanş bağlantıları sızdırmaz
- [ ] Termowell'ler doğru montajlandı
- [ ] Kablolama düzgün yapıldı
- [ ] Junction box'lar montajlandı
- [ ] Güç kaynağı montajlandı
- [ ] Topraklama yapıldı

### Elektrik Bağlantıları
- [ ] Tüm sinyal kabloları bağlandı
- [ ] Güç kabloları bağlandı
- [ ] Modbus bağlantıları yapıldı
- [ ] Ethernet bağlantısı yapıldı
- [ ] Güvenlik testleri geçti

### Yazılım ve Konfigürasyon
- [ ] PLC programlandı
- [ ] Modbus adresleri atandı
- [ ] Veritabanı tabloları oluşturuldu
- [ ] Veri okuma yazılımı çalışıyor
- [ ] Veri kaydetme çalışıyor
- [ ] Dashboard çalışıyor

### Test ve Doğrulama
- [ ] Tüm sensörler okunuyor
- [ ] Veri kaybı yok
- [ ] Hesaplama doğru
- [ ] Toplam kontrol geçti
- [ ] Sistem stabil çalışıyor

---

## RİSK YÖNETİMİ

### Potansiyel Riskler

| Risk | Etki | Olasılık | Önlem |
|------|------|----------|-------|
| Sensör arızası | Yüksek | Orta | Yedek sensör bulundurma, hızlı tedarik |
| Veri kaybı | Orta | Düşük | Yedekli veri toplama, offline kayıt |
| Kurulum sırasında üretim durması | Yüksek | Düşük | Planlı durdurma, hızlı kurulum |
| Hesaplama hatası | Orta | Düşük | Test ve doğrulama, kalibrasyon |
| Bütçe aşımı | Orta | Orta | Detaylı teklif alma, yedek bütçe |

---

## SÜRE TAHMİNİ

| Faz | Süre | Açıklama |
|-----|------|----------|
| Faz 1: Hazırlık | 1-2 hafta | Planlama ve tedarik |
| Faz 2: Pilot (1 makine) | 2-3 hafta | Kurulum ve test |
| Faz 3: Tam kurulum (4 makine) | 3-4 hafta | Kalan makineler |
| Faz 4: Raporlama | 2-3 hafta | Yazılım geliştirme |
| **TOPLAM** | **8-12 hafta** | **2-3 ay** |

---

## KALİBRASYON PLANI

### İlk Kurulum
- [ ] Tüm akış ölçerler kalibre edildi
- [ ] Tüm sıcaklık sensörleri kalibre edildi
- [ ] Kalibrasyon sertifikaları alındı

### Periyodik Kalibrasyon
- [ ] Yıllık kalibrasyon planı
- [ ] Kalibrasyon takvimi oluşturuldu
- [ ] Kalibrasyon kayıtları tutulacak

---

## BAKIM PLANI

### Günlük
- [ ] Veri akışı kontrolü
- [ ] Alarm kontrolü
- [ ] Anormal değer kontrolü

### Haftalık
- [ ] Sensör değerlerinin mantıklılık kontrolü
- [ ] Veritabanı boyutu kontrolü
- [ ] Sistem performans kontrolü

### Aylık
- [ ] Fiziksel kontrol (sensörler, kablolar)
- [ ] Temizlik
- [ ] Bağlantı kontrolü

### Yıllık
- [ ] Profesyonel kalibrasyon
- [ ] Sistem bakımı
- [ ] Yazılım güncellemeleri

---

**Hazırlanma Tarihi:** 2025-01-27  
**Versiyon:** 1.0

