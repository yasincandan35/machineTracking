# Push Notification Sistemi - Kurulum Rehberi

## Firebase Cloud Messaging (FCM) Kurulumu

### 1. Firebase Console'da Proje Oluşturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin
2. Yeni bir proje oluşturun veya mevcut projeyi seçin
3. Proje ayarlarına gidin

### 2. Firebase Server Key Alma

1. Firebase Console > Project Settings > Cloud Messaging
2. "Server key" veya "Legacy server key" değerini kopyalayın
3. Bu key'i backend'e ekleyin:

**appsettings.json'a ekleyin:**
```json
{
  "Firebase": {
    "ServerKey": "YOUR_FIREBASE_SERVER_KEY_BURAYA"
  }
}
```

**VEYA environment variable olarak:**
```bash
set FIREBASE_SERVER_KEY=YOUR_FIREBASE_SERVER_KEY_BURAYA
```

### 3. Veritabanı Tablosu Oluşturma

`SQL_CREATE_DEVICE_TOKENS_TABLE.sql` script'ini çalıştırın:
```sql
-- SQL Server Management Studio'da veya Azure Data Studio'da çalıştırın
```

### 4. Backend Servisleri

Backend'de aşağıdaki servisler otomatik olarak kayıtlı:
- `PushNotificationService` - FCM ile push notification gönderimi
- `DeviceToken` modeli - Cihaz token'larını saklama

### 5. API Endpoint'leri

#### Device Token Kaydetme
```
POST /api/maintenance/device-token
Authorization: Bearer {token}
Content-Type: application/json

{
  "token": "FCM_DEVICE_TOKEN",
  "platform": "ios" | "android" | "web",
  "deviceName": "iPhone 13 Pro" (opsiyonel),
  "appVersion": "1.0.0" (opsiyonel)
}
```

### 6. Mobil Uygulama Entegrasyonu

#### iOS (Swift)
```swift
import FirebaseMessaging

// FCM token al
Messaging.messaging().token { token, error in
  if let error = error {
    print("Error fetching FCM registration token: \(error)")
  } else if let token = token {
    print("FCM registration token: \(token)")
    // Backend'e gönder
    registerDeviceToken(token: token, platform: "ios")
  }
}

func registerDeviceToken(token: String, platform: String) {
  // API call to /api/maintenance/device-token
}
```

#### Android (Kotlin)
```kotlin
import com.google.firebase.messaging.FirebaseMessaging

// FCM token al
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (!task.isSuccessful) {
        Log.w(TAG, "Fetching FCM registration token failed", task.exception)
        return@addOnCompleteListener
    }

    // Get new FCM registration token
    val token = task.result
    Log.d(TAG, "FCM registration token: $token")
    
    // Backend'e gönder
    registerDeviceToken(token, "android")
}

fun registerDeviceToken(token: String, platform: String) {
    // API call to /api/maintenance/device-token
}
```

### 7. Otomatik Bildirimler

Sistem otomatik olarak şu durumlarda push notification gönderir:

1. **Yeni Arıza Bildirimi**: Bakım personeline yeni arıza bildirimi geldiğinde
2. **Bakım Hatırlatması**: Planlanan bakım tarihi yaklaştığında (30, 15, 3 gün kala)

### 8. Bildirim Tipleri

#### Arıza Bildirimi
```json
{
  "type": "maintenance_request",
  "requestId": "123",
  "machineName": "Bobst Lemanic 3",
  "faultType": "Elektrik Arızası",
  "description": "Arıza açıklaması"
}
```

#### Bakım Hatırlatması
```json
{
  "type": "maintenance_reminder",
  "machineName": "Bobst Lemanic 3",
  "maintenanceType": "Periyodik Bakım",
  "startDate": "2025-01-15T08:00:00",
  "daysUntil": "3"
}
```

### 9. Test Etme

1. Mobil uygulamada device token'ı alın
2. Backend'e token'ı kaydedin
3. Test arıza bildirimi oluşturun
4. Push notification'ın geldiğini kontrol edin

### 10. Sorun Giderme

- **Token kaydedilmiyor**: Backend loglarını kontrol edin
- **Bildirim gelmiyor**: 
  - Firebase Server Key'in doğru olduğundan emin olun
  - Device token'ın aktif olduğunu kontrol edin
  - FCM console'da test bildirimi gönderin
- **Sadece bazı cihazlara geliyor**: Platform kontrolü yapın (ios/android)

### Notlar

- Firebase Server Key güvenli tutulmalıdır
- Device token'lar otomatik olarak güncellenir (aynı token tekrar kaydedilirse)
- Geçersiz token'lar otomatik olarak pasif yapılır
- Her kullanıcının birden fazla cihazı olabilir (her cihaz için ayrı token)

