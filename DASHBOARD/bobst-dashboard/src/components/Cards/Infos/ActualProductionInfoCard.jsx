import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Package } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function ActualProductionInfoCard({ value, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  
  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
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