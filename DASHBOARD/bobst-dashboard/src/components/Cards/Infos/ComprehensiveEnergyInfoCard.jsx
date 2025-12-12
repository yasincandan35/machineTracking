import React, { useState } from 'react';
import { getTranslation } from '../../../utils/translations';
import { Zap, Flame, Droplets, Battery, TrendingUp, DollarSign, Percent, PieChart } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';

export default function ComprehensiveEnergyInfoCard({ 
  // Excel tablosundaki sabit veriler
  energyData = {
    // Elektrik tüketimleri (kW)
    machineL3: { power: 96.86, current: 173.33, unitPrice: 3.5, marketKwh: 86.67, calcKwh: 96.86, marketCost: 303.33, calcCost: 339.00, distribution: 25.2 },
    chiller: { power: 51.41, current: 92.00, unitPrice: 3.5, marketKwh: 46.00, calcKwh: 51.41, marketCost: 53.67, calcCost: 59.98, distribution: 4.5 },
    chillerPump: { power: 3.27, current: 5.87, unitPrice: 3.5, marketKwh: 2.93, calcKwh: 3.27, marketCost: 3.42, calcCost: 3.82, distribution: 0.3 },
    airConditioning: { power: 48.00, current: 86.00, unitPrice: 3.5, marketKwh: 43.00, calcKwh: 48.00, marketCost: 50.17, calcCost: 56.00, distribution: 4.2 },
    compressor: { power: 55.00, current: 98.50, unitPrice: 3.5, marketKwh: 49.25, calcKwh: 55.00, marketCost: 57.46, calcCost: 64.17, distribution: 4.8 },
    waste: { power: 10.00, current: 17.90, unitPrice: 3.5, marketKwh: 8.95, calcKwh: 10.00, marketCost: 10.44, calcCost: 11.67, distribution: 0.9 },
    lighting: { power: 8.33, current: 14.93, unitPrice: 3.5, marketKwh: 7.47, calcKwh: 8.33, marketCost: 8.71, calcCost: 9.72, distribution: 0.7 },
    elevator: { power: 5.00, current: 8.96, unitPrice: 3.5, marketKwh: 4.48, calcKwh: 5.00, marketCost: 5.22, calcCost: 5.83, distribution: 0.4 },
    hotOilPump: { power: 2.67, current: 4.78, unitPrice: 3.5, marketKwh: 2.39, calcKwh: 2.67, marketCost: 2.79, calcCost: 3.11, distribution: 0.2 },
    humidificationElec: { power: 0.50, current: 0.90, unitPrice: 3.5, marketKwh: 0.45, calcKwh: 0.50, marketCost: 0.52, calcCost: 0.58, distribution: 0.0 },
    
    // Doğalgaz
    hotOilGas: { consumption: 177.70, unitPrice: 1.35, marketKwh: 318.02, calcKwh: 177.70, marketCost: 429.32, calcCost: 429.32, distribution: 31.9 },
    
    // Su
    humidificationWater: { consumption: 0.16, unitPrice: 16, marketKwh: 0.16, calcKwh: 0, marketCost: 2.56, calcCost: 2.56, distribution: 0.2 }
  },
  
  style, 
  currentLanguage = 'tr' 
}) {
  const cardStyle = useCardStyle(style, '292px', 'comprehensiveEnergy');
  const [hoveredSlice, setHoveredSlice] = useState(null);
  
  // Toplam hesaplamalar
  const totalElectricPower = Object.values(energyData).slice(0, 10).reduce((sum, item) => sum + item.power, 0);
  const totalMarketCost = Object.values(energyData).reduce((sum, item) => sum + item.marketCost, 0);
  const totalCalcCost = Object.values(energyData).reduce((sum, item) => sum + item.calcCost, 0);
  
  // En yüksek dağılım yüzdesi
  const maxDistribution = Math.max(...Object.values(energyData).map(item => item.distribution));
  
  // Renk paleti - duruş kartındaki gibi
  const colors = [
    '#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#ef4444', '#10b981',
    '#f97316', '#06b6d4', '#ec4899', '#14b8a6', '#f43f5e', '#a855f7'
  ];
  
  // Pasta grafik için veri hazırla
  const pieData = [
    { 
      name: currentLanguage === 'tr' ? 'Makine-L3' : 'Machine-L3', 
      value: energyData.machineL3.distribution, 
      color: colors[0], 
      power: energyData.machineL3.power 
    },
    { 
      name: currentLanguage === 'tr' ? 'Doğalgaz' : 'Natural Gas', 
      value: energyData.hotOilGas.distribution, 
      color: colors[4], 
      consumption: energyData.hotOilGas.consumption 
    },
    { 
      name: 'Chiller', 
      value: energyData.chiller.distribution, 
      color: colors[1], 
      power: energyData.chiller.power 
    },
    { 
      name: currentLanguage === 'tr' ? 'Klima' : 'Air Conditioning', 
      value: energyData.airConditioning.distribution, 
      color: colors[2], 
      power: energyData.airConditioning.power 
    },
    { 
      name: currentLanguage === 'tr' ? 'Kompresor' : 'Compressor', 
      value: energyData.compressor.distribution, 
      color: colors[3], 
      power: energyData.compressor.power 
    },
    { 
      name: currentLanguage === 'tr' ? 'Diğer' : 'Others', 
      value: energyData.waste.distribution + energyData.lighting.distribution + energyData.elevator.distribution + energyData.hotOilPump.distribution + energyData.humidificationElec.distribution + energyData.humidificationWater.distribution, 
      color: colors[5] 
    }
  ];
  
  // Renk belirleme fonksiyonları
  const getPowerColor = (power) => {
    if (power < 20) return 'text-green-500';
    if (power < 50) return 'text-yellow-500';
    if (power < 100) return 'text-orange-500';
    return 'text-red-500';
  };
  
  const getCostColor = (cost) => {
    if (cost < 50) return 'text-green-500';
    if (cost < 200) return 'text-yellow-500';
    if (cost < 400) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div 
      className={`${cardStyle.className} h-full flex flex-col`}
      style={{...cardStyle.style, height: '100%'}}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <PieChart size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {getTranslation('comprehensiveEnergyConsumption', currentLanguage)}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentLanguage === 'tr' ? 'Enerji Dağılımı' : 'Energy Distribution'}
          </p>
        </div>
      </div>

      {/* Ana göstergeler */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Sol: Elektrik Toplam */}
        <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap size={16} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Elektrik' : 'Electricity'}
            </span>
          </div>
          <div className={`text-xl font-bold ${getPowerColor(totalElectricPower)}`}>
            {totalElectricPower.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">kW</div>
        </div>

        {/* Orta: Toplam Maliyet */}
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-1">
            <DollarSign size={16} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Maliyet' : 'Cost'}
            </span>
          </div>
          <div className={`text-xl font-bold ${getCostColor(totalCalcCost)}`}>
            {totalCalcCost.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">
            {currentLanguage === 'tr' ? 'TL/saat' : 'TL/hour'}
          </div>
        </div>

        {/* Sağ: Paket Başına Maliyet */}
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Battery size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentLanguage === 'tr' ? 'Paket' : 'Package'}
            </span>
          </div>
          <div className={`text-xl font-bold ${getCostColor(0.15)}`}>
            0.15
          </div>
          <div className="text-xs text-gray-500">
            {currentLanguage === 'tr' ? 'TL/adet' : 'TL/piece'}
          </div>
        </div>
      </div>

      {/* Pasta Grafik - Duruş kartındaki gibi */}
      <div className="flex-1 flex items-center justify-center mb-4" style={{ overflow: 'visible' }}>
        <div className="relative w-40 h-40" style={{ overflow: 'visible' }}>
          <svg viewBox="0 0 200 200" className="w-full h-full" style={{ overflow: 'visible' }}>
            {(() => {
              let cumulativePercentage = 0;
              
              return pieData.map((item, index) => {
                const percentage = item.value;
                const startAngle = (cumulativePercentage / 100) * 360;
                const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                cumulativePercentage += percentage;
                
                const radius = 80;
                const centerX = 100;
                const centerY = 100;
                
                const startAngleRad = (startAngle - 90) * (Math.PI / 180);
                const endAngleRad = (endAngle - 90) * (Math.PI / 180);
                
                const x1 = centerX + radius * Math.cos(startAngleRad);
                const y1 = centerY + radius * Math.sin(startAngleRad);
                const x2 = centerX + radius * Math.cos(endAngleRad);
                const y2 = centerY + radius * Math.sin(endAngleRad);
                
                const largeArcFlag = percentage > 50 ? 1 : 0;
                
                const pathData = [
                  `M ${centerX} ${centerY}`,
                  `L ${x1} ${y1}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  'Z'
                ].join(' ');
                
                const isHovered = hoveredSlice && hoveredSlice.index === index;
                const scale = isHovered ? 1.05 : 1;
                
                return (
                  <g key={index}>
                    <path
                      d={pathData}
                      fill={item.color}
                      stroke="transparent"
                      strokeWidth="0"
                      onMouseEnter={() => setHoveredSlice({ index, item, percentage })}
                      onMouseLeave={() => setHoveredSlice(null)}
                      style={{ 
                        cursor: 'pointer',
                        transform: `scale(${scale})`,
                        transformOrigin: '100px 100px',
                        transition: 'all 0.2s ease',
                        filter: isHovered ? 'drop-shadow(0 8px 4px rgba(0, 0, 0, 0.3))' : 'none'
                      }}
                    />
                  </g>
                );
              });
            })()}
          </svg>
          
          {/* Tooltip */}
          {hoveredSlice && (
            <div 
              className="absolute bg-gray-900 text-white text-xs rounded-lg px-2 py-1 z-10 pointer-events-none"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                whiteSpace: 'nowrap'
              }}
            >
              <div className="font-semibold">{hoveredSlice.item.name}</div>
              <div>{hoveredSlice.percentage.toFixed(1)}%</div>
              {hoveredSlice.item.power && <div>{hoveredSlice.item.power.toFixed(0)}kW</div>}
              {hoveredSlice.item.consumption && <div>{hoveredSlice.item.consumption.toFixed(0)}m³</div>}
            </div>
          )}
        </div>
      </div>

      {/* Alt: Kategori açıklamaları */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {pieData.slice(0, 6).map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="text-gray-600 dark:text-gray-400 truncate text-xs">{item.name}</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300 ml-auto text-xs">{item.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
