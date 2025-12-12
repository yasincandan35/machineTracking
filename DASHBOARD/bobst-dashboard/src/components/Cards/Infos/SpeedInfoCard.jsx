import React, { useEffect, useRef } from 'react';
import { getTranslation } from '../../../utils/translations';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function SpeedInfoCard({ value, style, currentLanguage = 'tr', targetSpeed = 0 }) {
  const cardStyle = useCardStyle(style, '140px');
  const needleRef = useRef(null);
  const speed = parseFloat(value);
  const target = parseFloat(targetSpeed);
  const angle = speed > 0 ? 90 : -90;
  const color = speed > 0 ? "#f97316" : "#ef4444"; // turuncu / kırmızı
  
  // Hedef farkını hesapla
  const targetDiff = target > 0 ? Math.round(((speed - target) / target) * 100) : 0;

  useEffect(() => {
    if (!needleRef.current) return;
    needleRef.current.style.animation = speed > 0 ? 'needleBounce 0.35s ease-in-out infinite' : 'none';
    needleRef.current.style.transform = `rotate(${angle}deg)`;
  }, [speed]);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >

      {/* Gömülü SVG Gauge */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[120px] h-[100px]">
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
            <line x1="100" y1="100" x2="100" y2="35" stroke={color} strokeWidth="4" />
            <circle cx="100" cy="100" r="5" fill={color} />
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

      {/* Sol metinler */}
      <div className="pr-16">
        <h2 className="text-lg font-semibold">{getTranslation('speed', currentLanguage)}</h2>
        <div className="space-y-1">
          <p className="text-2xl font-bold">{value} mpm</p>
          {target > 0 && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Hedef: <span className="font-semibold text-green-600 dark:text-green-400">{target} mpm</span>
              </p>
              <p className={`text-sm font-semibold ${targetDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                Fark: {targetDiff > 0 ? '+' : ''}{targetDiff}%
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
