import React, { useState, useEffect, memo, useCallback, useRef, useMemo } from 'react';
import { PieChart, Clock } from 'lucide-react';
import { useMachineScreen } from '../context';

const StoppageInfoCard = ({ currentOrder }) => {
  const { machineApi } = useMachineScreen();
  const [stoppageData, setStoppageData] = useState([]);
  const [loading, setLoading] = useState(true); // İlk yüklemede true
  const isInitialLoadRef = useRef(true); // İlk yükleme kontrolü
  const previousDataRef = useRef(null); // Önceki veriyi sakla
  const currentOrderRef = useRef(null); // currentOrder referansını sakla

  // Lokal saati UTC formatında gönder (Z ile ama lokal saat)
  const formatLocalAsUTC = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
  };

  // Duruş verilerini çek
  const fetchStoppageData = useCallback(async () => {
    try {
      // Sadece ilk yüklemede loading göster, sonraki güncellemelerde gösterme
      if (isInitialLoadRef.current) {
        setLoading(true);
      }

      // Backend otomatik olarak aktif işin cycle_start_time'ını bulup kullanacak
      // machineApi otomatik olarak machine parametresini ekler
      const response = await machineApi.get('/reports/stoppage-summary', { params: {} });
      const { data } = response;

      if (data?.success && data.data) {
        const processedData = data.data.map(item => ({
          categoryName: item.categoryName || 'Bilinmeyen',
          reasonName: item.reasonName || 'Bilinmeyen Sebep',
          duration: (item.totalDurationSeconds || 0) * 1000,
          durationSeconds: item.totalDurationSeconds || 0,
          count: item.count || 0
        }));

        processedData.sort((a, b) => b.durationSeconds - a.durationSeconds);

        // Eğer ilk yüklemeden sonra veri boş geliyorsa, mevcut grafiği koru (blink olmasın)
        if (!isInitialLoadRef.current && processedData.length === 0) {
          return;
        }

        // Eski veri ile karşılaştır; değişiklik yoksa hiç dokunma
        const newDataString = JSON.stringify(processedData);
        if (!isInitialLoadRef.current && previousDataRef.current === newDataString) {
          return;
        }

        previousDataRef.current = newDataString;
        setStoppageData(processedData);
      }
    } catch (error) {
      // sessiz geç
    } finally {
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setLoading(false);
      }
    }
  }, [machineApi]); // currentOrder'ı dependency'den çıkardık, ref ile kontrol edeceğiz

  // currentOrder değiştiğinde initial load'u resetle (sadece gerçekten değiştiyse)
  useEffect(() => {
    const currentOrderString = JSON.stringify(currentOrder);
    const previousOrderString = JSON.stringify(currentOrderRef.current);
    
    // Sadece gerçekten değiştiyse resetle
    if (currentOrderString !== previousOrderString) {
      currentOrderRef.current = currentOrder;
      isInitialLoadRef.current = true;
      previousDataRef.current = null;
      setStoppageData([]); // Veriyi temizle
      setLoading(true);
    }
  }, [currentOrder]);

  // Component mount olduğunda ve her 10 saniyede bir veri çek
  useEffect(() => {
    fetchStoppageData();
    const interval = setInterval(fetchStoppageData, 10000); // 10 saniye
    return () => clearInterval(interval);
  }, [fetchStoppageData]); // fetchStoppageData değiştiğinde yeniden çek

  // Süreyi formatla (saniye → ss:dd:sn)
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const totalDuration = useMemo(() => {
    return stoppageData.reduce((sum, item) => sum + item.durationSeconds, 0);
  }, [stoppageData]);

  // Başlık metnini belirle
  const getHeaderTitle = () => {
    if (currentOrder) {
      return 'Duruş Bilgileri (Aktif İş)';
    } else {
      return 'Duruş Bilgileri (Son 24 Saat)';
    }
  };

  // Aktif iş varken hiç duruş yoksa kartı gizle
  const shouldHideForActiveJob =
    !!currentOrder &&            // aktif iş var
    !loading &&                  // ilk yükleme bitti
    stoppageData.length === 0;   // hiç duruş kaydı yok

  if (shouldHideForActiveJob) {
    return null;
  }

  return (
    <div className="stoppage-info-card">
      <div className="card-header">
        <PieChart size={20} />
        <h2>{getHeaderTitle()}</h2>
      </div>
      
      <div className="stoppage-content">
        {loading ? (
          <div className="stoppage-loading">Yükleniyor...</div>
        ) : stoppageData.length === 0 ? (
          <div className="stoppage-empty">Duruş kaydı yok</div>
        ) : (
          <>
            {/* Pasta Grafik */}
            <div className="stoppage-chart">
              <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
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
                    
          // Unique key oluştur: reasonName + index + duration
          const uniqueKey = `path-${item.reasonName || 'unknown'}-${index}-${item.durationSeconds || 0}`;
          
          return (
            <path
              key={uniqueKey}
              d={pathData}
              fill={colors[index % colors.length]}
              stroke="rgba(30, 41, 59, 0.5)"
              strokeWidth="0.5"
            />
          );
                  });
                })()}
              </svg>
              
              {totalDuration > 0 && (
                <div className="chart-center-text">
                  <Clock size={16} />
                  <span>{formatDuration(totalDuration)}</span>
                </div>
              )}
            </div>
            
            {/* Duruş Sebepleri Listesi */}
            <div className="stoppage-list">
              {stoppageData.map((item, index) => {
                const percentage = totalDuration > 0 
                  ? ((item.durationSeconds / totalDuration) * 100).toFixed(1) 
                  : 0;
                
                // Unique key oluştur: reasonName + index + count
                const uniqueKey = `${item.reasonName || 'unknown'}-${index}-${item.count || 0}`;
                
                return (
                  <div key={uniqueKey} className="stoppage-item">
                    <div className="stoppage-item-header">
                      <div 
                        className="stoppage-color-dot" 
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="stoppage-name">{item.reasonName}</span>
                    </div>
                    <div className="stoppage-item-details">
                      <span className="stoppage-duration">{formatDuration(item.durationSeconds)}</span>
                      <span className="stoppage-percentage">{percentage}%</span>
                    </div>
                    <div className="stoppage-count">{item.count} kez</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

StoppageInfoCard.displayName = 'StoppageInfoCard';

// Custom comparison function - currentOrder'ı JSON ile karşılaştır
export default memo(StoppageInfoCard, (prevProps, nextProps) => {
  const prevOrderString = JSON.stringify(prevProps.currentOrder);
  const nextOrderString = JSON.stringify(nextProps.currentOrder);
  return prevOrderString === nextOrderString;
});

