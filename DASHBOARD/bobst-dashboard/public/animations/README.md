# Robot Arm Animation - Lottie JSON

Bu klasöre Lottie JSON animasyon dosyasını ekleyin.

## Nasıl Kullanılır?

1. **LottieFiles'den Robot Kol Animasyonu İndirin:**
   - https://lottiefiles.com/ adresine gidin
   - Arama kutusuna "robot arm" veya "industrial robot" yazın
   - Beğendiğiniz animasyonu seçin
   - "Download" butonuna tıklayın
   - "Lottie JSON" formatını seçin
   - Dosyayı indirin

2. **Dosyayı Bu Klasöre Ekleyin:**
   - İndirdiğiniz JSON dosyasını `robot-arm.json` olarak kaydedin
   - Bu klasöre (`public/animations/`) kopyalayın

3. **Önerilen Animasyonlar:**
   - "Industrial Robot Arm" - Endüstriyel robot kol
   - "Robot Arm Animation" - Genel robot kol
   - "KUKA Robot" - KUKA robot kol animasyonu
   - "Palletizing Robot" - Paletleme robotu

## Dosya Yapısı

```
public/
  animations/
    robot-arm.json  ← Buraya JSON dosyasını ekleyin
    README.md       ← Bu dosya
```

## Notlar

- Dosya adı `robot-arm.json` olmalı (kod bu ismi bekliyor)
- JSON dosyası geçerli bir Lottie formatında olmalı
- Eğer dosya yoksa, fallback olarak basit bir SVG ikon gösterilir
- Animasyon otomatik olarak loop (döngü) modunda çalışır

## Örnek LottieFiles Linkleri

- https://lottiefiles.com/search?q=robot+arm
- https://lottiefiles.com/search?q=industrial+robot
- https://lottiefiles.com/search?q=kuka+robot

