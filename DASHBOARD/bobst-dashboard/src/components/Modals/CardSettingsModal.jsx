import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import { getTranslation } from "../../utils/translations";

const supportedCardKeys = new Set([
  "jobCard",
  "speedInfo",
  "combinedSpeed",
  "wastageInfo",
  "machineStateInfo",
  "dieCounterInfo",
  "dieSpeedInfo",
  "paperConsumptionInfo",
  "ethylConsumptionInfo",
  "energyConsumptionInfo",
  "comprehensiveEnergyInfo",
  "stopDurationInfo",
  "actualProductionInfo",
  "remainingWorkInfo",
  "estimatedTimeInfo",
  "productionSummaryInfo",
  "robotPalletizingInfo",
  "speedGraph",
  "dieSpeedGraph",
  "ethylConsumptionGraph",
  "oeeGauge",
  "stoppageChart"
]);

const basicCards = [
  { key: "jobCard", label: "job" },
  { key: "combinedSpeed", label: "combinedSpeedCard" },
  { key: "wastageInfo", label: "wastageInfoCard" },
  { key: "machineStateInfo", label: "machineStateCard" },
  { key: "ethylConsumptionInfo", label: "ethylConsumptionCard" },
  { key: "energyConsumptionInfo", label: "energyConsumptionCard" },
  { key: "productionSummaryInfo", label: "productionSummaryCard" },
  { key: "oeeGauge", label: "oeeGaugeCard" },
  { key: "stoppageChart", label: "stoppageChartCard" }
].filter(c => supportedCardKeys.has(c.key));

const advancedCards = [
  { key: "actualProductionInfo", label: "actualProductionCard" },
  { key: "remainingWorkInfo", label: "remainingWorkCard" },
  { key: "estimatedTimeInfo", label: "estimatedTimeCard" },
  { key: "speedInfo", label: "speedInfoCard" },
  { key: "dieCounterInfo", label: "dieCounterCard" },
  { key: "dieSpeedInfo", label: "dieSpeedInfoCard" },
  { key: "paperConsumptionInfo", label: "paperConsumptionCard" },
  { key: "stopDurationInfo", label: "stopDurationCard" },
  { key: "comprehensiveEnergyInfo", label: "comprehensiveEnergyCard" },
  { key: "robotPalletizingInfo", label: "robotPalletizingCard" }
].filter(c => supportedCardKeys.has(c.key));

const graphCards = [
  { key: "speedGraph", label: "speedGraphCard" },
  { key: "dieSpeedGraph", label: "dieSpeedGraphCard" },
  { key: "ethylConsumptionGraph", label: "ethylConsumptionGraphCard" }
].filter(c => supportedCardKeys.has(c.key));

const allCards = [...basicCards, ...advancedCards, ...graphCards];

