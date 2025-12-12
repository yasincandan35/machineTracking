import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from '../utils/api';

const ColorContext = createContext();

export const useColor = () => {
  const context = useContext(ColorContext);
  if (!context) {
    throw new Error('useColor must be used within a ColorProvider');
  }
  return context;
};

export const ColorProvider = ({ children }) => {
  const { user } = useAuth();
  const [colorSettings, setColorSettings] = useState({
    background: '#f8fafc',
    infoCard: '#ffffff',
    graphCard: '#ffffff',
    sidebar: '#1f2937',
    text: '#1f2937',
    accent: '#3b82f6'
  });
  

  // Varsayılan renkler
  const defaultColors = {
    background: '#f8fafc',
    infoCard: '#ffffff',
    graphCard: '#ffffff',
    sidebar: '#1f2937',
    text: '#1f2937',
    accent: '#3b82f6'
  };

  // Kullanıcı renk tercihlerini yükle - 🆕 Users.ColorSettings'den
  useEffect(() => {
    if (!user?.id) return;

    // User objesinde colorSettings varsa kullan
    if (user.colorSettings) {
      try {
        const settings = typeof user.colorSettings === 'string' 
          ? JSON.parse(user.colorSettings) 
          : user.colorSettings;
        setColorSettings({ ...defaultColors, ...settings });
        console.log('🎨 Renk ayarları user\'dan yüklendi');
      } catch (err) {
        console.error('ColorSettings parse hatası:', err);
      }
    } else {
      // Yoksa DashboardBackend'den çek
      api.get(`/users/${user.id}`)
        .then(res => {
          if (res.data.colorSettings) {
            const settings = typeof res.data.colorSettings === 'string'
              ? JSON.parse(res.data.colorSettings)
              : res.data.colorSettings;
            setColorSettings({ ...defaultColors, ...settings });
          }
        })
        .catch(err => {
          console.warn("Renk tercihleri yüklenemedi:", err);
        });
    }
  }, [user?.id, user?.colorSettings]);

  // Renk tercihlerini kaydet - 🆕 DashboardBackend'e (Users.ColorSettings)
  const saveColorSettings = async (newSettings) => {
    if (!user?.id) return false;

    try {
      // Sadece colorSettings'i güncellemek için özel endpoint kullan
      await api.put(`/users/${user.id}/color-settings`, {
        colorSettings: JSON.stringify(newSettings)
      });
      setColorSettings(newSettings);
      
      // LocalStorage'da user objesini güncelle
      const storage = localStorage.getItem("user") ? localStorage : sessionStorage;
      const currentUser = JSON.parse(storage.getItem("user") || "{}");
      storage.setItem("user", JSON.stringify({ ...currentUser, colorSettings: JSON.stringify(newSettings) }));
      
      console.log('🎨 Renk ayarları kaydedildi');
      return true;
    } catch (err) {
      console.error("Renk tercihleri kaydedilemedi:", err);
      return false;
    }
  };

  // Varsayılan renklere dön
  const resetToDefault = async () => {
    const success = await saveColorSettings(defaultColors);
    if (success) {
      setColorSettings(defaultColors);
    }
  };


  const value = {
    colorSettings,
    saveColorSettings,
    resetToDefault,
    defaultColors
  };

  return (
    <ColorContext.Provider value={value}>
      {children}
    </ColorContext.Provider>
  );
}; 