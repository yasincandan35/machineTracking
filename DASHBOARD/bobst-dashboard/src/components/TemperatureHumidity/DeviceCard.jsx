import React, { useState, useEffect } from 'react';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';

const DeviceCard = ({ device, latestData, currentLanguage = 'tr' }) => {
  const { theme } = useTheme();
  const translate = (key) => getTranslation(key, currentLanguage);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [colorSettings, setColorSettings] = useState(null);

  // LocalStorage'dan renk ayarlarını yükle
  useEffect(() => {
    const loadColorSettings = () => {
      const saved = localStorage.getItem('tempHumidityColorSettings');
      if (saved) {
        try {
          setColorSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Renk ayarları yüklenemedi:', e);
        }
      } else {
        // Varsayılan ayarlar (3 renk: düşük, normal, yüksek)
        setColorSettings({
          temperature: {
            lowColor: '#4A90E2',
            normalColor: '#7ED321',
            highColor: '#D0021B',
            lowLimit: 20,
            highLimit: 25
          },
          humidity: {
            lowColor: '#4A90E2',
            normalColor: '#7ED321',
            highColor: '#D0021B',
            lowLimit: 50,
            highLimit: 60
          }
        });
      }
    };

    loadColorSettings();

    // Renk ayarları güncellendiğinde yeniden yükle
    const handleColorSettingsUpdate = () => {
      loadColorSettings();
      setForceUpdate(prev => prev + 1);
    };

    window.addEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
    return () => window.removeEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
  }, []);

  useEffect(() => {
    // Her 1 saniyede bir zorla güncelle
    const interval = setInterval(() => {
      setForceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getTemperatureColor = (temp) => {
    if (!colorSettings) {
      // Varsayılan renkler (3 renk: düşük, normal, yüksek)
      if (temp < 20) return '#4A90E2';
      if (temp < 25) return '#7ED321';
      return '#D0021B';
    }

    const settings = colorSettings.temperature;
    if (temp < settings.lowLimit) return settings.lowColor;
    if (temp < settings.highLimit) return settings.normalColor;
    return settings.highColor;
  };

  const getHumidityColor = (humidity) => {
    if (!colorSettings) {
      // Varsayılan renkler (3 renk: düşük, normal, yüksek)
      if (humidity < 50) return '#4A90E2';
      if (humidity < 60) return '#7ED321';
      return '#D0021B';
    }

    const settings = colorSettings.humidity;
    if (humidity < settings.lowLimit) return settings.lowColor;
    if (humidity < settings.highLimit) return settings.normalColor;
    return settings.highColor;
  };

  const getStatusIcon = (temp, humidity) => {
    if (temp > 30 || humidity > 80) return '⚠️';
    if (temp < 15 || humidity < 30) return '❄️';
    return '✅';
  };

  const getConnectionStatus = (latestData) => {
    const now = new Date();
    const TIMEOUT_SECONDS = 30; // 30 saniye zaman aşımı
    
    if (!latestData || !latestData.timestamp) {
      return { 
        icon: '🔴', 
        text: translate('tempHumDisconnected'), 
        color: '#e74c3c', 
        ethernetIcon: '❌', 
        ageSec: null,
        isConnected: false
      };
    }
    
    try {
    const lastUpdate = new Date(latestData.timestamp);
      if (isNaN(lastUpdate.getTime())) {
        return { 
          icon: '🔴', 
          text: translate('tempHumDisconnected'), 
          color: '#e74c3c', 
          ethernetIcon: '❌', 
          ageSec: null,
          isConnected: false
        };
      }
      
      const ageSec = Math.max(0, Math.floor((now.getTime() - lastUpdate.getTime()) / 1000));
      const isConnected = ageSec <= TIMEOUT_SECONDS && ageSec >= 0;
      
    return isConnected
        ? { 
            icon: '🟢', 
            text: translate('tempHumConnected'), 
            color: '#27ae60', 
            ethernetIcon: '🌐', 
            ageSec,
            isConnected: true
          }
        : { 
            icon: '🔴', 
            text: translate('tempHumDisconnected'), 
            color: '#e74c3c', 
            ethernetIcon: '❌', 
            ageSec,
            isConnected: false
          };
    } catch (e) {
      return { 
        icon: '🔴', 
        text: translate('tempHumDisconnected'), 
        color: '#e74c3c', 
        ethernetIcon: '❌', 
        ageSec: null,
        isConnected: false
      };
    }
  };

  const renderRelative = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const t = new Date(timestamp);
    const diffSec = Math.max(0, Math.floor((now - t) / 1000));
    if (diffSec < 60) return `${diffSec} ${currentLanguage === 'tr' ? 'sn önce' : 'sec ago'}`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} ${currentLanguage === 'tr' ? 'dk önce' : 'min ago'}`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr} ${currentLanguage === 'tr' ? 'sa önce' : 'hr ago'}`;
  };

  // Veri yoksa veya bağlantı yoksa "Veri bekleniyor..." göster
  const status = getConnectionStatus(latestData);
  const hasData = status.isConnected && latestData && latestData.timestamp;
  
  return (
    <div className="device-card">
      <div className="device-header">
        <div className="device-info">
          <h3>
            <span className="device-icon">📱</span>
            {device.name}
          </h3>
          <p className="device-location">
            <span className="location-icon">📍</span>
            {device.location}
          </p>
        </div>
        <div className="device-status">
          <div className="connection-status">
            {(() => {
              const status = getConnectionStatus(latestData);
              return (
                <div className="status-info">
                  <div className="ethernet-icon" style={{ color: status.color }}>{status.ethernetIcon}</div>
                  <span className="status-text" style={{ color: status.color }}>{status.text}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      {(() => {
        const status = getConnectionStatus(latestData);
        
        // isConnected false ise veya latestData yoksa veri gösterme
        if (!status.isConnected || !latestData) {
          return (
            <div className="device-no-data">
              <span className="no-data-icon">📡</span>
              <span className="no-data-text">{translate('tempHumWaitingForData')}</span>
            </div>
          );
        }
        
        // Sadece bağlı olduğunda veri göster
        return (
        <div className="device-data">
          <div className="data-footer">
            <span className="last-update">
              <span className="time-icon">🕐</span>
              <span className="update-label">{translate('tempHumLastUpdate')}:</span>
              {(() => {
                const lastUpdate = latestData?.timestamp ? new Date(latestData.timestamp) : null;
                if (!lastUpdate) return '—';
                const now = new Date();
                const isToday = now.toDateString() === lastUpdate.toDateString();
                const clock = isToday
                  ? lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : lastUpdate.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `${clock} (${renderRelative(latestData.timestamp)})`;
              })()}
            </span>
          </div>
          <div className="data-row">
            <div className="data-item temperature">
              <div className="data-icon">🌡️</div>
              <div className="data-content">
                <span className="data-label">{translate('tempHumTemperature')}</span>
                <span 
                  className="data-value"
                  style={{ color: getTemperatureColor(latestData.temperature) }}
                >
                  {latestData.temperature.toFixed(1)}°C
                </span>
              </div>
            </div>
            <div className="data-item humidity">
              <div className="data-icon">💧</div>
              <div className="data-content">
                <span className="data-label">{translate('tempHumHumidity')}</span>
                <span 
                  className="data-value"
                  style={{ color: getHumidityColor(latestData.humidity) }}
                >
                  {latestData.humidity.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default DeviceCard;