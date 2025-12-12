import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { useCardStyle } from '../../hooks/useCardStyle';
import { getTranslation } from '../../utils/translations';

const OEEGauge = ({ darkMode, colorSettings, liveData, style, currentLanguage = 'tr' }) => {
  const [oeeData, setOeeData] = useState({
    availability: 0,
    performance: 0,
    quality: 0,
    overall: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTooltip, setShowTooltip] = useState(null);
  
  // Otomatik yükseklik hesaplama - cardKey ile
  const cardStyle = useCardStyle(style, '140px', 'oeeGauge');

  // PLC'den gelen OEE verilerini kullan
  const calculateOEE = () => {
    try {
      if (!liveData) {
        setError('Canlı veri bulunamadı');
        return;
      }

      // PLC'den hesaplanmış OEE verilerini kullan
      const overallOEE = parseFloat(liveData.overallOEE?.toString().replace(',', '.')) || 0;
      const availability = parseFloat(liveData.availability?.toString().replace(',', '.')) || 0;
      const performance = parseFloat(liveData.performance?.toString().replace(',', '.')) || 0;
      const quality = parseFloat(liveData.quality?.toString().replace(',', '.')) || 0;
      
      setOeeData({
        availability: Math.round(availability * 100) / 100,
        performance: Math.round(performance * 100) / 100,
        quality: Math.round(quality * 100) / 100,
        overall: Math.round(overallOEE * 100) / 100
      });
      
      setError(null);
    } catch (err) {
      console.error('OEE hesaplama hatası:', err);
      setError(`OEE hesaplama hatası: ${err.message}`);
    }
  };

  useEffect(() => {
    if (liveData) {
      setIsLoading(false);
      calculateOEE();
    }
  }, [liveData]);

  // Gauge renk hesaplama
  const getGaugeColor = (value) => {
    if (value >= 80) return '#4ADE80'; // Koyu pastel yeşil
    if (value >= 60) return '#FBBF24'; // Koyu pastel sarı
    return '#F87171'; // Koyu pastel kırmızı
  };

  // PLC'den gelen OEE detay verilerini al
  const getCalculationParams = () => {
    if (!liveData) return null;
    
    const setupTime = parseFloat(liveData.setup?.toString().replace(',', '.')) || 0;
    const plannedTimeBase = parseFloat(liveData.plannedTime?.toString().replace(',', '.')) || 0;
    const plannedTimeWithSetup = plannedTimeBase + setupTime; // Planlanan süreye SETUP ekle
    
    return {
      overallOEE: parseFloat(liveData.overallOEE?.toString().replace(',', '.')) || 0,
      availability: parseFloat(liveData.availability?.toString().replace(',', '.')) || 0,
      performance: parseFloat(liveData.performance?.toString().replace(',', '.')) || 0,
      quality: parseFloat(liveData.quality?.toString().replace(',', '.')) || 0,
      uretimHizAdetDakika: parseFloat(liveData.uretimHizAdetDakika?.toString().replace(',', '.')) || 0,
      hedefUretimHizAdetDakika: parseFloat(liveData.hedefUretimHizAdetDakika?.toString().replace(',', '.')) || 0,
      plannedTime: plannedTimeWithSetup,
      plannedTimeBase: plannedTimeBase,
      setupTime: setupTime,
      totalStoppageDuration: parseFloat(liveData.totalStoppageDuration?.toString().replace(',', '.')) || 0
    };
  };

  // Tooltip içeriği - PLC'den gelen veriler
  const getTooltipContent = (type) => {
    const params = getCalculationParams();
    if (!params) return null;

    switch (type) {
      case 'availability':
        const availabilityValues = [
          { label: getTranslation('plannedTime', currentLanguage), value: `${params.plannedTime.toFixed(2)} ${getTranslation('minutes', currentLanguage)}` }
        ];
        
        // Setup süresini her zaman göster (0 olsa bile bilgilendirme için)
        if (params.setupTime > 0) {
          availabilityValues.push({ 
            label: 'Planlanan Setup Süresi', 
            value: `${params.setupTime.toFixed(2)} ${getTranslation('minutes', currentLanguage)}` 
          });
          // Planlanan süre açıklamasını güncelle
          availabilityValues[0] = { 
            label: `${getTranslation('plannedTime', currentLanguage)} (Setup dahil)`, 
            value: `${params.plannedTime.toFixed(2)} ${getTranslation('minutes', currentLanguage)}` 
          };
        }
        
        availabilityValues.push(
          { label: getTranslation('stoppageTime', currentLanguage), value: `${(params.totalStoppageDuration / 60000).toFixed(2)} ${getTranslation('minutes', currentLanguage)}` },
          { label: getTranslation('result', currentLanguage), value: `${params.availability.toFixed(1)}%` }
        );
        
        return {
          title: getTranslation('availabilityCalculationPLC', currentLanguage),
          formula: getTranslation('availabilityFormula', currentLanguage),
          values: availabilityValues
        };
      case 'performance':
        return {
          title: getTranslation('performanceCalculationPLC', currentLanguage),
          formula: getTranslation('performanceFormula', currentLanguage),
          values: [
            { label: getTranslation('actualSpeed', currentLanguage), value: `${params.uretimHizAdetDakika.toFixed(1)} ${getTranslation('piecesPerMinute', currentLanguage)}` },
            { label: getTranslation('targetSpeed', currentLanguage), value: `${params.hedefUretimHizAdetDakika.toFixed(1)} ${getTranslation('piecesPerMinute', currentLanguage)}` },
            { label: getTranslation('result', currentLanguage), value: `${params.performance.toFixed(1)}%` }
          ]
        };
      case 'quality':
        return {
          title: getTranslation('qualityCalculationPLC', currentLanguage),
          formula: getTranslation('qualityFormula', currentLanguage),
          values: [
            { label: getTranslation('instantProduction', currentLanguage), value: `${parseFloat(liveData.actualProduction || 0).toFixed(0)} ${getTranslation('pieces', currentLanguage)}` },
            { label: getTranslation('defectiveProduction', currentLanguage), value: `${parseFloat(liveData.wastageAfterDie || 0).toFixed(0)} ${getTranslation('pieces', currentLanguage)}` },
            { label: getTranslation('plcCalculation', currentLanguage), value: getTranslation('calculatedByPLC', currentLanguage) },
            { label: getTranslation('result', currentLanguage), value: `${params.quality.toFixed(1)}%` }
          ]
        };
      default:
        return null;
    }
  };

  // Circular Progress Ring çizimi
  const drawProgressRing = (canvas, value, color, size = 'large') => {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let radius, lineWidth, fontSize, textOffset;
    
    if (size === 'large') {
      radius = 80;
      lineWidth = 16;
      fontSize = 'bold 36px Inter, Arial, sans-serif';
      textOffset = 8;
    } else {
      radius = 25;
      lineWidth = 4;
      fontSize = 'bold 12px Inter, Arial, sans-serif';
      textOffset = 4;
    }
    
    // Canvas'ı temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Arka plan ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = darkMode ? '#374151' : '#E5E7EB';
    ctx.stroke();
    
    // Progress ring
    const startAngle = -Math.PI / 2; // 12 o'clock pozisyonu
    const endAngle = startAngle + (value / 100) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Değer metni
    ctx.fillStyle = darkMode ? '#F9FAFB' : '#111827';
    ctx.font = fontSize;
    ctx.textAlign = 'center';
    ctx.fillText(`${value.toFixed(1)}%`, centerX, centerY + textOffset);
  };

  // Canvas referansları
  const mainRingRef = useRef(null);
  const availabilityRingRef = useRef(null);
  const performanceRingRef = useRef(null);
  const qualityRingRef = useRef(null);

  // Ring'leri çiz
  useEffect(() => {
    if (mainRingRef.current) {
      drawProgressRing(mainRingRef.current, oeeData.overall, getGaugeColor(oeeData.overall), 'large');
    }
    if (availabilityRingRef.current) {
      drawProgressRing(availabilityRingRef.current, oeeData.availability, '#3B82F6', 'small');
    }
    if (performanceRingRef.current) {
      drawProgressRing(performanceRingRef.current, oeeData.performance, '#10B981', 'small');
    }
    if (qualityRingRef.current) {
      drawProgressRing(qualityRingRef.current, oeeData.quality, '#8B5CF6', 'small');
    }
  }, [oeeData, darkMode]);

  if (isLoading) {
    return (
      <div 
        className={cardStyle.className}
        style={cardStyle.style}
      >
        <div className="flex items-center justify-center h-full">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-500"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={cardStyle.className}
        style={cardStyle.style}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              darkMode ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <svg className={`w-8 h-8 ${darkMode ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Başlık - Sol üst köşe */}
      <div className="absolute top-3 left-3 z-10">
        <h2 className="text-2xl font-bold">{getTranslation('oee', currentLanguage)}</h2>
      </div>
      
      {/* Ana OEE Progress Ring */}
      <div className="flex justify-center mb-6 pt-8">
        <div className="relative w-[180px] h-[180px]">
          <canvas
            ref={mainRingRef}
            width={180}
            height={180}
            className="w-full h-full"
          />
            </div>
          </div>
          
      {/* Alt Progress Ring'ler */}
      <div className="grid grid-cols-3 gap-4 px-4 mb-4">
        {/* Erişebilirlik */}
        <div className="text-center relative">
          <div className="relative w-[60px] h-[60px] mx-auto mb-2">
            <canvas
              ref={availabilityRingRef}
              width={60}
              height={60}
              className="w-full h-full"
            />
          </div>
          <div 
            className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1"
            onClick={() => setShowTooltip(showTooltip === 'availability' ? null : 'availability')}
          >
            {getTranslation('availability', currentLanguage)}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Performans */}
        <div className="text-center relative">
          <div className="relative w-[60px] h-[60px] mx-auto mb-2">
              <canvas
              ref={performanceRingRef}
              width={60}
              height={60}
              className="w-full h-full"
            />
          </div>
          <div 
            className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-green-600 dark:hover:text-green-400 flex items-center justify-center gap-1"
            onClick={() => setShowTooltip(showTooltip === 'performance' ? null : 'performance')}
          >
            {getTranslation('performance', currentLanguage)}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
              </div>
          </div>

        {/* Kalite */}
        <div className="text-center relative">
          <div className="relative w-[60px] h-[60px] mx-auto mb-2">
              <canvas
              ref={qualityRingRef}
              width={60}
              height={60}
              className="w-full h-full"
            />
          </div>
          <div 
            className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1"
            onClick={() => setShowTooltip(showTooltip === 'quality' ? null : 'quality')}
          >
            {getTranslation('quality', currentLanguage)}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
              </div>
            </div>
          </div>

      {/* OEE durumu */}
      <div className="text-center mt-4">
        <div className={`text-sm font-medium px-3 py-1 rounded-full inline-block ${
          oeeData.overall >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          oeeData.overall >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          oeeData.overall >= 40 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {oeeData.overall >= 80 ? getTranslation('excellent', currentLanguage) :
           oeeData.overall >= 60 ? getTranslation('good', currentLanguage) :
           oeeData.overall >= 40 ? getTranslation('average', currentLanguage) :
           getTranslation('poor', currentLanguage)}
              </div>
            </div>

      {/* Hesaplama Tooltip */}
      {showTooltip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTooltip(null)}>
          <div 
            className={`max-w-md w-full mx-4 p-6 rounded-lg shadow-xl ${
              darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const content = getTooltipContent(showTooltip);
              if (!content) return null;
              
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{content.title}</h3>
                    <button 
                      onClick={() => setShowTooltip(null)}
                      className={`p-1 rounded-full hover:bg-opacity-20 ${
                        darkMode ? 'hover:bg-white' : 'hover:bg-gray-200'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
          </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">{getTranslation('formula', currentLanguage)}:</h4>
                    <div className={`p-3 rounded-md text-sm font-mono ${
                      darkMode ? 'bg-gray-700' : 'bg-gray-100'
                    }`}>
                      {content.formula}
          </div>
        </div>
        
                  <div>
                    <h4 className="text-sm font-medium mb-2">{getTranslation('values', currentLanguage)}:</h4>
                    <div className="space-y-2">
                      {content.values.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-1">
                          <span className="text-sm">{item.label}:</span>
                          <span className={`text-sm font-semibold ${
                            showTooltip === 'availability' ? 'text-blue-600 dark:text-blue-400' :
                            showTooltip === 'performance' ? 'text-green-600 dark:text-green-400' :
                            'text-purple-600 dark:text-purple-400'
                          }`}>
                            {item.value}
            </span>
          </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
        </div>
      </div>
      )}
    </div>
  );
};

export default OEEGauge;
