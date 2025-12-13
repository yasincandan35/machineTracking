// Grid sistemi sabitleri
const GRID_CONFIG = {
  rowHeight: 140,    // Her satır 140px
  margin: 12,        // Gap 12px
};

// Kart yüksekliğini otomatik hesaplayan fonksiyon
export const calculateCardHeight = (rows) => {
  return (rows * GRID_CONFIG.rowHeight) + ((rows - 1) * GRID_CONFIG.margin);
};

// Kart boyut tanımları
export const cardDimensions = {
  // JOB kartı - 1 kolon x 3 satır
  'jobCard': { w: 1, h: 3 },
  
  // Info kartları - standart 1x1
  'speedInfo': { w: 1, h: 1 },
  'wastageInfo': { w: 1, h: 1 },
  'machineStateInfo': { w: 1, h: 1 },
  'dieCounterInfo': { w: 1, h: 1 },
  'dieSpeedInfo': { w: 1, h: 1 },
  'paperConsumptionInfo': { w: 1, h: 1 },
  'ethylConsumptionInfo': { w: 1, h: 1 },
  'energyConsumptionInfo': { w: 1, h: 2 },
  'comprehensiveEnergyInfo': { w: 1, h: 3 }, // 1 kolon x 3 satır - Daha uzun kart
  'stopDurationInfo': { w: 1, h: 1 },
  'actualProductionInfo': { w: 1, h: 1 },
  'remainingWorkInfo': { w: 1, h: 1 },
  'estimatedTimeInfo': { w: 1, h: 1 },
  'robotPalletizingInfo': { w: 1, h: 2 }, // 1 kolon x 2 satır
  
  // Özel kartlar
  'productionSummaryInfo': { w: 1, h: 2 }, // 1 kolon x 2 satır
  'oeeGauge': { w: 1, h: 3 }, // 1 kolon x 3 satır - OEE gauge'ları için daha fazla alan
  'oeeInfo': { w: 1, h: 3 }, // 1 kolon x 3 satır - OEE info kartı
  'stoppageChart': { w: 2, h: 3 }, // 2 kolon x 3 satır - Duruş grafiği
  
  // Periyodik Özet Kartları
  'dailySummary': { w: 1, h: 6 }, // 1 kolon x 6 satır
  'weeklySummary': { w: 1, h: 6 }, // 1 kolon x 6 satır
  'monthlySummary': { w: 1, h: 6 }, // 1 kolon x 6 satır
  'quarterlySummary': { w: 1, h: 6 }, // 1 kolon x 6 satır
  'yearlySummary': { w: 1, h: 6 } // 1 kolon x 6 satır
  
  // Grafik kartları GridSystem'de kullanılmıyor - Dashboard.jsx'de ayrı render
};

// Kart yükseklikleri - otomatik hesaplanmış
export const cardHeights = {
  'jobCard': `${calculateCardHeight(3)}px`,           // 3 satır = 444px
  'productionSummaryInfo': `${calculateCardHeight(2)}px`, // 2 satır = 304px
  'robotPalletizingInfo': `${calculateCardHeight(2)}px`, // 2 satır = 304px
  'comprehensiveEnergyInfo': `${calculateCardHeight(3)}px`, // 3 satır = 444px
  'oeeGauge': `${calculateCardHeight(3)}px`,          // 3 satır = 444px
  'dailySummary': `${calculateCardHeight(6)}px`,      // 6 satır = 864px
  'weeklySummary': `${calculateCardHeight(6)}px`,     // 6 satır = 864px
  'monthlySummary': `${calculateCardHeight(6)}px`,    // 6 satır = 864px
  'quarterlySummary': `${calculateCardHeight(6)}px`,  // 6 satır = 864px
  'yearlySummary': `${calculateCardHeight(6)}px`,     // 6 satır = 864px
  // 1 satırlık kartlar için varsayılan
  'default': `${calculateCardHeight(1)}px`            // 1 satır = 140px
};