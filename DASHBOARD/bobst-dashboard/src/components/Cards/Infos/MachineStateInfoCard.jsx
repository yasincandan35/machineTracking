import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Cog } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function MachineStateInfoCard({ machineSpeed, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  const isRunning = machineSpeed > 0;

      const label = isRunning ? getTranslation('running', currentLanguage) : getTranslation('stopped', currentLanguage);
  const color = isRunning ? "bg-green-500 dark:bg-green-700" : "bg-red-500 dark:bg-red-700";
  const textColor = isRunning ? "text-green-500" : "text-red-500";
  const spin = isRunning;

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sağ ortada animasyonlu dişli */}
      <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${textColor}`}>
        <Cog size={60} className={spin ? "animate-spin-slow" : ""} />
      </div>

      {/* Sol içerik */}
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('machineState', currentLanguage)}</h2>
        <p className={`text-2xl font-bold ${textColor}`}>{label}</p>
      </div>
    </div>
  );
}