import React from 'react';

// Info kartları
import SicaklikInfoCard from '../components/Cards/Infos/SicaklikInfoCard';
import NemInfoCard from '../components/Cards/Infos/NemInfoCard';
import SpeedInfoCard from '../components/Cards/Infos/SpeedInfoCard';
import WastageInfoCard from '../components/Cards/Infos/WastageInfoCard';
import MachineStateInfoCard from '../components/Cards/Infos/MachineStateInfoCard';
import DieCounterInfoCard from '../components/Cards/Infos/DieCounterInfoCard';
import DieSpeedInfoCard from '../components/Cards/Infos/DieSpeedInfoCard';
import PaperConsumptionInfoCard from '../components/Cards/Infos/PaperConsumptionInfoCard';
import EthylConsumptionInfoCard from '../components/Cards/Infos/EthylConsumptionInfoCard';
import StopDurationInfoCard from '../components/Cards/Infos/StopDurationInfoCard';
import ActualProductionInfoCard from '../components/Cards/Infos/ActualProductionInfoCard';
import RemainingWorkInfoCard from '../components/Cards/Infos/RemainingWorkInfoCard';
import EstimatedTimeInfoCard from '../components/Cards/Infos/EstimatedTimeInfoCard';
import ProductionInfoCard from '../components/Cards/Infos/ProductionInfoCard';
import RobotPalletizingInfoCard from '../components/Cards/Infos/RobotPalletizingInfoCard';

// Grafik kartları
import SpeedGraph from '../components/Cards/Graphs/SpeedGraph';
import DieSpeedGraph from '../components/Cards/Graphs/DieSpeedGraph';
import EthylConsumptionGraph from '../components/Cards/Graphs/EthylConsumptionGraph';

// Kart boyut tanımları
export const cardDimensions = {
  // JOB kartı - 1 kolon x 3 satır
  'jobCard': { w: 1, h: 3 },
  
  // Makine Özet Kartı (Main Dashboard için) - 1 kolon x 7 satır
  'machineOverview': { w: 1, h: 7 },
  
  // Info kartları - standart 1x1
  'speedInfo': { w: 1, h: 1 },
  'combinedSpeed': { w: 1, h: 1 },
  'wastageInfo': { w: 1, h: 1 },
  'machineStateInfo': { w: 1, h: 1 },
  'dieCounterInfo': { w: 1, h: 1 },
  'dieSpeedInfo': { w: 1, h: 1 },
  'paperConsumptionInfo': { w: 1, h: 1 },
  'ethylConsumptionInfo': { w: 1, h: 1 },
  'stopDurationInfo': { w: 1, h: 1 },
  'actualProductionInfo': { w: 1, h: 1 },
  'remainingWorkInfo': { w: 1, h: 1 },
  'estimatedTimeInfo': { w: 1, h: 1 },
  'robotPalletizingInfo': { w: 1, h: 2 }, // 1 kolon x 2 satır
  
  // Özel kartlar
  'productionSummaryInfo': { w: 1, h: 2 }, // 1 kolon x 2 satır
  'oeeGauge': { w: 1, h: 3 }, // 1 kolon x 3 satır
  'stoppageChart': { w: 2, h: 3 }, // 2 kolon x 3 satır
  
  // Grafik kartları - geniş
  'speedGraph': { w: 3, h: 2 },
  'dieSpeedGraph': { w: 3, h: 2 },
  'ethylConsumptionGraph': { w: 3, h: 2 }
};

// Kart render fonksiyonu
export const renderInfoCard = (cardType, values, liveData, darkMode, colorSettings, currentLanguage) => {
  const fmt = (val) => typeof val === 'number' ? val.toFixed(0) : val;
  const last = values?.[0];
  const cardStyle = darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text };

  switch (cardType) {
    case "Speed": return <SpeedInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Wastage": return <WastageInfoCard value={fmt(last)} wastageBeforeDie={liveData?.wastageBeforeDie} wastageAfterDie={liveData?.wastageAfterDie} wastageRatio={liveData?.wastageRatio} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Machine State": return <MachineStateInfoCard machineSpeed={parseFloat(last)} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Die Counter": return <DieCounterInfoCard value={last} speed={liveData?.machineDieCounter} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Die Speed": return <DieSpeedInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Ethyl Acetate": return <EthylAcetateConsumptionInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Ethyl Alcohol": return <EthylAlcoholConsumptionInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Stop Duration": return <StopDurationInfoCard value={liveData?.stopDurationSec} totalValue={liveData?.totalStoppageDurationSec} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Actual Production": return <ActualProductionInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Remaining Work": return <RemainingWorkInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Estimated Time": return <EstimatedTimeInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
    case "Production Summary": return <ProductionInfoCard 
      actualProduction={liveData?.actualProduction || 0}
      remainingWork={liveData?.remainingWork || 0}
      estimatedTime={liveData?.estimatedTime || 0}
      overProduction={liveData?.overProduction || 0}
      completionPercentage={liveData?.completionPercentage || 0}
      style={cardStyle} 
      currentLanguage={currentLanguage} 
    />;
    case "Robot Palletizing": return <RobotPalletizingInfoCard 
      qualifiedBundle={liveData?.qualifiedBundle || 0}
      defectiveBundle={liveData?.defectiveBundle || 0}
      goodPallets={liveData?.goodPallets || 0}
      defectivePallets={liveData?.defectivePallets || 0}
      style={cardStyle} 
      currentLanguage={currentLanguage} 
    />;
    default: return null;
  }
};

