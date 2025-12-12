import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "../utils/api";

// Auth context'i oluştur
const AuthContext = createContext();

// Context'e erişim hook'u
export const useAuth = () => useContext(AuthContext);

  // Sağlayıcı component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { username, role, theme, ... }
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0); // Token yenilendiğinde artır
  const refreshTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null); // Heartbeat için timer

  // Token yenileme fonksiyonu
  const refreshToken = async () => {
    try {
      const response = await api.post('/api/auth/refresh-token', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.token) {
        const newToken = response.data.token;
        setToken(newToken);
        setRefreshCount(prev => prev + 1); // Token yenilendiğinde sayacı artır
        
        // Storage'ı güncelle
        const storage = localStorage.getItem("token") ? localStorage : sessionStorage;
        storage.setItem("token", newToken);
        
        console.log("Token başarıyla yenilendi");
        return newToken;
      }
    } catch (error) {
      console.error('Token yenileme hatası:', error);
      // Token yenilenemezse logout yap
      logout();
    }
    return null;
  };

  // Heartbeat gönder (kullanıcının online olduğunu belirt)
  const sendHeartbeat = async () => {
    try {
      await api.post('/api/auth/heartbeat', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Heartbeat hatası:', error);
      // Heartbeat başarısız olursa logout yapma, sadece log'la
    }
  };

  // Heartbeat timer'ını başlat
  const startHeartbeat = (token) => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    
    // Her 2 saniyede bir heartbeat gönder
    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, 2 * 1000); // 2 saniye
  };

  // Token yenileme timer'ını başlat
  const startTokenRefresh = (token) => {
    // Token refresh kaldırıldı - Fabrika TV'si için session timeout yok
  };

  // Giriş yapıldığında token + user bilgilerini kaydet
  const login = (data, rememberMe) => {
    setToken(data.token);
    setUser({
      id: data.id, // 🔥 id'yi burada ekliyoruz
      username: data.username,
      role: data.role,
      theme: data.theme,
      accentColor: data.accentColor,
    });

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("token", data.token);
    storage.setItem("user", JSON.stringify({
      id: data.id, // 🔥 buraya da ekle
      username: data.username,
      role: data.role,
      theme: data.theme,
      accentColor: data.accentColor,
    }));

    // Token refresh kaldırıldı - Fabrika TV'si için session timeout yok
    // startTokenRefresh(data.token);
    
    // Heartbeat timer'ını başlat
    startHeartbeat(data.token);
  };

  // Çıkış işlemi
  const logout = async () => {
    // Backend'e logout bilgisi gönder
    if (token) {
      try {
        await api.post('/api/auth/logout', {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout API hatası:', error);
        // Hata olsa bile local logout yap
      }
    }

    setToken(null);
    setUser(null);
    // Token refresh timer kaldırıldı
    // if (refreshTimerRef.current) {
    //   clearTimeout(refreshTimerRef.current);
    // }
    
    // Heartbeat timer'ı temizle
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    localStorage.clear();
    sessionStorage.clear();
  };

  // Token'ı backend'e gönder ve lastLogin güncelle
  const validateToken = async (token) => {
    try {
      const response = await api.post('/api/auth/validate-token', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status !== 200) {
        // Token geçersizse temizle
        logout();
      }
    } catch (error) {
      console.error('Token kontrol hatası:', error);
      // Hata durumunda logout yapma, sadece log'la
    }
  };

  // Sayfa yenilendiğinde token/user var mı kontrol et
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
    const savedUser = localStorage.getItem("user") || sessionStorage.getItem("user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      
      // Token yenileme timer'ını başlat
      startTokenRefresh(savedToken);
      
      // Heartbeat timer'ını başlat
      startHeartbeat(savedToken);
      
      // Token kontrolünü geçici olarak kaldırdık
      // validateToken(savedToken);
    }
    setIsLoading(false); // ✅ auth kontrolü bitti
  }, []);

  // Browser kapatma/refresh durumunu yakala
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (token) {
        try {
          // Senkron olmayan API çağrısı yapılamaz, 
          // sadece navigator.sendBeacon kullanabiliriz
          navigator.sendBeacon('/api/auth/logout', JSON.stringify({}));
        } catch (error) {
          console.error('Beforeunload logout hatası:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && token) {
        // Sayfa gizlendiğinde (browser kapatıldığında) offline yap
        // Bu durumda heartbeat durur ve backend otomatik offline yapar
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  // Component unmount olduğunda timer'ları temizle
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, refreshToken, refreshCount }}>
      {children}
    </AuthContext.Provider>
  );
};
