import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Gauge, 
  Package, 
  TrendingUp, 
  Target,
  Ruler,
  Clock,
  Layers,
  Zap,
  Timer,
  BarChart3
} from 'lucide-react';
import { getTranslation } from '../../utils/translations';
import { dashboardApi } from '../../utils/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function MachineOverviewCard({ 
  machine,
  style, 
  currentLanguage = 'tr',
  isDark = false
}) {
  const { isLiquidGlass, isGlass, isFluid } = useTheme();
  const [liveData, setLiveData] = useState({
    machineSpeed: 0,
    actualProduction: 0,
    remainingWork: 0,
    estimatedTime: 0,
    paperConsumption: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    overallOEE: 0,
    goodPallets: 0,
    isRunning: false,
    lastUpdate: null
  });

  const [jobData, setJobData] = useState({
    toplamMiktar: 0,
    hedefHiz: 0,
    siparisNo: '',
    brutKartonMt: 0,
    paletAdet: 0,
  });

  // PLC'den canlı veri çek
  useEffect(() => {
    if (!machine?.tableName) return;

    let isMounted = true;

    const fetchMachineData = async () => {
      try {
        const response = await dashboardApi.get('/plcdata/data', {
          params: { machine: machine.tableName }
        });
        if (!isMounted) return;

        const data = response.data || {};

        setLiveData({
          machineSpeed: data.machineSpeed ?? data.machine_speed ?? 0,
          actualProduction: data.actualProduction ?? data.actual_production ?? 0,
          remainingWork: data.remainingWork ?? data.remaining_work ?? 0,
          estimatedTime: data.estimatedTime ?? data.estimated_time ?? 0,
          paperConsumption: data.paperConsumption ?? data.paper_consumption ?? 0,
          availability: data.availability ?? 0,
          performance: data.performance ?? 0,
          quality: data.quality ?? 0,
          overallOEE: data.overallOEE ?? 0,
          goodPallets: data.goodPallets ?? data.good_pallets ?? 0,
          isRunning: (data.machineSpeed ?? data.machine_speed ?? 0) > 0,
          lastUpdate: new Date()
        });
      } catch (err) {
        if (isMounted) {
          console.warn(`⚠️ ${machine.name} PLC verisi alınamadı:`, err);
        }
      }
    };

    fetchMachineData();
    const interval = setInterval(fetchMachineData, 200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [machine?.tableName, machine?.name]);

  // Job verisini veritabanından oku
  useEffect(() => {
    if (!machine?.tableName) return;

    let isMounted = true;

    const fetchJobData = async () => {
      try {
        const response = await dashboardApi.get('/plcdata/active-job', {
          params: { machine: machine.tableName }
        });
        if (!isMounted) return;

        if (response.data?.success && response.data?.data) {
          const payload = response.data.data;
          setJobData({
            toplamMiktar: payload.toplam_miktar || payload.totalQuantity || 0,
            hedefHiz: payload.hedef_hiz || payload.targetSpeed || 0,
            siparisNo: payload.siparis_no || payload.orderNumber || '',
            brutKartonMt: typeof payload.brut_karton_mt === 'number'
              ? payload.brut_karton_mt
              : parseFloat((payload.brut_karton_mt ?? '0').toString().replace(',', '.')) || 0,
            paletAdet: typeof payload.palet_adet === 'number'
              ? payload.palet_adet
              : parseFloat((payload.palet_adet ?? '0').toString().replace(',', '.')) || 0,
          });
        } else {
          // Aktif iş emri yoksa varsayılan değerler
          setJobData({
            toplamMiktar: 0,
            hedefHiz: 0,
            siparisNo: '',
            brutKartonMt: 0,
            paletAdet: 0,
          });
        }
      } catch (err) {
        if (isMounted) {
          console.warn(`⚠️ ${machine.name} iş emri verisi alınamadı:`, err);
        }
      }
    };

    fetchJobData();
    const interval = setInterval(fetchJobData, 2000); // 2 saniyede bir güncelle
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [machine?.tableName, machine?.name]);

  const cardStyle = isLiquidGlass || isGlass || isFluid
    ? (() => {
        const { backgroundColor, background, ...rest } = style || {};
        return rest;
      })()
    : {
        background: isDark 
          ? 'linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)'
          : '#ffffff',
        ...style
      };

  const oeeValue = liveData.overallOEE || 0;
  const oeeColor = oeeValue >= 80 ? '#10b981' : oeeValue >= 60 ? '#f59e0b' : '#ef4444';

  // Süre formatla (dakika → gün:saat:dakika)
  const formatTime = (minutes) => {
    if (minutes <= 0) return '00:00:00';
    const days = Math.floor(minutes / 1440); // 1440 dakika = 1 gün
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Hız yüzdesi hesapla
  const speedPercentage = jobData.hedefHiz > 0 
    ? Math.min((liveData.machineSpeed / jobData.hedefHiz) * 100, 100)
    : 0;

  // Üretim yüzdesi hesapla
  const totalQuantity = jobData.toplamMiktar;
  const producedQuantity = liveData.actualProduction;
  const remainingQuantity = liveData.remainingWork;
  const productionPercentage = totalQuantity > 0 
    ? (producedQuantity / totalQuantity) * 100
    : 0;
  const productionBarWidth = Math.min(productionPercentage, 100); // Bar maksimum %100'de kalır

  const meterOrderValue = jobData.brutKartonMt;
  const palletOrderValue = jobData.paletAdet;
  const meterProducedValue = liveData.paperConsumption || 0; // Direkt metre olarak geliyor
  const meterRemainingValue = Math.max(0, meterOrderValue - meterProducedValue); // Kalan metre (negatif olamaz)
  
  const palletProducedValue = liveData.goodPallets || 0; // Üretilen palet sayısı
  const palletRemainingValue = Math.max(0, palletOrderValue - palletProducedValue); // Kalan palet (negatif olamaz)
  const meterPercentage = meterOrderValue > 0 
    ? (meterProducedValue / meterOrderValue) * 100 
    : 0;
  const meterBarWidth = Math.min(meterPercentage, 100); // Bar maksimum %100'de kalır
  const formatNumber = (value, fraction = 2) => {
    if (value === null || value === undefined) return '0';
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return '0';
    // Değeri yuvarla ve sabit ondalık basamak sayısıyla göster (git gel yapmasın)
    const rounded = Math.round(parsed * Math.pow(10, fraction)) / Math.pow(10, fraction);
    return rounded.toLocaleString('tr-TR', {
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    });
  };

  return (
    <div
      className={`h-full w-full overflow-hidden transition-all duration-300 flex flex-col ${
        isFluid ? 'fluid-glass-card' : isGlass ? 'real-glass-card' : isLiquidGlass ? 'glass-card' : `rounded-2xl shadow-2xl border-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`
      }`}
      style={{
        ...cardStyle,
        fontSize: 'clamp(0.75rem, 1vw, 1rem)'
      }}
    >
      {/* ============ HEADER ============ */}
      <div className={`flex-shrink-0 p-3 border-b relative ${
        liveData.isRunning 
          ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600' 
          : 'bg-gradient-to-br from-red-400 via-red-500 to-red-600'
      }`} style={{ 
        overflow: 'visible',
        ...((isGlass || isFluid) && {
          background: liveData.isRunning 
            ? `linear-gradient(135deg, rgba(52, 211, 153, ${isFluid ? '0.4' : '0.6'}), rgba(16, 185, 129, ${isFluid ? '0.4' : '0.6'}))` 
            : `linear-gradient(135deg, rgba(239, 68, 68, ${isFluid ? '0.4' : '0.6'}), rgba(220, 38, 38, ${isFluid ? '0.4' : '0.6'}))`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)'
        })
      }}>
        {/* Makina Silüeti - Arka Plan */}
        <div className="absolute right-4 top-1/2 opacity-15 pointer-events-none" style={{ transform: 'translateY(-42%)' }}>
          <img 
            src="/lpng/l3komple.png" 
            alt="Machine Silhouette" 
            className="w-auto object-contain filter brightness-0 invert  "
            style={{ height: '220px' }}
          />
        </div>
        
        <div className="relative z-10 flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/20 backdrop-blur-sm">
            <Activity className={`w-6 h-6 text-white ${liveData.isRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white drop-shadow-lg">{machine.name}</h3>
            {jobData.siparisNo && (
              <p className="text-xs text-white/90 font-mono">#{jobData.siparisNo}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-2 gap-1 min-h-0 overflow-y-auto">
        
        {/* ============ OEE ============ */}
        <div className={`flex-shrink-0 rounded-lg p-3 ${
          isFluid ? 'fluid-section' : isGlass ? 'stained-glass-oee engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-800/20'
        }`}>
          <div className="flex items-center gap-4">
            {/* OEE Circle */}
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                <circle
                  cx="64" cy="64" r="56"
                  stroke={oeeColor}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - oeeValue / 100)}`}
                  className="transition-all duration-1000"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={{ fontSize: '1.8em', fontWeight: 'bold', color: oeeColor }}>
                  {oeeValue.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 font-semibold">OEE</span>
              </div>
            </div>

            {/* OEE Components */}
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className={`text-center p-2 rounded-lg ${isFluid ? 'fluid-inner' : isGlass ? 'glass-inner-card engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-blue-50 dark:bg-blue-900/30'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">A</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-blue-600 dark:text-blue-400">
                  {liveData.availability.toFixed(1)}%
                </p>
              </div>
              <div className={`text-center p-2 rounded-lg ${isFluid ? 'fluid-inner' : isGlass ? 'glass-inner-card engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-purple-50 dark:bg-purple-900/30'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">P</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-purple-600 dark:text-purple-400">
                  {liveData.performance.toFixed(1)}%
                </p>
              </div>
              <div className={`text-center p-2 rounded-lg ${isFluid ? 'fluid-inner' : isGlass ? 'glass-inner-card engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-green-50 dark:bg-green-900/30'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Q</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-green-600 dark:text-green-400">
                  {liveData.quality.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============ BASKΙ HIZI - PROGRESS BAR ============ */}
        <div className={`flex-shrink-0 rounded-lg p-2 ${
          isFluid ? 'fluid-section' : isGlass ? 'stained-glass-speed engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{getTranslation('machineSpeed', currentLanguage)}</p>
            <div className="text-right">
              <span style={{ fontSize: '2.5em' }} className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                {Math.round(liveData.machineSpeed)}
              </span>
              <span style={{ fontSize: '1.25em' }} className="text-gray-500"> / {jobData.hedefHiz || 0}</span>
              <span className="text-sm text-gray-500"> {getTranslation('meterPerMinute', currentLanguage)}</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="relative w-full rounded-full h-8" style={{
            background: (isGlass || isFluid)
              ? 'rgba(255, 255, 255, 0.2)' 
              : 'rgb(229, 231, 235)',
            backdropFilter: (isGlass || isFluid) ? 'blur(5px)' : 'none',
            border: (isGlass || isFluid) ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'
          }}>
            <div 
              className="h-8 transition-all duration-500 rounded-full"
              style={{ 
                width: `${speedPercentage}%`,
                background: (isGlass || isFluid)
                  ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.7), rgba(79, 70, 229, 0.7))'
                  : 'linear-gradient(to right, rgb(99, 102, 241), rgb(79, 70, 229))',
                boxShadow: (isGlass || isFluid) ? '0 0 15px rgba(99, 102, 241, 0.4)' : 'none'
              }}
            >
            </div>
            <span 
              className="absolute top-1/2 -translate-y-1/2 text-sm font-bold transition-all duration-500"
              style={{ 
                left: `${speedPercentage}%`,
                transform: speedPercentage >= 20 ? 'translate(-100%, -50%)' : 'translate(0%, -50%)',
                marginLeft: speedPercentage >= 20 ? '-4px' : '4px',
                color: speedPercentage >= 20 ? 'white' : '#1e40af'
              }}
            >
              {speedPercentage.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* ============ ÜRETİM DURUMU (ADET, METRE, PALET) ============ */}
        <div className={`flex-shrink-0 rounded-lg p-2 ${
          isFluid ? 'fluid-section' : isGlass ? 'stained-glass-production engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
        }`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-2">{getTranslation('productionStatus', currentLanguage)}</p>
          
          {/* ADET */}
          <div className="mb-2 pb-2 border-b border-gray-300 dark:border-gray-600">
            <p className="text-xs text-gray-500 mb-1 font-semibold">{getTranslation('piece', currentLanguage)}</p>
            <div className="grid grid-cols-3 gap-2 mb-1">
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('order', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {totalQuantity.toLocaleString()}
                </p>
              </div>
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('produced', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {producedQuantity.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{getTranslation('remaining', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {remainingQuantity.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="relative w-full rounded-full h-6" style={{
              background: (isGlass || isFluid)
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgb(229, 231, 235)',
              backdropFilter: (isGlass || isFluid) ? 'blur(5px)' : 'none',
              border: (isGlass || isFluid) ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'
            }}>
              <div 
                className="h-6 transition-all duration-500 rounded-full relative"
                style={{ 
                  width: `${productionBarWidth}%`,
                  background: (isGlass || isFluid)
                    ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.7), rgba(5, 150, 105, 0.7))'
                    : 'linear-gradient(to right, rgb(16, 185, 129), rgb(5, 150, 105))',
                  boxShadow: (isGlass || isFluid) ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                <span 
                  className="absolute top-1/2 -translate-y-1/2 right-1 text-xs font-bold whitespace-nowrap"
                  style={{ 
                    color: 'white',
                    pointerEvents: 'none'
                  }}
                >
                  {productionPercentage.toFixed(3)}%
                </span>
              </div>
            </div>
          </div>

          {/* METRE */}
          <div className="mb-2 pb-2 border-b border-gray-300 dark:border-gray-600">
            <p className="text-xs text-gray-500 mb-1 font-semibold">{getTranslation('meter', currentLanguage)}</p>
            <div className="grid grid-cols-3 gap-2 mb-1">
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('order', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                  {formatNumber(meterOrderValue)}
                </p>
              </div>
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('produced', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                  {formatNumber(Math.round(meterProducedValue * 10) / 10, 1)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{getTranslation('remaining', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatNumber(Math.round(meterRemainingValue * 10) / 10, 1)}
                </p>
              </div>
            </div>
            <div className="relative w-full rounded-full h-6" style={{
              background: (isGlass || isFluid)
                ? 'rgba(255, 255, 255, 0.2)' 
                : 'rgb(229, 231, 235)',
              backdropFilter: (isGlass || isFluid) ? 'blur(5px)' : 'none',
              border: (isGlass || isFluid) ? '1px solid rgba(255, 255, 255, 0.3)' : 'none'
            }}>
              <div className="h-6 transition-all duration-500 rounded-full"
                style={{ 
                  width: `${meterBarWidth}%`,
                  background: (isGlass || isFluid)
                    ? 'linear-gradient(90deg, rgba(20, 184, 166, 0.7), rgba(13, 148, 136, 0.7))'
                    : 'linear-gradient(to right, rgb(20, 184, 166), rgb(13, 148, 136))',
                  boxShadow: (isGlass || isFluid) ? '0 0 15px rgba(20, 184, 166, 0.4)' : 'none'
                }}
              >
              </div>
              <span 
                className="absolute top-1/2 -translate-y-1/2 text-xs font-bold transition-all duration-500"
                style={{ 
                  left: `${meterBarWidth}%`,
                  transform: meterBarWidth >= 20 ? 'translate(-100%, -50%)' : 'translate(0%, -50%)',
                  marginLeft: meterBarWidth >= 20 ? '-4px' : '4px',
                  color: meterBarWidth >= 20 ? 'white' : '#0f766e'
                }}
              >
                {meterPercentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* PALET */}
          <div>
            <p className="text-xs text-gray-500 mb-1 font-semibold">{getTranslation('pallet', currentLanguage)}</p>
            <div className="grid grid-cols-3 gap-2 mb-1">
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('order', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                  {formatNumber(palletOrderValue, 0)}
                </p>
              </div>
              <div className="text-center border-r border-gray-300 dark:border-gray-600">
                <p className="text-xs text-gray-500">{getTranslation('produced', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatNumber(palletProducedValue, 0)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500">{getTranslation('remaining', currentLanguage)}</p>
                <p style={{ fontSize: '1.5em' }} className="font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                  {formatNumber(palletRemainingValue, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============ KALAN SÜRE - DİJİTAL SAAT ============ */}
        <div className={`flex-shrink-0 rounded-lg p-2 text-center ${
          isFluid ? 'fluid-section' : isGlass ? 'stained-glass-time engraved-text' : isLiquidGlass ? 'glass-card' : 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
        }`}>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">{getTranslation('estimatedRemainingTime', currentLanguage)}</p>
          <p style={{ fontSize: '3em' }} className="font-bold text-purple-600 dark:text-purple-400 tabular-nums font-mono tracking-wider">
            {formatTime(liveData.estimatedTime)}
          </p>
          <p className="text-xs text-gray-500">{getTranslation('dayHourMinute', currentLanguage)}</p>
        </div>

      </div>
    </div>
  );
}

