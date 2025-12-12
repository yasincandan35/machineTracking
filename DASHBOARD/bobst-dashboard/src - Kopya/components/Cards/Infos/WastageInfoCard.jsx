import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Trash2 } from 'lucide-react';

export default function WastageInfoCard({ value, max, min, avg, style, wastageBeforeDie, wastageAfterDie, wastageRatio, currentLanguage = 'tr' }) {
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
      className="relative rounded-xl shadow-md shadow-bottom-cards p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Sağ ortada fire ikonu - renk değişiyor */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${iconColor}`}>
        <Trash2 size={50} />
      </div>

      {/* Üstte başlık */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-semibold">{getTranslation('wastage', currentLanguage)}</h2>
      </div>

      {/* 3 veri yan yana */}
      <div className="flex justify-between items-center h-20">
        {/* Sol taraf - wastageAfterDie */}
        <div className="flex-1 text-center border-r border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">wastageAfterDie</p>
          <p className={`text-2xl font-bold ${valueColor}`}>{displayValue}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">pack</p>
        </div>

        {/* Orta - wastageBeforeDie */}
        <div className="flex-1 text-center border-r border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">wastageBeforeDie</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {wastageBeforeDie !== undefined ? wastageBeforeDie.toFixed(2) : '0.00'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">meters</p>
        </div>

        {/* Sağ taraf - wastageRatio */}
        <div className="flex-1 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">wastageRatio</p>
          <p className={`text-2xl font-bold ${ratioColor}`}>
            {wastageRatio !== undefined ? wastageRatio.toFixed(2) : '0.00'}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">%</p>
        </div>
      </div>
    </div>
  );
}
