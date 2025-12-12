import React from 'react';
import { getTranslation } from '../../../utils/translations';

export default function EthylConsumptionInfoCard({ ethylAcetate, ethylAlcohol, style, currentLanguage = 'tr' }) {
  const safeEthylAcetate = typeof ethylAcetate === 'number' ? ethylAcetate : parseFloat(ethylAcetate);
  const safeEthylAlcohol = typeof ethylAlcohol === 'number' ? ethylAlcohol : parseFloat(ethylAlcohol);

  return (
    <div 
      className="relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      {/* Ortada animasyonlu damla alanı */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-[100px] flex items-start justify-center overflow-visible">

        {/* Damla */}
        <svg viewBox="0 0 24 24" className="w-8 h-8 animate-drip z-10">
          <path
            d="M12 2C9 7 6 10 6 13a6 6 0 0012 0c0-3-3-6-6-11z"
            fill="#06b6d4"
          />
        </svg>

        {/* Birikinti halkası */}
        <div className="absolute bottom-2 w-8 h-1 rounded-full bg-cyan-400 opacity-30 animate-puddle"></div>
      </div>

                        {/* Sol taraf - Etil Alkol */}
                  <div className="absolute left-3 top-3 text-left">
        <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-1">{getTranslation('ethylAlcohol', currentLanguage)}</h3>
        <p className="text-xl font-bold text-green-600 dark:text-green-400">
          {!isNaN(safeEthylAlcohol) ? safeEthylAlcohol.toFixed(2) : '0.00'} <span className="text-base font-medium">L</span>
        </p>
      </div>

                        {/* Sağ taraf - Etil Asetat */}
                  <div className="absolute right-3 top-3 text-right">
        <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-1">{getTranslation('ethylAcetate', currentLanguage)}</h3>
        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
          {!isNaN(safeEthylAcetate) ? safeEthylAcetate.toFixed(2) : '0.00'} <span className="text-base font-medium">L</span>
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
          50%   { transform: scale(1.1); opacity: 0.2; }
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