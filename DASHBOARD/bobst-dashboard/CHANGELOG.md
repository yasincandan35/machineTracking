# Geliştirme Günlüğü - EGEM Makine Takip Sistemi

## 17.10.2025 - Job Passport DR Blade Açıları Otomatik Hesaplama

### 🎯 Yapılan İyileştirmeler

#### 1. DR Blade Açıları Otomatik Hesaplama Sistemi
- **Özellik:** İş pasaportunda silindir çevresi değerine göre otomatik DR Blade açıları hesaplama
- **Mantık:** 
  - Silindir çevresi null/0 ise silindir_cevre1-12 alanlarından ilk dolu değer alınıyor
  - Düşük değere yuvarlama mantığı (527.45 → 520)
  - Türkçe format desteği (virgül → nokta çevirimi)
- **Sonuç:** Her ünite kartının V ve H kutularına otomatik değer yazılıyor

#### 2. Backend Geliştirmeleri
- **DR Blade Tablosu:** Lemanic 1 makinası için F, V, H değerleri tablosu oluşturuldu
- **Hesaplama Fonksiyonu:** `get_dr_blade_angles()` fonksiyonu eklendi
- **Debug Logları:** Detaylı console logları eklendi
- **Veri İşleme:** `process_job_data()` fonksiyonu güncellendi

#### 3. Frontend Geliştirmeleri
- **UnitCard Güncelleme:** jobData prop'u eklendi
- **Otomatik Doldurma:** V ve H kutularına `defaultValue` eklendi
- **Console Logları:** Debug için console.log'lar eklendi
- **Genel Kart Temizliği:** DR Blade açıları genel kartından kaldırıldı

### 📁 Değiştirilen Dosyalar
- `DASHBOARD/bobst-dashboard/backend/job_passport_api.py`
  - DR Blade tablosu eklendi
  - `get_dr_blade_angles()` fonksiyonu eklendi
  - Virgül → nokta çevirimi eklendi
  - Debug logları eklendi
  
- `DASHBOARD/bobst-dashboard/src/components/JobPassport/JobPassportViewer.jsx`
  - UnitCard'a jobData prop'u eklendi
  - V ve H kutularına otomatik değer yazma eklendi
  - Genel kartından DR Blade açıları kaldırıldı
  - Console logları eklendi

### 🚀 Sonuç
- Silindir çevresi değerine göre otomatik DR Blade açıları hesaplanıyor
- Her ünite kartının V ve H kutularına otomatik değer yazılıyor
- Türkçe format desteği (virgül → nokta çevirimi) eklendi
- Debug logları ile sorun tespiti kolaylaştırıldı

---

## 13.10.2025 - Job Passport Vizkozite Düzeltmeleri

### 🎯 Yapılan İyileştirmeler

#### 1. Varnish Üniteleri için Vizkozite Değeri Düzeltmesi
- **Sorun:** Varnish (vernik) üniteleri için vizkozite değeri "-----" olarak geliyordu ve değiştirilemiyordu
- **Çözüm:** 
  - Varnish üniteleri için varsayılan değer olarak "25 sn / 20 C" tanımlandı
  - Vizkozite değeri boş veya "-----" ise otomatik olarak varsayılan değer atanıyor
  - Ok tuşları ile saniye ve derece değerleri artık düzgün çalışıyor

#### 2. Adjustment Fonksiyonları Güncelleme
- `adjustVizkoziteSeconds`: Varsayılan değer "25 sn / 20 C" olarak güncellendi
- `adjustVizkoziteTemperature`: Varsayılan değer "25 sn / 20 C" olarak güncellendi
- Mavi ok tuşları: Saniye değerini 0.5'er artırıp azaltıyor
- Kırmızı ok tuşları: Derece değerini 1'er artırıp azaltıyor

#### 3. Console Log Temizliği
- Gereksiz debug log'ları kaldırıldı
- Performans iyileştirmesi sağlandı
- Console çıktısı temizlendi

### 📁 Değiştirilen Dosyalar
- `DASHBOARD/bobst-dashboard/src/components/JobPassport/JobPassportViewer.jsx`
  - Varnish vizkozite kontrolü eklendi
  - Console.log'lar temizlendi
  
- `DASHBOARD/bobst-dashboard/src/components/JobPassport/utils/adjustments.js`
  - Varsayılan değerler güncellendi (25 sn / 20 C)

### 🚀 Sonuç
- Varnish üniteleri artık düzgün vizkozite değeri gösteriyor
- Ok tuşları ile değer değiştirme işlevi tam çalışıyor
- Console çıktısı temizlendi, performans arttı

---

## Önceki Güncellemeler

### 12.10.2025 - Genel İyileştirmeler
- Job Passport drag & drop özelliği
- Custom color picker implementasyonu
- Print functionality geliştirmeleri

### 11.10.2025 - Backend Entegrasyonu
- ASP.NET Core backend API geliştirmesi
- User preferences kayıt sistemi
- Machine selection persistence

---

**Not:** Bu proje EGEM Makine Takip Sistemi için geliştirilmektedir.

