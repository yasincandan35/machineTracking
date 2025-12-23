import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { PauseCircle } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

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

export default function StopDurationInfoCard({ value, totalValue, stopReason, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  const formatted = formatDuration(value ?? 0);
  const formattedTotal = formatDuration(totalValue ?? 0);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sağ ikon - biraz büyütüldü */}
      <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-red-500">
        <PauseCircle className="w-[48px] h-[48px] sm:w-[72px] sm:h-[72px]" />
      </div>
      {/* Sol kolon: üstte başlık, ortada süre, altta toplam duruş ve duruş sebebi */}
      <div className="absolute inset-y-0 left-0 w-full pr-24 sm:pr-28 pl-4 flex flex-col justify-between py-2">
        <div>
          <h2 className="text-sm sm:text-lg font-semibold">{getTranslation('stopDuration', currentLanguage)}</h2>
        </div>
        <div>
          <p className="text-xl sm:text-3xl font-bold">⏱ {formatted}</p>
          {/* Duruş sebebi */}
          {value > 0 && (
            <p className="text-xs sm:text-sm mt-1 text-gray-600 dark:text-gray-400">
              <span className="font-medium">{getTranslation('stopReason', currentLanguage)}: </span>
              <span className={stopReason ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500 dark:text-gray-500 italic'}>
                {stopReason || getTranslation('stopReasonNotEntered', currentLanguage)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
