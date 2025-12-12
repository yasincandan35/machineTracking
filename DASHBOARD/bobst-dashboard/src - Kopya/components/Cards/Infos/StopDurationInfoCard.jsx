import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { PauseCircle } from 'lucide-react';

// Yardımcı formatlayıcı
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60); // . dan sonrası olmasın

  const parts = [];
  if (hrs > 0) parts.push(`${hrs} saat`);
  if (mins > 0 || hrs > 0) parts.push(`${mins} dk`);
  parts.push(`${secs} sn`);

  return parts.join(' ');
}

export default function StopDurationInfoCard({ lastStopDT, value, style, currentLanguage = 'tr' }) {
  const formatted = formatDuration(value ?? 0);

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
        <PauseCircle size={60} />
      </div>
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('stopDuration', currentLanguage)}</h2>
        <p className="text-base">📅 {lastStopDT || "N/A"}</p>
        <p className="text-2xl font-bold mt-2">⏱ {formatted}</p>
      </div>
    </div>
  );
}
