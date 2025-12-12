import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { tr, enUS } from 'date-fns/locale';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';

// Custom Tooltip Component (memoized for performance)
const CustomTooltip = React.memo(({ active, payload, label, chartType, currentLanguage = 'tr', theme = 'dark' }) => {
  const translate = (key) => getTranslation(key, currentLanguage);
  const dateLocale = currentLanguage === 'tr' ? tr : enUS;
  const isLightTheme = theme === 'light';
  
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  if (chartType === 'bar') {
    const dayData = payload[0]?.payload;
    return (
      <div style={{
        backgroundColor: isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(26, 26, 46, 0.95)',
        border: isLightTheme ? '1px solid rgba(0, 0, 0, 0.2)' : '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        padding: '10px',
        color: isLightTheme ? '#1a1a2e' : '#ffffff',
        boxShadow: isLightTheme ? '0 4px 6px rgba(0, 0, 0, 0.1)' : '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ padding: '4px 0' }}>
          <div>{translate('tempHumDate')}: {label}</div>
          <div>{translate('tempHumDailyMaxMin')}</div>
        </div>
        {payload.map((entry, index) => (
          <div key={index} style={{ color: entry.color, padding: '2px 0' }}>
            {(() => {
              let displayValue = entry.value;
              if (dayData) {
                if (entry.dataKey === 'tempStack') {
                  displayValue = (dayData.tempBase ?? 0) + entry.value;
                } else if (entry.dataKey === 'humidityStack') {
                  displayValue = (dayData.humidityBase ?? 0) + entry.value;
                }
              }
              const unit = entry.name.includes(translate('tempHumTemperature')) || entry.name.includes('Temperature') ? '°C' : '%';
              const formatted = typeof displayValue === 'number' ? displayValue.toFixed(2) : displayValue;
              return `${entry.name}: ${formatted}${unit}`;
            })()}
          </div>
        ))}
      </div>
    );
  }

  // Line chart için
  const dataPoint = payload[0]?.payload;
  if (dataPoint) {
    let fullDateTime = label;
    
    if (dataPoint.timestamp) {
      try {
        const timestamp = new Date(dataPoint.timestamp);
        if (!isNaN(timestamp.getTime())) {
          fullDateTime = format(timestamp, 'dd.MM.yyyy HH:mm:ss', { locale: dateLocale });
        }
      } catch (e) {
        console.error('Timestamp parse error:', e);
      }
    } else if (dataPoint.date && dataPoint.time) {
      // date ve time'dan tam tarih oluştur
      fullDateTime = `${dataPoint.date} ${dataPoint.time}`;
    }

    return (
      <div style={{
        backgroundColor: isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(0, 0, 0, 0.8)',
        border: isLightTheme ? '1px solid rgba(74, 144, 226, 0.5)' : '1px solid #4a90e2',
        borderRadius: '8px',
        padding: '10px',
        color: isLightTheme ? '#1a1a2e' : '#e0e0e0',
        boxShadow: isLightTheme ? '0 4px 6px rgba(0, 0, 0, 0.1)' : '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ padding: '4px 0', marginBottom: '8px' }}>
          <div>{translate('tempHumDevice')}: {dataPoint.device || translate('tempHumDisconnected')}</div>
          <div>{translate('tempHumDateAndTime')}: {fullDateTime}</div>
        </div>
        {payload.map((entry, index) => {
          const isTemp = entry.name.includes(translate('tempHumTemperature')) || entry.name.includes('Temperature');
          const value = typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value;
          return (
            <div key={index} style={{ color: entry.color, padding: '2px 0', fontWeight: '500' }}>
              {entry.name}: {value}{isTemp ? '°C' : '%'}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
});

const CombinedChart = ({ data, currentLanguage = 'tr' }) => {
  const { theme } = useTheme();
  const translate = (key) => getTranslation(key, currentLanguage);
  const dateLocale = currentLanguage === 'tr' ? tr : enUS;
  const [chartType, setChartType] = useState('line'); // 'line' veya 'bar'
  
  // Theme colors
  const isLightTheme = theme === 'light';
  const textColor = isLightTheme ? '#1a1a2e' : '#ffffff';
  const secondaryTextColor = isLightTheme ? '#6b7280' : '#b0b0b0';
  const borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const tabActiveBg = isLightTheme ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.2)';
  const tabInactiveBg = isLightTheme ? 'rgba(0, 0, 0, 0.03)' : 'transparent';
  const buttonBg = isLightTheme ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.3)';
  const buttonDisabledBg = isLightTheme ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255,255,255,0.1)';
  const buttonText = isLightTheme ? '#1a1a2e' : '#ffffff';
  const gridColor = isLightTheme ? '#e5e7eb' : '#333';
  const axisTextColor = isLightTheme ? '#4b5563' : '#b0b0b0';
  
  // Veri örnekleme fonksiyonu - 5571 kayıt → 929 nokta (tooltip için)
  const sampleData = (data, maxPoints = 1000) => {
    if (data.length <= maxPoints) {
      return data; // Zaten az kayıt varsa direkt dön
    }
    
    // Veri çoksa örnekle
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0);
  };
  
  // ÇİZİM İÇİN: Tüm veri (useMemo ile optimize edilmiş)
  const fullChartData = useMemo(() => {
    return data.map((item, index) => ({
      index: index,
    time: format(new Date(item.timestamp), 'HH:mm', { locale: dateLocale }),
    date: format(new Date(item.timestamp), 'dd.MM', { locale: dateLocale }),
    temperature: item.temperature,
    humidity: item.humidity,
    device: item.deviceName,
      timestamp: item.timestamp
  }));
  }, [data]);
  
  // TOOLTİP İÇİN: Örneklenmiş veri (useMemo ile optimize edilmiş)
  const tooltipData = useMemo(() => {
  const sampledData = chartType === 'line' ? sampleData(data, 1000) : data;
    return sampledData.map(item => ({
    time: format(new Date(item.timestamp), 'HH:mm', { locale: dateLocale }),
    date: format(new Date(item.timestamp), 'dd.MM', { locale: dateLocale }),
    temperature: item.temperature,
    humidity: item.humidity,
    device: item.deviceName,
    timestamp: item.timestamp
  }));
  }, [data, chartType]);
  
  // 1 haftalık pencere için state (hangi 1 hafta gösterileceği)
  const oneWeekPoints = 7 * 24 * 12; // 2016 nokta (1 hafta)
  const [weekOffset, setWeekOffset] = useState(0); // 0 = son hafta, 1 = bir önceki hafta, vs.
  const [zoomFactor, setZoomFactor] = useState(1); // 1 = tüm hafta, >1 = daha fazla yakınlaştır
  const [zoomPosition, setZoomPosition] = useState(0); // 0-1 arası, yakınlaştırılmış pencerenin haftadaki konumu
  const [isDragging, setIsDragging] = useState(false); // Mini-bar sürükleme durumu
  const chartContainerRef = useRef(null);
  const rafIdRef = useRef(null);
  const barContainerRef = useRef(null);

  const MIN_WINDOW_RATIO = 0.05; // mini bar en az %5 genişlik
  const rawWindowRatio = zoomFactor > 1 ? Math.min(1, 1 / zoomFactor) : 1;
  const windowRatio = zoomFactor > 1 ? Math.max(rawWindowRatio, MIN_WINDOW_RATIO) : 1;
  const windowPercent = windowRatio * 100;
  const availableRatio = Math.max(0, 1 - windowRatio);
  const highlightWidthPercent = zoomFactor > 1 ? windowPercent : 100;
  const highlightLeftPercent = zoomFactor > 1 ? zoomPosition * (100 - highlightWidthPercent) : 0;
  
  // Toplam hafta sayısını hesapla (sabit - zoom seviyesine göre değişmez)
  const totalWeeks = useMemo(() => {
    return Math.ceil(fullChartData.length / oneWeekPoints);
  }, [fullChartData.length, oneWeekPoints]);
  
  // Başlangıçta son haftayı göster ve zoom'u sıfırla
  useEffect(() => {
    setWeekOffset(0); // Son hafta
    setZoomFactor(1);
    setZoomPosition(0);
  }, [data.length]);

  useEffect(() => {
    setZoomPosition(0);
  }, [weekOffset]);

  // Mini-bar sürükleme işlemi
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!barContainerRef.current || zoomFactor <= 1) return;

      const containerRect = barContainerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      
      // Mouse pozisyonunu 0-1 arasına normalize et
      const normalizedX = Math.max(0, Math.min(1, mouseX / containerWidth));
      
      // Pencere genişliği ve kaydırma aralığı
      const windowWidth = windowRatio; // 0-1 arası
      const maxStart = Math.max(0, 1 - windowWidth);
      const desiredStart = Math.max(0, Math.min(maxStart, normalizedX - windowWidth / 2));
      const normalizedPosition = maxStart > 0 ? desiredStart / maxStart : 0;
      
      setZoomPosition(Number(normalizedPosition.toFixed(3)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoomFactor, windowRatio]);
  
  // Mouse wheel ile zoom (Ctrl/Cmd + wheel) ve kaydırma (normal wheel)
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || chartType !== 'line') return;
    
    let lastWheelTime = 0;
    const throttleDelay = 150;
    
    const handleWheel = (e) => {
      if (fullChartData.length <= oneWeekPoints) return;
      
      e.preventDefault();
      
      const now = Date.now();
      if (now - lastWheelTime < throttleDelay) return;
      lastWheelTime = now;
      
      // Ctrl/Cmd + Wheel = Zoom
      if (e.ctrlKey || e.metaKey) {
        const zoomStep = 0.2;
        setZoomFactor(prev => {
          if (e.deltaY > 0) {
            // Tekerlek ileri (aşağı) -> yakınlaştır
            return Math.min(8, Math.round((prev + zoomStep) * 10) / 10);
          }
          // Tekerlek geri (yukarı) -> uzaklaştır
          const next = Math.max(1, Math.round((prev - zoomStep) * 10) / 10);
          if (next === 1) {
            setZoomPosition(0);
          }
          return next;
        });
      } else {
        if (zoomFactor > 1) {
          // Zoom yapılmışsa wheel kaydırma içinde gezsin
          const panStep = 0.05;
          const delta = e.deltaY > 0 ? panStep : -panStep;
          setZoomPosition(prev => {
            const next = Math.min(1, Math.max(0, prev + delta));
            return Number(next.toFixed(3));
          });
        } else {
          // Zoom yoksa haftalar arasında gez
          const deltaWeek = e.deltaY > 0 ? 1 : -1;
          
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
          }
          
          rafIdRef.current = requestAnimationFrame(() => {
            setWeekOffset(prev => {
              const maxOffset = Math.max(0, totalWeeks - 1);
              const newOffset = prev + deltaWeek;
              return Math.max(0, Math.min(maxOffset, newOffset));
            });
            rafIdRef.current = null;
          });
        }
      }
    };
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [chartType, fullChartData.length, oneWeekPoints, totalWeeks, zoomFactor]);
  
  // Veri yumuşatma fonksiyonu (sadece gerçekten ani sıçramaları önlemek için - minimal smoothing)
  const smoothData = (data, windowSize = 3) => {
    if (data.length <= windowSize) return data;
    
    return data.map((item, index) => {
      if (index === 0 || index === data.length - 1) {
        return item; // İlk ve son noktayı olduğu gibi bırak
      }
      
      // Komşu noktaların ortalamasını al (moving average)
      const start = Math.max(0, index - Math.floor(windowSize / 2));
      const end = Math.min(data.length, index + Math.ceil(windowSize / 2));
      const window = data.slice(start, end);
      
      const avgTemp = window.reduce((sum, d) => sum + d.temperature, 0) / window.length;
      const avgHum = window.reduce((sum, d) => sum + d.humidity, 0) / window.length;
      
      // Eğer değişim gerçekten çok büyükse (ani sıçrama), hafif yumuşat
      // Eşik değerlerini artırdık - sadece gerçek anomalileri yakala
      const tempDiff = Math.abs(item.temperature - avgTemp);
      const humDiff = Math.abs(item.humidity - avgHum);
      
      // Eğer değişim 3°C veya %7'den fazlaysa, hafif yumuşat (daha az agresif)
      const smoothedTemp = tempDiff > 3 ? avgTemp * 0.85 + item.temperature * 0.15 : item.temperature;
      const smoothedHum = humDiff > 7 ? avgHum * 0.85 + item.humidity * 0.15 : item.humidity;
      
      return {
        ...item,
        temperature: smoothedTemp,
        humidity: smoothedHum
      };
    });
  };

  // Gösterilecek veri (hafta bazlı + zoom seviyesine göre) - useMemo ile optimize edilmiş + yumuşatılmış
  const chartData = useMemo(() => {
    if (fullChartData.length <= oneWeekPoints) {
      // 1 haftadan az veri varsa tümünü göster
      return smoothData(fullChartData, 3);
    }
    
    // Hangi haftayı gösteriyoruz? (0 = son hafta, 1 = bir önceki hafta, vs.)
    const weekToShow = Math.min(weekOffset, totalWeeks - 1);
    
    // O haftanın başlangıç ve bitiş indeksleri
    const weekStartIndex = Math.max(0, fullChartData.length - (weekToShow + 1) * oneWeekPoints);
    const weekEndIndex = Math.min(fullChartData.length, weekStartIndex + oneWeekPoints);
    
    // Zoom seviyesine göre o hafta içinde ne kadar gösterileceğini hesapla
    const pointsToShow = Math.max(120, Math.round(oneWeekPoints * windowRatio));
    const availablePoints = Math.max(0, (weekEndIndex - weekStartIndex) - pointsToShow);
    const panOffset = zoomFactor > 1 ? Math.round(availablePoints * zoomPosition) : 0;
    const zoomStartIndex = weekStartIndex + panOffset;
    const zoomEndIndex = Math.min(weekEndIndex, zoomStartIndex + pointsToShow);
    
    const slicedData = fullChartData.slice(zoomStartIndex, zoomEndIndex);
    
    // Ani sıçramaları önlemek için veriyi yumuşat
    return smoothData(slicedData, 3);
  }, [fullChartData, weekOffset, oneWeekPoints, zoomFactor, zoomPosition, totalWeeks, windowRatio]);

  // Günlük max-min verileri hazırla
  const prepareDailyData = (data) => {
    const dailyGroups = {};
    
    data.forEach(item => {
      const date = format(new Date(item.timestamp), 'yyyy-MM-dd');
      if (!dailyGroups[date]) {
        dailyGroups[date] = {
          date: date,
          displayDate: format(new Date(item.timestamp), 'dd.MM', { locale: dateLocale }),
          temperatures: [],
          humidities: []
        };
      }
      dailyGroups[date].temperatures.push(item.temperature);
      dailyGroups[date].humidities.push(item.humidity);
    });
    
    return Object.values(dailyGroups).map(day => ({
      date: day.displayDate,
      tempMax: Math.max(...day.temperatures),
      tempMin: Math.min(...day.temperatures),
      humidityMax: Math.max(...day.humidities),
      humidityMin: Math.min(...day.humidities),
      // Stacking için - min değer + (max-min) aralığı
      tempBase: Math.min(...day.temperatures),
      tempStack: Math.max(...day.temperatures) - Math.min(...day.temperatures),
      humidityBase: Math.min(...day.humidities),
      humidityStack: Math.max(...day.humidities) - Math.min(...day.humidities)
    }));
  };

  // Bar chart için 1 haftalık window'daki verileri kullan (chartData'dan hazırla)
  const dailyData = useMemo(() => prepareDailyData(chartData), [chartData]);

  // Min-Max değerleri hesapla - useMemo ile optimize edilmiş
  const { tempMin, tempMax, humidityMin, humidityMax, tempDomain, humidityDomain } = useMemo(() => {
  const tempValues = data.map(item => item.temperature);
  const humidityValues = data.map(item => item.humidity);
  
    const tMin = Math.min(...tempValues);
    const tMax = Math.max(...tempValues);
    const hMin = Math.min(...humidityValues);
    const hMax = Math.max(...humidityValues);
  
  // Y ekseni için padding ekle (min-max'ın %10'u kadar)
    const tempPadding = (tMax - tMin) * 0.1;
    const humidityPadding = (hMax - hMin) * 0.1;
    
    return {
      tempMin: tMin,
      tempMax: tMax,
      humidityMin: hMin,
      humidityMax: hMax,
      tempDomain: [Math.max(0, tMin - tempPadding), tMax + tempPadding],
      humidityDomain: [Math.max(0, hMin - humidityPadding), hMax + humidityPadding]
    };
  }, [data]);

  return (
        <div 
          className="chart-container" 
          ref={chartContainerRef}
          style={{ 
            willChange: 'transform',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden'
          }}
        >
          <h3 className="chart-title">📊 {translate('tempHumDataAnalysis')}</h3>
          
          {/* Sekmeler */}
          <div style={{ 
            display: 'flex', 
            marginBottom: '20px',
            borderBottom: `1px solid ${borderColor}`,
            backgroundColor: isLightTheme ? 'rgba(249, 250, 251, 0.5)' : 'transparent',
            borderRadius: '8px 8px 0 0',
            padding: '4px'
          }}>
            <button
              onClick={() => setChartType('line')}
              style={{
                padding: '10px 20px',
                background: chartType === 'line' ? tabActiveBg : tabInactiveBg,
                border: 'none',
                color: textColor,
                cursor: 'pointer',
                borderBottom: chartType === 'line' ? `2px solid #667eea` : `2px solid transparent`,
                transition: 'all 0.3s ease',
                borderRadius: '6px 6px 0 0',
                fontWeight: chartType === 'line' ? '600' : '400'
              }}
            >
              📈 Line Graph
            </button>
            <button
              onClick={() => setChartType('bar')}
              style={{
                padding: '10px 20px',
                background: chartType === 'bar' ? tabActiveBg : tabInactiveBg,
                border: 'none',
                color: textColor,
                cursor: 'pointer',
                borderBottom: chartType === 'bar' ? `2px solid #667eea` : `2px solid transparent`,
                transition: 'all 0.3s ease',
                borderRadius: '6px 6px 0 0',
                fontWeight: chartType === 'bar' ? '600' : '400'
              }}
            >
              📊 {translate('tempHumDailyMaxMin')}
            </button>
          </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '10px',
        fontSize: '12px',
        color: secondaryTextColor,
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ color: isLightTheme ? '#d97706' : '#f5a623', fontWeight: '500' }}>
          🌡️ {translate('tempHumTemperature')}: {tempMin.toFixed(1)}°C - {tempMax.toFixed(1)}°C
        </div>
        <div style={{ color: isLightTheme ? '#2563eb' : '#4a90e2', fontWeight: '500' }}>
          💧 {translate('tempHumHumidity')}: {humidityMin.toFixed(1)}% - {humidityMax.toFixed(1)}%
        </div>
        {data.length > oneWeekPoints && (
          <div style={{ color: isLightTheme ? '#059669' : '#4ecdc4', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setWeekOffset(prev => Math.max(0, prev - 1));
              }}
              disabled={weekOffset === 0}
              style={{
                background: weekOffset === 0 ? buttonDisabledBg : buttonBg,
                border: `1px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.5)'}`,
                color: weekOffset === 0 ? (isLightTheme ? '#9ca3af' : 'rgba(255,255,255,0.5)') : buttonText,
                padding: '5px 10px',
                cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                opacity: weekOffset === 0 ? 0.5 : 1
              }}
            >
              ← {translate('tempHumPrevious')}
            </button>
            <span style={{ color: textColor, fontWeight: '500' }}>📅 {translate('tempHumZoom')}: {zoomFactor.toFixed(2)}x | {translate('tempHumWeek')}: {totalWeeks - weekOffset}/{totalWeeks}</span>
            <button
              onClick={() => {
                const maxOffset = Math.max(0, totalWeeks - 1);
                setWeekOffset(prev => Math.min(maxOffset, prev + 1));
              }}
              disabled={weekOffset >= totalWeeks - 1}
              style={{
                background: weekOffset >= totalWeeks - 1 ? buttonDisabledBg : buttonBg,
                border: `1px solid ${isLightTheme ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.5)'}`,
                color: weekOffset >= totalWeeks - 1 ? (isLightTheme ? '#9ca3af' : 'rgba(255,255,255,0.5)') : buttonText,
                padding: '5px 10px',
                cursor: weekOffset >= totalWeeks - 1 ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                opacity: weekOffset >= totalWeeks - 1 ? 0.5 : 1
              }}
            >
              {translate('tempHumNext')} →
            </button>
            <span style={{ fontSize: '11px', color: secondaryTextColor }}>
              ({translate('tempHumCtrlWheelZoom')} - {translate('tempHumWheelPan')})
            </span>
            {data.length > 1000 && (
              <span style={{ color: textColor, fontWeight: '500' }}>📊 {translate('tempHumRecords')}: {chartData.length}</span>
            )}
          </div>
        )}
      </div>
      {chartType === 'line' && data.length > oneWeekPoints && (
        <div style={{ margin: '5px 0 15px 0', padding: '6px 12px', background: isLightTheme ? 'rgba(249, 250, 251, 0.8)' : 'rgba(255,255,255,0.08)', borderRadius: '6px', border: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: secondaryTextColor, marginBottom: '4px' }}>
            <span>{translate('tempHumWeek')} Start</span>
            <span>{translate('tempHumWeek')} End</span>
          </div>
          <div 
            ref={barContainerRef}
            style={{ 
              position: 'relative', 
              height: '12px', 
              borderRadius: '6px', 
              background: 'rgba(255,255,255,0.15)', 
              overflow: 'visible',
              cursor: zoomFactor > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onMouseDown={(e) => {
              if (zoomFactor > 1 && barContainerRef.current) {
                e.preventDefault();
                setIsDragging(true);
              }
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(90deg, rgba(74,144,226,0.2), rgba(245,166,35,0.2))'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: `${highlightWidthPercent}%`,
                left: `${highlightLeftPercent}%`,
                borderRadius: '6px',
                background: 'linear-gradient(90deg, rgba(102,126,234,0.8), rgba(118,75,162,0.9))',
                boxShadow: isDragging ? '0 0 10px rgba(118,75,162,1)' : '0 0 6px rgba(118,75,162,0.8)',
                transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
                cursor: zoomFactor > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
            />
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: isLightTheme ? '#2563eb' : '#9ad9ff', textAlign: 'center', fontWeight: '500' }}>
            {zoomFactor > 1
              ? `${translate('tempHumZoomedWindow')}: ${Math.round(windowPercent)}% · ${translate('tempHumScrolling')}: ${highlightLeftPercent.toFixed(0)}%`
              : translate('tempHumFullWeek')}
          </div>
        </div>
      )}

          <ResponsiveContainer width="100%" height={450}>
            <ComposedChart 
              data={chartType === 'line' ? chartData : dailyData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={isLightTheme ? 0.2 : 0.3} />
              <XAxis 
                dataKey={chartType === 'line' ? "time" : "date"} 
                tick={{ fontSize: 12, fill: axisTextColor }}
                interval="preserveStartEnd"
                minTickGap={chartType === 'line' ? 50 : 30}
                angle={chartType === 'line' && chartData.length > 100 ? -45 : 0}
                textAnchor={chartType === 'line' && chartData.length > 100 ? 'end' : 'middle'}
                height={chartType === 'line' && chartData.length > 100 ? 60 : 30}
                stroke={axisTextColor}
              />
              <YAxis 
                yAxisId="temp"
                orientation="left"
                domain={tempDomain}
                label={{ 
                  value: `${translate('tempHumTemperature')} (°C)`, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: isLightTheme ? '#d97706' : '#f5a623', fontWeight: 'bold' }
                }}
                tick={{ fontSize: 12, fill: isLightTheme ? '#d97706' : '#f5a623' }}
                tickFormatter={(value) => value.toFixed(2)}
                stroke={isLightTheme ? '#d97706' : '#f5a623'}
              />
              <YAxis 
                yAxisId="humidity"
                orientation="right"
                domain={humidityDomain}
                label={{ 
                  value: `${translate('tempHumHumidity')} (%)`, 
                  angle: 90, 
                  position: 'insideRight',
                  style: { fill: isLightTheme ? '#2563eb' : '#4a90e2', fontWeight: 'bold' }
                }}
                tick={{ fontSize: 12, fill: isLightTheme ? '#2563eb' : '#4a90e2' }}
                tickFormatter={(value) => value.toFixed(2)}
                stroke={isLightTheme ? '#2563eb' : '#4a90e2'}
              />
              <Tooltip 
                content={(props) => <CustomTooltip {...props} chartType={chartType} currentLanguage={currentLanguage} theme={theme} />}
                animationDuration={0}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px', color: textColor }} 
                iconType="line"
              />
              {chartType === 'line' ? (
                <>
                  <Line 
                    yAxisId="humidity"
                    type="monotone" 
                    dataKey="humidity" 
                    stroke="#4a90e2" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#4a90e2', strokeWidth: 2 }}
                    name={`${translate('tempHumHumidity')} (%)`}
                    isAnimationActive={false}
                    connectNulls={true}
                  />
                  <Line 
                    yAxisId="temp"
                    type="monotone" 
                    dataKey="temperature" 
                    stroke="#f5a623" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: '#f5a623', strokeWidth: 2 }}
                    name={`${translate('tempHumTemperature')} (°C)`}
                    isAnimationActive={false}
                    connectNulls={true}
                  />
                </>
              ) : (
                <>
                  <Bar 
                    yAxisId="temp"
                    dataKey="tempBase" 
                    fill="#ff9999" 
                    name={`${translate('tempHumTemperatureMin')} (°C)`}
                    opacity={0.6}
                    stackId="temp"
                    isAnimationActive={false}
                  />
                  <Bar 
                    yAxisId="temp"
                    dataKey="tempStack" 
                    fill="#f5a623" 
                    name={`${translate('tempHumTemperatureMax')} (°C)`}
                    opacity={0.9}
                    stackId="temp"
                    isAnimationActive={false}
                  />
                  <Bar 
                    yAxisId="humidity"
                    dataKey="humidityBase" 
                    fill="#7dd3fc" 
                    name={`${translate('tempHumHumidityMin')} (%)`}
                    opacity={0.6}
                    stackId="humidity"
                    isAnimationActive={false}
                  />
                  <Bar 
                    yAxisId="humidity"
                    dataKey="humidityStack" 
                    fill="#4a90e2" 
                    name={`${translate('tempHumHumidityMax')} (%)`}
                    opacity={0.9}
                    stackId="humidity"
                    isAnimationActive={false}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
    </div>
  );
};

// Component'i memoize et (props değişmediği sürece re-render olmasın)
export default React.memo(CombinedChart, (prevProps, nextProps) => {
  // Sadece data referansı veya uzunluğu değiştiğinde re-render yap
  if (prevProps.data === nextProps.data) return true;
  if (!prevProps.data || !nextProps.data) return false;
  if (prevProps.data.length !== nextProps.data.length) return false;
  
  // İlk ve son elemanları kontrol et (hızlı kontrol)
  if (prevProps.data.length > 0 && nextProps.data.length > 0) {
    const prevFirst = prevProps.data[0];
    const nextFirst = nextProps.data[0];
    const prevLast = prevProps.data[prevProps.data.length - 1];
    const nextLast = nextProps.data[nextProps.data.length - 1];
    
    if (prevFirst?.timestamp !== nextFirst?.timestamp || 
        prevLast?.timestamp !== nextLast?.timestamp) {
      return false;
    }
  }
  
  return true; // Aynı görünüyor, re-render yapma
});
