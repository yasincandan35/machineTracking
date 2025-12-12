import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Package } from 'lucide-react';

export default function ActualProductionInfoCard({ value, style, currentLanguage = 'tr' }) {
  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Sağ ortada paket ikonu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <Package size={60} />
      </div>

      {/* Bilgi metinleri sola hizalı */}
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('actualProduction', currentLanguage)}</h2>
        <p className="text-2xl font-bold">{value} {getTranslation('pieces', currentLanguage)}</p>

      </div>
    </div>
  );
} 