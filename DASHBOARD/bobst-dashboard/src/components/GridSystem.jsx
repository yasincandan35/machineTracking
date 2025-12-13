import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { cardDimensions } from '../utils/cardMappings';
import { getTranslation } from '../utils/translations';
import { useTheme } from '../contexts/ThemeContext';

// Tüm kart bileşenlerini import et
import SpeedInfoCard from './Cards/Infos/SpeedInfoCard';
import WastageInfoCard from './Cards/Infos/WastageInfoCard';
import MachineStateInfoCard from './Cards/Infos/MachineStateInfoCard';
import DieCounterInfoCard from './Cards/Infos/DieCounterInfoCard';
import DieSpeedInfoCard from './Cards/Infos/DieSpeedInfoCard';
import PaperConsumptionInfoCard from './Cards/Infos/PaperConsumptionInfoCard';
import EthylConsumptionInfoCard from './Cards/Infos/EthylConsumptionInfoCard';
import EnergyConsumptionInfoCard from './Cards/Infos/EnergyConsumptionInfoCard';
import ComprehensiveEnergyInfoCard from './Cards/Infos/ComprehensiveEnergyInfoCard';
import StopDurationInfoCard from './Cards/Infos/StopDurationInfoCard';
import CombinedSpeedCard from './Cards/Infos/CombinedSpeedCard';
import ActualProductionInfoCard from './Cards/Infos/ActualProductionInfoCard';
import RemainingWorkInfoCard from './Cards/Infos/RemainingWorkInfoCard';
import EstimatedTimeInfoCard from './Cards/Infos/EstimatedTimeInfoCard';
import RobotPalletizingInfoCard from './Cards/Infos/RobotPalletizingInfoCard';
import OEEGauge from './Cards/OEEGauge';
import StoppageChart from './Cards/StoppageChart';
import PeriodicSummaryCard from './Cards/PeriodicSummaryCard';

