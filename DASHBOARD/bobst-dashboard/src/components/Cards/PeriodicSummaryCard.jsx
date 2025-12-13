import React, { useRef, useEffect } from 'react';
import { getTranslation } from '../../utils/translations';
import { usePeriodicSummary } from '../../hooks/usePeriodicSummary';
import { useCardStyle } from '../../hooks/useCardStyle';
import { Calendar, Package, Zap, AlertCircle, TrendingUp, Clock, Briefcase } from 'lucide-react';

/**
 * Periyodik özet kartı - Günlük, Haftalık, Aylık, Çeyreklik, Yıllık özetleri gösterir
 */
export default function PeriodicSummaryCard({
  period = 'daily', // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  machine = null, // Makine table name (opsiyonel)
  style,
  currentLanguage = 'tr',
  darkMode = false
}) {
  const { data, loading, error } = usePeriodicSummary(period, machine, {
    autoRefresh: true,
    refreshInterval: 1000 // 1 saniye
  });

  const cardStyle = useCardStyle(style, '864px', 'periodicSummary'); // 1x6 için

  // Period başlığı
  const getPeriodTitle = () => {
    const titles = {
      daily: currentLanguage === 'tr' ? 'Günlük Özet' : 'Daily Summary',
      weekly: currentLanguage === 'tr' ? 'Haftalık Özet' : 'Weekly Summary',
      monthly: currentLanguage === 'tr' ? 'Aylık Özet' : 'Monthly Summary',
      quarterly: currentLanguage === 'tr' ? 'Çeyreklik Özet' : 'Quarterly Summary',
      yearly: currentLanguage === 'tr' ? 'Yıllık Özet' : 'Yearly Summary'
    };
    return titles[period] || titles.daily;
  };

  // Period ikonu
  const getPeriodIcon = () => {
    return <Calendar className="text-blue-500" size={24} />;
  };

  // Tarih formatı
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Süre formatı (ms -> saat:dakika)
  const formatDuration = (ms) => {
    if (!ms || ms === 0) return '0:00';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    // Saat:dakika formatında göster (örn: 6:01 = 6 saat 1 dakika)
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">
            {currentLanguage === 'tr' ? 'Yükleniyor...' : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex flex-col items-center justify-center h-full text-red-500">
          <AlertCircle size={32} className="mb-2" />
          <div className="text-sm text-center px-4">
            {error}
          </div>
        </div>
      </div>
    );
  }

  // Veri yoksa
  if (!data || !data.summary) {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          {currentLanguage === 'tr' ? 'Veri bulunamadı' : 'No data available'}
        </div>
      </div>
    );
  }

  const { summary, startDate, endDate } = data;

  return (
    <div className={cardStyle.className} style={cardStyle.style}>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {getPeriodIcon()}
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {getPeriodTitle()}
          </h2>
        </div>
      </div>

      {/* Tarih Aralığı */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {formatDate(startDate)} - {formatDate(endDate)}
      </div>

      {/* İş Sayısı */}
      <div className="flex items-center justify-between p-3 mb-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <div className="flex items-center gap-2">
          <Briefcase size={20} className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentLanguage === 'tr' ? 'Toplam İş' : 'Total Jobs'}
          </span>
        </div>
        <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          {summary.jobCount || 0}
        </span>
      </div>

      {/* Ana Metrikler */}
      <div className="space-y-3 mb-4">
        {/* Üretim */}
        <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Üretim' : 'Production'}
            </span>
          </div>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {summary.actualProduction?.toLocaleString('tr-TR') || '0'}
          </span>
        </div>

        {/* Duruş Süresi */}
        <div className="flex items-center justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-orange-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Duruş' : 'Stoppage'}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatDuration(summary.totalStoppageDuration || 0)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {currentLanguage === 'tr' ? 'saat:dakika' : 'hr:min'}
            </span>
          </div>
        </div>

        {/* Enerji */}
        <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-yellow-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Enerji' : 'Energy'}
            </span>
          </div>
          <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
            {summary.energyConsumptionKwh?.toFixed(2) || '0.00'} kWh
          </span>
        </div>

        {/* Fire - Adet */}
        <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Fire' : 'Wastage'}
            </span>
          </div>
          <span className="text-lg font-bold text-red-600 dark:text-red-400">
            {Math.round((summary.wastageBeforeDie || 0) + (summary.wastageAfterDie || 0)).toLocaleString('tr-TR')} {currentLanguage === 'tr' ? 'adet' : 'pcs'}
          </span>
        </div>

        {/* Fire Yüzdesi */}
        {(() => {
          const totalWastage = (summary.wastageBeforeDie || 0) + (summary.wastageAfterDie || 0);
          const totalProduction = summary.actualProduction || 0;
          const totalWithWastage = totalProduction + totalWastage;
          const wastagePercentage = totalWithWastage > 0 ? (totalWastage / totalWithWastage) * 100 : 0;
          
          return (
            <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentLanguage === 'tr' ? 'Fire %' : 'Wastage %'}
                </span>
              </div>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {wastagePercentage.toFixed(2)}%
              </span>
            </div>
          );
        })()}
      </div>

      {/* OEE Bölümü - En Alt */}
      {summary.overallOEE !== null && summary.overallOEE !== undefined && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
            {getTranslation('oee', currentLanguage)}
          </h3>
          
          {/* Ana OEE Ring */}
          <div className="flex justify-center mb-4">
            <div className="relative w-32 h-32">
              <OEEProgressRing 
                value={summary.overallOEE || 0}
                darkMode={darkMode}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {(summary.overallOEE || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Alt OEE Metrikleri */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'}
              </div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {(summary.availability || 0).toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {currentLanguage === 'tr' ? 'Performans' : 'Performance'}
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {(summary.performance || 0).toFixed(1)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {currentLanguage === 'tr' ? 'Kalite' : 'Quality'}
              </div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {(summary.quality || 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// OEE Progress Ring Component
function OEEProgressRing({ value, darkMode }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 50;
    const lineWidth = 12;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = darkMode ? '#374151' : '#E5E7EB';
    ctx.stroke();

    // Progress ring
    const startAngle = -Math.PI / 2; // 12 o'clock
    const endAngle = startAngle + (value / 100) * 2 * Math.PI;

    // Color based on value
    let color = '#F87171'; // Red
    if (value >= 80) color = '#4ADE80'; // Green
    else if (value >= 60) color = '#FBBF24'; // Yellow

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }, [value, darkMode]);

  return (
    <canvas
      ref={canvasRef}
      width={128}
      height={128}
      className="w-full h-full"
    />
  );
}

