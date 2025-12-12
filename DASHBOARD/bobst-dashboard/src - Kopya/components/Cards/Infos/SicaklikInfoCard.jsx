import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Thermometer } from 'lucide-react';

export default function SicaklikInfoCard({ value, style, currentLanguage = 'tr' }) {
  return (
    <div 
      className="relative rounded-xl shadow-md shadow-bottom-cards p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[120px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Sağ ortada termometre ikonu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
        <Thermometer size={60} />
      </div>

      {/* Bilgi metinleri sola hizalı */}
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('temperature', currentLanguage)}</h2>
        <p className="text-2xl font-bold">{value}°C</p>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      <p>{getTranslation('current', currentLanguage)}: {value}°C</p>
        </div>
      </div>
    </div>
  );
}