// Grafik kartları GridSystem'de kullanılmıyor - Dashboard.jsx'de ayrı render ediliyor

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function GridSystem({ 
  visibleCards, 
  liveData, 
  currentLanguage,
  darkMode,
  colorSettings,
  isLiquidGlass = false,
  savedLayout = null,
  onLayoutChange,
  selectedMachine  // 🆕 Dinamik IP için
}) {
  // JOB kartı bileşeni - hover efektleri ile (diğer kartlar gibi)
  const JobCard = () => (
    <div 
      className={`h-full relative p-4 transition-all duration-300 cursor-pointer group ${
        isLiquidGlass 
          ? 'glass-card'
          : 'rounded-xl shadow-md hover:shadow-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 hover:scale-[1.01]'
      }`}
      style={isLiquidGlass ? {} : (darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text })}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 4H18C19.1046 4 20 4.89543 20 6V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V6C4 4.89543 4.89543 4 6 4H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="pr-16">
        <h2 className="text-lg font-bold mb-2 text-blue-600 dark:text-blue-400">{getTranslation('job', currentLanguage)}</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('order', currentLanguage)}:</span>
            <p className="font-semibold text-base">{liveData?.orderNumber || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('stock', currentLanguage)}:</span>
            <p className="font-semibold text-xs leading-tight" title={liveData?.stokAdi}>{liveData?.stokAdi || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('quantity', currentLanguage)}:</span>
            <p className="font-semibold text-base">{liveData?.totalQuantity ? liveData.totalQuantity.toLocaleString('tr-TR') : getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('remainingQuantity', currentLanguage)}:</span>
            <p className="font-semibold text-base">{liveData?.remainingQuantity ? liveData.remainingQuantity.toLocaleString('tr-TR') : getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('setCount', currentLanguage)}:</span>
            <p className="font-semibold text-sm">{liveData?.setSayisi || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('productionType', currentLanguage)}:</span>
            <p className="font-semibold text-sm">{liveData?.uretimTipi || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('targetSpeed', currentLanguage)}:</span>
            <p className="font-bold text-green-600 text-base">
              {liveData?.hedefHiz || 0} {getTranslation('mpm', currentLanguage)}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('cylinderCircumference', currentLanguage)}:</span>
            <p className="font-semibold text-sm">{liveData?.silindirCevresi || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Süreyi gün:saat:dakika formatına çevir
  const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return "0:00:00";
    
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    
    return `${days}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Production Summary kartı - hover efektleri ile (diğer kartlar gibi)
  const ProductionSummary = () => (
    <div 
      className={`h-full relative p-6 transition-all duration-300 cursor-pointer group ${
        isLiquidGlass 
          ? 'glass-card'
          : 'rounded-xl shadow-md hover:shadow-lg bg-gray-50 dark:bg-gray-800 dark:text-gray-100 hover:scale-[1.01]'
      }`}
      style={isLiquidGlass ? {} : (darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text })}
    >
      <h2 className="text-xl font-semibold mb-4">{getTranslation('productionSummary', currentLanguage)}</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('actualProduction', currentLanguage)}</p>
          <p className="text-lg font-bold text-blue-600">{liveData?.actualProduction || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('remainingWork', currentLanguage)}</p>
          <p className="text-lg font-bold text-orange-600">{liveData?.remainingWork || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('estimatedTime', currentLanguage)}</p>
          <p className="text-lg font-bold text-purple-600">{formatDuration(liveData?.estimatedTime || 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('overProduction', currentLanguage)}</p>
          <p className="text-lg font-bold text-green-600">+{liveData?.overProduction || 0}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm">{getTranslation('completed', currentLanguage)}</span>
          <span className="text-sm font-bold">{(liveData?.completionPercentage || 0).toFixed(3)}%</span>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-3">
          <div 
            className="h-3 bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(liveData?.completionPercentage || 0, 100)}%` }}
          ></div>
        </div>
      </div>
    </div>
  );

  // Tüm kart bileşenleri
  const allCardComponents = {
    jobCard: JobCard,
    productionSummaryInfo: ProductionSummary,
    
    // Info kartları
    speedInfo: () => <SpeedInfoCard value={liveData?.machineSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    combinedSpeed: () => <CombinedSpeedCard machineSpeed={liveData?.machineSpeed || 0} dieSpeed={liveData?.dieSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    wastageInfo: () => <WastageInfoCard value={liveData?.wastageRatio || 0} wastageBeforeDie={liveData?.wastageBeforeDie} wastageAfterDie={liveData?.wastageAfterDie} wastageRatio={liveData?.wastageRatio} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    machineStateInfo: () => <MachineStateInfoCard machineSpeed={liveData?.machineSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    dieCounterInfo: () => <DieCounterInfoCard value={liveData?.machineDieCounter || 0} speed={liveData?.machineDieCounter} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    dieSpeedInfo: () => <DieSpeedInfoCard value={liveData?.dieSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    paperConsumptionInfo: () => <PaperConsumptionInfoCard value={liveData?.paperConsumption || 0} dieCounter={liveData?.machineDieCounter || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    ethylConsumptionInfo: () => <EthylConsumptionInfoCard ethylAcetate={liveData?.ethylAcetateConsumption || 0} ethylAlcohol={liveData?.ethylAlcoholConsumption || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    energyConsumptionInfo: () => <EnergyConsumptionInfoCard 
      voltageL1={liveData?.voltageL1 || 0}
      voltageL2={liveData?.voltageL2 || 0}
      voltageL3={liveData?.voltageL3 || 0}
      currentL1={liveData?.currentL1 || 0}
      currentL2={liveData?.currentL2 || 0}
      currentL3={liveData?.currentL3 || 0}
      activePowerW={liveData?.activePowerW || 0}
      totalEnergyKwh={liveData?.totalEnergyKwh || 0}
      frequencyHz={liveData?.frequencyHz || 50}
      style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }}
      currentLanguage={currentLanguage}
    />,
    comprehensiveEnergyInfo: () => <ComprehensiveEnergyInfoCard 
      energyData={{
        // Excel tablosundaki gerçek veriler
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
        hotOilGas: { consumption: 177.70, unitPrice: 1.35, marketKwh: 318.02, calcKwh: 177.70, marketCost: 429.32, calcCost: 429.32, distribution: 31.9 },
        humidificationWater: { consumption: 0.16, unitPrice: 16, marketKwh: 0.16, calcKwh: 0, marketCost: 2.56, calcCost: 2.56, distribution: 0.2 }
      }}
      style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }}
      currentLanguage={currentLanguage}
    />,
    stopDurationInfo: () => <StopDurationInfoCard value={liveData?.stopDurationSec} totalValue={liveData?.totalStoppageDurationSec} stopReason={liveData?.stopReason} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    actualProductionInfo: () => <ActualProductionInfoCard value={liveData?.actualProduction || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    remainingWorkInfo: () => <RemainingWorkInfoCard value={liveData?.remainingWork || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    estimatedTimeInfo: () => <EstimatedTimeInfoCard value={liveData?.estimatedTime || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    robotPalletizingInfo: () => <RobotPalletizingInfoCard 
      qualifiedBundle={liveData?.qualifiedBundle || 0}
      defectiveBundle={liveData?.defectiveBundle || 0}
      goodPallets={liveData?.goodPallets || 0}
      defectivePallets={liveData?.defectivePallets || 0}
      style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} 
      currentLanguage={currentLanguage} 
    />,
    oeeGauge: () => <OEEGauge darkMode={darkMode} colorSettings={colorSettings} liveData={liveData} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    stoppageChart: () => <StoppageChart isDark={darkMode} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} selectedMachine={selectedMachine} />,
    
    // Periyodik Özet Kartları
    dailySummary: () => <PeriodicSummaryCard period="daily" machine={selectedMachine?.tableName} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} darkMode={darkMode} />,
    weeklySummary: () => <PeriodicSummaryCard period="weekly" machine={selectedMachine?.tableName} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} darkMode={darkMode} />,
    monthlySummary: () => <PeriodicSummaryCard period="monthly" machine={selectedMachine?.tableName} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} darkMode={darkMode} />,
    quarterlySummary: () => <PeriodicSummaryCard period="quarterly" machine={selectedMachine?.tableName} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} darkMode={darkMode} />,
    yearlySummary: () => <PeriodicSummaryCard period="yearly" machine={selectedMachine?.tableName} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} darkMode={darkMode} />
    
    // Grafik kartları GridSystem'den kaldırıldı - sadece Dashboard.jsx'de render ediliyor
  };

  // Tüm kartları topla - visibleCards'a göre (jobCard dahil)
  const allCards = visibleCards.filter(key => allCardComponents[key]);

  // Layout oluştur - Tüm kartlar sürüklenebilir
  const createLayout = () => {
    const layout = [];
    
    // Yerleşim başlangıcı
    let currentX = 0;
    let currentY = 0;
    
    // Kullanılan alanları takip et
    const occupied = new Set();
    
    // Tüm kartları yerleştir (graph kartları hariç)
    const cardsToPlace = allCards.filter(key => !key.includes('Graph'));
    
    cardsToPlace.forEach((key) => {
      // jobCard dahil tüm kartlar için boyutları al
      const dimensions = cardDimensions[key] || { w: 1, h: 1 };
      
      // Boş alan bul
      let placed = false;
      while (!placed) {
        // Kartın tüm alanı boş mu kontrol et
        let canPlace = true;
        for (let dx = 0; dx < dimensions.w; dx++) {
          for (let dy = 0; dy < dimensions.h; dy++) {
            if (occupied.has(`${currentX + dx},${currentY + dy}`) || currentX + dx >= 3) {
              canPlace = false;
              break;
            }
          }
          if (!canPlace) break;
        }
        
        if (canPlace) {
          // Kartı yerleştir
          layout.push({
            i: key,
            x: currentX,
            y: currentY,
            w: dimensions.w,
            h: dimensions.h,
            static: false,
            isDraggable: true
          });
          
          // Alanı işaretle
          for (let dx = 0; dx < dimensions.w; dx++) {
            for (let dy = 0; dy < dimensions.h; dy++) {
              occupied.add(`${currentX + dx},${currentY + dy}`);
            }
          }
          
          placed = true;
        }
        
        // Sonraki pozisyona geç
        currentX++;
        if (currentX >= 3) {
          currentX = 0;
          currentY++;
        }
        
        // Sonsuz loop önleme
        if (currentY > 20) break;
      }
    });
    
    return layout;
  };

  // Saved layout'u kullan ama tüm kartları draggable yap ve boyutları güncelle
  const processLayout = (layout) => {
    if (!layout) return createLayout();
    return layout.map(item => {
      // cardDimensions'dan doğru boyutu al, yoksa mevcut değeri kullan
      const dimensions = cardDimensions[item.i] || { w: item.w || 1, h: item.h || 1 };
      return {
        ...item,
        w: dimensions.w,  // cardMappings'den doğru boyutu al
        h: dimensions.h,  // cardMappings'den doğru boyutu al
        static: false,    // Tüm kartları sürüklenebilir yap
        isDraggable: true
      };
    });
  };

  // Kaydedilen layout varsa kullan, yoksa yeni oluştur
  // Büyük ekranda (lg) kaydedilen layout'u kullan, yoksa yeni oluştur
  // Küçük kırılımlarda mevcut kaydı işleyip tek sütunlu hale getir
  const layouts = {
    lg: processLayout(savedLayout),  // Kaydedilen layout'u kullan
    md: processLayout(savedLayout),
    sm: (savedLayout ? processLayout(savedLayout) : createLayout()).map(item => ({ ...item, x: 0, w: 1 })),
  };

  // Grid layout debug kaldırıldı - console temiz olsun

  // Mobile için basit liste, desktop için grid
  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    return (
      <div className="px-4 pt-4 space-y-4">
        {allCards.map(key => (
          <div key={key} className="w-full">
            {allCardComponents[key] ? allCardComponents[key]() : <div>Kart bulunamadı: {key}</div>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-8 pt-4 grid-mobile">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
        cols={{lg: 3, md: 2, sm: 1, xs: 1, xxs: 1}}
        rowHeight={140}
        isDraggable={true}
        isResizable={false}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
        transformScale={1}
        draggableCancel=".no-drag"
        draggableHandle=".drag-handle"
        onLayoutChange={(layout, allLayouts) => {
          if (onLayoutChange) {
            onLayoutChange(layout, allLayouts);
          }
        }}
      >
        {allCards.map(key => (
          <div key={key} className="grid-item group">
            {/* Drag Handle - Kartın üst kısmı */}
            <div 
              className="drag-handle absolute top-0 left-0 right-0 h-8 cursor-move z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.1), transparent)',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px'
              }}
            >
              <div className="flex items-center justify-center h-full">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                </div>
              </div>
            </div>
            {allCardComponents[key] ? allCardComponents[key]() : <div>Kart bulunamadı: {key}</div>}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
