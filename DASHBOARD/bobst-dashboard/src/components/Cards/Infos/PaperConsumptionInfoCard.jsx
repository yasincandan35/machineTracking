import React from "react";
import { getTranslation } from '../../../utils/translations';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function PaperConsumptionInfoCard({ value, style, currentLanguage = 'tr' }) {
  const cardStyle = useCardStyle(style, '140px');
  
  return (
    <div
      className={`${cardStyle.className} overflow-hidden`}
      style={cardStyle.style}
    >
      {/* Sağ ortada dönen kağıt bobin */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <div className="relative">
          {/* Dönen kağıt bobin */}
          <div className="w-16 h-16 bg-gradient-to-b from-white to-gray-100 rounded-full border-4 border-gray-300 relative animate-spin-slow">
            {/* Kağıt katmanları - temiz */}
            <div className="absolute inset-1 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-2 bg-gray-50 rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-3 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-4 bg-gray-50 rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-5 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-6 bg-gray-50 rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-7 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-8 bg-gray-50 rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-9 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-10 bg-gray-50 rounded-full border border-gray-200 animate-spin-slow"></div>
            <div className="absolute inset-11 bg-white rounded-full border border-gray-200 animate-spin-slow"></div>
            {/* Bobin merkezi - küçük siyah silindir */}
            <div className="absolute inset-12 bg-gray-800 rounded-full animate-spin-slow"></div>
          </div>
          
          {/* En dıştaki gri çember - küçültülmüş */}
          <div className="absolute inset-2 w-12 h-12 rounded-full border-2 border-transparent animate-spin-slow">
            <div className="absolute inset-0 rounded-full border-2 border-gray-300 bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 animate-spin-slow"></div>
          </div>
        </div>
      </div>

      {/* Bilgi metinleri sola hizalı */}
      <div className="pr-20">
        <h2 className="text-lg font-semibold">{getTranslation('paperConsumption', currentLanguage)}</h2>
        <p className="text-2xl font-bold">{parseFloat(value).toFixed(2)} m</p>
      </div>
    </div>
  );
} 