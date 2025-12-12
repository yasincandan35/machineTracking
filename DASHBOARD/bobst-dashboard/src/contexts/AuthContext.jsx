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
      const response = await api.post('/auth/refresh-token', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.token) {
        const newToken = response.data.token;
        setToken(newToken);
        setRefreshCount(prev => prev + 1); // Token yenilendiğinde sayacı artır
        
        // User bilgilerini de güncelle (backend'den dönen yeni bilgilerle)
        const updatedUser = {
          id: response.data.id,
          username: response.data.username,
          email: response.data.email,
          role: response.data.role,
          theme: response.data.theme,
          accentColor: response.data.accentColor,
          isActive: response.data.isActive,
          isOnline: response.data.isOnline,
          createdAt: response.data.createdAt,
          lastLogin: response.data.lastLogin,
          lastSeen: response.data.lastSeen,
          languageSelection: response.data.languageSelection,
          lastSelectedMachineId: response.data.lastSelectedMachineId,
          colorSettings: response.data.colorSettings,
          assignedMachineId: response.data.assignedMachineId,
          assignedMachineTable: response.data.assignedMachineTable,
          assignedMachineName: response.data.assignedMachineName,
          isDemo: response.data.isDemo,
          privacySettings: response.data.privacySettings,
          roleSettings: response.data.roleSettings ?? user?.roleSettings ?? null,
        };
        setUser(updatedUser);
        
        // Storage'ı güncelle
        const storage = localStorage.getItem("token") ? localStorage : sessionStorage;
        storage.setItem("token", newToken);
        storage.setItem("user", JSON.stringify(updatedUser));
        
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


  // Heartbeat timer'ını başlat
  const startHeartbeat = (savedToken) => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    
    // Token varsa heartbeat başlat
    if (savedToken) {
      // Her 2 saniyede bir heartbeat gönder
      heartbeatTimerRef.current = setInterval(async () => {
        // Token'ı parameter olarak kullan (state yerine)
        if (!savedToken) return;
        
        try {
          const response = await api.post('/auth/heartbeat', {}, {
            headers: { 'Authorization': `Bearer ${savedToken}` }
          });
          
          // Backend'den dönen güncel kullanıcı bilgilerini state'e güncelle
          if (response.data && response.data.id) {
            const updatedUser = {
              id: response.data.id,
              username: response.data.username,
              email: response.data.email,
              role: response.data.role,
              theme: response.data.theme,
              accentColor: response.data.accentColor,
              isActive: response.data.isActive,
              isOnline: response.data.isOnline,
              createdAt: response.data.createdAt,
              lastLogin: response.data.lastLogin,
              lastSeen: response.data.lastSeen,
              languageSelection: response.data.languageSelection,
              lastSelectedMachineId: response.data.lastSelectedMachineId,
              colorSettings: response.data.colorSettings,
              assignedMachineId: response.data.assignedMachineId,
              assignedMachineTable: response.data.assignedMachineTable,
          assignedMachineName: response.data.assignedMachineName,
          isDemo: response.data.isDemo,
          privacySettings: response.data.privacySettings,
          roleSettings: response.data.roleSettings ?? user?.roleSettings ?? null,
            };
            setUser(updatedUser);
          }
        } catch (error) {
          // 401 hatası gelirse token'ı temizle
          if (error.response?.status === 401) {
            logout();
          }
          // Diğer hataları sessizce ele al
        }
      }, 2 * 1000); // 2 saniye
    }
  };

  // Token yenileme timer'ını başlat
  const startTokenRefresh = (token) => {
    // Token süresiz - refresh'e gerek yok
    // Sadece manuel logout yapıldığında oturum kapanacak
  };

  // Giriş yapıldığında token + user bilgilerini kaydet
  const login = (data, rememberMe) => {
    setToken(data.token);
    const userData = {
      id: data.id,
      username: data.username,
      email: data.email,
      role: data.role,
      theme: data.theme,
      accentColor: data.accentColor,
      isActive: data.isActive,
      isOnline: data.isOnline,
      createdAt: data.createdAt,
      lastLogin: data.lastLogin,
      lastSeen: data.lastSeen,
      languageSelection: data.languageSelection,
      lastSelectedMachineId: data.lastSelectedMachineId,
      colorSettings: data.colorSettings,
      assignedMachineId: data.assignedMachineId,
      assignedMachineTable: data.assignedMachineTable,
      assignedMachineName: data.assignedMachineName,
      isDemo: data.isDemo,
      privacySettings: data.privacySettings,
      roleSettings: data.roleSettings ?? null,
    };
    setUser(userData);

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("token", data.token);
    // User bilgilerini backend'den çekeceğiz, localStorage'a kaydetme
    // storage.setItem("user", JSON.stringify(userData));

    // Theme'i localStorage'a da kaydet (ThemeContext için)
    localStorage.setItem('dashboard-theme', data.theme || 'light');

    // Token refresh başlat - 7 günlük token için 6 günde bir yenile
    startTokenRefresh(data.token);
    
    // Heartbeat timer'ını başlat
    startHeartbeat(data.token);
  };

  // Çıkış işlemi
  const logout = async () => {
    // Backend'e logout bilgisi gönder
    if (token) {
      try {
        await api.post('/auth/logout', {}, {
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
    // Token refresh timer'ı temizle
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
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
      const response = await api.post('/auth/validate-token', {}, {
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

  // Sayfa yenilendiğinde token var mı kontrol et ve user bilgilerini backend'den çek
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (savedToken) {
      setToken(savedToken);
      
      // Token yenileme timer'ını başlat
      startTokenRefresh(savedToken);
      
      // Heartbeat timer'ını başlat
      startHeartbeat(savedToken);
      
      // Backend'den user bilgilerini çek (localStorage'da user yok artık)
      // Token'dan userId'yi decode etmek yerine, heartbeat endpoint'i kullan
      api.post('/auth/heartbeat', {}, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
        .then(response => {
          if (response.data && response.data.id) {
            setUser(response.data);
          }
        })
        .catch(err => {
          console.warn('User bilgisi alınamadı:', err.message);
          // Token geçersizse logout
          if (err.response?.status === 401) {
            logout();
          }
        });
      
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
