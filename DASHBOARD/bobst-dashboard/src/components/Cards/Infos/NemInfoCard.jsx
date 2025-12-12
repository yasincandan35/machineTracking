import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Droplet } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function NemInfoCard({ value, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style);
  
  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sağ ortada su damlası ikonu */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <Droplet size={60}/>
      </div>

      {/* Sol tarafta nem bilgileri */}
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('humidity', currentLanguage)}</h2>
        <p className="text-2xl font-bold">{value}%</p>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      <p>{getTranslation('current', currentLanguage)}: {value}%</p>
        </div>
      </div>
    </div>
  );
}


