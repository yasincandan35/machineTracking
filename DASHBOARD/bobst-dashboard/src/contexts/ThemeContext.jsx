import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light'); // light, dark, liquid-glass, glass, fluid
  const [liquidGlassVariant, setLiquidGlassVariant] = useState('default'); // default, ocean, sunset, aurora, neon

  // Temayı uygula
  const applyTheme = useCallback((newTheme, variant = 'default') => {
    const root = document.documentElement;
    
    // Önceki tema sınıflarını temizle
    root.classList.remove('light', 'dark', 'liquid-glass', 'glass', 'fluid');
    
    // Yeni tema sınıfını ekle
    root.classList.add(newTheme);
    
    // Background sınıflarını temizle
    document.body.classList.remove(
      'liquid-glass-bg', 
      'liquid-glass-bg-ocean', 
      'liquid-glass-bg-sunset', 
      'liquid-glass-bg-aurora', 
      'liquid-glass-bg-neon',
      'liquid-glass-bg-classic-blue',
      'liquid-glass-bg-classic-green',
      'liquid-glass-bg-classic-purple',
      'liquid-glass-bg-classic-red',
      'liquid-glass-bg-rainbow',
      'liquid-glass-bg-rainbow-soft',
      'liquid-glass-bg-rainbow-subtle',
      'liquid-glass-bg-silver',
      'liquid-glass-bg-gold',
      'liquid-glass-bg-bronze',
      'glass-sky-bg',
      'fluid-bg'
    );
    
    // Liquid glass teması için özel background
    if (newTheme === 'liquid-glass') {
      const bgClass = variant === 'default' ? 'liquid-glass-bg' : `liquid-glass-bg-${variant}`;
      console.log('🎨 Liquid glass background class ekleniyor:', bgClass);
      document.body.classList.add(bgClass);
      // Text rengini beyaz yap (okunabilirlik için)
      document.documentElement.style.color = '#ffffff';
      document.body.style.color = '#ffffff';
    } else {
      // Diğer temalarda text rengini temizle
      document.documentElement.style.color = '';
      document.body.style.color = '';
    }
    
    // Glass teması için gökyüzü arkaplan
    if (newTheme === 'glass') {
      document.body.classList.add('glass-sky-bg');
      // Inline style olarak da ekle - daha güçlü override
      document.body.style.background = 'linear-gradient(to bottom, #4A90E2 0%, #5BA3E8 20%, #6BB6EE 40%, #7EC8F4 60%, #91D9FA 80%, #A4E8FF 100%)';
      document.body.style.minHeight = '100vh';
    } else if (newTheme === 'fluid') {
      document.body.classList.add('fluid-bg');
      // Fluid için koyu arkaplan (WebGL simulation görünsün)
      document.body.style.background = '#000000';
      document.body.style.minHeight = '100vh';
    } else {
      // Tema değiştiğinde inline style'ı temizle
      document.body.style.background = '';
      document.body.style.minHeight = '';
    }
  }, []);

  // Tema tercihini localStorage'dan yükle (sadece ilk yüklemede)
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    const savedVariant = localStorage.getItem('liquid-glass-variant') || 'default';
    
    // Sadece localStorage'da tema varsa ve user henüz yüklenmemişse kullan
    if (savedTheme && ['light', 'dark', 'liquid-glass'].includes(savedTheme)) {
      setTheme(savedTheme);
      // Liquid glass ise varyantı da yükle
      if (savedTheme === 'liquid-glass') {
        setLiquidGlassVariant(savedVariant);
      }
      applyTheme(savedTheme, savedVariant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Liquid glass variant değiştiğinde temayı güncelle
  useEffect(() => {
    if (theme === 'liquid-glass') {
      applyTheme('liquid-glass', liquidGlassVariant);
    }
  }, [liquidGlassVariant, theme, applyTheme]);

  // Tema değiştir
  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    // Liquid glass'a geçerken mevcut varyantı koru
    const currentVariant = localStorage.getItem('liquid-glass-variant') || liquidGlassVariant;
    applyTheme(newTheme, newTheme === 'liquid-glass' ? currentVariant : 'default');
    // localStorage'a kaydetme - artık sadece veritabanına kaydediliyor
  };

  // Liquid Glass variant değiştir
  const changeLiquidGlassVariant = (variant) => {
    console.log('🎨 Variant değiştiriliyor:', variant);
    setLiquidGlassVariant(variant);
    // Her zaman liquid-glass temasını variant ile uygula
    // (Tema zaten liquid-glass olmalı ama emin olmak için)
    applyTheme('liquid-glass', variant);
    localStorage.setItem('liquid-glass-variant', variant);
    console.log('✅ Variant uygulandı:', variant);
  };

  // Liquid Glass varyantları
  const liquidGlassVariants = [
    { id: 'default', name: 'Classic', icon: '🌈', preview: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb)' },
    { id: 'rainbow', name: 'Rainbow Flow', icon: '🌈', preview: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)' },
    { id: 'rainbow-soft', name: 'Rainbow Soft', icon: '🌸', preview: 'linear-gradient(90deg, #ff9999, #ffcc99, #ffff99, #99ff99, #9999ff, #cc99ff, #ff99ff)' },
    { id: 'rainbow-subtle', name: 'Rainbow Subtle', icon: '🌅', preview: 'linear-gradient(90deg, #ffcccc, #ffe6cc, #ffffcc, #ccffcc, #ccccff, #e6ccff, #ffccff)' },
    { id: 'silver', name: 'Silver', icon: '🥈', preview: 'linear-gradient(135deg, #e5e7eb, #d1d5db, #9ca3af, #6b7280, #4b5563)' },
    { id: 'gold', name: 'Gold', icon: '🥇', preview: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706, #b45309, #92400e)' },
    { id: 'bronze', name: 'Bronze', icon: '🥉', preview: 'linear-gradient(135deg, #cd7f32, #b8860b, #8b4513, #654321, #4a2c2a)' },
    { id: 'classic-blue', name: 'Classic Blue', icon: '💙', preview: 'linear-gradient(135deg, #4f46e5, #7c3aed, #2563eb)' },
    { id: 'classic-green', name: 'Classic Green', icon: '💚', preview: 'linear-gradient(135deg, #059669, #10b981, #34d399)' },
    { id: 'classic-purple', name: 'Classic Purple', icon: '💜', preview: 'linear-gradient(135deg, #7c3aed, #a855f7, #c084fc)' },
    { id: 'classic-red', name: 'Classic Red', icon: '❤️', preview: 'linear-gradient(135deg, #dc2626, #ef4444, #f87171)' },
    { id: 'ocean', name: 'Ocean Waves', icon: '🌊', preview: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { id: 'sunset', name: 'Sunset', icon: '🌅', preview: 'linear-gradient(135deg, #ff9a9e, #fecfef, #fad0c4)' },
    { id: 'aurora', name: 'Aurora', icon: '🌌', preview: 'linear-gradient(135deg, #a8edea, #fed6e3, #d299c2)' },
    { id: 'neon', name: 'Neon', icon: '⚡', preview: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)' }
  ];


  // Mevcut temalar
  const themes = [
    { id: 'light', nameKey: 'lightTheme', icon: '☀️' },
    { id: 'dark', nameKey: 'darkTheme', icon: '🌙' },
    { id: 'liquid-glass', nameKey: 'liquidGlassTheme', icon: '✨' }
  ];

  const value = {
    theme,
    changeTheme,
    themes,
    isLiquidGlass: theme === 'liquid-glass',
    isGlass: theme === 'glass',
    isFluid: theme === 'fluid',
    liquidGlassVariant,
    changeLiquidGlassVariant,
    liquidGlassVariants
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
