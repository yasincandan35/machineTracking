import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';

const HistoricalDataTable = ({ data, currentLanguage = 'tr' }) => {
  const { theme } = useTheme();
  const translate = (key) => getTranslation(key, currentLanguage);
  const dateLocale = currentLanguage === 'tr' ? tr : enUS;
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [colorSettings, setColorSettings] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all, outOfRange, tempOutOfRange, humOutOfRange
  const itemsPerPage = 20;

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
    };

    window.addEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
    return () => window.removeEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
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

  // Veriyi filtrele
  const filterData = (dataToFilter) => {
    if (!colorSettings || activeFilter === 'all') {
      return dataToFilter;
    }

    const tempSettings = colorSettings.temperature;
    const humSettings = colorSettings.humidity;

    return dataToFilter.filter(item => {
      const tempOutOfRange = item.temperature < tempSettings.lowLimit || item.temperature >= tempSettings.highLimit;
      const humOutOfRange = item.humidity < humSettings.lowLimit || item.humidity >= humSettings.highLimit;

      switch (activeFilter) {
        case 'outOfRange':
          return tempOutOfRange || humOutOfRange;
        case 'tempOutOfRange':
          return tempOutOfRange;
        case 'humOutOfRange':
          return humOutOfRange;
        default:
          return true;
      }
    });
  };

  // Filtre değiştiğinde sayfayı sıfırla
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  const sortedData = filterData([...data]).sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];
    
    if (sortField === 'timestamp') {
      aValue = new Date(aValue);
      bValue = new Date(bValue);
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  // Theme colors
  const isLightTheme = theme === 'light';
  const textColor = isLightTheme ? '#1a1a2e' : '#ffffff';
  const secondaryTextColor = isLightTheme ? '#6b7280' : '#bdc3c7';
  
  // Table colors
  const tableHeaderBg = isLightTheme ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.2)';
  const tableHeaderText = isLightTheme ? '#1a1a2e' : '#ffffff';
  const tableRowBgEven = isLightTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 46, 0.95)';
  const tableRowBgOdd = isLightTheme ? 'rgba(249, 250, 251, 0.8)' : 'rgba(26, 26, 46, 0.60)';
  const tableBorder = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  
  // Pagination theme colors
  const paginationTextColor = isLightTheme ? '#1a1a2e' : '#ffffff';
  const paginationContainerBg = isLightTheme ? 'transparent' : 'transparent';
  const paginationButtonBg = '#667eea';
  const paginationButtonDisabledBg = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const paginationButtonDisabledColor = isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
  const paginationButtonBorder = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  // Filtre sayılarını hesapla
  const getFilterCounts = () => {
    if (!colorSettings) {
      return { all: data.length, outOfRange: 0, tempOutOfRange: 0, humOutOfRange: 0 };
    }

    const tempSettings = colorSettings.temperature;
    const humSettings = colorSettings.humidity;

    let outOfRange = 0;
    let tempOutOfRange = 0;
    let humOutOfRange = 0;

    data.forEach(item => {
      const tempOut = item.temperature < tempSettings.lowLimit || item.temperature >= tempSettings.highLimit;
      const humOut = item.humidity < humSettings.lowLimit || item.humidity >= humSettings.highLimit;

      if (tempOut) tempOutOfRange++;
      if (humOut) humOutOfRange++;
      if (tempOut || humOut) outOfRange++;
    });

    return {
      all: data.length,
      outOfRange,
      tempOutOfRange,
      humOutOfRange
    };
  };

  const filterCounts = getFilterCounts();

  // Container background color
  const containerBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 26, 46, 0.95)';

  return (
    <div 
      className={`temp-hum-root theme-${theme} chart-container`}
      style={{
        borderRadius: '12px',
        padding: '20px'
      }}
    >
      <h3 className="chart-title">📋 Detaylı Veri Tablosu</h3>
      
      {/* Filtre Sekmeleri */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '10px', 
        flexWrap: 'wrap',
        borderBottom: `2px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)'}`,
        paddingBottom: '10px'
      }}>
        <button
          onClick={() => setActiveFilter('all')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeFilter === 'all' ? 'rgba(102, 126, 234, 0.8)' : 'rgba(102, 126, 234, 0.3)',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: activeFilter === 'all' ? '600' : '400',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}
        >
          {translate('tempHumAll')} ({filterCounts.all})
        </button>
        <button
          onClick={() => setActiveFilter('outOfRange')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeFilter === 'outOfRange' ? 'rgba(245, 166, 35, 0.8)' : 'rgba(245, 166, 35, 0.3)',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: activeFilter === 'outOfRange' ? '600' : '400',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}
        >
          {translate('tempHumOutOfRange')} ({filterCounts.outOfRange})
        </button>
        <button
          onClick={() => setActiveFilter('tempOutOfRange')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeFilter === 'tempOutOfRange' ? 'rgba(208, 2, 27, 0.8)' : 'rgba(208, 2, 27, 0.3)',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: activeFilter === 'tempOutOfRange' ? '600' : '400',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}
        >
          {translate('tempHumTempOutOfRange')} ({filterCounts.tempOutOfRange})
        </button>
        <button
          onClick={() => setActiveFilter('humOutOfRange')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeFilter === 'humOutOfRange' ? 'rgba(208, 2, 27, 0.8)' : 'rgba(208, 2, 27, 0.3)',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: activeFilter === 'humOutOfRange' ? '600' : '400',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}
        >
          {translate('tempHumHumOutOfRange')} ({filterCounts.humOutOfRange})
        </button>
      </div>
      
      <div style={{ marginBottom: '16px', fontSize: '14px', color: textColor }}>
        {activeFilter === 'all' ? `${currentLanguage === 'tr' ? 'Toplam' : 'Total'} ${data.length} ${translate('tempHumRecords')}` : `${currentLanguage === 'tr' ? 'Filtrelenmiş' : 'Filtered'} ${sortedData.length} ${translate('tempHumRecords')}`} - {currentLanguage === 'tr' ? 'Sayfa' : 'Page'} {currentPage} / {totalPages}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ background: tableHeaderBg }}>
              <th 
                style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  borderBottom: `2px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)'}`,
                  color: tableHeaderText,
                  background: tableHeaderBg
                }}
                onClick={() => handleSort('timestamp')}
              >
                {translate('tempHumDateAndTime')} {getSortIcon('timestamp')}
              </th>
              <th 
                style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  borderBottom: `2px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)'}`,
                  color: tableHeaderText,
                  background: tableHeaderBg
                }}
                onClick={() => handleSort('deviceName')}
              >
                {translate('tempHumDevice')} {getSortIcon('deviceName')}
              </th>
              <th 
                style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  borderBottom: `2px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)'}`,
                  color: tableHeaderText,
                  background: tableHeaderBg
                }}
                onClick={() => handleSort('temperature')}
              >
                {translate('tempHumTemperature')} {getSortIcon('temperature')}
              </th>
              <th 
                style={{ 
                  padding: '12px', 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  borderBottom: `2px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)'}`,
                  color: tableHeaderText,
                  background: tableHeaderBg
                }}
                onClick={() => handleSort('humidity')}
              >
                {translate('tempHumHumidity')} {getSortIcon('humidity')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((item, index) => (
              <tr key={item.id} style={{ 
                borderBottom: `1px solid ${tableBorder}`,
                background: Math.floor(index / 2) % 2 === 0 ? tableRowBgEven : tableRowBgOdd
              }}>
                <td style={{ padding: '12px', color: textColor }}>
                  <div style={{ fontWeight: '500', color: textColor }}>
                    {format(new Date(item.timestamp), 'dd.MM.yyyy', { locale: dateLocale })}
                  </div>
                  <div style={{ fontSize: '12px', color: secondaryTextColor }}>
                    {format(new Date(item.timestamp), 'HH:mm:ss', { locale: dateLocale })}
                  </div>
                </td>
                <td style={{ padding: '12px', color: textColor }}>
                  <div style={{ fontWeight: '500', color: textColor }}>{item.deviceName}</div>
                  <div style={{ fontSize: '12px', color: secondaryTextColor }}>{item.location}</div>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    color: getTemperatureColor(item.temperature),
                    fontWeight: '600'
                  }}>
                    {item.temperature}°C
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    color: getHumidityColor(item.humidity),
                    fontWeight: '600'
                  }}>
                    {item.humidity}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div 
          className="pagination-container"
          style={{ 
          marginTop: '20px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
            gap: '10px',
            backgroundColor: paginationContainerBg,
            padding: '10px',
            borderRadius: '8px'
          }}
        >
          <button 
            className="pagination-btn"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              backgroundColor: currentPage === 1 ? paginationButtonDisabledBg : paginationButtonBg,
              color: currentPage === 1 ? paginationButtonDisabledColor : '#ffffff',
              border: `1px solid ${currentPage === 1 ? paginationButtonBorder : paginationButtonBg}`,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            ← {translate('tempHumPrevious')}
          </button>
          
          <span 
            className="pagination-text"
            style={{ 
              margin: '0 10px', 
              color: paginationTextColor,
              fontWeight: '500',
              fontSize: '14px',
              userSelect: 'none'
            }}
          >
            {currentLanguage === 'tr' ? 'Sayfa' : 'Page'} {currentPage} / {totalPages}
          </span>
          
          <button 
            className="pagination-btn"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              backgroundColor: currentPage === totalPages ? paginationButtonDisabledBg : paginationButtonBg,
              color: currentPage === totalPages ? paginationButtonDisabledColor : '#ffffff',
              border: `1px solid ${currentPage === totalPages ? paginationButtonBorder : paginationButtonBg}`,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            {translate('tempHumNext')} →
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoricalDataTable;
