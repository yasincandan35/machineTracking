import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { BarChart3, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function ProductionSummaryInfoCard({ 
  actualProduction = 0,
  targetProduction = 0, 
  efficiency = 0,
  status = 'running',
  style, 
  currentLanguage = 'tr' 
}) {
  const cardStyle = useCardStyle(style, '140px', 'productionSummaryInfo');
  
  // Verimlilik yüzdesini hesapla
  const efficiencyPercent = targetProduction > 0 ? Math.round((actualProduction / targetProduction) * 100) : 0;
  
  // Durum rengini belirle
  const getStatusColor = () => {
    if (efficiencyPercent >= 100) return 'text-green-500';
    if (efficiencyPercent >= 80) return 'text-blue-500';
    if (efficiencyPercent >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Trend ikonu
  const getTrendIcon = () => {
    if (efficiencyPercent >= 100) return <TrendingUp size={20} className="text-green-500" />;
    if (efficiencyPercent >= 80) return <TrendingUp size={20} className="text-blue-500" />;
    return <TrendingDown size={20} className="text-red-500" />;
  };

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sağ ortada grafik ikonu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <BarChart3 size={60} />
      </div>

      {/* Sol içerik */}
      <div className="pr-16">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold">{getTranslation('productionSummary', currentLanguage)}</h2>
          {getTrendIcon()}
        </div>
        
        {/* Ana değerler */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{getTranslation('actual', currentLanguage)}:</span>
            <span className="font-bold">{actualProduction}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{getTranslation('target', currentLanguage)}:</span>
            <span className="font-bold">{targetProduction}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{getTranslation('efficiency', currentLanguage)}:</span>
            <span className={`font-bold ${getStatusColor()}`}>{efficiencyPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                efficiencyPercent >= 100 ? 'bg-green-500' :
                efficiencyPercent >= 80 ? 'bg-blue-500' :
                efficiencyPercent >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(efficiencyPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
