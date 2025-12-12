import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Trash2 } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function WastageInfoCard({ value, max, min, avg, style, wastageBeforeDie, wastageAfterDie, wastageRatio, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  
  // Eğer wastageAfterDie verisi varsa onu kullan, yoksa eski value'yu kullan
  const displayValue = wastageAfterDie !== undefined ? wastageAfterDie : value;
  
  // Fire seviyesine göre renk belirle
  const isHighWastage = displayValue > 100;
  const isMediumWastage = displayValue > 50;
  
  const iconColor = isHighWastage ? 'text-red-500' : isMediumWastage ? 'text-orange-500' : 'text-green-500';
  const valueColor = isHighWastage ? 'text-red-600' : isMediumWastage ? 'text-orange-600' : 'text-green-600';

  // WastageRatio'ya göre renk belirle
  const getRatioColor = (ratio) => {
    if (ratio < 2) return 'text-green-600 dark:text-green-400';
    if (ratio < 7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const ratioColor = getRatioColor(wastageRatio);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Başlık - köşede, daha küçük */}
      <div className="absolute left-2 top-2 mobile-fire-title">
        <h2 className="text-sm font-semibold">
          {getTranslation('wastage', currentLanguage)}
        </h2>
      </div>

      {/* Fire ikonu - mobilde küçült */}
      <div className={`hidden sm:block absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 ${iconColor} mobile-fire-icon`}>
        <Trash2 className="w-8 h-8 sm:w-12 sm:h-12" />
      </div>

      {/* İçerik - hem yatay hem dikey tam ortalı */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="grid grid-cols-3 gap-4 w-full max-w-[720px] mobile-fire-content">
        {/* Sol taraf - wastageAfterDie */}
          <div className="text-center border-r border-gray-200 dark:border-gray-600 mobile-fire-item px-2">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{getTranslation('wastageAfterDie', currentLanguage)}</p>
            <p className={`text-xl sm:text-2xl font-bold ${valueColor}`}>{displayValue}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{getTranslation('pack', currentLanguage)}</p>
        </div>

        {/* Orta - wastageBeforeDie */}
          <div className="text-center border-r border-gray-200 dark:border-gray-600 mobile-fire-item px-2">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{getTranslation('wastageBeforeDie', currentLanguage)}</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
            {wastageBeforeDie !== undefined ? wastageBeforeDie.toFixed(2) : '0.00'}
          </p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{getTranslation('meters', currentLanguage)}</p>
        </div>

        {/* Sağ taraf - wastageRatio */}
          <div className="text-center mobile-fire-item px-2">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">{getTranslation('wastageRatio', currentLanguage)}</p>
            <p className={`text-xl sm:text-2xl font-bold ${ratioColor}`}>
            {wastageRatio !== undefined ? wastageRatio.toFixed(2) : '0.00'}%
          </p>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
