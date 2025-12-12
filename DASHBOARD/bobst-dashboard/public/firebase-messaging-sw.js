// Firebase Cloud Messaging Service Worker
// Bu dosya public klasöründe olmalı (root seviyesinde)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase config - Aynı config'i buraya da ekleyin
const firebaseConfig = {
  apiKey: "AIzaSyBsJn4rmrUeUc--sO-xF9pByQTOGecigfM",
  authDomain: "dashboard-e8926.firebaseapp.com",
  projectId: "dashboard-e8926",
  storageBucket: "dashboard-e8926.firebasestorage.app",
  messagingSenderId: "1004146268508",
  appId: "1:1004146268508:web:5f526caefc01277cd90999",
  measurementId: "G-K64EMDW60L"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);

// Messaging instance
const messaging = firebase.messaging();

// Background mesajları dinle (uygulama kapalıyken veya arka plandayken)
// NOT: Eğer uygulama foreground'da ise, bu fonksiyon çalışmaz, onMessage çalışır
messaging.onBackgroundMessage((payload) => {
  // Backend'den sadece Data gönderiliyor, Notification payload yok
  // Firebase Data payload'ı string olarak gelir, bu yüzden doğrudan erişebiliriz
  // Data'dan title ve body'yi al
  const data = payload.data || {};
  const notificationTitle = payload.notification?.title || data.title || data.Title || 'Yeni Bildirim';
  const notificationBody = payload.notification?.body || data.body || data.Body || '';
  const tag = data.type || data.Type || 'default';
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/logo.png', // Bildirim ikonu
    badge: '/logo.png',
    tag: tag, // Aynı tag ile önceki bildirimi kapat (çift bildirim olmasın)
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
    renotify: false
  };

  // Bildirimi göster
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Bildirime tıklandığında
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Bildirim tipine göre yönlendirme
  const data = event.notification.data;
  let url = '/';

  if (data?.type === 'maintenance_request') {
    url = '/maintenance';
  } else if (data?.type === 'maintenance_reminder') {
    url = '/maintenance';
  }

  // Uygulamayı aç
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Eğer uygulama zaten açıksa, o pencereyi focus et
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Eğer uygulama açık değilse, yeni pencere aç
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

