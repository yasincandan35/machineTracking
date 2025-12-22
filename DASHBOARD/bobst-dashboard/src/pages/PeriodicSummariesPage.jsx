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

  // Makine seçilmediğinde mesaj göster
  if (!selectedMachine || !selectedMachine.tableName) {
    return (
      <div className="p-4 sm:p-6 pt-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calendar className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {currentLanguage === 'tr' 
                ? 'Periyodik özetleri görüntülemek için lütfen bir makine seçin.' 
                : 'Please select a machine to view periodic summaries.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pt-4">
      {/* Periyodik Özet Kartları - 1x6 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 sm:gap-6">
        {periods.map((period) => (
          <div key={period.key} className="w-full">
            <PeriodicSummaryCard
              period={period.key}
              machine={selectedMachine.tableName}
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

