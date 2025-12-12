import React, { useEffect, useRef } from 'react';
import { getTranslation } from '../../../utils/translations';

export default function SpeedInfoCard({ value, style, currentLanguage = 'tr' }) {
  const needleRef = useRef(null);
  const speed = parseFloat(value);
  const angle = speed > 0 ? 90 : -90;
  const color = speed > 0 ? "#f97316" : "#ef4444"; // turuncu / kırmızı

  useEffect(() => {
    if (!needleRef.current) return;
    needleRef.current.style.animation = speed > 0 ? 'needleBounce 0.35s ease-in-out infinite' : 'none';
    needleRef.current.style.transform = `rotate(${angle}deg)`;
  }, [speed]);

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >

      {/* Gömülü SVG Gauge */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-[120px] h-[100px]">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Arka kavis */}
          <path
  d="M20,100 A80,80 0 0,1 180,100"
  fill={
    document.documentElement.classList.contains('dark')
      ? (speed > 0 ? '#1f2937' : '#1f2937') // dark mode için arka plan sabit koyu
      : (speed > 0 ? '#f3f4f6' : '#e5e7eb') // light mode için açık tonlar
  }
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
        <p className="text-2xl font-bold">{value} mpm</p>
        {/*
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <p>Max: {max} mpm</p>
          <p>Min: {min} mpm</p>
          <p>Ort: {avg} mpm</p>
        </div>
        */}
      </div>
    </div>
  );
}
