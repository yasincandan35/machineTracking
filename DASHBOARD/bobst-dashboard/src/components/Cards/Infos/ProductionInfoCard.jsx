import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Package, Clock, Target, TrendingUp, BarChart3 } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function ProductionInfoCard({ 
  actualProduction = 0,
  remainingWork = 0, 
  estimatedTime = 0,
  overProduction = 0,
  completionPercentage = 0,
  style, 
  currentLanguage = 'tr' 
}) {
  const cardStyle = useCardStyle(style, '200px');
  
  // Tahmini süreyi saat:dakika formatına çevir
  const formatTime = (minutes) => {
    if (minutes <= 0) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Progress bar rengi
  const getProgressColor = () => {
    if (completionPercentage >= 100) return 'bg-green-500';
    if (completionPercentage >= 75) return 'bg-blue-500';
    if (completionPercentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Başlık ve ana ikon */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{getTranslation('production', currentLanguage)}</h2>
        <Package className="text-blue-500" size={32} />
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{getTranslation('completion', currentLanguage)}</span>
          <span className="text-sm font-bold">{completionPercentage}%</span>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${Math.min(completionPercentage, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Ana veriler - 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Gerçek Üretim */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <BarChart3 size={16} className="text-blue-500 mr-1" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getTranslation('actual', currentLanguage)}
            </span>
          </div>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {actualProduction.toLocaleString('tr-TR')}
          </p>
        </div>

        {/* Kalan İş */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Target size={16} className="text-orange-500 mr-1" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getTranslation('remaining', currentLanguage)}
            </span>
          </div>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {remainingWork.toLocaleString('tr-TR')}
          </p>
        </div>

        {/* Tahmini Süre */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <Clock size={16} className="text-purple-500 mr-1" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getTranslation('estimatedTime', currentLanguage)}
            </span>
          </div>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatTime(estimatedTime)}
          </p>
        </div>

        {/* Fazla Üretim */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-1">
            <TrendingUp size={16} className="text-green-500 mr-1" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getTranslation('overProduction', currentLanguage)}
            </span>
          </div>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {overProduction > 0 ? `+${overProduction.toLocaleString('tr-TR')}` : '0'}
          </p>
        </div>
      </div>
    </div>
  );
}
