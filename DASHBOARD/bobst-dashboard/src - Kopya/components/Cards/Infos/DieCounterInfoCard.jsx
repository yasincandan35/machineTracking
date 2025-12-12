import React from 'react';
import { getTranslation } from '../../../utils/translations';

export default function DieCounterInfoCard({ value, speed, style, currentLanguage = 'tr' }) {
  const isRunning = parseFloat(speed) > 0;

  const offset = 4;
  const duration = 0.6;

  const femaleY = 40;
  const maleY = isRunning ? 30 : 26; // durunca yukarıda kalsın
  const pinY = isRunning ? 40 : 36;
  const slotY = isRunning ? 40 : 40;

  // Renkler duruma göre
  const maleColor = isRunning ? '#10B981' : '#ef4444'; // yeşil veya kırmızı
  const femaleColor = '#6B7280'; // gri alt kalıp

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Sağ animasyon alanı */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <svg
          width="160"
          height="160"
          viewBox="0 0 80 80"
          fill="none"
          shapeRendering="crispEdges"
          className="text-gray-900 dark:text-white"
        >
          {/* Dişi kalıp (alt) */}
          <g>
            <rect
              x="20"
              y={femaleY}
              width="40"
              height="10"
              rx="2"
              fill={femaleColor}
            >
              {isRunning && (
                <animate
                  attributeName="y"
                  values={`${femaleY};${femaleY + offset};${femaleY}`}
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                />
              )}
            </rect>

            {[26, 38, 50].map((x, i) => (
              <rect
                key={`slot-${i}`}
                x={x}
                y={slotY}
                width="4"
                height="4"
                className="fill-white dark:fill-gray-900"
              >
                {isRunning && (
                  <animate
                    attributeName="y"
                    values={`${slotY};${slotY + offset};${slotY}`}
                    dur={`${duration}s`}
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            ))}
          </g>

          {/* Erkek kalıp (üst) */}
          <g>
            <rect
              x="20"
              y={maleY}
              width="40"
              height="10"
              rx="2"
              fill={maleColor}
            >
              {isRunning && (
                <animate
                  attributeName="y"
                  values={`${maleY};${maleY - offset};${maleY}`}
                  dur={`${duration}s`}
                  repeatCount="indefinite"
                />
              )}
            </rect>

            {[26, 38, 50].map((x, i) => (
              <rect
                key={`pin-${i}`}
                x={x}
                y={pinY}
                width="4"
                height="4"
                fill={maleColor}
              >
                {isRunning && (
                  <animate
                    attributeName="y"
                    values={`${pinY};${pinY - offset};${pinY}`}
                    dur={`${duration}s`}
                    repeatCount="indefinite"
                  />
                )}
              </rect>
            ))}
          </g>
        </svg>
      </div>

      {/* Sol metin alanı */}
      <div className="pr-24">
        <h2 className="text-lg font-semibold">{getTranslation('dieCounter', currentLanguage)}</h2>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
