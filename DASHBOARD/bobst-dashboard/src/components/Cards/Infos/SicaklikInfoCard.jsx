import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Thermometer } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function SicaklikInfoCard({ value, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style);
  
  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
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
