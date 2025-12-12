# Web Push Notification Kurulum Rehberi

## Firebase Console Kurulumu

### 1. Firebase Console'da Web App Ekleme

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. Projenizi seçin
3. Project Settings > General sekmesine gidin
4. "Your apps" bölümünde "Add app" > "Web" (</> ikonu) seçin
5. App nickname girin (örn: "EGEM Dashboard Web")
6. "Register app" butonuna tıklayın
7. Firebase config değerlerini kopyalayın

### 2. VAPID Key Oluşturma

1. Firebase Console > Project Settings > Cloud Messaging sekmesine gidin
2. "Web Push certificates" bölümüne gidin
3. "Generate key pair" butonuna tıklayın
4. Oluşturulan key'i kopyalayın (bu VAPID key olacak)

### 3. Environment Variables Ayarlama

`.env` dosyası oluşturun (`.env.example` dosyasını kopyalayarak):

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
```

### 4. Service Worker Dosyasını Güncelleme

`public/firebase-messaging-sw.js` dosyasındaki Firebase config değerlerini güncelleyin:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  // ... diğer değerler
};
```

**Not:** Service worker dosyası environment variable'ları okuyamaz, bu yüzden manuel olarak güncellemeniz gerekir.

### 5. Package Kurulumu

```bash
npm install firebase
```

### 6. Manifest.json Güncelleme

`public/manifest.json` dosyasına `gcm_sender_id` eklendi (Firebase Messaging Sender ID).

### 7. Kullanım

Push notification sistemi otomatik olarak çalışır:

1. **Kullanıcı giriş yaptığında**: FCM token otomatik olarak alınır ve backend'e kaydedilir
2. **Bildirim izni**: İlk kullanımda kullanıcıdan bildirim izni istenir
3. **Foreground bildirimler**: Uygulama açıkken bildirimler gösterilir
4. **Background bildirimler**: Uygulama kapalıyken veya arka plandayken bildirimler gösterilir

### 8. Test Etme

1. Uygulamayı çalıştırın: `npm run dev`
2. Giriş yapın
3. Bildirim izni verin (tarayıcıdan isteyecek)
4. Test arıza bildirimi oluşturun
5. Push notification'ın geldiğini kontrol edin

### 9. PWA (Progressive Web App) Olarak Yükleme

1. Chrome'da uygulamayı açın
2. Adres çubuğundaki "Install" ikonuna tıklayın
3. Veya menüden "Add to Home Screen" seçin
4. Uygulama ana ekrana eklenecek
5. Push notification'lar PWA'da da çalışır

### 10. Sorun Giderme

#### Bildirim izni verilmiyor
- Tarayıcı ayarlarından site izinlerini kontrol edin
- HTTPS veya localhost kullanın (HTTP'de çalışmaz)

#### Service Worker kaydedilemiyor
- `firebase-messaging-sw.js` dosyasının `public` klasöründe olduğundan emin olun
- Build sonrası `dist` klasöründe de olmalı

#### Token alınamıyor
- VAPID key'in doğru olduğundan emin olun
- Firebase config değerlerini kontrol edin
- Browser console'da hataları kontrol edin

#### Bildirimler gelmiyor
- Backend'de Firebase Server Key'in doğru olduğundan emin olun
- Device token'ın backend'e kaydedildiğini kontrol edin
- Browser console'da hataları kontrol edin

### 11. Desteklenen Tarayıcılar

- Chrome (Desktop & Mobile)
- Firefox (Desktop & Mobile)
- Edge
- Safari (iOS 16.4+)
- Opera

### 12. Önemli Notlar

- **HTTPS Gereklidir**: Production'da HTTPS kullanılmalı (localhost hariç)
- **Service Worker**: Push notification için service worker zorunludur
- **VAPID Key**: Her proje için benzersiz bir VAPID key gereklidir
- **Token Yenileme**: FCM token'lar bazen yenilenir, sistem otomatik olarak günceller

### 13. Bildirim Tipleri

Sistem şu durumlarda push notification gönderir:

1. **Yeni Arıza Bildirimi**: Bakım personeline yeni arıza bildirimi geldiğinde
2. **Bakım Hatırlatması**: Planlanan bakım tarihi yaklaştığında (30, 15, 3 gün kala)

### 14. Bildirim İçeriği

Bildirimler şu bilgileri içerir:
- **Başlık**: Bildirim başlığı
- **İçerik**: Bildirim mesajı
- **İkon**: Logo ikonu
- **Tıklama**: Bildirime tıklandığında ilgili sayfaya yönlendirir

