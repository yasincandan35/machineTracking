import React, { useState, useEffect } from 'react';
import './styles.css';
import Dashboard from './Dashboard.jsx';
import Settings from './Settings.jsx';
import Analysis from './Analysis.jsx';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';

const TemperatureHumiditySystem = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const [currentLanguage, setCurrentLanguage] = useState('tr');
  const { theme } = useTheme();

  // Load language from localStorage and listen for changes
  useEffect(() => {
    const loadLanguage = () => {
      const savedLanguage = localStorage.getItem('dashboard-language') || 'tr';
      setCurrentLanguage(savedLanguage);
    };
    
    // Initial load
    loadLanguage();
    
    // Listen for storage changes (when language is changed in another component)
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard-language') {
        loadLanguage();
      }
    };
    
    // Listen for custom language change event
    const handleLanguageChange = (e) => {
      if (e.detail && e.detail.language) {
        setCurrentLanguage(e.detail.language);
      } else {
        loadLanguage();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('languageChanged', handleLanguageChange);
    
    // Also check periodically (in case localStorage is changed in same window)
    const interval = setInterval(() => {
      const savedLanguage = localStorage.getItem('dashboard-language') || 'tr';
      if (savedLanguage !== currentLanguage) {
        setCurrentLanguage(savedLanguage);
      }
    }, 500);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('languageChanged', handleLanguageChange);
      clearInterval(interval);
    };
  }, [currentLanguage]);

  const translate = (key) => getTranslation(key, currentLanguage);

  return (
    <div className={`temp-hum-root temp-hum-container theme-${theme}`}>
      {/* Header */}
      <div className="temp-hum-header">
        <h1 className="temp-hum-title">
          🌡️ {translate('tempHumSystemTitle')}
        </h1>
        
        {/* Navigation Tabs */}
        <div className="temp-hum-tabs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`temp-hum-tab ${currentView === 'dashboard' ? 'active' : ''}`}
          >
            📊 {translate('tempHumDashboard')}
          </button>
          <button
            onClick={() => setCurrentView('analysis')}
            className={`temp-hum-tab ${currentView === 'analysis' ? 'active' : ''}`}
          >
            📈 {translate('tempHumDataAnalysis')}
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`temp-hum-tab ${currentView === 'settings' ? 'active' : ''}`}
          >
            ⚙️ {translate('tempHumSettings')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="temp-hum-content">
        {currentView === 'dashboard' && <Dashboard currentLanguage={currentLanguage} />}
        {currentView === 'analysis' && <Analysis currentLanguage={currentLanguage} />}
        {currentView === 'settings' && <Settings currentLanguage={currentLanguage} />}
      </div>
    </div>
  );
};

export default TemperatureHumiditySystem;

