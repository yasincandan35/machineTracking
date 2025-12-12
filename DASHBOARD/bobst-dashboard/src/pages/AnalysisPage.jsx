import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Settings, TrendingUp, Plus, X, RefreshCw } from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { useTheme } from '../contexts/ThemeContext';
import { createMachineApi } from '../utils/api';

export default function AnalysisPage({ currentLanguage = 'tr', selectedMachine, colorSettings, liveData }) {
  const { theme, isLiquidGlass, isFluid } = useTheme();
  const isDark = theme === 'dark';
  
  const [timeRange, setTimeRange] = useState('1h'); // 15m, 30m, 1h, 2h, 4h, 6h, 12h, 24h, 1M, 3M, 6M, 1Y
  const [updateInterval, setUpdateInterval] = useState(5); // Güncelleme sıklığı (saniye)
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState('database'); // 'database' veya 'liveStream'
  const [showSettings, setShowSettings] = useState(false);
  const [normalize, setNormalize] = useState(false); // Normalize mod (0-100% aralığı)
  const [selectedMetrics, setSelectedMetrics] = useState([]); // Seçilen metrikler (default: boş)
  const [brushIndexes, setBrushIndexes] = useState({ start: 0, end: null }); // null = tüm veriyi göster
  const chartWrapperRef = useRef(null);
  const viewRef = useRef({ start: 0, end: 0 });
  
  const timeRangeOptions = [
    { key: '15m', label: '15 DK', durationMs: 15 * 60 * 1000 },
    { key: '30m', label: '30 DK', durationMs: 30 * 60 * 1000 },
    { key: '1h', label: '1 SA', durationMs: 1 * 60 * 60 * 1000 },
    { key: '2h', label: '2 SA', durationMs: 2 * 60 * 60 * 1000 },
    { key: '4h', label: '4 SA', durationMs: 4 * 60 * 60 * 1000 },
    { key: '6h', label: '6 SA', durationMs: 6 * 60 * 60 * 1000 },
    { key: '12h', label: '12 SA', durationMs: 12 * 60 * 60 * 1000 },
    { key: '24h', label: '24 SA', durationMs: 24 * 60 * 60 * 1000 },
    // Uzun periyotlar: veri gösterimi maksimum 1 hafta olacak
    { key: '1M', label: '1 Ay', durationMs: 30 * 24 * 60 * 60 * 1000, displayLimitMs: 7 * 24 * 60 * 60 * 1000 },
    { key: '3M', label: '3 Ay', durationMs: 90 * 24 * 60 * 60 * 1000, displayLimitMs: 7 * 24 * 60 * 60 * 1000 },
    { key: '6M', label: '6 Ay', durationMs: 180 * 24 * 60 * 60 * 1000, displayLimitMs: 7 * 24 * 60 * 60 * 1000 },
    { key: '1Y', label: '1 Yıl', durationMs: 365 * 24 * 60 * 60 * 1000, displayLimitMs: 7 * 24 * 60 * 60 * 1000 },
  ];

  const getRangeConfig = (key) => timeRangeOptions.find(opt => opt.key === key) || timeRangeOptions[0];
  
  // liveData ref - useEffect içinde güncel değere erişmek için
  const liveDataRef = useRef(liveData);
  
  // liveData her güncellendiğinde ref'i güncelle
  useEffect(() => {
    liveDataRef.current = liveData;
  }, [liveData]);

  // Auto-scale: Her metrik için min/max hesapla (ilk metrik hariç - o master)
  const calculateAutoScale = (metricKey, index) => {
    if (index === 0) return null; // İlk metrik master - aralığı değişmez
    
    const values = chartData.map(item => item[metricKey]).filter(v => v !== undefined && v !== null && !isNaN(v));
    if (values.length === 0) return null;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1; // %10 padding
    
    return {
      min: Math.max(0, min - padding), // Negatif olmasın
      max: max + padding
    };
  };

  // chartData değiştiğinde auto-scale metrikleri güncelle
  useEffect(() => {
    if (chartData.length === 0) return;
    
    setSelectedMetrics(prev => prev.map((metric, index) => {
      if (!metric.isAutoScale) return metric; // İlk metrik değişmez
      
      const autoScale = calculateAutoScale(metric.key, index);
      if (!autoScale) return metric;
      
      return {
        ...metric,
        visualMin: autoScale.min,
        visualMax: autoScale.max
      };
    }));
  }, [chartData]);

  // Normalize edilmiş veriyi hazırla - useMemo ile
  const normalizedData = React.useMemo(() => {
    return chartData.map(item => {
      const normalized = { time: item.time };
      selectedMetrics.forEach(metric => {
        const value = item[metric.key] || 0;
        const range = metric.visualMax - metric.visualMin;
        normalized[metric.key] = range > 0 ? ((value - metric.visualMin) / range) * 100 : 0;
      });
      return normalized;
    });
  }, [chartData, selectedMetrics]);

  // Brush index'lerini güvenli hale getir
  const safeStart = React.useMemo(() => {
    if (chartData.length === 0) return 0;
    const maxIndex = chartData.length - 1;
    return Math.min(Math.max(brushIndexes.start || 0, 0), maxIndex);
  }, [brushIndexes.start, chartData.length]);

  const safeEnd = React.useMemo(() => {
    if (chartData.length === 0) return 0;
    const maxIndex = chartData.length - 1;
    const end = brushIndexes.end === null || brushIndexes.end === undefined
      ? maxIndex
      : brushIndexes.end;
    return Math.min(Math.max(end, 0), maxIndex);
  }, [brushIndexes.end, chartData.length]);

  // Görünüm referansını güncel tut
  useEffect(() => {
    viewRef.current = { start: safeStart, end: safeEnd };
  }, [safeStart, safeEnd]);

  // Brush indexlerini veri uzunluğu değişiminde güvene al
  useEffect(() => {
    if (chartData.length === 0) {
      if (brushIndexes.start !== 0 || brushIndexes.end !== null) {
        setBrushIndexes({ start: 0, end: null });
      }
      return;
    }

    const maxIndex = chartData.length - 1;
    const clampedStart = Math.min(Math.max(0, brushIndexes.start || 0), maxIndex);
    const clampedEnd = brushIndexes.end === null || brushIndexes.end === undefined
      ? maxIndex
      : Math.min(Math.max(0, brushIndexes.end), maxIndex);

    const normalized =
      clampedStart > clampedEnd
        ? { start: clampedEnd, end: clampedEnd }
        : { start: clampedStart, end: clampedEnd };

    if (normalized.start !== brushIndexes.start || normalized.end !== brushIndexes.end) {
      setBrushIndexes(normalized);
    }
  }, [chartData.length, brushIndexes.start, brushIndexes.end]);

  // Mouse wheel ile pan/zoom (temperatureHumidity sayfasındaki davranışa benzer)
  useEffect(() => {
    const container = chartWrapperRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      if (chartData.length < 2) return;
      e.preventDefault();
      e.stopPropagation();
      const maxIndex = chartData.length - 1;
      const current = viewRef.current;
      const start = current.start ?? 0;
      const end = current.end ?? maxIndex;
      const span = Math.max(1, end - start + 1);

      // Zoom: Ctrl/Cmd + tekerlek
      if (e.ctrlKey) {
        const zoomIn = e.deltaY < 0;
        const factor = zoomIn ? 0.9 : 1.1;
        const minSpan = 10;
        const maxSpan = chartData.length;
        const newSpan = Math.min(maxSpan, Math.max(minSpan, Math.round(span * factor)));
        const center = (start + end) / 2;
        let newStart = Math.round(center - (newSpan - 1) / 2);
        newStart = Math.max(0, Math.min(newStart, maxIndex - newSpan + 1));
        const newEnd = Math.min(newStart + newSpan - 1, maxIndex);
        setBrushIndexes({ start: newStart, end: newEnd });
        return;
      }

      // Pan: normal tekerlek
      const step = Math.max(1, Math.round(span * 0.1));
      const direction = e.deltaY > 0 ? 1 : -1;
      let newStart = start + direction * step;
      newStart = Math.max(0, Math.min(newStart, maxIndex - span + 1));
      const newEnd = Math.min(newStart + span - 1, maxIndex);
      setBrushIndexes({ start: newStart, end: newEnd });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [chartData.length]);

  // Gösterilecek veri - normalize veya gerçek değerler
  const displayData = React.useMemo(() => {
    const dataToUse = normalize ? normalizedData : chartData;
    if (dataToUse.length === 0) return [];
    
    const start = Math.max(0, safeStart);
    const end = Math.min(safeEnd, dataToUse.length - 1);
    if (end < start) return [];
    const rangeConfig = getRangeConfig(timeRange);

    // Uzun periyotlarda en fazla 1 haftalık pencereyi göster
    // Sabit maksimum nokta sayısı kullan (çok yüksek çözünürlük için)
    let windowStart = start;
    if (rangeConfig?.displayLimitMs) {
      // Uzun periyotlarda en az 10000 nokta göster (çok yüksek çözünürlük)
      const maxPoints = 10000;
      windowStart = Math.max(start, end - maxPoints + 1);
    }
    
    return dataToUse.slice(windowStart, end + 1);
  }, [normalize, normalizedData, chartData, safeStart, safeEnd, timeRange, updateInterval]);

  // Görüntülenen aralık için istatistikler
  const metricStats = React.useMemo(() => {
    if (!displayData || displayData.length === 0) return [];
    return selectedMetrics.map(metric => {
      const values = displayData
        .map(item => Number(item[metric.key]))
        .filter(v => Number.isFinite(v));
      if (values.length === 0) return null;
      const sum = values.reduce((a, b) => a + b, 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = sum / values.length;
      const current = values[values.length - 1];
      return {
        key: metric.key,
        label: metric.label,
        unit: metric.unit,
        min,
        max,
        avg,
        current
      };
    }).filter(Boolean);
  }, [displayData, selectedMetrics]);

  // Zaman aralığına göre izin verilen minimum resolution'ı hesapla
  const getMinResolution = (rangeKey) => {
    const range = getRangeConfig(rangeKey);
    const totalSeconds = (range?.durationMs || 0) / 1000;
    
    // 1 saat veya daha az için özel: Sınırlama yok
    if (totalSeconds <= 3600) {
      return 1; // Tüm seçenekler kullanılabilir
    }
    
    // Uzun periyotlarda daha yüksek çözünürlük için daha fazla nokta
    const maxDataPoints = range?.displayLimitMs 
      ? 10000 // Uzun periyotlar için 10000 nokta (çok yüksek çözünürlük)
      : 1500; // Diğer zaman aralıkları için limit
    return Math.ceil(totalSeconds / maxDataPoints); // Minimum resolution (saniye)
  };

  // Mevcut zaman aralığı için minimum resolution
  const minResolution = getMinResolution(timeRange);
  
  // Zaman aralığı değiştiğinde, updateInterval çok küçükse otomatik ayarla
  useEffect(() => {
    if (updateInterval < minResolution) {
      setUpdateInterval(minResolution);
    }
  }, [timeRange, minResolution]);
  
  // Tüm mevcut metrikler
  const availableMetrics = [
    // Hız & Üretim
    { key: 'machineSpeed', label: 'Makine Hızı', defaultColor: '#f97316', unit: 'mpm', absoluteMin: 0, absoluteMax: 500 },
    { key: 'dieSpeed', label: 'Kalıp Hızı', defaultColor: '#10b981', unit: 'bpm', absoluteMin: 0, absoluteMax: 300 },
    { key: 'machineDieCounter', label: 'Kalıp Sayacı', defaultColor: '#3b82f6', unit: 'adet', absoluteMin: 0, absoluteMax: 1000000 },
    { key: 'actualProduction', label: 'Gerçek Üretim', defaultColor: '#06b6d4', unit: 'adet', absoluteMin: 0, absoluteMax: 10000000 },
    { key: 'uretimHizAdetDakika', label: 'Üretim Hızı', defaultColor: '#14b8a6', unit: 'adet/dk', absoluteMin: 0, absoluteMax: 500 },
    
    // Tüketim
    { key: 'ethylAcetate', label: 'Etil Asetat', defaultColor: '#8b5cf6', unit: 'L', absoluteMin: 0, absoluteMax: 5000 },
    { key: 'ethylAlcohol', label: 'Etil Alkol', defaultColor: '#ec4899', unit: 'L', absoluteMin: 0, absoluteMax: 5000 },
    { key: 'paperConsumption', label: 'Kağıt Tüketimi', defaultColor: '#06b6d4', unit: 'm²', absoluteMin: 0, absoluteMax: 500000 },
    
    // OEE & Kalite
    { key: 'overallOEE', label: 'OEE', defaultColor: '#22c55e', unit: '%', absoluteMin: 0, absoluteMax: 100 },
    { key: 'availability', label: 'Kullanılabilirlik', defaultColor: '#3b82f6', unit: '%', absoluteMin: 0, absoluteMax: 100 },
    { key: 'performance', label: 'Performans', defaultColor: '#a855f7', unit: '%', absoluteMin: 0, absoluteMax: 100 },
    { key: 'quality', label: 'Kalite', defaultColor: '#eab308', unit: '%', absoluteMin: 0, absoluteMax: 100 },
    
    // Fire
    { key: 'wastageRatio', label: 'Fire Oranı', defaultColor: '#ef4444', unit: '%', absoluteMin: 0, absoluteMax: 20 },
    { key: 'wastageBeforeDie', label: 'Fire (Kalıp Öncesi)', defaultColor: '#f87171', unit: 'adet', absoluteMin: 0, absoluteMax: 10000 },
    { key: 'wastageAfterDie', label: 'Fire (Kalıp Sonrası)', defaultColor: '#dc2626', unit: 'adet', absoluteMin: 0, absoluteMax: 100000 },
    
    // Duruşlar
    { key: 'totalStops', label: 'Toplam Duruş', defaultColor: '#f59e0b', unit: 'adet', absoluteMin: 0, absoluteMax: 1000 },
    { key: 'setupStops', label: 'Hazırlık Duruşları', defaultColor: '#fb923c', unit: 'adet', absoluteMin: 0, absoluteMax: 500 },
    { key: 'faultStops', label: 'Arıza Duruşları', defaultColor: '#dc2626', unit: 'adet', absoluteMin: 0, absoluteMax: 500 },
    { key: 'qualityStops', label: 'Kalite Duruşları', defaultColor: '#eab308', unit: 'adet', absoluteMin: 0, absoluteMax: 500 },
    { key: 'totalStoppageDuration', label: 'Toplam Duruş Süresi', defaultColor: '#f97316', unit: 'ms', absoluteMin: 0, absoluteMax: 86400000 },
    
    // İş Durumu
    { key: 'remainingWork', label: 'Kalan İş', defaultColor: '#a855f7', unit: 'adet', absoluteMin: 0, absoluteMax: 10000000 },
    { key: 'completionPercentage', label: 'Tamamlanma', defaultColor: '#22c55e', unit: '%', absoluteMin: 0, absoluteMax: 100 },
    
    // Enerji
    { key: 'activePowerW', label: 'Aktif Güç', defaultColor: '#f59e0b', unit: 'kW', absoluteMin: 0, absoluteMax: 150 },
    { key: 'totalEnergyKwh', label: 'Toplam Enerji', defaultColor: '#3b82f6', unit: 'kWh', absoluteMin: 0, absoluteMax: 100000 },
    { key: 'voltageL1', label: 'Voltaj L1', defaultColor: '#10b981', unit: 'V', absoluteMin: 0, absoluteMax: 500 },
    { key: 'voltageL2', label: 'Voltaj L2', defaultColor: '#14b8a6', unit: 'V', absoluteMin: 0, absoluteMax: 500 },
    { key: 'voltageL3', label: 'Voltaj L3', defaultColor: '#06b6d4', unit: 'V', absoluteMin: 0, absoluteMax: 500 },
    { key: 'currentL1', label: 'Akım L1', defaultColor: '#f97316', unit: 'A', absoluteMin: 0, absoluteMax: 200 },
    { key: 'currentL2', label: 'Akım L2', defaultColor: '#fb923c', unit: 'A', absoluteMin: 0, absoluteMax: 200 },
    { key: 'currentL3', label: 'Akım L3', defaultColor: '#fdba74', unit: 'A', absoluteMin: 0, absoluteMax: 200 },
  ];
  
  const lineTypes = ['monotone', 'linear', 'step', 'stepBefore', 'stepAfter'];
  const strokeDashOptions = [
    { value: 'solid', label: 'Düz Çizgi', dash: '' },
    { value: 'dashed', label: 'Kesikli', dash: '5 5' },
    { value: 'dotted', label: 'Noktalı', dash: '2 2' },
  ];

  // Veri çekme fonksiyonu - yüksek frekanslı
  const fetchHighFrequencyData = async (isInitial = false) => {
    // Main Dashboard için veri çekme
    if (selectedMachine?.id === -1 || !selectedMachine?.tableName) {
      setChartData([]);
      setLoading(false);
      return;
    }

    try {
      // Sadece ilk yüklemede loading göster
      if (isInitial) {
        setLoading(true);
      }
      const endTime = new Date();
      const rangeConfig = getRangeConfig(timeRange);
      const rangeDurationMs = rangeConfig?.durationMs || 60 * 60 * 1000;
      const startTime = new Date(endTime.getTime() - rangeDurationMs);

      // Lokal saati UTC formatında gönder
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

      // Uzun periyotlarda daha yüksek çözünürlük için resolution'ı otomatik düşür
      let effectiveResolution = updateInterval;
      if (rangeConfig?.displayLimitMs) {
        // Uzun periyotlarda: 1 hafta için ~10000 nokta hedefle (çok yüksek çözünürlük)
        // 1 hafta = 604800 saniye, 10000 nokta için resolution = 604800 / 10000 ≈ 60 saniye (1 dakika)
        const targetPoints = 10000;
        const weekSeconds = 7 * 24 * 60 * 60;
        const optimalResolution = Math.max(1, Math.floor(weekSeconds / targetPoints));
        effectiveResolution = Math.min(updateInterval, optimalResolution);
      }

      const params = new URLSearchParams();
      params.append('start', formatLocalAsUTC(startTime));
      params.append('end', formatLocalAsUTC(endTime));
      params.append('resolution', effectiveResolution);

      const machineApi = createMachineApi(selectedMachine);
      const response = await machineApi.get(`/sensors/period?${params.toString()}`);

      if (response.data) {
        // Veriyi formatla - Recharts için (tüm metrikler)
        const formattedData = response.data.map(item => ({
          time: new Date(item.kayitZamani).toLocaleTimeString('tr-TR'),
          fullTime: item.kayitZamani,
          // Hız verileri
          machineSpeed: item.machineSpeed || 0,
          dieSpeed: item.dieSpeed || 0,
          // Tüketim verileri
          ethylAcetate: item.etilAsetat || item.ethylAcetate || 0,
          ethylAlcohol: item.etilAlkol || item.ethylAlcohol || 0,
          paperConsumption: item.paperConsumption || 0,
          // OEE verileri
          overallOEE: item.overallOEE || 0,
          availability: item.availability || 0,
          performance: item.performance || 0,
          quality: item.quality || 0,
          wastageRatio: item.wastageRatio || 0,
          // Enerji (kW'a çevir)
          activePowerW: item.activePowerW ? item.activePowerW / 1000 : 0
        }));
        
        if (formattedData.length === 0) {
          setChartData([]);
          setBrushIndexes({ start: 0, end: null });
        } else {
          setChartData(formattedData);

          // Uzun periyotlar için başlangıçta en fazla 1 haftalık pencere göster
          // Sabit maksimum nokta sayısı kullan (çok yüksek çözünürlük)
          const maxPointsToShow = rangeConfig?.displayLimitMs 
            ? 10000 // Uzun periyotlarda 10000 nokta göster (çok yüksek çözünürlük)
            : formattedData.length; // Kısa periyotlarda tüm veriyi göster
          const endIndex = formattedData.length - 1;
          const startIndex = Math.max(0, endIndex - maxPointsToShow + 1);

          setBrushIndexes({ start: startIndex, end: endIndex });
        }
      } else {
        setChartData([]);
        setBrushIndexes({ start: 0, end: null });
      }
    } catch (error) {
      console.error('Analiz verileri yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  // Metrik ekle/çıkar
  const addMetric = (metricKey) => {
    const metric = availableMetrics.find(m => m.key === metricKey);
    if (metric && !selectedMetrics.find(m => m.key === metricKey)) {
      const newIndex = selectedMetrics.length;
      const autoScale = calculateAutoScale(metricKey, newIndex);
      
      setSelectedMetrics([...selectedMetrics, {
        key: metric.key,
        label: metric.label,
        color: metric.defaultColor,
        lineType: 'monotone',
        strokeDash: 'solid',
        strokeWidth: 2,
        unit: metric.unit,
        // İlk metrik: manuel aralık, diğerleri: auto-scale
        visualMin: autoScale ? autoScale.min : metric.absoluteMin,
        visualMax: autoScale ? autoScale.max : metric.absoluteMax,
        absoluteMin: metric.absoluteMin,
        absoluteMax: metric.absoluteMax,
        isAutoScale: newIndex > 0 // İlk metrik hariç auto-scale
      }]);
    }
  };

  const removeMetric = (metricKey) => {
    setSelectedMetrics(selectedMetrics.filter(m => m.key !== metricKey));
  };

  const updateMetric = (metricKey, field, value) => {
    setSelectedMetrics(selectedMetrics.map(m => 
      m.key === metricKey ? { ...m, [field]: value } : m
    ));
  };

  // Son değerleri al (en güncel veri)
  const getLatestValue = (metricKey) => {
    if (chartData.length === 0) return 0;
    return chartData[chartData.length - 1][metricKey] || 0;
  };

  // Veritabanı Modu - Veri çekme
  useEffect(() => {
    if (analysisMode !== 'database' || !selectedMachine?.tableName || selectedMachine.id === -1 || selectedMetrics.length === 0) {
      return;
    }

      // İlk yükleme
      fetchHighFrequencyData(true);
  }, [analysisMode, selectedMachine?.tableName, timeRange, selectedMetrics.length, updateInterval]);

  // Live Stream - Binance tarzı tick-tick-tick (liveData'dan)
  useEffect(() => {
    if (analysisMode !== 'liveStream' || !liveData || selectedMachine?.id === -1 || selectedMetrics.length === 0) {
      return;
    }

    // Her 1 saniyede liveData'dan yeni nokta ekle
    const streamInterval = setInterval(() => {
      const currentLiveData = liveDataRef.current;
      if (!currentLiveData) return;
      
      const newPoint = {
        time: new Date().toLocaleTimeString('tr-TR'),
        fullTime: new Date().toISOString(),
        // Hız & Üretim
        machineSpeed: currentLiveData.machineSpeed || 0,
        dieSpeed: currentLiveData.dieSpeed || 0,
        machineDieCounter: currentLiveData.machineDieCounter || 0,
        actualProduction: currentLiveData.actualProduction || 0,
        uretimHizAdetDakika: currentLiveData.uretimHizAdetDakika || 0,
        // Tüketim
        ethylAcetate: currentLiveData.ethylAcetateConsumption || 0,
        ethylAlcohol: currentLiveData.ethylAlcoholConsumption || 0,
        paperConsumption: currentLiveData.paperConsumption || 0,
        // OEE & Kalite
        overallOEE: currentLiveData.overallOEE || 0,
        availability: currentLiveData.availability || 0,
        performance: currentLiveData.performance || 0,
        quality: currentLiveData.quality || 0,
        // Fire
        wastageRatio: currentLiveData.wastageRatio || 0,
        wastageBeforeDie: currentLiveData.wastageBeforeDie || 0,
        wastageAfterDie: currentLiveData.wastageAfterDie || 0,
        // Duruşlar
        totalStops: currentLiveData.totalStops || 0,
        setupStops: currentLiveData.setupStops || 0,
        faultStops: currentLiveData.faultStops || 0,
        qualityStops: currentLiveData.qualityStops || 0,
        totalStoppageDuration: currentLiveData.totalStoppageDuration || 0,
        // İş Durumu
        remainingWork: currentLiveData.remainingWork || 0,
        completionPercentage: currentLiveData.completionPercentage || 0,
        // Enerji (kW'a/V/A çevir)
        activePowerW: (currentLiveData.activePowerW && currentLiveData.activePowerW !== -1) ? currentLiveData.activePowerW / 1000 : 0,
        totalEnergyKwh: (currentLiveData.totalEnergyKwh && currentLiveData.totalEnergyKwh !== -1) ? currentLiveData.totalEnergyKwh : 0,
        voltageL1: (currentLiveData.voltageL1 && currentLiveData.voltageL1 !== -1) ? currentLiveData.voltageL1 : 0,
        voltageL2: (currentLiveData.voltageL2 && currentLiveData.voltageL2 !== -1) ? currentLiveData.voltageL2 : 0,
        voltageL3: (currentLiveData.voltageL3 && currentLiveData.voltageL3 !== -1) ? currentLiveData.voltageL3 : 0,
        currentL1: (currentLiveData.currentL1 && currentLiveData.currentL1 !== -1) ? currentLiveData.currentL1 : 0,
        currentL2: (currentLiveData.currentL2 && currentLiveData.currentL2 !== -1) ? currentLiveData.currentL2 : 0,
        currentL3: (currentLiveData.currentL3 && currentLiveData.currentL3 !== -1) ? currentLiveData.currentL3 : 0,
      };
      
      setChartData(prev => {
        const updated = [...prev, newPoint];
        const result = updated.slice(-500); // Son 500 noktayı tut
        
        // Brush'ı otomatik sağa kaydır (son 100 nokta)
        setBrushIndexes({
          start: Math.max(0, result.length - 100),
          end: result.length - 1
        });
        
        return result;
      });
    }, 1000); // Her 1 saniye

    return () => clearInterval(streamInterval);
  }, [analysisMode, selectedMachine?.id, selectedMetrics.length]); // liveData dependency'den çıkarıldı - yoksa her 200ms yeniden başlıyor

  const cardClass = `rounded-xl shadow-md p-6 ${
    isFluid 
      ? 'bg-black/40 backdrop-blur-md border border-white/30'
      : isLiquidGlass 
        ? 'glass-card'
        : 'bg-white dark:bg-gray-800'
  }`;

  return (
    <div className="p-6 space-y-6">
      {/* Sekme Menüsü */}
      <div className={cardClass}>
        <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              setAnalysisMode('database');
              setChartData([]);
              setBrushIndexes({ start: 0, end: null });
            }}
            className={`px-6 py-3 font-semibold transition-all ${
              analysisMode === 'database'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            💾 Veritabanı (Geçmiş)
          </button>
          <button
            onClick={() => {
              setAnalysisMode('liveStream');
              setChartData([]);
              setBrushIndexes({ start: 0, end: null });
            }}
            className={`px-6 py-3 font-semibold transition-all ${
              analysisMode === 'liveStream'
                ? 'border-b-2 border-red-500 text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            🔴 Live Stream
          </button>
        </div>

          <div className="flex items-center gap-3">
            <TrendingUp size={32} className="text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {analysisMode === 'database' ? 'Veritabanı Analizi' : 'Canlı Veri Akışı'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
              {analysisMode === 'database' 
                ? `Geçmiş veri analizi - Makine: ${selectedMachine?.name || 'Seçiniz'}` 
                : `Gerçek zamanlı izleme (Binance tarzı) - Makine: ${selectedMachine?.name || 'Seçiniz'}`}
              </p>
          </div>
            </div>
          </div>

      {/* Kontroller - Moda göre */}
      <div className={cardClass}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Veritabanı Modu - Manuel yenile */}
            {analysisMode === 'database' && (
              <button
                onClick={() => fetchHighFrequencyData(true)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  isFluid
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                }`}
              >
                <RefreshCw size={18} />
                Yenile
              </button>
            )}

            {/* Live Stream Modu - Bilgilendirme */}
            {analysisMode === 'liveStream' && (
              <div className="text-gray-600 dark:text-gray-400 font-medium flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                Canlı veri akışı aktif (Her 1 saniye)
              </div>
            )}

            {/* Grafik ayarları butonu */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                isFluid
                  ? 'bg-white/20 text-white hover:bg-white/30'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <Settings size={18} />
              Grafik Ayarları
            </button>

            {/* Veritabanı Modu - Veri sıklığı ve zaman aralığı */}
            {analysisMode === 'database' && (
              <>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Veri Sıklığı:
              </span>
              <select
                value={updateInterval}
                onChange={(e) => setUpdateInterval(parseInt(e.target.value))}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium ${
                  isFluid
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value={1} disabled={minResolution > 1}>1 saniye {minResolution > 1 && '(Çok fazla veri!)'}</option>
                <option value={2} disabled={minResolution > 2}>2 saniye {minResolution > 2 && '(Çok fazla veri!)'}</option>
                <option value={5} disabled={minResolution > 5}>5 saniye {minResolution > 5 && '(Çok fazla veri!)'}</option>
                <option value={10} disabled={minResolution > 10}>10 saniye {minResolution > 10 && '(Çok fazla veri!)'}</option>
                <option value={30} disabled={minResolution > 30}>30 saniye {minResolution > 30 && '(Çok fazla veri!)'}</option>
                <option value={60}>60 saniye</option>
              </select>
            </div>

            {/* Zaman aralığı */}
            <div className="flex gap-2 flex-wrap">
              {timeRangeOptions.map(range => (
                <button
                  key={range.key}
                  onClick={() => setTimeRange(range.key)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                    timeRange === range.key
                      ? 'bg-green-500 text-white shadow-lg'
                      : isFluid
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
              </>
            )}
          </div>
        </div>

        {/* Durum göstergesi */}
        <div className="flex items-center gap-4 mt-4 text-sm flex-wrap">
          {/* Mod göstergesi */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              analysisMode === 'liveStream' && selectedMetrics.length > 0 
                ? 'bg-red-500 animate-pulse' 
                : analysisMode === 'database' && selectedMetrics.length > 0 
                  ? 'bg-green-500 animate-pulse' 
                  : 'bg-gray-400'
            }`}></div>
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              {analysisMode === 'liveStream' && selectedMetrics.length > 0 
                ? '🔴 Live Stream (1sn)' 
                : analysisMode === 'database' && selectedMetrics.length > 0 
                  ? `📂 Geçmiş veri (örnekleme ${updateInterval}sn)` 
                  : '⏸️ Durduruldu'}
            </span>
          </div>
          
          {/* Veri kaynağı */}
          <div className="text-gray-600 dark:text-gray-400">
            {analysisMode === 'liveStream' ? '📡 Canlı API' : '💾 Veritabanı'}
          </div>
          
          <div className="text-gray-600 dark:text-gray-400">
            📊 {selectedMetrics.length} metrik
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            📈 {chartData.length} nokta
          </div>
          {chartData.length > 0 && (
            <div className="text-gray-600 dark:text-gray-400">
              🕐 {chartData[chartData.length - 1]?.fullTime ? new Date(chartData[chartData.length - 1].fullTime).toLocaleString('tr-TR') : '-'}
            </div>
          )}
          {analysisMode === 'liveStream' && selectedMetrics.length > 0 && (
            <div className="text-red-500 font-medium animate-pulse">
              ⚡ Gerçek zamanlı veri akışı
            </div>
          )}
        </div>
      </div>

      {/* Grafik Ayarları Paneli */}
      {showSettings && (
        <div className={cardClass}>
          <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Grafik Seçimi ve Ayarları</h2>
          
          {/* Metrik ekle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Grafik Ekle:
            </label>
            <div className="flex flex-wrap gap-2">
              {availableMetrics.map(metric => (
                <button
                  key={metric.key}
                  onClick={() => addMetric(metric.key)}
                  disabled={selectedMetrics.find(m => m.key === metric.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    selectedMetrics.find(m => m.key === metric.key)
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : isFluid
                        ? 'bg-white/20 text-white hover:bg-white/30'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                  }`}
                >
                  <Plus size={16} />
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          {/* Seçili metrikler ve ayarları */}
          {selectedMetrics.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Seçili Grafikler:</h3>
              {selectedMetrics.map(metric => (
                <div key={metric.key} className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-900 dark:text-white">{metric.label}</span>
                    <button
                      onClick={() => removeMetric(metric.key)}
                      className="text-red-500 hover:text-red-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-4">
                    {/* Renk seçici */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Renk:</label>
                      <input
                        type="color"
                        value={metric.color}
                        onChange={(e) => updateMetric(metric.key, 'color', e.target.value)}
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </div>

                    {/* Çizgi tipi */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Çizgi Tipi:</label>
                      <select
                        value={metric.lineType}
                        onChange={(e) => updateMetric(metric.key, 'lineType', e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white"
                      >
                        {lineTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Çizgi stili */}
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Çizgi Stili:</label>
                      <select
                        value={metric.strokeDash}
                        onChange={(e) => updateMetric(metric.key, 'strokeDash', e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white"
                      >
                        {strokeDashOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Görsel Aralık (Min-Max) Slider */}
                    <div className="col-span-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                          {metric.isAutoScale ? 'Otomatik Aralık (Canlı)' : 'Görsel Aralık:'}
                        </label>
                        {!metric.isAutoScale && (
                          <button
                            onClick={() => {
                              updateMetric(metric.key, 'visualMin', metric.absoluteMin);
                              updateMetric(metric.key, 'visualMax', metric.absoluteMax);
                            }}
                            className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-900 dark:text-white"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {/* Min slider */}
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Alt Sınır (Min):</span>
                            <span className="font-bold" style={{ color: metric.color }}>{metric.visualMin.toFixed(0)} {metric.unit}</span>
                          </div>
                          <input
                            type="range"
                            min={metric.absoluteMin}
                            max={metric.absoluteMax}
                            step={(metric.absoluteMax - metric.absoluteMin) / 200}
                            value={metric.visualMin}
                            disabled={metric.isAutoScale}
                            onChange={(e) => {
                              const newMin = parseFloat(e.target.value);
                              if (newMin < metric.visualMax) {
                                updateMetric(metric.key, 'visualMin', newMin);
                              }
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, ${metric.color} 0%, ${metric.color}33 100%)`
                            }}
                          />
                        </div>
                        {/* Max slider + textbox */}
                        <div>
                          <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>Üst Sınır (Max):</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={metric.visualMax}
                                disabled={metric.isAutoScale}
                                onChange={(e) => {
                                  const newMax = parseFloat(e.target.value) || metric.absoluteMax;
                                  if (newMax > metric.visualMin && newMax <= metric.absoluteMax) {
                                    updateMetric(metric.key, 'visualMax', newMax);
                                  }
                                }}
                                className="w-20 px-2 py-1 rounded text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 font-bold text-right"
                                style={{ color: metric.color }}
                              />
                              <span className="font-bold" style={{ color: metric.color }}>{metric.unit}</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={metric.absoluteMin}
                            max={metric.absoluteMax}
                            step={(metric.absoluteMax - metric.absoluteMin) / 200}
                            value={metric.visualMax}
                            disabled={metric.isAutoScale}
                            onChange={(e) => {
                              const newMax = parseFloat(e.target.value);
                              if (newMax > metric.visualMin) {
                                updateMetric(metric.key, 'visualMax', newMax);
                              }
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            style={{
                              background: `linear-gradient(to right, ${metric.color}33 0%, ${metric.color} 100%)`
                            }}
                          />
                        </div>
                      </div>
                      {/* Mutlak sınır ayarı */}
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>Mutlak Üst Sınır:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={metric.absoluteMax}
                              onChange={(e) => {
                                const newAbsMax = parseFloat(e.target.value) || 100;
                                updateMetric(metric.key, 'absoluteMax', newAbsMax);
                                // Eğer visualMax yeni absoluteMax'tan büyükse ayarla
                                if (metric.visualMax > newAbsMax) {
                                  updateMetric(metric.key, 'visualMax', newAbsMax);
                                }
                              }}
                              className="w-24 px-2 py-1 rounded text-xs bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 font-bold text-right text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-600 dark:text-gray-400">{metric.unit}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          Slider'ların maksimum değeri (örn: Etil 10000 L'ye çıkabilir)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Makine seçilmemişse uyarı */}
      {(!selectedMachine || selectedMachine.id === -1) ? (
        <div className={`${cardClass} text-center py-20 text-gray-500 dark:text-gray-400`}>
          <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Lütfen bir makine seçin</p>
          <p className="text-sm">Analiz yapmak için üst menüden bir makine seçmelisiniz</p>
        </div>
      ) : selectedMetrics.length === 0 ? (
        <div className={`${cardClass} text-center py-20 text-gray-500 dark:text-gray-400`}>
          <Plus size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Grafik eklenmedi</p>
          <p className="text-sm">Yukarıdaki "Grafik Ayarları" butonuna tıklayarak grafikler ekleyin</p>
        </div>
      ) : (
        <>
          {/* Ana Grafik - Normalize */}
          <div className={cardClass}>
              <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp size={24} className="text-blue-500" />
                {normalize ? 'Normalize Grafik' : 'Gerçek Değerler'}
                {normalize && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    (Tüm değerler %0-100 aralığında)
                  </span>
                )}
              </h2>
              
              {/* Normalize Toggle */}
              <button
                onClick={() => setNormalize(!normalize)}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  normalize
                    ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg'
                    : isFluid
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
                }`}
              >
                {normalize ? '📊 Gerçek Değerleri Göster' : '% Normalize Et'}
              </button>
            </div>
            
            {/* Görünen aralık özetleri */}
            {displayData.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4 text-sm">
                <div className={`px-3 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/60 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                  🗓️ Aralık: {displayData[0]?.fullTime ? new Date(displayData[0].fullTime).toLocaleString('tr-TR') : displayData[0]?.time} → {displayData[displayData.length - 1]?.fullTime ? new Date(displayData[displayData.length - 1].fullTime).toLocaleString('tr-TR') : displayData[displayData.length - 1]?.time}
                </div>
                <div className={`px-3 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/60 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                  📈 Nokta: {displayData.length}
                </div>
                {metricStats.map(stat => (
                  <div
                    key={stat.key}
                    className={`px-3 py-2 rounded-lg border ${isDark ? 'border-gray-700 bg-gray-800/60 text-gray-200' : 'border-gray-200 bg-gray-50 text-gray-800'}`}
                  >
                    <div className="font-semibold text-sm">{stat.label}</div>
                    <div className="text-xs flex flex-wrap gap-2">
                      <span>Min: {stat.min.toFixed(1)}{stat.unit}</span>
                      <span>Max: {stat.max.toFixed(1)}{stat.unit}</span>
                      <span>Ort: {stat.avg.toFixed(1)}{stat.unit}</span>
                      <span>Son: {stat.current.toFixed(1)}{stat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="text-center py-20 text-gray-500 dark:text-gray-400">
                <p>Veri bulunamadı</p>
              </div>
            ) : (
              <>
              <div ref={chartWrapperRef} className="w-full">
              <ResponsiveContainer width="100%" height={chartData.length > 20 ? 650 : 600}>
                <LineChart 
                  data={displayData}
                  margin={{ top: 5, right: 30, left: 20, bottom: chartData.length > 20 ? 80 : 5 }}
                  syncId="analysisChart"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="time" 
                    stroke={isDark ? '#9ca3af' : '#6b7280'}
                    tick={{ fill: isDark ? '#9ca3af' : '#6b7280' }}
                  />
                  
                  {/* Sol Y-axis - normalize'a göre değişir */}
                  <YAxis 
                    domain={normalize ? [0, 100] : ['auto', 'auto']}
                    stroke={isDark ? '#9ca3af' : '#6b7280'}
                    tickFormatter={(value) => normalize ? `${value}%` : value.toFixed(0)}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={4} textAnchor="end" fill={isDark ? '#9ca3af' : '#6b7280'} fontSize={12}>
                            {normalize ? `${payload.value}%` : payload.value}
                          </text>
                          {/* Her metriğin değerini renkli yaz */}
                          {selectedMetrics.map((metric, idx) => {
                            const latestData = chartData[chartData.length - 1];
                            if (!latestData) return null;
                            const realValue = latestData[metric.key] || 0;
                            const normalized = ((realValue - metric.visualMin) / (metric.visualMax - metric.visualMin)) * 100;
                            if (Math.abs(normalized - payload.value) < 5) {
                              return (
                                <text 
                                  key={metric.key}
                                  x={-35 - (idx * 60)}
                                  y={0}
                                  dy={4}
                                  textAnchor="end"
                                  fill={metric.color}
                                  fontSize={10}
                                  fontWeight="bold"
                                >
                                  {realValue.toFixed(0)}{metric.unit}
                                </text>
                              );
                            }
                            return null;
                          })}
                        </g>
                      );
                    }}
                  />
                  
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDark ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '8px',
                      color: isDark ? '#f3f4f6' : '#1f2937'
                    }}
                    formatter={(value, name) => {
                      const metric = selectedMetrics.find(m => m.label === name);
                      if (!metric) return [value.toFixed(1), name];
                      
                      if (normalize) {
                        // Normalize modda: % değer + gerçek değer
                        const realValue = (value / 100) * (metric.visualMax - metric.visualMin) + metric.visualMin;
                        return [`${value.toFixed(1)}% (${realValue.toFixed(1)} ${metric.unit})`, name];
                      } else {
                        // Normal modda: sadece gerçek değer
                        return [`${value.toFixed(1)} ${metric.unit}`, name];
                      }
                    }}
                  />
                  <Legend wrapperStyle={{ color: isDark ? '#f3f4f6' : '#1f2937' }} />
                  
                  {selectedMetrics.map(metric => {
                    const dashOption = strokeDashOptions.find(opt => opt.value === metric.strokeDash);
                    return (
                      <Line 
                        key={metric.key}
                        type={metric.lineType}
                        dataKey={metric.key}
                        stroke={metric.color}
                        name={metric.label}
                        strokeWidth={metric.strokeWidth}
                        strokeDasharray={dashOption?.dash || ''}
                        dot={false}
                        animationDuration={0}
                        isAnimationActive={false}
                      />
                    );
                  })}
                  
                </LineChart>
              </ResponsiveContainer>
              </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

