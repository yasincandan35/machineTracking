import React from 'react';
import { getTranslation } from '../utils/translations';
import PeriodicSummaryCard from '../components/Cards/PeriodicSummaryCard';
import { useCardStyle } from '../hooks/useCardStyle';
import { Calendar } from 'lucide-react';

export default function PeriodicSummariesPage({
  darkMode = false,
  currentLanguage = 'tr',
  selectedMachine = null,
  colorSettings = {}
}) {
  const periods = [
    { key: 'daily', label: 'dailySummary' },
    { key: 'weekly', label: 'weeklySummary' },
    { key: 'monthly', label: 'monthlySummary' },
    { key: 'quarterly', label: 'quarterlySummary' },
    { key: 'yearly', label: 'yearlySummary' }
  ];

  const cardStyle = {
    backgroundColor: darkMode ? undefined : colorSettings.infoCard,
    color: darkMode ? undefined : colorSettings.text
  };

  return (
    <div className="p-4 sm:p-6 pt-6">
      {/* Açıklama */}
      <p className="mb-6 text-gray-600 dark:text-gray-400 text-sm sm:text-base">
        {currentLanguage === 'tr' 
          ? 'Günlük, haftalık, aylık, çeyreklik ve yıllık üretim özetlerini görüntüleyin.'
          : 'View daily, weekly, monthly, quarterly, and yearly production summaries.'}
      </p>

      {/* Periyodik Özet Kartları - 1x4 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 sm:gap-6">
        {periods.map((period) => (
          <div key={period.key} className="w-full">
            <PeriodicSummaryCard
              period={period.key}
              machine={selectedMachine?.tableName}
              style={cardStyle}
              currentLanguage={currentLanguage}
              darkMode={darkMode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

