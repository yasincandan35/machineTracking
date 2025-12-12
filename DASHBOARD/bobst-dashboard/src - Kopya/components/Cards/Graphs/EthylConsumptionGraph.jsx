import React, { useState, useRef, useMemo, useCallback } from 'react';
import { getTranslation } from '../../../utils/translations';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend
} from 'recharts';
import { Maximize2, ZoomIn, ZoomOut, Droplets } from 'lucide-react';

export default function EthylConsumptionGraph({ data, isDark = false, style, range = '24h', currentLanguage = 'tr' }) {
  const containerRef = useRef(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [chartType, setChartType] = useState('area'); // 'area' or 'line'
  const [showBrush, setShowBrush] = useState(false);

  // Akıllı veri örnekleme - performans için
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Veriyi temizle ve geçerli hale getir
    const cleanData = data
      .filter(point => {
        // Geçersiz değerleri filtrele
        if (!point || !point.kayitZamani) return false;
        
        // NaN ve Infinity değerleri filtrele
        const ethylAcetate = Number(point.ethylAcetateConsumption);
        const ethylAlcohol = Number(point.ethylAlcoholConsumption);
        if (isNaN(ethylAcetate) || !isFinite(ethylAcetate) || 
            isNaN(ethylAlcohol) || !isFinite(ethylAlcohol)) return false;
        
        // Geçersiz tarih kontrolü
        const timestamp = new Date(point.kayitZamani).getTime();
        if (isNaN(timestamp)) return false;
        
        return true;
      })
      .map(point => ({
        name: point.kayitZamani,
        ethylAcetate: Number(point.ethylAcetateConsumption),
        ethylAlcohol: Number(point.ethylAlcoholConsumption),
        timestamp: new Date(point.kayitZamani).getTime()
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (cleanData.length < 2) return cleanData.map(point => ({ 
      name: point.name, 
      ethylAcetate: point.ethylAcetate,
      ethylAlcohol: point.ethylAlcohol
    }));

    // Range'e göre maksimum nokta sayısı belirle
    let maxPoints;
    switch (range) {
      case '12h': maxPoints = 1440; break; // 12 saat * 60 dakika (1dk gruplama) - yüksek çözünürlük
      case '24h': maxPoints = 2880; break; // 24 saat * 60 dakika (1dk gruplama) - yüksek çözünürlük
      case '1w': maxPoints = 10080; break; // 7 gün * 1440 dakika (1dk gruplama) - yüksek çözünürlük
      case '1m': maxPoints = 43200; break; // 30 gün * 1440 dakika (1dk gruplama) - yüksek çözünürlük
      case '1y': maxPoints = 525600; break; // 365 gün * 1440 dakika (1dk gruplama) - yüksek çözünürlük
      default: maxPoints = 10000;
    }

    // Eğer veri nokta sayısı maksimumdan azsa, tümünü kullan
    if (cleanData.length <= maxPoints) {
      return cleanData.map(point => ({ 
        name: point.name, 
        ethylAcetate: point.ethylAcetate,
        ethylAlcohol: point.ethylAlcohol
      }));
    }

    // Akıllı örnekleme - önemli noktaları koru
    const step = Math.ceil(cleanData.length / maxPoints);
    const sampledData = [];
    
    for (let i = 0; i < cleanData.length; i += step) {
      const point = cleanData[i];
      
      // Eğer bu nokta ile önceki nokta arasında büyük fark varsa, önceki noktayı da ekle
      if (i > 0) {
        const prevPoint = cleanData[i - 1];
        const ethylAcetateChange = Math.abs(point.ethylAcetate - prevPoint.ethylAcetate);
        const ethylAlcoholChange = Math.abs(point.ethylAlcohol - prevPoint.ethylAlcohol);
        const avgEthylAcetate = (point.ethylAcetate + prevPoint.ethylAcetate) / 2;
        const avgEthylAlcohol = (point.ethylAlcohol + prevPoint.ethylAlcohol) / 2;
        
        // Daha hassas değişim algılama (12h/24h için %5, diğerleri için %8)
        const threshold = (range === '12h' || range === '24h') ? 0.05 : 0.08;
        if (ethylAcetateChange > avgEthylAcetate * threshold || 
            ethylAlcoholChange > avgEthylAlcohol * threshold) {
          sampledData.push({
            name: prevPoint.name,
            ethylAcetate: prevPoint.ethylAcetate,
            ethylAlcohol: prevPoint.ethylAlcohol
          });
        }
      }
      
      sampledData.push({
        name: point.name,
        ethylAcetate: point.ethylAcetate,
        ethylAlcohol: point.ethylAlcohol
      });
    }

    // Son noktayı ekle
    if (sampledData[sampledData.length - 1]?.name !== cleanData[cleanData.length - 1]?.name) {
      sampledData.push({
        name: cleanData[cleanData.length - 1].name,
        ethylAcetate: cleanData[cleanData.length - 1].ethylAcetate,
        ethylAlcohol: cleanData[cleanData.length - 1].ethylAlcohol
      });
    }

    // 12h/24h için ek hassasiyet - her 5. noktayı ekle
    if ((range === '12h' || range === '24h') && cleanData.length > 1000) {
      const additionalPoints = [];
      for (let i = 0; i < cleanData.length; i += 5) {
        if (!sampledData.find(p => p.name === cleanData[i].name)) {
          additionalPoints.push({
            name: cleanData[i].name,
            ethylAcetate: cleanData[i].ethylAcetate,
            ethylAlcohol: cleanData[i].ethylAlcohol
          });
        }
      }
      
      // Ek noktaları ekle ve sırala
      sampledData.push(...additionalPoints);
      sampledData.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
    }

    // Son kontrol - tüm değerlerin geçerli olduğundan emin ol
    return sampledData.filter(point => 
      point && 
      point.name && 
      typeof point.ethylAcetate === 'number' && 
      !isNaN(point.ethylAcetate) && 
      isFinite(point.ethylAcetate) &&
      typeof point.ethylAlcohol === 'number' && 
      !isNaN(point.ethylAlcohol) && 
      isFinite(point.ethylAlcohol)
    );
  }, [data, range]);

  // Gradient renkleri
  const gradientColors = useMemo(() => {
    if (isDark) {
      return {
        ethylAcetate: {
          start: 'rgba(6, 182, 212, 0.8)',
          end: 'rgba(6, 182, 212, 0.1)'
        },
        ethylAlcohol: {
          start: 'rgba(139, 92, 246, 0.8)',
          end: 'rgba(139, 92, 246, 0.1)'
        }
      };
    }
    return {
      ethylAcetate: {
        start: 'rgba(6, 182, 212, 0.6)',
        end: 'rgba(6, 182, 212, 0.05)'
      },
      ethylAlcohol: {
        start: 'rgba(139, 92, 246, 0.6)',
        end: 'rgba(139, 92, 246, 0.05)'
      }
    };
  }, [isDark]);

  // X ekseni ayarları
  const xAxisProps = {
    dataKey: "name",
    type: "category",
    tickFormatter: (value) => {
      if (!value) return '';
      
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return '';
        
        if (range === '12h' || range === '24h') {
          return date.toLocaleString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          });
        } else if (range === '1w') {
          return date.toLocaleString("tr-TR", {
            month: "short",
            day: "2-digit",
            hour: "2-digit"
          });
        } else if (range === '1m') {
          return date.toLocaleString("tr-TR", {
            month: "short",
            day: "2-digit"
          });
        } else {
          return date.toLocaleString("tr-TR", {
            month: "short",
            year: "2-digit"
          });
        }
      } catch (error) {
        console.warn('Date formatting error:', error);
        return '';
      }
    },
    tick: { 
      angle: range === '1y' ? -45 : 0, 
      textAnchor: range === '1y' ? "end" : "middle", 
      fontSize: 10 
    },
    stroke: isDark ? "#d1d5db" : "#374151",
    interval: Math.max(0, Math.ceil(processedData.length / 10)) // Maksimum 10 tick göster, negatif olmasın
  };

  // Tooltip ayarları
  const tooltipProps = {
    labelFormatter: (value) => {
      const date = new Date(value);
      return date.toLocaleString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
    },
    contentStyle: {
      backgroundColor: isDark ? "#111827" : "#ffffff",
      borderColor: isDark ? "#374151" : "#ccc",
      color: isDark ? "#f9fafb" : "#000000",
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
    },
    formatter: (value, name) => [`${parseFloat(value).toFixed(2)} L`, name],
    separator: ": "
  };

  // İstatistikler
  const stats = useMemo(() => {
    if (!processedData || processedData.length === 0) return { 
      ethylAcetate: { avg: 0, max: 0, min: 0, current: 0 },
      ethylAlcohol: { avg: 0, max: 0, min: 0, current: 0 }
    };
    
    try {
      const ethylAcetateValues = processedData
        .map(d => d.ethylAcetate)
        .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
      
      const ethylAlcoholValues = processedData
        .map(d => d.ethylAlcohol)
        .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
      
      if (ethylAcetateValues.length === 0 || ethylAlcoholValues.length === 0) {
        return { 
          ethylAcetate: { avg: 0, max: 0, min: 0, current: 0 },
          ethylAlcohol: { avg: 0, max: 0, min: 0, current: 0 }
        };
      }
      
      const currentEthylAcetate = processedData[processedData.length - 1]?.ethylAcetate || 0;
      const currentEthylAlcohol = processedData[processedData.length - 1]?.ethylAlcohol || 0;
      
      return {
        ethylAcetate: {
          avg: parseFloat((ethylAcetateValues.reduce((a, b) => a + b, 0) / ethylAcetateValues.length).toFixed(2)),
          max: parseFloat(Math.max(...ethylAcetateValues).toFixed(2)),
          min: parseFloat(Math.min(...ethylAcetateValues).toFixed(2)),
          current: parseFloat(currentEthylAcetate.toFixed(2))
        },
        ethylAlcohol: {
          avg: parseFloat((ethylAlcoholValues.reduce((a, b) => a + b, 0) / ethylAlcoholValues.length).toFixed(2)),
          max: parseFloat(Math.max(...ethylAlcoholValues).toFixed(2)),
          min: parseFloat(Math.min(...ethylAlcoholValues).toFixed(2)),
          current: parseFloat(currentEthylAlcohol.toFixed(2))
        }
      };
    } catch (error) {
      console.warn('Stats calculation error:', error);
      return { 
        ethylAcetate: { avg: 0, max: 0, min: 0, current: 0 },
        ethylAlcohol: { avg: 0, max: 0, min: 0, current: 0 }
      };
    }
  }, [processedData]);

  // Chart render fonksiyonu
  const renderChart = (height = 400, showBrushComponent = false) => {
    // Veri kontrolü
    if (!processedData || processedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Droplets size={48} className="mx-auto mb-2 opacity-50" />
            <p>{getTranslation('noDataFound', currentLanguage)}</p>
          </div>
        </div>
      );
    }

    const ChartComponent = chartType === 'area' ? AreaChart : LineChart;
    const DataComponent = chartType === 'area' ? Area : Line;
    
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent 
          data={processedData} 
          margin={{ top: 20, right: 30, left: 20, bottom: showBrushComponent ? 80 : 50 }}
          style={{ 
            backgroundColor: isDark ? "#1f2937" : (style?.backgroundColor || "#ffffff"),
            borderRadius: "8px"
          }}
        >
          <defs>
            <linearGradient id="ethylAcetateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColors.ethylAcetate.start} />
              <stop offset="95%" stopColor={gradientColors.ethylAcetate.end} />
            </linearGradient>
            <linearGradient id="ethylAlcoholGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColors.ethylAlcohol.start} />
              <stop offset="95%" stopColor={gradientColors.ethylAlcohol.end} />
            </linearGradient>
          </defs>
          
          <XAxis {...xAxisProps} />
          <YAxis 
            domain={[0, 'auto']} 
            stroke={isDark ? "#d1d5db" : "#374151"}
            tickFormatter={(value) => `${parseFloat(value).toFixed(2)} L`}
            label={{ 
              value: 'Litre', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle' },
              fill: isDark ? "#d1d5db" : "#374151"
            }}
          />
          <CartesianGrid 
            stroke={isDark ? "#4b5563" : "#e5e7eb"} 
            strokeDasharray="3 3" 
            opacity={0.3}
          />
          <Tooltip {...tooltipProps} />
          <Legend />
          
          {showBrushComponent && processedData.length > 10 && (
            <Brush 
              dataKey="name" 
              height={30} 
              stroke="#06b6d4"
              fill={isDark ? "#374151" : "#f3f4f6"}
            />
          )}
          
          <DataComponent
            type="monotone"
            dataKey="ethylAcetate"
            name="Etil Asetat"
            stroke="#06b6d4"
            fill={chartType === 'area' ? "url(#ethylAcetateGradient)" : undefined}
            dot={false}
            strokeWidth={chartType === 'area' ? 2 : 3}
            isAnimationActive={true}
            animationDuration={1500}
            animationEasing="ease-out"
          />
          
          <DataComponent
            type="monotone"
            dataKey="ethylAlcohol"
            name="Etil Alkol"
            stroke="#8b5cf6"
            fill={chartType === 'area' ? "url(#ethylAlcoholGradient)" : undefined}
            dot={false}
            strokeWidth={chartType === 'area' ? 2 : 3}
            isAnimationActive={true}
            animationDuration={1500}
            animationEasing="ease-out"
          />
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        className="relative rounded-lg shadow-lg p-6 bg-white dark:bg-gray-800 dark:text-gray-100 hover:shadow-xl transition-all duration-300"
        style={style}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Droplets size={20} className="text-cyan-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{getTranslation('ethylConsumptionGraph', currentLanguage)}</h3>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Chart Type Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setChartType('area')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  chartType === 'area' 
                    ? 'bg-cyan-500 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                {getTranslation('area', currentLanguage)}
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  chartType === 'line' 
                    ? 'bg-cyan-500 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'
                }`}
              >
                {getTranslation('line', currentLanguage)}
              </button>
            </div>
            
            {/* Brush Toggle */}
            <button
              onClick={() => setShowBrush(!showBrush)}
              className={`p-2 rounded-lg transition-all ${
                showBrush 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title="Zoom ve Pan"
            >
              {showBrush ? <ZoomOut size={16} /> : <ZoomIn size={16} />}
            </button>
            
            {/* Maximize */}
            <button
              onClick={() => setIsZoomed(true)}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
              title="Tam Ekran"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.ethylAcetate.current}</div>
            <div className="text-xs text-cyan-600 dark:text-cyan-400">{getTranslation('current', currentLanguage)} (Etil Asetat)</div>
          </div>
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.ethylAlcohol.current}</div>
            <div className="text-xs text-purple-600 dark:text-purple-400">{getTranslation('current', currentLanguage)} (Etil Alkol)</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.ethylAcetate.avg}</div>
            <div className="text-xs text-green-600 dark:text-green-400">{getTranslation('average', currentLanguage)} (Etil Asetat)</div>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.ethylAlcohol.avg}</div>
            <div className="text-xs text-orange-600 dark:text-orange-400">{getTranslation('average', currentLanguage)} (Etil Alkol)</div>
          </div>
        </div>

        {/* Chart */}
        {renderChart(350, showBrush)}
        
        {/* Range Info */}
        <div className="mt-3 text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {range === '12h' && `${getTranslation('last', currentLanguage)} ${getTranslation('hours12', currentLanguage)} (1${getTranslation('minute', currentLanguage)} ${getTranslation('resolution', currentLanguage)})`}
            {range === '24h' && `${getTranslation('last', currentLanguage)} ${getTranslation('hours24', currentLanguage)} (1${getTranslation('minute', currentLanguage)} ${getTranslation('resolution', currentLanguage)})`}
            {range === '1w' && `${getTranslation('last', currentLanguage)} ${getTranslation('week1', currentLanguage)} (1${getTranslation('minute', currentLanguage)} ${getTranslation('resolution', currentLanguage)})`}
            {range === '1m' && `${getTranslation('last', currentLanguage)} ${getTranslation('month1', currentLanguage)} (1${getTranslation('minute', currentLanguage)} ${getTranslation('resolution', currentLanguage)})`}
            {range === '1y' && `${getTranslation('last', currentLanguage)} ${getTranslation('year1', currentLanguage)} (1${getTranslation('minute', currentLanguage)} ${getTranslation('resolution', currentLanguage)})`}
            {' • '}{processedData.length} {getTranslation('dataPoints', currentLanguage)}
          </span>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isZoomed && (
        <div
          onClick={() => setIsZoomed(false)}
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
        >
          <div
            className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl shadow-2xl w-full max-w-7xl h-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold">{getTranslation('ethylConsumptionGraph', currentLanguage)} - {getTranslation('fullScreenView', currentLanguage)}</h3>
              <button
                onClick={() => setIsZoomed(false)}
                className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 h-full">
              {renderChart(600, true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 