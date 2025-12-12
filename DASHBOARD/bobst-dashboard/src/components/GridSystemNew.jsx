import React from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { cardDimensions } from '../utils/cardMappings';
import { getTranslation } from '../utils/translations';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function GridSystem({ 
  visibleCards, 
  liveData, 
  currentLanguage,
  darkMode,
  colorSettings
}) {
  
  // JOB kartı bileşeni
  const JobCard = () => (
    <div className="h-full relative rounded-xl shadow-md p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100">
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
        <h2 className="text-lg font-bold mb-3 text-blue-600 dark:text-blue-400">{getTranslation('job', currentLanguage)}</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('order', currentLanguage)}:</span>
            <p className="font-semibold">{liveData?.orderNumber || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('stock', currentLanguage)}:</span>
            <p className="font-semibold">{liveData?.stokAdi || getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('quantity', currentLanguage)}:</span>
            <p className="font-semibold">{liveData?.totalQuantity ? liveData.totalQuantity.toLocaleString('tr-TR') : getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getTranslation('remainingQuantity', currentLanguage)}:</span>
            <p className="font-semibold">{liveData?.remainingQuantity ? liveData.remainingQuantity.toLocaleString('tr-TR') : getTranslation('waitingForData', currentLanguage)}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Hedef Hız:</span>
            <p className="font-bold text-green-600">{liveData?.hedefHiz || 0} mpm</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Production Summary kartı
  const ProductionSummary = () => (
    <div className="h-full relative rounded-xl shadow-md p-6 bg-gray-50 dark:bg-gray-800 dark:text-gray-100">
      <h2 className="text-xl font-semibold mb-4">Üretim Özeti</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">Gerçek</p>
          <p className="text-lg font-bold text-blue-600">{liveData?.actualProduction || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">Kalan</p>
          <p className="text-lg font-bold text-orange-600">{liveData?.remainingWork || 0}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">Süre</p>
          <p className="text-lg font-bold text-purple-600">{liveData?.estimatedTime || 0}dk</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">Fazla</p>
          <p className="text-lg font-bold text-green-600">+{liveData?.overProduction || 0}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm">Tamamlanma</span>
          <span className="text-sm font-bold">{liveData?.completionPercentage || 0}%</span>
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
    productionSummaryInfo: ProductionSummary
  };

  // Tüm kartları topla
  const allCards = ['jobCard', ...visibleCards.filter(key => allCardComponents[key])];

  // Layout oluştur
  const createLayout = () => {
    const layout = [];
    let currentX = 0, currentY = 0;
    
    allCards.forEach((key) => {
      const dimensions = cardDimensions[key] || { w: 1, h: 1 };
      
      // Satıra sığmıyorsa alt satıra geç
      if (currentX + dimensions.w > 3) {
        currentX = 0;
        currentY += 1;
      }
      
      layout.push({
        i: key,
        x: currentX,
        y: currentY,
        w: dimensions.w,
        h: dimensions.h,
        static: true
      });
      
      currentX += dimensions.w;
      
      // Satır tamamlandıysa alt satıra geç
      if (currentX >= 3) {
        currentX = 0;
        currentY += dimensions.h;
      }
    });
    
    return layout;
  };

  const layouts = {
    lg: createLayout(),
    md: createLayout(),
    sm: createLayout().map(item => ({...item, x: 0, w: 1}))
  };

  console.log('=== YENİ GRİD SİSTEMİ ===');
  console.log('All Cards:', allCards);
  console.log('Generated Layout:', layouts.lg);

  return (
    <div className="px-8 pt-4">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0}}
        cols={{lg: 3, md: 2, sm: 1, xs: 1, xxs: 1}}
        rowHeight={140}
        isDraggable={false}
        isResizable={false}
        margin={[24, 24]}
        containerPadding={[0, 0]}
      >
        {allCards.map(key => (
          <div key={key} className="grid-item">
            {allCardComponents[key] ? allCardComponents[key]() : <div>Kart bulunamadı: {key}</div>}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
