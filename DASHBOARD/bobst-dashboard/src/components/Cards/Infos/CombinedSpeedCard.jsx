import React, { useEffect, useRef } from 'react';
import { getTranslation } from '../../../utils/translations';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function CombinedSpeedCard({ 
  machineSpeed, 
  dieSpeed, 
  style, 
  currentLanguage = 'tr' 
}) {
  const cardStyle = useCardStyle(style, '140px');
  const needleRef = useRef(null);
  
  const speed = parseFloat(machineSpeed) || 0;
  const dieSpeedValue = parseFloat(dieSpeed) || 0;
  const isRunning = speed > 0;
  
  // Hız animasyonu
  const angle = speed > 0 ? 90 : -90;
  const needleColor = speed > 0 ? "#f97316" : "#ef4444";
  
  // Die animasyonu
  const offset = 4;
  const duration = isRunning ? (60 / dieSpeedValue) : 0.6;
  const femaleY = 40;
  const maleY = isRunning ? 30 : 26;
  const pinY = isRunning ? 40 : 36;
  const slotY = isRunning ? 40 : 40;
  const maleColor = isRunning ? '#10B981' : '#ef4444';
  const femaleColor = '#6B7280';

  useEffect(() => {
    if (!needleRef.current) return;
    needleRef.current.style.animation = speed > 0 ? 'needleBounce 0.35s ease-in-out infinite' : 'none';
    needleRef.current.style.transform = `rotate(${angle}deg)`;
  }, [speed, angle]);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sol: Die Speed Animasyonu */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2">
        <svg
          className="w-[96px] h-[96px] sm:w-[160px] sm:h-[160px]"
          viewBox="0 0 80 80"
          fill="none"
          shapeRendering="crispEdges"
        >
          {/* Mask for female die */}
          <defs>
            <mask id="femaleMaskCombined">
              <rect width="80" height="80" fill="white"/>
              {[26, 38, 50].map((x, i) => (
                <rect
                  key={`hole-${i}`}
                  x={x}
                  y={slotY}
                  width="4"
                  height="4"
                  fill="black"
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
            </mask>
          </defs>
          
          {/* Dişi kalıp (alt) */}
          <rect
            x="20"
            y={femaleY}
            width="40"
            height="10"
            rx="2"
            fill={femaleColor}
            mask="url(#femaleMaskCombined)"
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

          {/* Erkek kalıp (üst) */}
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

          {/* Pinler */}
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
        </svg>
      </div>

      {/* Ortada: Rakamlar - Yan Yana */}
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 sm:gap-6 px-24 sm:px-40">
        {/* Die Speed (Sol) */}
        <div className="text-center">
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {getTranslation('dieSpeed', currentLanguage)}
          </h3>
          <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
            {Math.round(dieSpeedValue)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
            {getTranslation('beatsPerMin', currentLanguage)}
          </p>
        </div>

        {/* Ayırıcı çizgi */}
        <div className="h-12 sm:h-16 w-px bg-gray-300 dark:bg-gray-600"></div>

        {/* Machine Speed (Sağ) */}
        <div className="text-center">
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {getTranslation('speed', currentLanguage)}
          </h3>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
            {Math.round(speed)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">mpm</p>
        </div>
      </div>

      {/* Sağ: Machine Speed Animasyonu (İbre) */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-[90px] h-[80px] sm:w-[120px] sm:h-[100px]">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Arka kavis */}
          <path
            d="M20,100 A80,80 0 0,1 180,100"
            fill="transparent"
            stroke={speed > 0 ? "#22c55e" : "#ef4444"}
            strokeWidth="3"
          />
          
          {/* İbre */}
          <g ref={needleRef} style={{ transformOrigin: '100px 100px' }}>
            <line x1="100" y1="100" x2="100" y2="35" stroke={needleColor} strokeWidth="4" />
            <circle cx="100" cy="100" r="5" fill={needleColor} />
          </g>
        </svg>

        {/* Keyframe animasyon */}
        <style>{`
          @keyframes needleBounce {
            0%   { transform: rotate(90deg); }
            50%  { transform: rotate(75deg); }
            100% { transform: rotate(90deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

