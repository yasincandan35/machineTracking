import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { dashboardApi } from '../utils/api';
import { getFCMToken, setupForegroundMessageListener } from '../config/firebase';
import { useNotification } from './NotificationContext';

const PushNotificationContext = createContext();

export const usePushNotification = () => {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotification must be used within a PushNotificationProvider');
  }
  return context;
};

export const PushNotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();
  const [fcmToken, setFcmToken] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState(null);

  // Browser desteğini kontrol et
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setIsSupported(supported);
      
      if (supported && 'Notification' in window) {
        // Notification iznini kontrol et
        setPermission(Notification.permission);
      }
    }
  }, []);

  // FCM token'ı backend'e kaydet
  const registerToken = useCallback(async (token) => {
    if (!user || !token) return;

    try {
      await dashboardApi.post('/maintenance/device-token', {
        token: token,
        platform: 'web',
        deviceName: navigator.userAgent,
        appVersion: '1.0.0'
      });
      console.log('FCM token backend\'e kaydedildi');
    } catch (error) {
      console.error('FCM token kaydetme hatası:', error);
    }
  }, [user]);

  // FCM token al ve kaydet
  const requestPermissionAndRegister = useCallback(async () => {
    if (!isSupported) {
      console.warn('Push notification bu tarayıcıda desteklenmiyor');
      return;
    }

    try {
      // Notification izni iste
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        setPermission(permission);
        
        if (permission !== 'granted') {
          showError('Bildirim izni verilmedi');
          return;
        }
      } else if (Notification.permission === 'denied') {
        showError('Bildirim izni reddedilmiş. Tarayıcı ayarlarından izin verebilirsiniz.');
        return;
      }

      // Service worker'ı kaydet
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            updateViaCache: 'none' // Her zaman en güncel versiyonu kullan
          });
          console.log('Service Worker kaydedildi:', registration);
          
          // Service worker'ı hemen güncelle
          await registration.update();
          console.log('Service Worker güncellendi');
        } catch (error) {
          console.error('Service Worker kayıt hatası:', error);
          showError('Service Worker kaydedilemedi');
          return;
        }
      }

      // FCM token al
      const token = await getFCMToken();
      if (token) {
        setFcmToken(token);
        await registerToken(token);
        showSuccess('Push bildirimleri aktif edildi');
      } else {
        showError('FCM token alınamadı');
      }
    } catch (error) {
      console.error('Push notification izni hatası:', error);
      showError('Bildirim izni alınamadı');
    }
  }, [isSupported, registerToken, showSuccess, showError]);

  // Kullanıcı giriş yaptığında token'ı kaydet veya izin iste
  // Token varsa kullanıcı giriş yapmış demektir (hem manuel giriş hem "beni hatırla" ile)
  useEffect(() => {
    if (token && isSupported) {
      // Kısa bir gecikme ile kontrol et (service worker'ın hazır olması için)
      const timer = setTimeout(async () => {
        // İzin durumunu kontrol et
        const currentPermission = Notification.permission;
        setPermission(currentPermission);
        
        // Eğer izin verilmişse token'ı al ve kaydet
        if (currentPermission === 'granted') {
          const fcmToken = await getFCMToken();
          if (fcmToken) {
            setFcmToken(fcmToken);
            await registerToken(fcmToken);
          }
        } 
        // Eğer izin verilmemişse (default) ve mobil cihazdaysa otomatik izin iste
        else if (currentPermission === 'default') {
          // Mobil cihaz kontrolü (daha geniş kontrol)
          const userAgent = navigator.userAgent || '';
          const isMobile = /iPhone|iPad|iPod|Android|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
          
          // Ayrıca ekran boyutuna göre de kontrol et
          const isSmallScreen = window.innerWidth <= 768;
          
          if (isMobile || isSmallScreen) {
            // Mobil cihazdaysa veya küçük ekrandaysa otomatik izin iste
            try {
              console.log('Mobil cihaz tespit edildi, bildirim izni isteniyor...');
              const permission = await Notification.requestPermission();
              setPermission(permission);
              
              if (permission === 'granted') {
                // Service worker'ı kaydet
                if ('serviceWorker' in navigator) {
                  try {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                      updateViaCache: 'none'
                    });
                    await registration.update();
                    console.log('Service Worker kaydedildi ve güncellendi');
                  } catch (error) {
                    console.error('Service Worker kayıt hatası:', error);
                  }
                }
                
                // FCM token al ve kaydet
                const fcmToken = await getFCMToken();
                if (fcmToken) {
                  setFcmToken(fcmToken);
                  await registerToken(fcmToken);
                  showSuccess('Bildirimler aktif edildi');
                  console.log('FCM token başarıyla kaydedildi');
                } else {
                  console.warn('FCM token alınamadı');
                }
              } else if (permission === 'denied') {
                // İzin reddedildi, kullanıcıya bilgi ver
                console.warn('Bildirim izni reddedildi');
              } else {
                console.log('Bildirim izni verilmedi (default)');
              }
            } catch (error) {
              console.error('Bildirim izni hatası:', error);
            }
          } else {
            // Desktop'ta otomatik izin isteme, kullanıcı manuel butona basmalı
            console.log('Desktop cihaz - bildirim izni manuel olarak istenmeli (Settings > Bildirim Testi)');
          }
        } else if (currentPermission === 'denied') {
          // İzin daha önce reddedilmiş
          console.warn('Bildirim izni daha önce reddedilmiş. Tarayıcı ayarlarından açılmalı.');
        }
        // Eğer izin daha önce reddedilmişse (denied), hiçbir şey yapma
        // Kullanıcı tarayıcı ayarlarından manuel olarak açmalı
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [token, isSupported, registerToken, showSuccess]);

  // Foreground mesajları dinle (sürekli dinleme)
  // NOT: Firebase'de onMessage kullanıldığında, Firebase otomatik bildirim göstermez
  // Ama service worker'daki onBackgroundMessage her zaman çalışır ve bildirim gösterir
  // Sorun: Her ikisi de tetikleniyor ve 2 bildirim geliyor
  // Çözüm: Foreground'da onMessage kullanmayı TAMAMEN KAPAT, sadece service worker bildirim gösterecek
  useEffect(() => {
    if (!isSupported || Notification.permission !== 'granted') return;

    // Foreground mesaj listener'ını KAPAT - sadece service worker bildirim gösterecek
    // Bu şekilde çift bildirim sorunu çözülür
    console.log('Foreground message listener KAPALI - sadece service worker bildirim gösterecek');
    
    // Listener'ı kurma - service worker zaten bildirim gösterecek
    // const unsubscribe = setupForegroundMessageListener((payload) => {
    //   // KAPALI - çift bildirim olmasın
    // });
    
    // Sadece context notification için ayrı bir listener (opsiyonel)
    // Ama şimdilik kapalı, sadece service worker bildirim gösterecek
  }, [isSupported]);

  const value = {
    fcmToken,
    isSupported,
    permission,
    requestPermissionAndRegister,
    registerToken
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
};

