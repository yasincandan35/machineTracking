import React, { useRef, useEffect, useState } from 'react';
import { getTranslation } from '../../utils/translations';
import { usePeriodicSummary } from '../../hooks/usePeriodicSummary';
import { useCardStyle } from '../../hooks/useCardStyle';
import { Calendar, Package, Zap, AlertCircle, TrendingUp, Clock, Briefcase, HelpCircle, X } from 'lucide-react';

/**
 * Periyodik özet kartı - Günlük, Haftalık, Aylık, Çeyreklik, Yıllık özetleri gösterir
 * Daily için 3 günlük carousel desteği var
 */
export default function PeriodicSummaryCard({
  period = 'daily', // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  machine = null, // Makine table name (opsiyonel)
  style,
  currentLanguage = 'tr',
  darkMode = false
}) {
  // Daily için 3 günlük veri çek, diğerleri için tek gün
  const isDaily = period === 'daily';
  
  // Carousel state (sadece daily için) - Sağdan sola kaydırma
  // Array sırası: [bugün (index 0), dün (index 1), dünden önceki gün (index 2)]
  // Görsel olarak: bugün en sağda, dün ortada, dünden önceki gün en solda
  // Başlangıçta bugün görünsün (index 0), sonra dün (index 1), sonra dünden önceki gün (index 2)
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const { data, dataArray, loading, error } = usePeriodicSummary(period, machine, {
    autoRefresh: isDaily, // Daily için otomatik yenileme (sadece bugün için aktif olacak, currentSlide kontrolü hook içinde)
    refreshInterval: 1000, // Daily için 1 saniye (sadece bugün için kullanılacak)
    daysCount: isDaily ? 3 : 1, // Daily için son 3 gün
    currentSlide: currentSlide // Carousel'da hangi slide aktif (hook sadece bugün için yenileme yapacak)
  });

  const cardStyle = useCardStyle(style, '864px', 'periodicSummary'); // 1x6 için

  // OEE detay modal state'i
  const [isOeeModalOpen, setIsOeeModalOpen] = useState(false);
  const [oeeModalSummary, setOeeModalSummary] = useState(null);
  const [oeeModalDates, setOeeModalDates] = useState({ start: null, end: null });
  const [oeeModalDetails, setOeeModalDetails] = useState([]);
  const autoplayIntervalRef = useRef(null);

  // Autoplay için useEffect (sadece daily ve dataArray varsa) - Sağdan sola
  useEffect(() => {
    if (isDaily && dataArray && dataArray.length > 1) {
      // 5 saniye autoplay - sağdan sola (bugün -> dün -> dünden önceki gün)
      autoplayIntervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % dataArray.length);
      }, 5000);

      return () => {
        if (autoplayIntervalRef.current) {
          clearInterval(autoplayIntervalRef.current);
        }
      };
    }
  }, [isDaily, dataArray]);

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

  // Tarih formatı (Bugün - tarih, Dün - tarih, veya sadece tarih)
  const formatShortDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    const diffTime = today - dateOnly;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const dateStr = date.toLocaleDateString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (diffDays === 0) {
      return currentLanguage === 'tr' ? `Bugün - ${dateStr}` : `Today - ${dateStr}`;
    } else if (diffDays === 1) {
      return currentLanguage === 'tr' ? `Dün - ${dateStr}` : `Yesterday - ${dateStr}`;
    }
    
    // 2 gün ve daha öncesi için sadece tarih
    return dateStr;
  };

  // Süre formatı (ms -> saat:dakika)
  const formatDuration = (ms) => {
    if (!ms || ms === 0) return '0:00';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Bugün mü kontrolü
  const isToday = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Tek bir özet kartı render et
  const renderSummaryContent = (summaryData, showOEE = true) => {
    const { summary, startDate, endDate, oeeDetails } = summaryData;
    const isTodayDate = isToday(startDate);

    return (
      <div className="w-full">
        {/* Tarih Aralığı */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-center font-medium">
          {formatShortDate(startDate)}
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

        {/* OEE Bölümü - Sadece bitmiş günlerde göster (bugün değilse) */}
        {showOEE && !isTodayDate && summary.overallOEE != null && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center mb-3 gap-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                {getTranslation('oee', currentLanguage)}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setOeeModalSummary(summary);
                  setOeeModalDates({ start: startDate, end: endDate });
                  // OEE detayları varsa modal için sakla
                  if (Array.isArray(oeeDetails)) {
                    setOeeModalDetails(oeeDetails);
                  } else if (summaryData && Array.isArray(summaryData.oeeDetails)) {
                    setOeeModalDetails(summaryData.oeeDetails);
                  } else {
                    setOeeModalDetails([]);
                  }
                  setIsOeeModalOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                aria-label={currentLanguage === 'tr' ? 'OEE hesaplama detaylarını göster' : 'Show OEE calculation details'}
              >
                <HelpCircle size={14} />
              </button>
            </div>
            
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
  };

  // Loading state (sadece ilk yükleme)
  if (loading && !data && (!isDaily || !dataArray || dataArray.length === 0)) {
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

  // Error state'i gösterme - hataları sessizce geç, sadece veri yoksa "Veri bulunamadı" göster
  // (Error state kontrolü kaldırıldı, hatalar hook'ta sessizce işleniyor)

  // Makine seçilmediğinde veya "Main Dashboard" seçiliyken mesaj göster
  // Main Dashboard: tableName === 'all' veya machine === null/undefined
  if (!machine || machine === 'all') {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {getPeriodIcon()}
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {getPeriodTitle()}
            </h2>
          </div>
        </div>
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          {currentLanguage === 'tr' ? 'Lütfen bir makine seçiniz' : 'Please select a machine'}
        </div>
      </div>
    );
  }

  // Daily için carousel, diğerleri için normal görünüm
  if (isDaily && dataArray && dataArray.length > 0) {
    return (
      <>
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

          {/* Carousel Container - Sağdan sola kaydırma 
              Array sırası: [bugün (index 0), dün (index 1), 2 gün öncesi (index 2)]
              Görsel düzen: [2 gün öncesi] [dün] [BUGÜN] <- bugün en sağda
              Başlangıç: bugün (index 0), sonra sola kayarak dün (index 1), sonra 2 gün öncesi (index 2)
          */}
          <div 
            className="relative overflow-hidden" 
            style={{ 
              minHeight: '600px',
              pointerEvents: 'none' // Scroll event'lerinin geçmesi için
            }}
          >
            <div 
              className="flex transition-transform duration-500 ease-in-out h-full"
              style={{ 
                // Array ters çevrildiği için: [2 gün öncesi, dün, bugün]
                // currentSlide 0 (bugün) -> translateX(-200%) -> bugün görünür (en sağda)
                // currentSlide 1 (dün) -> translateX(-100%) -> dün görünür (ortada)
                // currentSlide 2 (2 gün öncesi) -> translateX(0%) -> 2 gün öncesi görünür (en solda)
                transform: `translateX(-${(dataArray.length - 1 - currentSlide) * 100}%)`,
                pointerEvents: 'auto' // İçerik interaktif olmalı
              }}
            >
              {/* Array'i ters sırada göster: 2 gün öncesi, dün, bugün (soldan sağa) */}
              {[...dataArray].reverse().map((item, index) => (
                <div key={dataArray.length - 1 - index} className="w-full flex-shrink-0 px-1">
                  {renderSummaryContent(item, true)}
                </div>
              ))}
            </div>
          </div>

          {/* Carousel Indicators (3 nokta) - Ters sırada (bugün en sağda) */}
          {dataArray.length > 1 && (
            <div 
              className="flex justify-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              style={{ pointerEvents: 'auto' }}
            >
              {/* Indicators: Görsel olarak [2 gün öncesi, dün, bugün] ama index'ler: [bugün (0), dün (1), 2 gün öncesi (2)] */}
              {[...dataArray].reverse().map((_, index) => {
                const originalIndex = dataArray.length - 1 - index;
                return (
                  <button
                    key={originalIndex}
                    onClick={() => {
                      setCurrentSlide(originalIndex);
                      // Autoplay'i resetle
                      if (autoplayIntervalRef.current) {
                        clearInterval(autoplayIntervalRef.current);
                      }
                      autoplayIntervalRef.current = setInterval(() => {
                        setCurrentSlide((prev) => (prev + 1) % dataArray.length);
                      }, 5000);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentSlide === originalIndex
                        ? 'bg-blue-500 w-6'
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                    }`}
                    aria-label={`Slide ${originalIndex + 1}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* OEE Detay Modalı */}
        {isOeeModalOpen && oeeModalSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">
                  {currentLanguage === 'tr' ? 'OEE Hesaplama Detayları' : 'OEE Calculation Details'}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsOeeModalOpen(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-4 py-3 space-y-4 text-xs sm:text-sm">
                {/* Tarih ve periyot bilgisi */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Periyot' : 'Period'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {getPeriodTitle()} ({formatDate(oeeModalDates.start)})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Tarih Aralığı' : 'Date Range'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {formatDate(oeeModalDates.start)} - {formatDate(oeeModalDates.end || oeeModalDates.start)}
                    </div>
                  </div>
                </div>

                {/* OEE özet değerleri */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border rounded-lg p-3 border-gray-200 dark:border-gray-800">
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      OEE
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-50">
                      {(oeeModalSummary.overallOEE || 0).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'}
                    </div>
                    <div className="text-sm font-bold text-blue-600 dark:text-blue-300">
                      {(oeeModalSummary.availability || 0).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Performans' : 'Performance'}
                    </div>
                    <div className="text-sm font-bold text-green-600 dark:text-green-300">
                      {(oeeModalSummary.performance || 0).toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Kalite' : 'Quality'}
                    </div>
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-300">
                      {(oeeModalSummary.quality || 0).toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Kullanılan periyot metrikleri */}
                <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-800">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    {currentLanguage === 'tr' ? 'Periyot Metrikleri' : 'Period Metrics'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] sm:text-xs">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {currentLanguage === 'tr' ? 'Toplam İş' : 'Total Jobs'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {oeeModalSummary.jobCount ?? '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {currentLanguage === 'tr' ? 'Üretim (adet)' : 'Production (pcs)'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {oeeModalSummary.actualProduction?.toLocaleString('tr-TR') ?? '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {currentLanguage === 'tr' ? 'Duruş (ms)' : 'Stoppage (ms)'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {oeeModalSummary.totalStoppageDuration ?? '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {currentLanguage === 'tr' ? 'Fire (adet)' : 'Wastage (pcs)'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {Math.round(
                          (oeeModalSummary.wastageBeforeDie || 0) + (oeeModalSummary.wastageAfterDie || 0)
                        ).toLocaleString('tr-TR')}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {currentLanguage === 'tr' ? 'Enerji (kWh)' : 'Energy (kWh)'}
                      </div>
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {(oeeModalSummary.energyConsumptionKwh || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* İş bazlı OEE detayları */}
                {oeeModalDetails && oeeModalDetails.length > 0 && (
                  <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                      {currentLanguage === 'tr' ? 'İş Bazlı OEE Detayları' : 'Job-based OEE Details'}
                    </div>
                    <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-md">
                      <table className="min-w-full text-[10px] sm:text-[11px]">
                        <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Sipariş No' : 'Order No'}
                            </th>
                            <th className="px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Başlangıç' : 'Start'}
                            </th>
                            <th className="px-2 py-1 text-left font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Bitiş' : 'End'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">Set</th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Sil. Çevresi' : 'Cyl. Circ.'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Hedef Hız' : 'Target Spd'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Planlanan' : 'Planned'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'PLC remainingWork (adet)' : 'PLC remainingWork (pcs)'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Periyot Üretim' : 'Period Prod.'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Periyot Fire' : 'Period Wastage'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">
                              {currentLanguage === 'tr' ? 'Periyot Duruş (ms)' : 'Period Stop (ms)'}
                            </th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">Avail%</th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">Perf%</th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">Qual%</th>
                            <th className="px-2 py-1 text-right font-semibold text-gray-600 dark:text-gray-300">OEE%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {oeeModalDetails.map((job, idx) => {
                            const isActive = job.isActiveJob;
                            const rowBg =
                              idx % 2 === 0
                                ? 'bg-white dark:bg-gray-900'
                                : 'bg-gray-50 dark:bg-gray-900/80';
                            return (
                              <tr
                                key={idx}
                                className={`${rowBg} cursor-pointer hover:bg-blue-50/70 dark:hover:bg-blue-900/20`}
                              >
                                <td className="px-2 py-1 whitespace-nowrap text-gray-800 dark:text-gray-100">
                                  {job.siparisNo}
                                  {isActive && (
                                    <span className="ml-1 text-[9px] text-emerald-500">
                                      {currentLanguage === 'tr' ? '(Devam eden iş)' : '(Active job)'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {job.jobStartTime
                                    ? new Date(job.jobStartTime).toLocaleString(
                                        currentLanguage === 'tr' ? 'tr-TR' : 'en-US'
                                      )
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  {job.jobEndTime
                                    ? new Date(job.jobEndTime).toLocaleString(
                                        currentLanguage === 'tr' ? 'tr-TR' : 'en-US'
                                      )
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.setSayisi}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.silindirCevresi?.toFixed(2)}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.hedefHiz}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.toplamMiktar != null
                                    ? Number(job.toplamMiktar).toLocaleString('tr-TR')
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.periodRemainingWork != null && job.periodRemainingWork > 0
                                    ? Number(job.periodRemainingWork).toLocaleString('tr-TR')
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.periodProduction != null
                                    ? Number(job.periodProduction).toLocaleString('tr-TR')
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.periodWastageBefore != null || job.periodWastageAfter != null
                                    ? Number(
                                        (job.periodWastageBefore || 0) + (job.periodWastageAfter || 0)
                                      ).toLocaleString('tr-TR')
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-100">
                                  {job.periodStoppage != null
                                    ? Number(job.periodStoppage).toLocaleString('tr-TR')
                                    : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-blue-600 dark:text-blue-300">
                                  {job.availability != null ? job.availability.toFixed(2) : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-green-600 dark:text-green-300">
                                  {job.performance != null ? job.performance.toFixed(2) : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-purple-600 dark:text-purple-300">
                                  {job.quality != null ? job.quality.toFixed(2) : '-'}
                                </td>
                                <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-50 font-semibold">
                                  {job.oee != null ? job.oee.toFixed(2) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Formüller ve veri kaynakları */}
                <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    {currentLanguage === 'tr' ? 'Kullanılan Formüller' : 'Formulas Used'}
                  </div>

                  {/* Seçilen iş için detaylı formül gösterimi */}
                  {oeeModalDetails && oeeModalDetails.length > 0 && (
                    <div className="border border-gray-100 dark:border-gray-800 rounded-md p-2 space-y-2 bg-gray-50/60 dark:bg-gray-900/40">
                      <div className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        {currentLanguage === 'tr'
                          ? 'Formül Örneği (İlk iş üzerinden)'
                          : 'Formula Example (First job)'}{' '}
                        <span className="font-normal text-gray-500 dark:text-gray-400">
                          ({currentLanguage === 'tr' ? 'sipariş' : 'order'}:{' '}
                          {oeeModalDetails[0]?.siparisNo || '-'})
                        </span>
                      </div>
                      {(() => {
                        const j = oeeModalDetails[0] || {};
                        const totalWastageUnits =
                          (j.periodWastageBefore || 0) + (j.periodWastageAfter || 0);
                        const totalCountUnits =
                          (j.periodProduction || 0) + (totalWastageUnits || 0);
                        return (
                          <div className="space-y-1 text-[10px] sm:text-[11px] text-gray-800 dark:text-gray-100">
                            {/* Availability */}
                            <div>
                              <div className="font-semibold">
                                {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'}:
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr'
                                  ? `Planlanan Süre = Periyot içinde üretilen miktarı hedef hızla üretmek için gereken süre`
                                  : `Planned Time = Time required to produce the period's production at target speed`}
                              </div>
                              <div>
                                {currentLanguage === 'tr'
                                  ? 'Planlanan Süre = (Periyot Üretimi / Set Sayısı) × (Silindir Çevresi / 1000) / Hedef Hız'
                                  : 'Planned Time = (Period Production / Set Count) × (Cylinder Circumference / 1000) / Target Speed'}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                = ({(j.periodProduction || 0).toLocaleString('tr-TR')} /{' '}
                                {j.setSayisi}) × ({(j.silindirCevresi || 0).toFixed(2)} / 1000) / {j.hedefHiz}
                                {' ≈ '}
                                {(j.plannedTimeMinutes || 0).toFixed(2)}{' '}
                                {currentLanguage === 'tr' ? 'dk' : 'min'}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Periyot Süresi' : 'Period Duration'} ={' '}
                                {(j.periyotSuresiDakika || 0).toFixed(2)}{' '}
                                {currentLanguage === 'tr' ? 'dk' : 'min'}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Duruş Süresi' : 'Stoppage Duration'} ={' '}
                                {((j.durusSuresiDakika || 0)).toFixed(2)}{' '}
                                {currentLanguage === 'tr' ? 'dk' : 'min'}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Run Time (Gerçek Çalışma Süresi)' : 'Run Time (Actual Working Time)'} ={' '}
                                {(j.periyotSuresiDakika || 0).toFixed(2)} -{' '}
                                {((j.durusSuresiDakika || 0)).toFixed(2)} ≈{' '}
                                {(j.runTimeAvailabilityMinutes || 0).toFixed(2)}{' '}
                                {currentLanguage === 'tr' ? 'dk' : 'min'}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'} = (
                                {(j.runTimeAvailabilityMinutes || 0).toFixed(2)} /{' '}
                                {(j.plannedTimeMinutes || 0).toFixed(2)}) × 100 ≈{' '}
                                {(j.availability || 0).toFixed(2)}%
                              </div>
                            </div>

                            {/* Performance */}
                            <div className="pt-1">
                              <div className="font-semibold">
                                {currentLanguage === 'tr' ? 'Performans' : 'Performance'}:
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr'
                                  ? `Ortalama Hız (Average Speed) = dataRecords tablosundan hesaplanır (MachineSpeed >= 65)`
                                  : `Average Speed = Calculated from dataRecords table (MachineSpeed >= 65)`}
                              </div>
                              {j.averageSpeed != null && (
                                <div className="text-gray-700 dark:text-gray-200">
                                  {currentLanguage === 'tr' ? 'Ortalama Hız' : 'Average Speed'} ={' '}
                                  {j.averageSpeed.toFixed(2)} m/dk
                                  {j.periodStartForJob && j.periodEndForJob && (
                                    <span className="text-gray-500 dark:text-gray-400 text-[9px] ml-1">
                                      ({new Date(j.periodStartForJob).toLocaleString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })} - {new Date(j.periodEndForJob).toLocaleString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })})
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Hedef Hız' : 'Target Speed'} = {j.hedefHiz} m/dk
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Performans' : 'Performance'} = (
                                {j.averageSpeed != null ? j.averageSpeed.toFixed(2) : '0.00'} / {j.hedefHiz}) × 100 ≈{' '}
                                {(j.performance || 0).toFixed(2)}%
                              </div>
                            </div>

                            {/* Quality */}
                            <div className="pt-1">
                              <div className="font-semibold">
                                {currentLanguage === 'tr' ? 'Kalite' : 'Quality'}:
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Üretim (adet)' : 'Production (pcs)'} ={' '}
                                {(j.periodProduction || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Die Öncesi Fire (adet)' : 'Wastage Before Die (pcs)'} ={' '}
                                {(j.dieOncesiAdet || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Die Sonrası Fire (adet)' : 'Wastage After Die (pcs)'} ={' '}
                                {(j.periodWastageAfter || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Toplam Fire (adet)' : 'Total Wastage (pcs)'} ={' '}
                                {(j.hataliUretim || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'QC Sonrası Fire (adet)' : 'Wastage After QC (pcs)'} ={' '}
                                {(j.periodWastageAfterQualityControl || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'İyi Ürün (Good Count)' : 'Good Count'} ={' '}
                                {(j.periodProduction || 0).toLocaleString('tr-TR')} -{' '}
                                {(j.periodWastageAfterQualityControl || 0).toLocaleString('tr-TR')} ={' '}
                                {(j.goodCountUnits || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Toplam Adet (Total Count)' : 'Total Count'} ={' '}
                                {(j.periodProduction || 0).toLocaleString('tr-TR')} +{' '}
                                {(j.hataliUretim || 0).toLocaleString('tr-TR')} ={' '}
                                {(j.totalCountForQualityUnits || 0).toLocaleString('tr-TR')}
                              </div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {currentLanguage === 'tr' ? 'Kalite' : 'Quality'} = (
                                {(j.goodCountUnits || 0).toLocaleString('tr-TR')} /{' '}
                                {(j.totalCountForQualityUnits || 0).toLocaleString('tr-TR')}) × 100 ≈{' '}
                                {(j.quality || 0).toFixed(2)}%
                              </div>
                            </div>

                            {/* OEE */}
                            <div className="pt-1">
                              <div className="font-semibold">OEE:</div>
                              <div className="text-gray-700 dark:text-gray-200">
                                {(j.availability || 0).toFixed(2)} × {(j.performance || 0).toFixed(2)} ×{' '}
                                {(j.quality || 0).toFixed(2)} / 10000 ≈ {(j.oee || 0).toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* İş bazlı veri kaynakları */}
                  {oeeModalDetails && oeeModalDetails.length > 0 && oeeModalDetails[0]?.dataSource && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                      <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                        {currentLanguage === 'tr' ? 'Veri Kaynakları (İlk iş için)' : 'Data Sources (First job)'}
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-300">
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'Kalan Miktar' : 'Remaining Qty'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.remainingWorkSource}
                        </li>
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'Üretim' : 'Production'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.productionSource}
                        </li>
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'Duruş' : 'Stoppage'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.stoppageSource}
                        </li>
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'Fire' : 'Wastage'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.wastageSource}
                        </li>
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'Ortalama Hız' : 'Average Speed'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.averageSpeedSource}
                        </li>
                        <li>
                          <span className="font-semibold">{currentLanguage === 'tr' ? 'QC Sonrası Fire' : 'Wastage After QC'}:</span>{' '}
                          {oeeModalDetails[0].dataSource.wastageAfterQualityControlSource}
                        </li>
                      </ul>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                    <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      {currentLanguage === 'tr' ? 'Genel Veri Kaynakları' : 'General Data Sources'}
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-300">
                      <li>
                        <span className="font-semibold">JobEndReports</span>{' '}
                        {currentLanguage === 'tr'
                          ? '(iş bazlı üretim, fire, duruş süreleri ve silindir_cevresi, hedef_hiz, set_sayisi gibi OEE parametreleri)'
                          : '(job-based production, wastage, stoppage durations and OEE parameters like cylinder circumference, target speed, set count)'}
                      </li>
                      <li>
                        <span className="font-semibold">PeriodicSnapshots</span>{' '}
                        {currentLanguage === 'tr'
                          ? '(periyot başı ve sonu kümülatif snapshot verileri; üretim, fire, duruş, enerji, remaining_work)'
                          : '(cumulative snapshot data at period start/end: production, wastage, stoppage, energy, remaining_work)'}
                      </li>
                      <li>
                        <span className="font-semibold">dataRecords</span>{' '}
                        {currentLanguage === 'tr'
                          ? '(Ortalama hız hesaplaması için; MachineSpeed >= 65 olan kayıtlar)'
                          : '(for average speed calculation; records where MachineSpeed >= 65)'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
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

        {/* Tarih Aralığı veya boş veri mesajı */}
        {!machine || machine === 'all' ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {currentLanguage === 'tr' ? 'Lütfen bir makine seçiniz' : 'Please select a machine'}
          </div>
        ) : data && data.summary ? (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {formatDate(data.startDate)} - {formatDate(data.endDate)}
            </div>
            {renderSummaryContent(data, true)}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {currentLanguage === 'tr' ? 'Veri bulunamadı' : 'No data available'}
          </div>
        )}
      </div>

      {/* OEE Detay Modalı (daily dışındaki periyotlar için de ortak) */}
      {isOeeModalOpen && oeeModalSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm sm:text-base font-semibold text-gray-800 dark:text-gray-100">
                {currentLanguage === 'tr' ? 'OEE Hesaplama Detayları' : 'OEE Calculation Details'}
              </h2>
              <button
                type="button"
                onClick={() => setIsOeeModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-4 text-xs sm:text-sm">
              {/* Tarih ve periyot bilgisi */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {currentLanguage === 'tr' ? 'Periyot' : 'Period'}
                  </div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {getPeriodTitle()} ({formatDate(oeeModalDates.start)})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 dark:text-gray-400">
                    {currentLanguage === 'tr' ? 'Tarih Aralığı' : 'Date Range'}
                  </div>
                  <div className="font-medium text-gray-800 dark:text-gray-100">
                    {formatDate(oeeModalDates.start)} - {formatDate(oeeModalDates.end || oeeModalDates.start)}
                  </div>
                </div>
              </div>

              {/* OEE özet değerleri */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border rounded-lg p-3 border-gray-200 dark:border-gray-800">
                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    OEE
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-50">
                    {(oeeModalSummary.overallOEE || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'}
                  </div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-300">
                    {(oeeModalSummary.availability || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {currentLanguage === 'tr' ? 'Performans' : 'Performance'}
                  </div>
                  <div className="text-sm font-bold text-green-600 dark:text-green-300">
                    {(oeeModalSummary.performance || 0).toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {currentLanguage === 'tr' ? 'Kalite' : 'Quality'}
                  </div>
                  <div className="text-sm font-bold text-purple-600 dark:text-purple-300">
                    {(oeeModalSummary.quality || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Kullanılan periyot metrikleri */}
              <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-800">
                <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-2">
                  {currentLanguage === 'tr' ? 'Periyot Metrikleri' : 'Period Metrics'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] sm:text-xs">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Toplam İş' : 'Total Jobs'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {oeeModalSummary.jobCount ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Üretim (adet)' : 'Production (pcs)'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {oeeModalSummary.actualProduction?.toLocaleString('tr-TR') ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Duruş (ms)' : 'Stoppage (ms)'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {oeeModalSummary.totalStoppageDuration ?? '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Fire (adet)' : 'Wastage (pcs)'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {Math.round(
                        (oeeModalSummary.wastageBeforeDie || 0) + (oeeModalSummary.wastageAfterDie || 0)
                      ).toLocaleString('tr-TR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {currentLanguage === 'tr' ? 'Enerji (kWh)' : 'Energy (kWh)'}
                    </div>
                    <div className="font-medium text-gray-800 dark:text-gray-100">
                      {(oeeModalSummary.energyConsumptionKwh || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formüller ve veri kaynakları */}
              <div className="border rounded-lg p-3 border-gray-200 dark:border-gray-800 space-y-2">
                <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  {currentLanguage === 'tr' ? 'Kullanılan Formüller' : 'Formulas Used'}
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">
                  <li>
                    <span className="font-semibold">
                      {currentLanguage === 'tr' ? 'Erişilebilirlik' : 'Availability'}:
                    </span>{' '}
                    {currentLanguage === 'tr'
                      ? 'Run Time / Planlanan Süre × 100 (duruş süreleri JobEndReports ve PeriodicSnapshots farklarından alınır)'
                      : 'Run Time / Planned Time × 100 (stoppage times from JobEndReports and PeriodicSnapshots differences)'}
                  </li>
                  <li>
                    <span className="font-semibold">
                      {currentLanguage === 'tr' ? 'Performans' : 'Performance'}:
                    </span>{' '}
                    {currentLanguage === 'tr'
                      ? 'İdeal Çevrim Süresi × Toplam Adet / Run Time × 100 (silindir çevresi, hedef hız, set sayısı JobEndReports tablosundan alınır)'
                      : 'Ideal Cycle Time × Total Count / Run Time × 100 (cylinder circumference, target speed, set count from JobEndReports table)'}
                  </li>
                  <li>
                    <span className="font-semibold">
                      {currentLanguage === 'tr' ? 'Kalite' : 'Quality'}:
                    </span>{' '}
                    {currentLanguage === 'tr'
                      ? 'İyi Ürün / (İyi Ürün + Fire) × 100 (üretim ve fire değerleri JobEndReports + PeriodicSnapshots farklarından alınır)'
                      : 'Good Count / (Good Count + Wastage) × 100 (production and wastage from JobEndReports + PeriodicSnapshots differences)'}
                  </li>
                  <li>
                    <span className="font-semibold">OEE:</span>{' '}
                    {currentLanguage === 'tr'
                      ? 'Erişilebilirlik × Performans × Kalite / 10000 (her bir iş için hesaplanıp ortalaması alınır)'
                      : 'Availability × Performance × Quality / 10000 (calculated per job and averaged)'}
                  </li>
                </ul>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    {currentLanguage === 'tr' ? 'Veri Kaynakları' : 'Data Sources'}
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] sm:text-xs text-gray-700 dark:text-gray-300">
                    <li>
                      <span className="font-semibold">JobEndReports</span>{' '}
                      {currentLanguage === 'tr'
                        ? '(iş bazlı üretim, fire, duruş süreleri ve silindir_cevresi, hedef_hiz, set_sayisi gibi OEE parametreleri)'
                        : '(job-based production, wastage, stoppage durations and OEE parameters like cylinder circumference, target speed, set count)'}
                    </li>
                    <li>
                      <span className="font-semibold">PeriodicSnapshots</span>{' '}
                      {currentLanguage === 'tr'
                        ? '(periyot başı ve sonu kümülatif snapshot verileri; üretim, fire, duruş, enerji, remaining_work)'
                        : '(cumulative snapshot data at period start/end: production, wastage, stoppage, energy, remaining_work)'}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
