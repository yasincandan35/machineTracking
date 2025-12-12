import React from 'react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function EthylAlcoholConsumptionInfoCard({ value, style }) {
  const cardStyle = useCardStyle(style, '140px');
  const safeValue = typeof value === 'number' ? value : parseFloat(value);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >

      {/* Damla + birikinti alanı */}
      <div className="absolute right-6 top-4 w-16 h-[100px] flex items-start justify-center overflow-visible">

        {/* Damla */}
        <svg viewBox="0 0 24 24" className="w-6 h-6 animate-drip z-10">
          <path
            d="M12 2C9 7 6 10 6 13a6 6 0 0012 0c0-3-3-6-6-11z"
            fill="#8b5cf6"
          />
        </svg>

        {/* Birikinti halkası */}
        <div className="absolute bottom-2 w-6 h-1 rounded-full bg-purple-400 opacity-30 animate-puddle"></div>
      </div>

      {/* Sol içerik */}
      <div className="pr-24">
        <h2 className="text-xl font-semibold">Ethyl Alcohol Consumption</h2>
        <p className="text-3xl font-bold">
          {!isNaN(safeValue) ? safeValue.toFixed(2) : '0.00'} <span className="text-base font-medium">Liters</span>
        </p>
      </div>

      {/* Animasyonlar */}
      <style>{`
        @keyframes drip {
          0%   { transform: translateY(0px); opacity: 1; }
          80%  { transform: translateY(60px); opacity: 1; }
          100% { transform: translateY(70px); opacity: 0; }
        }

        @keyframes puddle {
          0%   { transform: scale(0.6); opacity: 0.4; }
          50%  { transform: scale(1.1); opacity: 0.2; }
          100% { transform: scale(0.6); opacity: 0.4; }
        }

        .animate-drip {
          animation: drip 1.5s ease-in-out infinite;
        }

        .animate-puddle {
          animation: puddle 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
