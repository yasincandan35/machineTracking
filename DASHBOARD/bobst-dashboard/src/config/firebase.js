// Firebase configuration
// Bu dosyayı Firebase Console'dan alacağınız config ile doldurun
// Firebase Console > Project Settings > General > Your apps > Web app

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config - Firebase Console'dan alınacak
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBsJn4rmrUeUc--sO-xF9pByQTOGecigfM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dashboard-e8926.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dashboard-e8926",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dashboard-e8926.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1004146268508",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1004146268508:web:5f526caefc01277cd90999",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-K64EMDW60L"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Messaging instance (sadece browser'da çalışır)
let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging başlatılamadı:', error);
  }
}

// FCM token alma
export const getFCMToken = async () => {
  if (!messaging) {
    console.warn('Firebase Messaging mevcut değil');
    return null;
  }

  try {
    // VAPID key - Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BJ9nNMC4zKX8LhfkLmsyz5cqV7Mkrx05zmTqvDXOQZQFeFiT_qHC9-fCWrftpQ2QSNfKGBZ74xeoqiqCk3E8ZGk";
    
    const currentToken = await getToken(messaging, { vapidKey });
    
    if (currentToken) {
      console.log('FCM Token:', currentToken);
      return currentToken;
    } else {
      console.warn('FCM token alınamadı. Notification izni verilmemiş olabilir.');
      return null;
    }
  } catch (error) {
    console.error('FCM token alma hatası:', error);
    return null;
  }
};

// Foreground mesajları dinle (uygulama açıkken)
// Bu fonksiyon sürekli dinleme yapar, Promise döndürmez
export const setupForegroundMessageListener = (callback) => {
  if (!messaging) {
    console.warn('Firebase Messaging mevcut değil, foreground listener kurulamadı');
    return null;
  }

  // onMessage sürekli dinleme yapar, bir kez kurulur
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('Foreground mesaj alındı:', payload);
    if (callback) {
      callback(payload);
    }
  });

  return unsubscribe; // Cleanup için unsubscribe fonksiyonunu döndür
};

export { messaging };
export default app;

