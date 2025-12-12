import React from 'react';
import { getTranslation } from '../../../utils/translations';
import { Zap, Battery } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function EnergyConsumptionInfoCard({ 
  voltageL1 = -1,
  voltageL2 = -1,
  voltageL3 = -1,
  currentL1 = -1,
  currentL2 = -1,
  currentL3 = -1,
  activePowerW = -1,
  totalEnergyKwh = -1,
  style, 
  currentLanguage = 'tr' 
}) {
  const cardStyle = useCardStyle(style, '292px', 'energyConsumption');
  
  // Veri kontrol - geçerli değerleri say
  const hasVoltageL1 = voltageL1 > 0;
  const hasVoltageL2 = voltageL2 > 0;
  const hasVoltageL3 = voltageL3 > 0;
  const hasCurrentL1 = currentL1 > 0;
  const hasCurrentL2 = currentL2 > 0;
  const hasCurrentL3 = currentL3 > 0;
  
  // Güç göstergesi (kW'a çevir)
  const hasPower = activePowerW >= 0;
  const powerKw = hasPower ? (activePowerW / 1000).toFixed(2) : '-';
  const isActive = activePowerW > 100; // 100W üzeri aktif sayıyoruz
  
  const hasEnergy = totalEnergyKwh > 0;
  
  // Renk belirleme
  const getPowerColor = () => {
    if (activePowerW < 100) return 'text-gray-400';
    if (activePowerW < 5000) return 'text-green-500';
    if (activePowerW < 15000) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div 
      className={cardStyle.className}
      style={cardStyle.style}
    >
      {/* Sol Üst: Başlık */}
      <div className="absolute left-4 top-3">
        <h2 className="text-base sm:text-lg font-semibold text-gray-700 dark:text-gray-300">
          {getTranslation('energyConsumption', currentLanguage)}
        </h2>
      </div>

      {/* Sol Orta: Elektrik İkonu - Pastel sarı */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <div className="relative">
          <Zap 
            size={55}
            className="sm:w-[65px] sm:h-[65px] transition-all duration-300 text-amber-400"
            strokeWidth={2}
            fill="currentColor"
          />
          {isActive && (
            <div className="absolute inset-0 animate-ping hidden sm:block">
              <Zap size={65} className="text-amber-400 opacity-20" strokeWidth={2} />
            </div>
          )}
        </div>
      </div>

      {/* Orta Üst: Ana Güç */}
      <div className="absolute left-1/2 -translate-x-1/2 top-8">
        <div className="text-center">
          <div className="flex items-baseline gap-2 justify-center">
            <span className={`text-4xl sm:text-5xl font-bold ${getPowerColor()}`}>
              {powerKw}
            </span>
            <span className="text-lg sm:text-xl text-gray-500">kW</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {getTranslation('activePower', currentLanguage)}
          </p>
        </div>
      </div>

      {/* Ayırıcı Çizgi - TAM ORTADA */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[125px] w-32 h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>

      {/* Orta Alt: Total Energy */}
      <div className="absolute left-1/2 -translate-x-1/2 top-[150px]">
        <div className="text-center">
          <div className="flex items-baseline gap-1.5 justify-center">
            <Battery size={16} className="text-blue-500" />
            <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
              {hasEnergy ? totalEnergyKwh.toFixed(1) : '-'}
            </span>
            <span className="text-sm text-gray-500">kWh</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">Toplam Tüketim</p>
        </div>
      </div>

      {/* Sağ üst özet bilgiler kaldırıldı - gereksiz */}

      {/* Alt: L1, L2, L3 Yan Yana */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full px-4">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {/* L1 */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-[90px] justify-center sm:justify-start">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${hasVoltageL1 ? 'bg-red-500' : 'bg-gray-300'}`}></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 text-center sm:text-left">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                L1<span className="sm:hidden">:</span>
              </span>
              <span className="hidden sm:inline text-gray-400">:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {hasVoltageL1 ? `${voltageL1.toFixed(0)}V` : '-'}
              </span>
              <span className="hidden sm:inline mx-1 text-gray-400">|</span>
              <span className="text-gray-600 dark:text-gray-400">
                {hasCurrentL1 ? `${currentL1.toFixed(1)}A` : '-'}
              </span>
            </div>
          </div>
          
          {/* L2 */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-[90px] justify-center sm:justify-start">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${hasVoltageL2 ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 text-center sm:text-left">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                L2<span className="sm:hidden">:</span>
              </span>
              <span className="hidden sm:inline text-gray-400">:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {hasVoltageL2 ? `${voltageL2.toFixed(0)}V` : '-'}
              </span>
              <span className="hidden sm:inline mx-1 text-gray-400">|</span>
              <span className="text-gray-600 dark:text-gray-400">
                {hasCurrentL2 ? `${currentL2.toFixed(1)}A` : '-'}
              </span>
            </div>
          </div>
          
          {/* L3 */}
          <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-[90px] justify-center sm:justify-start">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${hasVoltageL3 ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1 text-center sm:text-left">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                L3<span className="sm:hidden">:</span>
              </span>
              <span className="hidden sm:inline text-gray-400">:</span>
              <span className="ml-1 text-gray-600 dark:text-gray-400">
                {hasVoltageL3 ? `${voltageL3.toFixed(0)}V` : '-'}
              </span>
              <span className="hidden sm:inline mx-1 text-gray-400">|</span>
              <span className="text-gray-600 dark:text-gray-400">
                {hasCurrentL3 ? `${currentL3.toFixed(1)}A` : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

