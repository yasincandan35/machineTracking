import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function EthylConsumptionInfoCard({ ethylAcetate, ethylAlcohol, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  const safeEthylAcetate = typeof ethylAcetate === 'number' ? ethylAcetate : parseFloat(ethylAcetate);
  const safeEthylAlcohol = typeof ethylAlcohol === 'number' ? ethylAlcohol : parseFloat(ethylAlcohol);

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sol: Mavi Akan Damla (Etil Alkol) */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-16 h-[100px] flex items-start justify-center overflow-visible">
        <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 animate-drip z-10">
          <path
            d="M12 2C9 7 6 10 6 13a6 6 0 0012 0c0-3-3-6-6-11z"
            fill="#3b82f6"
          />
        </svg>
        <div className="absolute bottom-2 w-10 h-1 rounded-full bg-blue-400 opacity-30 animate-puddle"></div>
      </div>

      {/* Ortada: Değerler - Yan Yana */}
      <div className="absolute inset-0 z-10 flex items-center justify-center gap-4 sm:gap-6 px-20 sm:px-32">
        {/* Etil Alkol (Sol) */}
        <div className="text-center">
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {getTranslation('ethylAlcohol', currentLanguage)}
          </h3>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
            {!isNaN(safeEthylAlcohol) ? safeEthylAlcohol.toFixed(2) : '0.00'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Litre</p>
        </div>

        {/* Ayırıcı çizgi */}
        <div className="h-12 sm:h-16 w-px bg-gray-300 dark:bg-gray-600"></div>

        {/* Etil Asetat (Sağ) */}
        <div className="text-center">
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {getTranslation('ethylAcetate', currentLanguage)}
          </h3>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
            {!isNaN(safeEthylAcetate) ? safeEthylAcetate.toFixed(2) : '0.00'}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Litre</p>
        </div>
      </div>

      {/* Sağ: Mor Akan Damla (Etil Asetat) */}
      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-16 h-[100px] flex items-start justify-center overflow-visible">
        <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 animate-drip-delayed z-10">
          <path
            d="M12 2C9 7 6 10 6 13a6 6 0 0012 0c0-3-3-6-6-11z"
            fill="#a855f7"
          />
        </svg>
        <div className="absolute bottom-2 w-10 h-1 rounded-full bg-purple-400 opacity-30 animate-puddle-delayed"></div>
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
        
        .animate-drip-delayed {
          animation: drip 1.5s ease-in-out infinite;
          animation-delay: 0.75s;
        }

        .animate-puddle {
          animation: puddle 1.5s ease-in-out infinite;
        }
        
        .animate-puddle-delayed {
          animation: puddle 1.5s ease-in-out infinite;
          animation-delay: 0.75s;
        }
      `}</style>
    </div>
  );
} 