// Info kartları haritası
export const createInfoCardMap = (liveData, darkMode, colorSettings, currentLanguage) => ({
  sicaklikInfo: () => renderInfoCard("Temperature", [liveData?.sicaklik], liveData, darkMode, colorSettings, currentLanguage),
  nemInfo: () => renderInfoCard("Humidity", [liveData?.nem], liveData, darkMode, colorSettings, currentLanguage),
  speedInfo: () => renderInfoCard("Speed", [liveData?.machineSpeed], liveData, darkMode, colorSettings, currentLanguage),
  wastageInfo: () => renderInfoCard("Wastage", [liveData?.wastageRatio], liveData, darkMode, colorSettings, currentLanguage),
  machineStateInfo: () => renderInfoCard("Machine State", [liveData?.machineSpeed], liveData, darkMode, colorSettings, currentLanguage),
  dieCounterInfo: () => renderInfoCard("Die Counter", [liveData?.machineDieCounter], liveData, darkMode, colorSettings, currentLanguage),
  dieSpeedInfo: () => renderInfoCard("Die Speed", [liveData?.dieSpeed], liveData, darkMode, colorSettings, currentLanguage),
  paperConsumptionInfo: () => renderInfoCard("Paper Consumption", [liveData?.paperConsumption], liveData, darkMode, colorSettings, currentLanguage),
  ethylConsumptionInfo: () => <EthylConsumptionInfoCard 
    ethylAcetate={liveData?.ethylAcetateConsumption || 0} 
    ethylAlcohol={liveData?.ethylAlcoholConsumption || 0} 
    style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }}
    currentLanguage={currentLanguage}
  />,
  stopDurationInfo: () => renderInfoCard("Stop Duration", [liveData?.stopDurationSec], liveData, darkMode, colorSettings, currentLanguage),
  actualProductionInfo: () => renderInfoCard("Actual Production", [liveData?.actualProduction], liveData, darkMode, colorSettings, currentLanguage),
  remainingWorkInfo: () => renderInfoCard("Remaining Work", [liveData?.remainingWork], liveData, darkMode, colorSettings, currentLanguage),
  estimatedTimeInfo: () => renderInfoCard("Estimated Time", [liveData?.estimatedTime], liveData, darkMode, colorSettings, currentLanguage),
  productionSummaryInfo: () => renderInfoCard("Production Summary", [], liveData, darkMode, colorSettings, currentLanguage),
  robotPalletizingInfo: () => renderInfoCard("Robot Palletizing", [], liveData, darkMode, colorSettings, currentLanguage),
});

// Grafik kartları haritası
export const createGraphCardMap = (chartData, darkMode, colorSettings, currentLanguage, range, liveData) => ({
  speedGraph: () => <SpeedGraph 
    data={chartData.speed} 
    isDark={darkMode} 
    range={range}
    style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
    lineColor={darkMode ? "#3b82f6" : colorSettings.accent}
    currentLanguage={currentLanguage}
    targetSpeed={liveData?.hedefHiz || 0}
  />,
  dieSpeedGraph: () => <DieSpeedGraph 
    data={chartData.dieSpeed} 
    isDark={darkMode} 
    style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
    lineColor={darkMode ? "#a855f7" : "#8b5cf6"}
    currentLanguage={currentLanguage}
  />,
  ethylConsumptionGraph: () => <EthylConsumptionGraph 
    data={chartData.ethylConsumption} 
    isDark={darkMode} 
    range={range}
    style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
    currentLanguage={currentLanguage}
  />,
});
