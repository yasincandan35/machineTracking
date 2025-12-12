import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle } from "lucide-react";
import { Switch } from '../components/ui/switch';
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";

import CardSettingsModal from "../components/Modals/CardSettingsModal";
import SicaklikInfoCard from '../components/Cards/Infos/SicaklikInfoCard';
import NemInfoCard from '../components/Cards/Infos/NemInfoCard';
import SpeedInfoCard from '../components/Cards/Infos/SpeedInfoCard';
import WastageInfoCard from '../components/Cards/Infos/WastageInfoCard';
import DonutNemCard from '../components/Cards/Donuts/DonutNemCard';
import SicaklikGraph from '../components/Cards/Graphs/SicaklikGraph';
import NemGraph from '../components/Cards/Graphs/NemGraph';
import SpeedGraph from '../components/Cards/Graphs/SpeedGraph';
import WastageGraph from '../components/Cards/Graphs/WastageGraph';
import { Sun, Moon } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import DatabaseAdmin from "../pages/DatabaseAdmin";
import MachineSelect from '../components/MachineSelect';
import MachineStateInfoCard from '../components/Cards/Infos/MachineStateInfoCard';
import DieCounterInfoCard from '../components/Cards/Infos/DieCounterInfoCard';
import EthylAcetateConsumptionInfoCard from '../components/Cards/Infos/EthylAcetateConsumptionInfoCard';
import EthylAlcoholConsumptionInfoCard from '../components/Cards/Infos/EthylAlcoholConsumptionInfoCard';
import StopDurationInfoCard from '../components/Cards/Infos/StopDurationInfoCard';




function Dashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [liveData, setLiveData] = useState(null);
  const [range, setRange] = useState("24h");
  const [rangeData, setRangeData] = useState([]);
  const [currentTab, setCurrentTab] = useState("home");
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [visibleCards, setVisibleCards] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState("main");
  const { user } = useAuth();
  const userId = user?.id;
  const [machineList, setMachineList] = useState([
    { id: "main", name: "Main Dashboard" }
  ]);

  useEffect(() => {
    api.get("/api/database/machines")
      .then(res => {
        const dynamicMachines = res.data.map(m => ({
          id: m.tableName,
          name: m.machineName
        }));
        setMachineList([
          { id: "main", name: "Main Dashboard" },
          ...dynamicMachines
        ]);
      })
      .catch(err => {
        console.error("Makine listesi alınamadı:", err);
        setMachineList([{ id: "main", name: "Main Dashboard" }]);
      });
  }, []);

  useEffect(() => {
    fetchRangeData();
  }, [range, selectedMachine]);

  useEffect(() => {
    if (!userId) return;
    fetchPreferences();
  }, [userId, selectedMachine]);

  const fetchRangeData = () => {
    api.get(`/api/sensors/period?range=${range}&machineId=${selectedMachine}`)
      .then(res => setRangeData(res.data))
      .catch(err => console.error("Veri alınamadı:", err));
  };

  const fetchPreferences = () => {
    api.get(`/api/user/preferences?userId=${userId}&machineId=${selectedMachine}`)
      .then(res => {
        const safeCards = Array.isArray(res.data.visibleCards) ? res.data.visibleCards : [];
        setVisibleCards(safeCards);
      })
      .catch(() => setVisibleCards([]));
  };

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      api.get(`/api/sensors/last?machineId=${selectedMachine}`)
        .then(res => {
          setLiveData(res.data);
        })
        .catch(err => console.error("Canlı veri alınamadı:", err));
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

const chartData = useMemo(() => ({
  machineSpeed: rangeData.map(x => ({
    name: new Date(x.kayitZamani).toISOString(),
    value: x.machineSpeed ?? 0,
    kayitZamani: x.kayitZamani
  })),
  wastage: rangeData.map(x => ({
    name: new Date(x.kayitZamani).toISOString(),
    value: parseFloat(x.wastage?.toFixed?.(2) || 0),
    kayitZamani: x.kayitZamani
  }))
}), [rangeData]);