export default function CardSettingsModal({ 
  onClose, 
  onSave, 
  userId, 
  machineId, 
  currentLanguage = 'tr',
  currentVisibleCards = []
}) {
  const [selectedCards, setSelectedCards] = useState(currentVisibleCards);

  useEffect(() => {
    if (!userId || machineId === undefined) return;

    const fetchPreferences = async () => {
      try {
        const res = await api.get(`/preferences?userId=${userId}&machineId=${machineId}`);
        let visibleCards = res.data.visibleCards;
        
        if (typeof visibleCards === 'string') {
          try {
            visibleCards = JSON.parse(visibleCards);
          } catch (e) {
            visibleCards = [];
          }
        }
        
        const safeCards = Array.isArray(visibleCards)
          ? visibleCards.filter(c => supportedCardKeys.has(c))
          : [];
        
        if (safeCards.length > 0) {
          setSelectedCards(safeCards);
        } else if (currentVisibleCards.length > 0) {
          setSelectedCards(currentVisibleCards);
        }
      } catch (err) {
        if (currentVisibleCards.length > 0) {
          setSelectedCards(currentVisibleCards);
        }
      }
    };

    fetchPreferences();
  }, [userId, machineId]);

  const handleToggle = (key) => {
    setSelectedCards(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    if (selectedCards.length === allCards.length) {
      setSelectedCards([]);
    } else {
      setSelectedCards(allCards.map(card => card.key));
    }
  };

  const handleSelectBasicCards = () => {
    const basicCardKeys = basicCards.map(card => card.key);
    const otherCards = selectedCards.filter(key => !basicCardKeys.includes(key));
    
    if (basicCardKeys.every(key => selectedCards.includes(key))) {
      setSelectedCards(otherCards);
    } else {
      setSelectedCards([...otherCards, ...basicCardKeys]);
    }
  };

  const handleSelectAdvancedCards = () => {
    const advancedCardKeys = advancedCards.map(card => card.key);
    const otherCards = selectedCards.filter(key => !advancedCardKeys.includes(key));
    
    if (advancedCardKeys.every(key => selectedCards.includes(key))) {
      setSelectedCards(otherCards);
    } else {
      setSelectedCards([...otherCards, ...advancedCardKeys]);
    }
  };

  const handleSelectGraphCards = () => {
    const graphCardKeys = graphCards.map(card => card.key);
    const otherCards = selectedCards.filter(key => !graphCardKeys.includes(key));
    
    if (graphCardKeys.every(key => selectedCards.includes(key))) {
      setSelectedCards(otherCards);
    } else {
      setSelectedCards([...otherCards, ...graphCardKeys]);
    }
  };

  const handleSave = async () => {
    if (selectedCards.length === 0) {
      const confirm = window.confirm('Hiçbir kart seçilmedi! Tüm kartlar gizlenecek. Devam etmek istiyor musunuz?');
      if (!confirm) return;
    }
    
    try {
      await api.post("/preferences", {
        userId,
        machineId,
        visibleCards: JSON.stringify(selectedCards)
      });
      
      onSave(selectedCards);
      onClose();
    } catch (err) {
      alert('Tercihler kaydedilemedi!');
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-3 sm:p-6 rounded shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto mobile-modal">
        <h2 className="text-xl font-semibold mb-4">{getTranslation('selectVisibleCards', currentLanguage)}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 max-h-80 sm:max-h-96 overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-blue-600 dark:text-blue-400">
                ⭐ {currentLanguage === 'tr' ? 'Temel Kartlar' : 'Basic Cards'}
              </h3>
              <button
                onClick={handleSelectBasicCards}
                className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
              >
                {basicCards.every(card => selectedCards.includes(card.key)) 
                  ? (currentLanguage === 'tr' ? 'Kaldır' : 'Remove') 
                  : (currentLanguage === 'tr' ? 'Tümünü Seç' : 'Select All')}
              </button>
            </div>
            <div className="border-b border-blue-200 dark:border-blue-700"></div>
            <div className="space-y-2">
              {basicCards.map(card => (
                <label key={card.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCards.includes(card.key)}
                    onChange={() => handleToggle(card.key)}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{getTranslation(card.label, currentLanguage)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-purple-600 dark:text-purple-400">
                🔧 {currentLanguage === 'tr' ? 'Gelişmiş Kartlar' : 'Advanced Cards'}
              </h3>
              <button
                onClick={handleSelectAdvancedCards}
                className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800"
              >
                {advancedCards.every(card => selectedCards.includes(card.key)) 
                  ? (currentLanguage === 'tr' ? 'Kaldır' : 'Remove') 
                  : (currentLanguage === 'tr' ? 'Tümünü Seç' : 'Select All')}
              </button>
            </div>
            <div className="border-b border-purple-200 dark:border-purple-700"></div>
            <div className="space-y-2">
              {advancedCards.map(card => (
                <label key={card.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCards.includes(card.key)}
                    onChange={() => handleToggle(card.key)}
                    className="text-purple-600"
                  />
                  <span className="text-sm">{getTranslation(card.label, currentLanguage)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-green-600 dark:text-green-400">
                📈 {currentLanguage === 'tr' ? 'Grafik Kartları' : 'Graph Cards'}
              </h3>
              <button
                onClick={handleSelectGraphCards}
                className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-800"
              >
                {graphCards.every(card => selectedCards.includes(card.key)) 
                  ? (currentLanguage === 'tr' ? 'Kaldır' : 'Remove') 
                  : (currentLanguage === 'tr' ? 'Tümünü Seç' : 'Select All')}
              </button>
            </div>
            <div className="border-b border-green-200 dark:border-green-700"></div>
            <div className="space-y-2">
              {graphCards.map(card => (
                <label key={card.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={selectedCards.includes(card.key)}
                    onChange={() => handleToggle(card.key)}
                    className="text-green-600"
                  />
                  <span className="text-sm">{getTranslation(card.label, currentLanguage)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button 
            onClick={handleSelectAll} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            {selectedCards.length === allCards.length ? getTranslation('removeAllCards', currentLanguage) : getTranslation('selectAllCards', currentLanguage)}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-400 rounded hover:bg-gray-500">{getTranslation('cancel', currentLanguage)}</button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{getTranslation('save', currentLanguage)}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

