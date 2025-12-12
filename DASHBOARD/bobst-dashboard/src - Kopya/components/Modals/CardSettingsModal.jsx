import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../utils/api";
import { getTranslation } from "../../utils/translations";

// Dashboard'da kullanılan kart anahtarları
const supportedCardKeys = new Set([
  "speedInfo",
  "wastageInfo",
  "machineStateInfo",
  "dieCounterInfo",
  "dieSpeedInfo",
  "paperConsumptionInfo",
  "ethylConsumptionInfo",
  "stopDurationInfo",
  "actualProductionInfo",
  "remainingWorkInfo",
  "estimatedTimeInfo",
  "speedGraph",
  "sicaklikGraph",
  "nemGraph",
  "wastageGraph",
  "dieSpeedGraph",
  "ethylConsumptionGraph"
]);

const allCards = [
  { key: "speedInfo", label: "speedInfoCard" },
  { key: "wastageInfo", label: "wastageInfoCard" },
  { key: "speedGraph", label: "speedGraphCard" },
  { key: "machineStateInfo", label: "machineStateCard" },
  { key: "dieCounterInfo", label: "dieCounterCard" },
  { key: "dieSpeedInfo", label: "dieSpeedInfoCard" },
  { key: "paperConsumptionInfo", label: "paperConsumptionCard" },
  { key: "sicaklikGraph", label: "sicaklikGraphCard" },
  { key: "nemGraph", label: "nemGraphCard" },
  { key: "wastageGraph", label: "wastageGraphCard" },
  { key: "dieSpeedGraph", label: "dieSpeedGraphCard" },
  { key: "ethylConsumptionGraph", label: "ethylConsumptionGraphCard" },
  { key: "ethylConsumptionInfo", label: "ethylConsumptionCard" },
  { key: "stopDurationInfo", label: "stopDurationCard" },
  { key: "actualProductionInfo", label: "actualProductionCard" },
  { key: "remainingWorkInfo", label: "remainingWorkCard" },
  { key: "estimatedTimeInfo", label: "estimatedTimeCard" }
].filter(c => supportedCardKeys.has(c.key)); // sadece desteklenenleri göster

export default function CardSettingsModal({ onClose, onSave, userId, machineId, currentLanguage = 'tr' }) {
  const [selectedCards, setSelectedCards] = useState([]);

  useEffect(() => {
    if (!userId || machineId === undefined) return;

    const fetchPreferences = async () => {
      try {
        const res = await api.get(`/api/user/preferences?userId=${userId}&machineId=${machineId}`);
        const safeCards = Array.isArray(res.data.visibleCards)
          ? res.data.visibleCards.filter(c => supportedCardKeys.has(c))
          : [];
        setSelectedCards(safeCards);
      } catch (err) {
        console.error("Kartlar alınamadı:", err);
        setSelectedCards([]);
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
      // Tümü seçiliyse, hiçbirini seçme
      setSelectedCards([]);
    } else {
      // Tümünü seç
      setSelectedCards(allCards.map(card => card.key));
    }
  };

  const handleSave = async () => {
    try {
      await api.post("/api/user/preferences", {
        userId,
        machineId,
        visibleCards: selectedCards,
      });
      onSave(selectedCards);
      onClose();
    } catch (err) {
      console.error("Tercihler kaydedilemedi:", err);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded shadow-lg max-w-lg w-full">
        <h2 className="text-xl font-semibold mb-4">{getTranslation('selectVisibleCards', currentLanguage)}</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {allCards.map(card => (
            <label key={card.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedCards.includes(card.key)}
                onChange={() => handleToggle(card.key)}
              />
              {getTranslation(card.label, currentLanguage)}
            </label>
          ))}
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
