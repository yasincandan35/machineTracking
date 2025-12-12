import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Cog } from 'lucide-react';

export default function MachineStateInfoCard({ machineSpeed, style, currentLanguage = 'tr' }) {
  const isRunning = machineSpeed > 0;

      const label = isRunning ? getTranslation('running', currentLanguage) : getTranslation('stopped', currentLanguage);
  const color = isRunning ? "bg-green-500 dark:bg-green-700" : "bg-red-500 dark:bg-red-700";
  const textColor = isRunning ? "text-green-500" : "text-red-500";
  const spin = isRunning;

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
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