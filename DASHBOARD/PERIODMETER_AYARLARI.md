# PeriodMeter Ayarları - Makine Dururken Ters Dönüş ve Hız Artışı Sorunu

## Sorun
Makine dururken ters yönde dönüyor ve hızda çılgın bir artış oluyor.

## Neden
PeriodMeter, iki pulse arasındaki süreyi (period) ölçer. Makine durduğunda:
- Pulse gelmez veya çok seyrek gelir
- Period çok büyük olur (veya timeout olur)
- Eğer period çok küçük değerler alırsa (noise/bounce), hız = 1/period formülü nedeniyle hız çok büyük görünür
- Negatif period değerleri ters yönde dönüş olarak algılanabilir

## Çözüm - Machine Expert'te Yapılacak Ayarlar

### 1. Timeout Ayarı (ÖNEMLİ!)
**Mevcut:** 0 (timeout yok)  
**Önerilen:** 1000-5000 ms

**Nasıl Ayarlanır:**
- PeriodMeter_0 → Range → Timeout
- Değeri **1000** veya **5000** ms yapın
- Bu, makine durduğunda period ölçümünün maksimum süresini sınırlar

### 2. Bounce Filter Ayarı (ÖNEMLİ!)
**Mevcut:** 0.001 ms (çok düşük)  
**Önerilen:** 0.5-2 ms

**Nasıl Ayarlanır:**
- PeriodMeter_0 → Counting inputs → A input → Bounce filter
- Değeri **0.5** veya **2** ms yapın
- Bu, gürültüden kaynaklı yanlış pulse'ları filtreler

### 3. Resolution Ayarı
**Mevcut:** 1 µs (çok hassas)  
**Önerilen:** 10-100 µs (makine hızına göre)

**Nasıl Ayarlanır:**
- PeriodMeter_0 → Range → Resolution
- Değeri **10** veya **100** µs yapın
- Çok hassas resolution gürültüyü artırabilir

### 4. PeriodMeter Mode Ayarı
**Mevcut:** Edge to Edge  
**Kontrol Edin:** Bu ayar doğru mu?

**Seçenekler:**
- **Edge to Edge:** Tek pulse genişliğini ölçer
- **Start to Stop:** İki ayrı pulse arasındaki süreyi ölçer

### 5. EN Input (Enable Input) - EN İYİ ÇÖZÜM! ✅
**Mevcut:** Disabled  
**Önerilen:** Makine çalışma durumuna bağlı bir input kullanın

**Makine Çalışıyor Sinyalini Bulma:**

1. **Kodda Bulunan Bilgi:**
   - Backend kodunda `machineStatus` sinyali kullanılıyor
   - Bu sinyalin bit 0'ı (0x0001) makine durumunu gösteriyor
   - Yorumda "Register 30" yazıyor ama bu veritabanı konfigürasyonunda farklı olabilir

2. **Veritabanında Kontrol:**
   - `PLCDataDefinitions` tablosunda `machineStatus` veya `machineStopped` için register adresini kontrol edin
   - SQL sorgusu:
   ```sql
   SELECT Name, RegisterAddress, DataType 
   FROM PLCDataDefinitions 
   WHERE Name LIKE '%machineStatus%' OR Name LIKE '%machineStopped%'
   ```

3. **Machine Expert'te Kontrol:**
   - Machine Expert'te makine çalışma durumunu gösteren bir output veya memory bit bulun
   - Bu genellikle:
     - Bir output bit (örn: Q0.0, Q1.5)
     - Bir memory bit (örn: M0.0, M1.2)
     - Bir register'in bit'i (örn: Register 30, bit 0)

4. **EN Input'a Bağlama:**
   - PeriodMeter_0 → Control inputs → EN input → Location
   - Bulduğunuz makine çalışıyor sinyalini seçin
   - **ÖNEMLİ:** Sinyal **invert** edilmiş olabilir (makine durduğunda 1, çalıştığında 0)
   - Eğer invert edilmişse, Machine Expert'te invert seçeneğini kullanın veya ters sinyali seçin

**Nasıl Test Edilir:**
- Makine durduğunda: EN input = 0 → PeriodMeter çalışmaz → Hız = 0
- Makine çalıştığında: EN input = 1 → PeriodMeter çalışır → Hız ölçülür

**Avantajları:**
- Makine durduğunda period ölçümü tamamen durur
- Gürültüden kaynaklı yanlış ölçümler olmaz
- Timeout ayarına gerek kalmaz (ama yine de önerilir)

## Önerilen Ayar Değerleri

```
PeriodMeter_0:
├── Range
│   ├── Resolution: 10 µs (veya 100 µs)
│   └── Timeout: 2000 ms (2 saniye)
├── Counting inputs
│   └── A input
│       └── Bounce filter: 1 ms
└── Control inputs
    └── EN input
        └── Location: Makine çalışma durumu input'u
```

## Test
1. Ayarları yaptıktan sonra Machine Expert'i kaydedin
2. PLC'yi yeniden başlatın
3. Makineyi durdurun ve hız değerini kontrol edin
4. Hız 0 veya çok düşük bir değer olmalı
5. Makineyi çalıştırın ve hız değerini kontrol edin
6. Hız normal aralıkta olmalı

## Notlar
- Timeout değeri, makinenin maksimum durma süresine göre ayarlanmalı
- Bounce filter, makine tipine ve sensör tipine göre ayarlanmalı
- Resolution, ölçülecek hız aralığına göre ayarlanmalı
- EN input kullanmak, makine durduğunda period ölçümünü tamamen durdurur (en iyi çözüm)

