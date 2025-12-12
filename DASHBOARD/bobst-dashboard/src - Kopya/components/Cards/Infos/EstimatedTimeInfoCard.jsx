import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Clock } from 'lucide-react';

export default function EstimatedTimeInfoCard({ value, style, currentLanguage = 'tr' }) {
  // Dakikayı gün:saat:dakika formatına çevir
  const formatEstimatedTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0:00:00';
    
    const days = Math.floor(minutes / (24 * 60));
    const remainingMinutes = minutes % (24 * 60);
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    
    return `${days}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const displayValue = formatEstimatedTime(value);

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Sağ ortada Clock ikonu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <Clock 
          size={60} 
          className="animate-pulse hover:animate-spin transition-all duration-300 hover:scale-110" 
        />
      </div>

      {/* Bilgi metinleri sola hizalı */}
      <div className="pr-20">
        <h2 className="text-lg font-semibold">{getTranslation('estimatedTime', currentLanguage)}</h2>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{displayValue}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{getTranslation('dayHourMinute', currentLanguage)}</p>
      </div>
    </div>
  );
} 