const renderInfoCard = (title, values) => {
  const forceFloat = ["Sıcaklık", "Nem", "Wastage", "Ethyl Acetate", "Ethyl Alcohol"];

  const cleanValues = values.map(v => Number(v) || 0);
  const maxVal = Math.max(...cleanValues);
  const minVal = Math.min(...cleanValues);
  const avgVal = cleanValues.reduce((sum, v) => sum + v, 0) / cleanValues.length;
  const lastVal = cleanValues.at(-1);

  const format = (v) => forceFloat.includes(title)
    ? v.toFixed(2)
    : Math.round(v).toString();

  const max = format(maxVal);
  const min = format(minVal);
  const avg = format(avgVal);
  const last = format(lastVal);

  switch (title) {
    case "Sıcaklık": return <SicaklikInfoCard value={last} max={max} min={min} avg={avg} />;
    case "Nem": return <NemInfoCard value={last} max={max} min={min} avg={avg} />;
    case "Speed": return <SpeedInfoCard value={last} max={max} min={min} avg={avg} />;
    case "Wastage": return <WastageInfoCard value={last} max={max} min={min} avg={avg} />;
    case "Machine State": return <MachineStateInfoCard machineSpeed={parseFloat(last)} />;
    case "Die Counter": return <DieCounterInfoCard value={last} speed={liveData?.machineSpeed ?? 0} />;
    case "Ethyl Acetate": return <EthylAcetateConsumptionInfoCard value={last} />;
    case "Ethyl Alcohol": return <EthylAlcoholConsumptionInfoCard value={last} />;
    case "Stop Duration":
      return (
        <StopDurationInfoCard
          lastStopDT={liveData?.lastStopDT}
          value={liveData?.stopDurationSec}
        />
      );
    default: return null;
  }
};





  const renderGraphCard = (key, data) => {
    switch (key) {
      case "sicaklik": return <SicaklikGraph data={data} isDark={darkMode} />;
      case "nem": return <NemGraph data={data} isDark={darkMode} />;
      case "machineSpeed": return <SpeedGraph data={data} isDark={darkMode} />;
      case "wastage": return <WastageGraph data={data} isDark={darkMode} />;
      default: return null;
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-300 ease-in-out ${darkMode ? "dark bg-gray-950 text-white" : "bg-gray-150 text-black"}`}>
      <Sidebar current={currentTab} onChange={setCurrentTab} isHovered={isSidebarHovered} setIsHovered={setIsSidebarHovered} />
      <div className={`transition-all duration-300 ${isSidebarHovered ? "ml-60" : "ml-20"} p-6`}>
        {currentTab === "database" ? (
          <DatabaseAdmin />
        ) : (
          <>
            <div className="flex justify-between items-center mb-5">
  <div className="flex items-center gap-4">
    <h1 className="text-2xl font-bold">EGEqM Dashboard</h1>
    <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-3 py-1 rounded animate-pulse">
      <AlertTriangle size={16} className="text-yellow-500 dark:text-yellow-300" />
      <p className="text-sm">Site yapım aşamasındadır. Henüz veriler doğruyu yansıtmayabilir.</p>
    </div>
  </div>

  <div className="flex items-center gap-4">
    <MachineSelect value={selectedMachine} onChange={(val) => setSelectedMachine(val)} items={machineList} />
    <p>{currentTime}</p>
    <button onClick={() => setShowCardModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Kart Ayarları</button>
    <button onClick={() => setDarkMode(!darkMode)} className="flex items-center bg-gray-300 dark:bg-gray-700 rounded-full p-1 w-14 h-7 relative transition-colors duration-300">
      <div className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${darkMode ? "translate-x-7 bg-gray-900" : "translate-x-0 bg-white"}`}>
        {darkMode ? <Moon size={16} className="text-yellow-300" /> : <Sun size={16} className="text-yellow-500" />}
      </div>
    </button>
  </div>
</div>

            {currentTab === "home" && (
              <>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {["12h", "24h", "1w", "1m", "1y"].map(opt => (
                    <button
                      key={opt}
                      className={`px-3 py-1 border rounded transition-all duration-150 ${range === opt ? 'bg-blue-600 text-white' : 'bg-white text-black dark:bg-gray-700 dark:text-white'}`}
                      onClick={() => setRange(opt)}
                    >
                      {opt === "12h" && "12 Saat"}
                      {opt === "24h" && "24 Saat"}
                      {opt === "1w" && "1 Hafta"}
                      {opt === "1m" && "1 Ay"}
                      {opt === "1y" && "1 Yıl"}
                    </button>
                  ))}
                </div>

                {Array.isArray(visibleCards) && (
                  <>
                    <div className="flex flex-wrap justify-start gap-4">
  {visibleCards.includes("sicaklikInfo") && rangeData.length > 0 && liveData && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Sıcaklık", [...rangeData.map(d => d.sicaklik), liveData.sicaklik])}
    </div>
  )}

  {visibleCards.includes("nemInfo") && rangeData.length > 0 && liveData && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Nem", [...rangeData.map(d => d.nem), liveData.nem])}
    </div>
  )}

  {visibleCards.includes("speedInfo") && liveData && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Speed", [...rangeData.map(d => d.machineSpeed), liveData.machineSpeed])}
    </div>
  )}

  {visibleCards.includes("wastageInfo") && liveData && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Wastage", [...rangeData.map(d => d.wastage), liveData.wastage])}
    </div>
  )}

{visibleCards.includes("machineStateInfo") && liveData?.machineSpeed != null && (
  <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
    {renderInfoCard("Machine State", [liveData.machineSpeed])}
  </div>
)}


  {visibleCards.includes("dieCounterInfo") && liveData?.machineDieCounter != null && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Die Counter", [liveData.machineDieCounter])}
    </div>
  )}

  {visibleCards.includes("ethylAcetateInfo") && liveData?.ethylAcetateConsumption != null && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Ethyl Acetate", [liveData.ethylAcetateConsumption])}
    </div>
  )}

  {visibleCards.includes("ethylAlcoholInfo") && liveData?.ethylAlcoholConsumption != null && (
    <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
      {renderInfoCard("Ethyl Alcohol", [liveData.ethylAlcoholConsumption])}
    </div>
  )}
  {visibleCards.includes("stopDurationInfo") && liveData?.stopDurationSec != null && (
  <div className="w-full sm:w-1/2 lg:w-[calc(33.333%-1rem)]">
    {renderInfoCard("Stop Duration", [liveData.stopDurationSec])}
  </div>
)}

</div>



                  </>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {Array.isArray(visibleCards) &&
                    Object.entries(chartData).map(([key, data]) => {
                      const keyMap = {
                        sicaklik: "sicaklikGraph",
                        nem: "nemGraph",
                        machineSpeed: "speedGraph",
                        wastage: "wastageGraph"
                      };
                      if (!visibleCards.includes(keyMap[key])) return null;
                      return <div key={key}>{renderGraphCard(key, data)}</div>;
                    })}
                </div>
              </>
            )}

            {showCardModal && userId && (
              <CardSettingsModal
                userId={userId}
                machineId={selectedMachine}
                onClose={() => {
                  setShowCardModal(false);
                  fetchPreferences();
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
