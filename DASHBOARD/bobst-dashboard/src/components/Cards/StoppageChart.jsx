import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';
import { useCardStyle } from '../../hooks/useCardStyle';
import { PieChart, AlertTriangle, Clock } from 'lucide-react';
import { createMachineApi } from '../../utils/api';

export default function StoppageChart({ isDark = false, style, currentLanguage = 'tr', selectedMachine }) {
  const { isLiquidGlass } = useTheme();
  const [stoppageData, setStoppageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoadRef = useRef(true);
  const previousDataRef = useRef(null);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  
  // Kart stili için useCardStyle hook'u kullan - height otomatik (grid'den gelecek)
  const cardStyle = useCardStyle(style, '100%', 'stoppageChart');

  // StoppageInfoCard mantığına göre veri çekme
  const fetchStoppageData = useCallback(async () => {
    // Main Dashboard için stoppage chart render etme
    if (selectedMachine?.id === -1) {
      setStoppageData([]);
      setLoading(false);
      return;
    }
    
    if (!selectedMachine?.tableName) {
      setLoading(false);
      return;
    }

    try {
      // Sadece ilk yüklemede loading göster
      if (isInitialLoadRef.current) {
        setLoading(true);
      }

      // Backend otomatik olarak aktif işin cycle_start_time'ını bulup kullanacak
      // machineApi otomatik olarak machine parametresini ekler
      const machineApi = createMachineApi(selectedMachine);
      const params = {};

      const response = await machineApi.get('/reports/stoppage-summary', { params });
      const { data } = response;
      
      if (data.success && data.data) {
        // Veriyi işle - StoppageInfoCard gibi
        const processedData = data.data.map(item => ({
          categoryName: item.categoryName || 'Bilinmeyen',
          reasonName: item.reasonName || 'Bilinmeyen Sebep',
          categoryId: item.categoryId || 0,
          reasonId: item.reasonId || 0,
          duration: (item.totalDurationSeconds || 0) * 1000,
          durationSeconds: item.totalDurationSeconds || 0,
          count: item.count || 0,
          totalDurationSeconds: item.totalDurationSeconds || 0 // UI için
        }));
        
        // Süreye göre sırala (en uzun başta)
        processedData.sort((a, b) => b.durationSeconds - a.durationSeconds);
        
        // Eğer ilk yüklemeden sonra veri boş geliyorsa, mevcut grafiği koru
        if (!isInitialLoadRef.current && processedData.length === 0) {
          return;
        }

        // Eski veri ile karşılaştır - sadece değişiklik varsa güncelle
        const newDataString = JSON.stringify(processedData);
        const hasChanged = previousDataRef.current !== newDataString;
        
        if (hasChanged || isInitialLoadRef.current) {
          setStoppageData(processedData);
          previousDataRef.current = newDataString;
        }
      } else {
        // Veri yoksa da eski veriyi koru (temizleme)
      }
    } catch (error) {
      // Hata - sessizce devam et
    } finally {
      // Sadece ilk yüklemede loading'i kapat ve flag'i sıfırla
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setLoading(false);
      }
    }
  }, [selectedMachine]);

  // selectedMachine değiştiğinde initial load'u resetle
  useEffect(() => {
    isInitialLoadRef.current = true;
    previousDataRef.current = null;
    setStoppageData([]);
    setLoading(true);
  }, [selectedMachine]);

  // Component mount olduğunda ve her 10 saniyede bir veri çek (StoppageInfoCard gibi)
  useEffect(() => {
    fetchStoppageData();
    const interval = setInterval(fetchStoppageData, 10000); // 10 saniye
    return () => clearInterval(interval);
  }, [fetchStoppageData]);

  // Süre formatla (saniye -> ss:dd:ss)
  const formatDurationFromSeconds = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalDuration = stoppageData.reduce((sum, item) => {
    return sum + (item.durationSeconds || 0);
  }, 0);
  const totalCount = stoppageData.reduce((sum, item) => {
    return sum + (item.count || 0);
  }, 0);
  
  // Daha geniş renk paleti - daha fazla duruş türü için
  const colors = [
    '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316',
    '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e', '#a855f7', '#fb923c',
    '#0ea5e9', '#f87171', '#fbbf24', '#34d399', '#c084fc', '#fdba74',
    '#22d3ee', '#fb7185', '#fcd34d', '#6ee7b7', '#d8b4fe', '#fed7aa'
  ];

  return (
    <div 
      className={`${cardStyle.className} h-full flex flex-col overflow-visible`}
      style={{...cardStyle.style, height: '100%'}}
    >

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : stoppageData.length > 0 ? (
        <div className="flex flex-col md:flex-row gap-4 h-full min-h-0 overflow-visible md:max-h-[400px]">
          {/* 1. Bölüm: Pasta Grafiği + Header */}
          <div className="flex flex-col items-center md:items-start flex-shrink-0 md:w-[280px]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2 text-center md:text-left">
              <div className={`p-2 rounded-lg ${isLiquidGlass ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-900'}`}>
                <PieChart size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {getTranslation('stoppageDistribution', currentLanguage)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {getTranslation('activeJobRange', currentLanguage)}
                </p>
              </div>
            </div>
            
            {/* Pasta Grafiği */}
            <div className="flex items-center justify-center" style={{ overflow: 'visible' }}>
              <div 
                className="relative w-120 h-120 pie-chart-mobile" 
                style={{ overflow: 'visible' }}
              >
              <svg viewBox="0 0 200 200" className="w-full h-full" style={{ overflow: 'visible' }}>
                {(() => {
                  let cumulativePercentage = 0;
                  
                  return stoppageData.map((item, index) => {
                    const percentage = (item.durationSeconds / totalDuration) * 100;
                    const startAngle = (cumulativePercentage / 100) * 360;
                    const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                    cumulativePercentage += percentage;
                    
                    const radius = 100;
                    const centerX = 100;
                    const centerY = 100;
                    
                    const startAngleRad = (startAngle - 90) * (Math.PI / 180);
                    const endAngleRad = (endAngle - 90) * (Math.PI / 180);
                    
                    const x1 = centerX + radius * Math.cos(startAngleRad);
                    const y1 = centerY + radius * Math.sin(startAngleRad);
                    const x2 = centerX + radius * Math.cos(endAngleRad);
                    const y2 = centerY + radius * Math.sin(endAngleRad);
                    
                    const largeArcFlag = percentage > 50 ? 1 : 0;
                    
                    const pathData = [
                      `M ${centerX} ${centerY}`,
                      `L ${x1} ${y1}`,
                      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                      'Z'
                    ].join(' ');
                    
                                const isHovered = hoveredSlice && hoveredSlice.index === index;
                                const scale = isHovered ? 1.1 : 1;
                                
                                return (
                                  <g key={index}>
                                    <path
                                      d={pathData}
                                      fill={colors[index % colors.length]}
                                      stroke="transparent"
                                      strokeWidth="0"
                                      onMouseEnter={() => setHoveredSlice({ index, item, percentage })}
                                      onMouseLeave={() => setHoveredSlice(null)}
                                      style={{ 
                                        cursor: 'pointer',
                                        transform: `scale(${scale})`,
                                        transformOrigin: '100px 100px',
                                        transition: 'all 0.2s ease',
                                        filter: isHovered ? 'drop-shadow(0 16px 6px rgba(0, 0, 0, 0.9))' : 'none'
                                      }}
                                    />
                                  </g>
                                );
                  });
                })()}
              </svg>
              
              {/* Tooltip */}
              {hoveredSlice && (() => {
                // Dilimin ortasındaki açıyı hesapla
                let cumulative = 0;
                for (let i = 0; i < hoveredSlice.index; i++) {
                  cumulative += (stoppageData[i].durationSeconds / totalDuration) * 100;
                }
                const slicePercentage = (hoveredSlice.item.durationSeconds / totalDuration) * 100;
                const midAngle = ((cumulative + slicePercentage / 2) / 100) * 360 - 90;
                const midAngleRad = midAngle * (Math.PI / 180);
                
                // Tooltip pozisyonunu dilimin ortasına göre sabit mesafede hesapla
                // SVG viewBox: 200x200, center: 100,100
                // Pasta yarıçapı: 100, hover'da 1.1x: 110, + boşluk: 130
                const tooltipDistance = 130;
                const tooltipX = 100 + tooltipDistance * Math.cos(midAngleRad);
                const tooltipY = 100 + tooltipDistance * Math.sin(midAngleRad);
                
                // SVG koordinatlarını % olarak dönüştür (viewBox 200x200)
                const tooltipLeftPercent = (tooltipX / 200) * 100;
                const tooltipTopPercent = (tooltipY / 200) * 100;
                
                return (
                  <div 
                    className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm z-50 pointer-events-none whitespace-nowrap"
                    style={{
                      left: `${tooltipLeftPercent}%`,
                      top: `${tooltipTopPercent}%`,
                      transform: 'translate(-50%, -50%)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div className="font-semibold">{hoveredSlice.item.categoryName || 'Bilinmeyen'}</div>
                    <div className="text-xs opacity-80">{hoveredSlice.item.reasonName || 'Bilinmeyen Sebep'}</div>
                    <div className="text-xs mt-1">
                      {formatDurationFromSeconds(hoveredSlice.item.durationSeconds)} ({hoveredSlice.percentage.toFixed(1)}%)
                    </div>
                  </div>
                );
              })()}
              </div>
            </div>
          </div>
          
          {/* 2. Bölüm: Duruş Sebepleri - İlk Yarı */}
          <div className="flex-1 flex flex-col min-h-0 w-full">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 text-center md:text-left">
              {getTranslation('stoppageDistribution', currentLanguage)} (1-{Math.ceil(stoppageData.length / 2)})
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
              {stoppageData.slice(0, Math.ceil(stoppageData.length / 2)).map((item, index) => {
                const percentage = ((item.durationSeconds / totalDuration) * 100).toFixed(1);
                
                return (
                  <div key={index} className="flex items-center gap-2 text-xs py-0.5">
                    <div 
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate text-xs">
                        {item.categoryName || 'Bilinmeyen'}
                        {item.categoryId > 0 && item.reasonId > 0 && (
                          <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({item.categoryId}-{item.reasonId})</span>
                        )}
                        {item.count > 0 && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">{item.count} kez</span>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 truncate text-xs">
                        {item.reasonName || 'Bilinmeyen Sebep'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-gray-900 dark:text-white text-xs">
                        {formatDurationFromSeconds(item.durationSeconds)}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        ({percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* 3. Bölüm: Duruş Sebepleri - İkinci Yarı + Özet */}
          <div className="flex-1 flex flex-col min-h-0 w-full">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 text-center md:text-left">
              {getTranslation('stoppageDistribution', currentLanguage)} ({Math.ceil(stoppageData.length / 2) + 1}-{stoppageData.length})
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto min-h-0">
              {stoppageData.slice(Math.ceil(stoppageData.length / 2)).map((item, index) => {
                const percentage = ((item.durationSeconds / totalDuration) * 100).toFixed(1);
                const actualIndex = Math.ceil(stoppageData.length / 2) + index;
                
                return (
                  <div key={actualIndex} className="flex items-center gap-2 text-xs py-0.5">
                    <div 
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ backgroundColor: colors[actualIndex % colors.length] }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate text-xs">
                        {item.categoryName || 'Bilinmeyen'}
                        {item.categoryId > 0 && item.reasonId > 0 && (
                          <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({item.categoryId}-{item.reasonId})</span>
                        )}
                        {item.count > 0 && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">{item.count} kez</span>
                        )}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 truncate text-xs">
                        {item.reasonName || 'Bilinmeyen Sebep'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-medium text-gray-900 dark:text-white text-xs">
                        {formatDurationFromSeconds(item.durationSeconds)}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">
                        ({percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Özet Bilgiler - Yan Yana */}
            <div className="pt-2 border-t-2 border-gray-300 dark:border-gray-500 flex-shrink-0">
              <div className="flex flex-col md:flex-row gap-4 md:gap-6 text-xs items-center md:items-start text-center md:text-left">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-500" />
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {getTranslation('totalStoppage', currentLanguage)}:
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {formatDurationFromSeconds(totalDuration)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-gray-500" />
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {getTranslation('stoppageCount', currentLanguage)}:
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {totalCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <PieChart size={48} className="mx-auto mb-2 opacity-50" />
          <p>{getTranslation('noStoppageData', currentLanguage)}</p>
        </div>
      )}

    </div>
  );
}
