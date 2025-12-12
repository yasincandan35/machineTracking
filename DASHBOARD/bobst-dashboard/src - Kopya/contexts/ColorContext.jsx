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

  // Kullanıcı renk tercihlerini yükle
  useEffect(() => {
    if (!user?.id) return;

    api.get(`/api/user/color-preferences?userId=${user.id}`)
      .then(res => {
        if (res.data && Object.keys(res.data).length > 0) {
          setColorSettings({ ...defaultColors, ...res.data });
        }
      })
      .catch(err => {
        console.error("Renk tercihleri yüklenemedi:", err);
      });
  }, [user?.id]);

  // Renk tercihlerini kaydet
  const saveColorSettings = async (newSettings) => {
    if (!user?.id) return;

    try {
      await api.post('/api/user/color-preferences', {
        userId: user.id,
        colorSettings: newSettings
      });
      setColorSettings(newSettings);
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