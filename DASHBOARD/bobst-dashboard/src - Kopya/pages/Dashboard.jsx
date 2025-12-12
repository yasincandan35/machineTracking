// Gerekli React ve dış kütüphaneler
import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Sun, Moon } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { getTranslation } from '../utils/translations';


// Ortak bileşenler
import CardSettingsModal from '../components/Modals/CardSettingsModal';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api'; // Axios instance
import { useAuth } from '../contexts/AuthContext';
import { useColor } from '../contexts/ColorContext';
import DatabaseAdmin from '../pages/DatabaseAdmin';
import AdminPanel from '../pages/AdminPanel';
import SettingsPage from '../pages/SettingsPage';
import MachineSelect from '../components/MachineSelect';

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
import JobCard from '../components/Cards/JobCard';

// Grafik kartları
import SicaklikGraph from '../components/Cards/Graphs/SicaklikGraph';
import NemGraph from '../components/Cards/Graphs/NemGraph';
import SpeedGraph from '../components/Cards/Graphs/SpeedGraph';
import WastageGraph from '../components/Cards/Graphs/WastageGraph';
import DieSpeedGraph from '../components/Cards/Graphs/DieSpeedGraph';
import EthylConsumptionGraph from '../components/Cards/Graphs/EthylConsumptionGraph';

// Donut kartları
import DonutNemCard from '../components/Cards/Donuts/DonutNemCard';
import DonutSicaklikCard from '../components/Cards/Donuts/DonutSicaklikCard';

function Dashboard() {
  // Temalar, zaman, veriler, ayarlar gibi state'ler
  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [liveData, setLiveData] = useState(null);
  const [range, setRange] = useState('24h');
  const [rangeData, setRangeData] = useState([]);
  const [currentTab, setCurrentTab] = useState('home');
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [visibleCards, setVisibleCards] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [machineList, setMachineList] = useState([]);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [speedGraphData, setSpeedGraphData] = useState([]);
  const [currentLanguage, setCurrentLanguage] = useState('tr'); // Varsayılan Türkçe


  const { user } = useAuth();
  const { colorSettings } = useColor();
  const userId = user?.id;

  // Makine listesini çek
  useEffect(() => {
    api.get('/api/database/machines')
      .then(res => {
        const list = res.data.map(m => ({
          id: m.id,
          name: m.machineName,
          tableName: m.tableName
        }));
        setMachineList(list);
      })
              .catch(err => {
          console.error(getTranslation('machineListNotLoaded', currentLanguage), err);
          setMachineList([]);
        });
  }, []);

  // Son seçilen makineyi getir
  useEffect(() => {
    if (!userId || machineList.length === 0) return;
    api.get(`/api/user/last-machine?userId=${userId}`)
      .then(res => {
        const lastId = res.data?.machineId;
        const match = machineList.find(m => m.id === lastId);
        if (match) setSelectedMachine(match);
        else setSelectedMachine(machineList[0]);
      })
              .catch(err => {
          console.warn(getTranslation('lastMachineNotLoaded', currentLanguage), err);
          setSelectedMachine(machineList[0]);
        });
  }, [userId, machineList]);

  // Sayfa ilk yüklendiğinde ve makine değiştiğinde tercihleri yükle
  useEffect(() => {
    if (userId && selectedMachine?.id !== undefined) {
      fetchPreferences();
      api.post(`/api/user/last-machine`, {
        userId,
        machineId: selectedMachine.id
              }).catch(err => console.warn(getTranslation('lastMachineNotUpdated', currentLanguage), err));
    }
  }, [userId, selectedMachine?.id]);

  // Aralık değişince grafik verisi getir
  useEffect(() => {
    if (selectedMachine?.tableName) fetchRangeData();
  }, [range, selectedMachine]);

  // Saat her saniye güncellensin
  useEffect(() => {
    const intv = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(intv);
  }, []);

  // Canlı verileri her 200ms'de çek (PLCDataCollector'dan)
  useEffect(() => {
    const intv = setInterval(() => {
      fetch('http://192.168.1.44:8080/api/data')
        .then(res => res.json())
        .then(data => {
          // PLCDataCollector'dan gelen veriyi dashboard formatına çevir
          setLiveData(prevData => ({
            machineSpeed: data.MachineSpeed || 0,
            dieSpeed: data.DieSpeed || 0,
            machineDieCounter: data.MachineDieCounter || 0,
            ethylAcetateConsumption: data.EthylAcetateConsumption || 0,
            ethylAlcoholConsumption: data.EthylAlcoholConsumption || 0,
            paperConsumption: data.PaperConsumption || 0,
            lastStopEpoch: data.LastStopEpoch || 0,
            stoppageDuration: data.StoppageDuration || 0,
            // Dashboard'da kullanılan ek alanlar
            lastStopDT: data.LastStopEpoch ? new Date(data.LastStopEpoch * 1000).toLocaleString('tr-TR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }) : null,
            stopDurationSec: data.StoppageDuration ? data.StoppageDuration / 1000 : 0,
            // Sicaklik ve nem için varsayılan değerler (şimdilik)
            sicaklik: 25 + Math.random() * 5, // 25-30 arası
            nem: 45 + Math.random() * 10, // 45-55 arası
            // Production data
            actualProduction: data.ActualProduction || 0,
            remainingWork: data.RemainingWork || 0,
            estimatedTime: data.EstimatedTime || 0,
            totalStops: data.TotalStops || 0,
            setupStops: data.SetupStops || 0,
            faultStops: data.FaultStops || 0,
            qualityStops: data.QualityStops || 0,
            // Wastage data
            wastageBeforeDie: data.WastageBeforeDie || 0,
            wastageAfterDie: data.WastageAfterDie || 0,
            wastageRatio: data.WastageRatio || 0,
            // İş emri bilgilerini koru (prevData'dan)
            orderNumber: prevData?.orderNumber || '',
            totalQuantity: prevData?.totalQuantity || 0,
            uretimTipi: prevData?.uretimTipi || '',
            stokAdi: prevData?.stokAdi || '',
            hiz: prevData?.hiz || 0,
            hedefHiz: prevData?.hedefHiz || 0,
            // Set sayısı ve bundle verilerini koru
            setSayisi: prevData?.setSayisi || '',
            bundle: prevData?.bundle || ''
          }));
        })
        .catch(err => {
          console.error("PLCDataCollector'dan veri alınamadı:", err);
          // Hata durumunda varsayılan değerler (job verilerini koruyarak)
          setLiveData(prevData => ({
            ...prevData,
            machineSpeed: 0,
            dieSpeed: 0,
            machineDieCounter: 0,
            ethylAcetateConsumption: 0,
            ethylAlcoholConsumption: 0,
            paperConsumption: 0,
            lastStopEpoch: 0,
            stoppageDuration: 0,
            lastStopDT: null,
            stopDurationSec: 0,
            sicaklik: 25,
            nem: 45,
            actualProduction: 0,
            remainingWork: 0,
            estimatedTime: 0,
            totalStops: 0,
            setupStops: 0,
            faultStops: 0,
            qualityStops: 0,
            wastageBeforeDie: 0,
            wastageAfterDie: 0,
            wastageRatio: 0,
            // Job verilerini koruyoruz - bunlar ayrı useEffect'te güncelleniyor
            // orderNumber, totalQuantity, uretimTipi, stokAdi, hiz, hedefHiz, setSayisi, bundle korunuyor
          }));
        });
    }, 200); // 200ms = 5 kez/saniye
    return () => clearInterval(intv);
  }, []);

  // İş emri verilerini her 30 saniyede bir çek (/api/job endpoint'inden)
  useEffect(() => {
    const fetchJobData = () => {
      fetch('http://192.168.1.44:8080/api/job')
        .then(res => res.json())
        .then(jobData => {
          if (jobData.success && jobData.data) {
            // Sadece veri varsa güncelle, yoksa mevcut veriyi koru
            setLiveData(prevData => ({
              ...prevData,
              // İş emri verileri
              orderNumber: jobData.data.siparis_no || '',
              totalQuantity: jobData.data.toplam_miktar || 0,
              // Yeni eklenen alanlar
              uretimTipi: jobData.data.uretim_tipi || '',
              stokAdi: jobData.data.stok_adi || '',
              hiz: jobData.data.hiz || 0,
              hedefHiz: jobData.data.hedef_hiz || 0,
              // Set sayısı ve bundle verileri
              setSayisi: jobData.data.set_sayisi || '',
              bundle: jobData.data.bundle || ''
            }));
          }
          // Veri yoksa hiçbir şey yapma, mevcut veriyi koru
        })
        .catch(err => {
          console.error(getTranslation('jobDataNotLoaded', currentLanguage), err);
        });
    };

    // İlk yükleme
    fetchJobData();
    
    // Her 30 saniyede bir güncelle (5 saniye çok sık)
    const intv = setInterval(fetchJobData, 5000);
    return () => clearInterval(intv);
  }, []);

  // Grafik verilerini her 30 saniyede bir güncelle
  useEffect(() => {
    if (!selectedMachine?.tableName) return;
    
    // İlk yükleme
    fetchRangeData();
    
    // Her 30 saniyede bir güncelle
    const intv = setInterval(() => {
      fetchRangeData();
    }, 30000); // 30 saniye
    
    return () => clearInterval(intv);
  }, [selectedMachine, range]);

  // Dil değiştirme fonksiyonu
  const handleLanguageChange = (newLanguage) => {
    setCurrentLanguage(newLanguage);
    // Kullanıcı tercihini kaydet
    if (userId && selectedMachine?.id !== undefined) {
      api.post('/api/user/preferences', {
        userId,
        machineId: selectedMachine.id,
        visibleCards: visibleCards, // Mevcut kartları koru
        languageSelection: newLanguage
      }).catch(err => console.warn(getTranslation('languagePreferenceNotSaved', currentLanguage), err));
    }
  };

  // Grafiksel veri çekme fonksiyonu
  const fetchRangeData = () => {
    if (!selectedMachine?.tableName) return;
    
    // Tüm grafikler için period verisi çek (daha verimli)
    api.get(`/api/sensors/period?range=${range}&machineId=${selectedMachine.tableName}`)
      .then(res => {
        // SpeedGraph için veriyi formatla
        const speedData = res.data.map(period => ({
          name: new Date(period.kayitZamani).toISOString(),
          value: period.machineSpeed || 0
        }));
        
        setSpeedGraphData(speedData);
        
        // Diğer grafikler için range data'yı set et
        setRangeData(res.data.map(period => ({
          kayitZamani: period.kayitZamani,
          machineSpeed: period.machineSpeed,
          ethylAcetateConsumption: period.etilAsetat || period.ethylAcetateConsumption || 0,
          ethylAlcoholConsumption: period.etilAlkol || period.ethylAlcoholConsumption || 0,
          machineDieCounter: period.machineDieCounter,
          dieSpeed: period.dieSpeed,
          // Sicaklik ve nem için varsayılan değerler (şimdilik)
          sicaklik: 25 + Math.random() * 5, // 25-30 arası
          nem: 45 + Math.random() * 10, // 45-55 arası
          wastage: period.machineSpeed > 0 ? Math.random() * 2 : 0 // Speed varsa wastage
        })));
      })
              .catch(err => {
          console.error(getTranslation('rangeDataNotLoaded', currentLanguage), err);
          setSpeedGraphData([]);
          setRangeData([]);
        });
  };

  // Kullanıcı tercihlerini al
const fetchPreferences = () => {
  setIsLoadingPreferences(true);
  if (!userId || selectedMachine?.id === undefined) return;

  api.get(`/api/user/preferences?userId=${userId}&machineId=${selectedMachine.id}`)
    .then(res => {
      const allValidKeys = [
        ...Object.keys(cardComponentMap),
        ...Object.keys(graphComponentMap)
      ];

      const savedCards = Array.isArray(res.data.visibleCards)
        ? res.data.visibleCards.filter(c => c && typeof c === "string" && allValidKeys.includes(c))
        : [];

      // Eğer hiç kart seçilmemişse varsayılan kartları göster
      if (savedCards.length === 0) {
        const defaultCards = ["sicaklikInfo", "nemInfo", "speedInfo", "wastageInfo", "ethylConsumptionInfo", "paperConsumptionInfo", "speedGraph", "ethylConsumptionGraph", "donutNemCard", "donutSicaklikCard"];
        setVisibleCards(defaultCards);
      } else {
        setVisibleCards(savedCards);
      }
      
      // Dil tercihini al
      if (res.data.languageSelection) {
        setCurrentLanguage(res.data.languageSelection);
      } else {
        // Eğer dil tercihi yoksa varsayılan olarak Türkçe kullan
        setCurrentLanguage('tr');
      }
    })
            .catch(err => {
          console.error(getTranslation('preferencesNotLoaded', currentLanguage), err);
          // Hata durumunda varsayılan kartları göster
          const defaultCards = ["sicaklikInfo", "nemInfo", "speedInfo", "wastageInfo", "ethylConsumptionInfo", "paperConsumptionInfo", "speedGraph", "donutNemCard", "donutSicaklikCard"];
          setVisibleCards(defaultCards);
        })
    .finally(() => setIsLoadingPreferences(false));
  };




    // Grafik için veriyi formatla (sadece seçili olanlar için)
  const chartData = useMemo(() => {
    const result = {
      machineSpeed: speedGraphData
    };
    
    // Sadece seçili olan grafikler için veri hazırla
    if (visibleCards.includes("sicaklikGraph")) {
      result.sicaklik = rangeData.map(x => {
        try {
          const date = new Date(x.kayitZamani);
          if (isNaN(date.getTime())) {
            console.warn('Invalid date in sicaklik data:', x.kayitZamani);
            return null;
          }
          return { 
            name: date.toISOString(), 
            value: parseFloat(x.sicaklik?.toFixed?.(2) || 0) 
          };
        } catch (error) {
          console.warn('Date parsing error in sicaklik:', error);
          return null;
        }
      }).filter(Boolean);
    }
    
    if (visibleCards.includes("nemGraph")) {
      result.nem = rangeData.map(x => {
        try {
          const date = new Date(x.kayitZamani);
          if (isNaN(date.getTime())) {
            console.warn('Invalid date in nem data:', x.kayitZamani);
            return null;
          }
          return { 
            name: date.toISOString(), 
            value: parseFloat(x.nem?.toFixed?.(2) || 0) 
          };
        } catch (error) {
          console.warn('Date parsing error in nem:', error);
          return null;
        }
      }).filter(Boolean);
    }
    
    if (visibleCards.includes("wastageGraph")) {
      result.wastage = rangeData.map(x => {
        try {
          const date = new Date(x.kayitZamani);
          if (isNaN(date.getTime())) {
            console.warn('Invalid date in wastage data:', x.kayitZamani);
            return null;
          }
          return { 
            name: date.toISOString(), 
            value: parseFloat(x.wastage?.toFixed?.(2) || 0) 
          };
        } catch (error) {
          console.warn('Date parsing error in wastage:', error);
          return null;
        }
      }).filter(Boolean);
    }
    
    if (visibleCards.includes("dieSpeedGraph")) {
      result.dieSpeed = rangeData.map(x => {
        try {
          const date = new Date(x.kayitZamani);
          if (isNaN(date.getTime())) {
            console.warn('Invalid date in dieSpeed data:', x.kayitZamani);
            return null;
          }
          return { 
            name: date.toISOString(), 
            value: parseFloat(x.dieSpeed?.toFixed?.(2) || 0) 
          };
        } catch (error) {
            console.warn('Date parsing error in dieSpeed:', error);
            return null;
          }
      }).filter(Boolean);
    }
    
    if (visibleCards.includes("ethylConsumptionGraph")) {
      result.ethylConsumption = rangeData.map(x => ({
        kayitZamani: x.kayitZamani,
        ethylAcetateConsumption: x.ethylAcetateConsumption || 0,
        ethylAlcoholConsumption: x.ethylAlcoholConsumption || 0
      }));
    }
    
    return result;
  }, [rangeData, speedGraphData, visibleCards]);

  // Info kart bileşenlerini dinamik üret
  const renderInfoCard = (title, values) => {
    const translatedTitle = getTranslation(title.toLowerCase().replace(/\s+/g, ''), currentLanguage);
    const forceFloat = ["Sıcaklık", "Nem", "Wastage", "Ethyl Acetate", "Ethyl Alcohol"];
    const clean = values.map(v => Number(v) || 0);
    const last = clean.at(-1);
    const fmt = v => forceFloat.includes(title) ? v.toFixed(2) : Math.round(v).toString();
    
    const cardStyle = darkMode ? {} : {
      backgroundColor: colorSettings.infoCard,
      color: colorSettings.text
    };
    
    switch (title) {
      case "Sıcaklık": return <SicaklikInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Nem": return <NemInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Speed": return <SpeedInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Wastage": return <WastageInfoCard value={fmt(last)} wastageBeforeDie={liveData?.wastageBeforeDie} wastageAfterDie={liveData?.wastageAfterDie} wastageRatio={liveData?.wastageRatio} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Machine State": return <MachineStateInfoCard machineSpeed={parseFloat(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Die Counter": return <DieCounterInfoCard value={last} speed={liveData?.machineDieCounter} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Die Speed": return <DieSpeedInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Ethyl Acetate": return <EthylAcetateConsumptionInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Ethyl Alcohol": return <EthylAlcoholConsumptionInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Stop Duration": return <StopDurationInfoCard lastStopDT={liveData?.lastStopDT} value={liveData?.stopDurationSec} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Actual Production": return <ActualProductionInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Remaining Work": return <RemainingWorkInfoCard value={fmt(last)} style={cardStyle} currentLanguage={currentLanguage} />;
      case "Estimated Time": return <EstimatedTimeInfoCard value={last} style={cardStyle} currentLanguage={currentLanguage} />;
      default: return null;
    }
  };

  // Anahtar => kart bileşen haritası (Info kartları)
  const cardComponentMap = {
    sicaklikInfo: () => renderInfoCard("Sıcaklık", [...rangeData.map(d => d.sicaklik), liveData?.sicaklik]),
    nemInfo: () => renderInfoCard("Nem", [...rangeData.map(d => d.nem), liveData?.nem]),
    speedInfo: () => renderInfoCard("Speed", [...rangeData.map(d => d.machineSpeed), liveData?.machineSpeed]),
    wastageInfo: () => renderInfoCard("Wastage", [...rangeData.map(d => d.wastage), liveData?.wastage]),
    machineStateInfo: () => renderInfoCard("Machine State", [liveData?.machineSpeed]),
    dieCounterInfo: () => <DieCounterInfoCard value={liveData?.machineDieCounter || 0} speed={liveData?.machineSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    dieSpeedInfo: () => <DieSpeedInfoCard value={liveData?.dieSpeed || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    paperConsumptionInfo: () => <PaperConsumptionInfoCard value={liveData?.paperConsumption || 0} dieCounter={liveData?.machineDieCounter || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    ethylConsumptionInfo: () => <EthylConsumptionInfoCard 
      ethylAcetate={liveData?.ethylAcetateConsumption || 0} 
      ethylAlcohol={liveData?.ethylAlcoholConsumption || 0} 
      style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }}
      currentLanguage={currentLanguage}
    />,
    stopDurationInfo: () => renderInfoCard("Stop Duration", [liveData?.stopDurationSec]),
    actualProductionInfo: () => renderInfoCard("Actual Production", [liveData?.actualProduction]),
    remainingWorkInfo: () => renderInfoCard("Remaining Work", [liveData?.remainingWork]),
    estimatedTimeInfo: () => renderInfoCard("Estimated Time", [liveData?.estimatedTime]),
    donutNemCard: () => <DonutNemCard value={liveData?.nem || 0} style={darkMode ? {} : { backgroundColor: colorSettings.infoCard, color: colorSettings.text }} currentLanguage={currentLanguage} />,
    donutSicaklikCard: () => <DonutSicaklikCard value={liveData?.sicaklik || 0} style={darkMode ? {} : { backgroundColor: colorSettings.text }} currentLanguage={currentLanguage} />,
  };

  // Grafik kartları haritası
  const graphComponentMap = {
    speedGraph: () => <SpeedGraph 
      data={chartData.machineSpeed} 
      isDark={darkMode} 
      range={range}
      style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
      lineColor={darkMode ? "#3b82f6" : colorSettings.accent}
      currentLanguage={currentLanguage}
    />,
    sicaklikGraph: () => <SicaklikGraph 
      data={chartData.sicaklik} 
      isDark={darkMode} 
      style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
      lineColor={darkMode ? "#fb7185" : "#ff6b35"}
      currentLanguage={currentLanguage}
    />,
    nemGraph: () => <NemGraph 
      data={chartData.nem} 
      isDark={darkMode} 
      style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
      lineColor={darkMode ? "#34d399" : "#10b981"}
      currentLanguage={currentLanguage}
    />,
    wastageGraph: () => <WastageGraph 
      data={chartData.wastage} 
      isDark={darkMode} 
      style={darkMode ? {} : { backgroundColor: colorSettings.graphCard, color: colorSettings.text }}
      lineColor={darkMode ? "#f87171" : "#ef4444"}
      currentLanguage={currentLanguage}
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
  };



  // Ana return (görünüm)
  return (
    <div 
      className={`min-h-screen ${darkMode ? "dark text-white" : "text-black"}`}
      style={{ 
        backgroundColor: darkMode ? '#0f172a' : colorSettings.background 
      }}
    >
      <Sidebar 
        current={currentTab} 
        onChange={setCurrentTab} 
        isHovered={isSidebarHovered} 
        setIsHovered={setIsSidebarHovered}
        backgroundColor={darkMode ? undefined : colorSettings.sidebar}
        currentLanguage={currentLanguage}
      />
      <div 
        className={`transition-all duration-300 ${isSidebarHovered ? "ml-60" : "ml-20"}`} 
        style={{ 
          color: darkMode ? undefined : colorSettings.text,
          zoom: '0.75'
        }}
      >
        {/* Top Bar - Integrated like sidebar with only bottom shadow */}
        <div className="bg-white dark:bg-gray-800 shadow-bottom p-6 mb-8 mt-0 relative z-40">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-red-600" style={{ color: darkMode ? undefined : colorSettings.text }}>EGEM DASHBOARD</h1>
              <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-3 py-1 rounded animate-pulse">
                <AlertTriangle size={16} />
                <p className="text-sm">{getTranslation('siteUnderConstruction', currentLanguage)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <MachineSelect
                value={selectedMachine?.id}
                onChange={(id) => {
                  const match = machineList.find(m => m.id === id);
                  if (match) setSelectedMachine(match);
                }}
                items={machineList}
              />
              
              <p style={{ color: darkMode ? undefined : colorSettings.text }}>{currentTime}</p>
              <button onClick={() => setShowCardModal(true)} className="text-white px-3 py-1 rounded" style={{ backgroundColor: darkMode ? undefined : colorSettings.accent }}>{getTranslation('cardSettings', currentLanguage)}</button>
              <LanguageSelector 
                currentLanguage={currentLanguage} 
                onLanguageChange={handleLanguageChange} 
              />
              <button onClick={() => setDarkMode(!darkMode)} className="bg-gray-300 dark:bg-gray-700 rounded-full p-1 w-14 h-7 relative">
                <div className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-transform ${darkMode ? "translate-x-7 bg-gray-900" : "translate-x-0 bg-white"}`}>
                  {darkMode ? <Moon size={16} className="text-yellow-300" /> : <Sun size={16} className="text-yellow-500" />}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Home sekmesi içeriği */}
        {currentTab === 'home' && (
          <>
            {/* Ana kartlar grid'i - Responsive - Added more spacing */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8 px-8 pt-4">
              {/* Sol sütun - JOB kartı (1x3 boyutunda) */}
              <div className="lg:col-span-1">
                <div className="h-[468px] relative rounded-xl shadow-bottom-cards p-4 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer">
                  {/* Sağ ortada JOB ikonu */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Clipboard/Job ikonu */}
                      <path d="M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 7H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 4H18C19.1046 4 20 4.89543 20 6V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V6C4 4.89543 4.89543 4 6 4H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15 2H9C8.44772 2 8 2.44772 8 3V5C8 5.55228 8.44772 6 9 6H15C15.5523 6 16 5.55228 16 5V3C16 2.44772 15.5523 2 15 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* Sol metin alanı */}
                  <div className="pr-24 h-full flex flex-col justify-center">
                    <h2 className="text-2xl font-semibold mb-6 text-blue-600 dark:text-blue-400">{getTranslation('job', currentLanguage)}</h2>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('order', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.orderNumber || getTranslation('waitingForData', currentLanguage)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('stock', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.stokAdi || getTranslation('waitingForData', currentLanguage)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('production', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.uretimTipi || getTranslation('waitingForData', currentLanguage)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('quantity', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.totalQuantity ? parseInt(liveData.totalQuantity).toLocaleString() : getTranslation('waitingForData', currentLanguage)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('setCount', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.setSayisi || ''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('bundle', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.bundle || ''}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('speed', currentLanguage)}:</span>
                        <span className="text-lg font-semibold">{liveData?.hiz || 0} mpm</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 dark:text-blue-400 font-medium min-w-[80px]">{getTranslation('target', currentLanguage)}:</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">{liveData?.hedefHiz || 0} mpm</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Orta sütun - 3 kart */}
              <div className="lg:col-span-1 space-y-4 lg:space-y-6">
                {visibleCards
                  .filter(key => cardComponentMap[key])
                  .slice(0, 3)
                  .map(key => (
                    <div key={key} className="h-[140px]">
                      {cardComponentMap[key]()}
                    </div>
                  ))}
              </div>
              
              {/* Sağ sütun - 3 kart */}
              <div className="lg:col-span-1 space-y-4 lg:space-y-6">
                {visibleCards
                  .filter(key => cardComponentMap[key])
                  .slice(3, 6)
                  .map(key => (
                    <div key={key} className="h-[140px]">
                      {cardComponentMap[key]()}
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Dinamik kart grid'i - JOB altındaki tüm kartlar için - Added more spacing */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 px-8">
              {visibleCards
                .filter(key => cardComponentMap[key])
                .slice(6)
                .map(key => (
                  <div key={key} className="h-[140px]">
                    {cardComponentMap[key]()}
                  </div>
                ))}
            </div>
            
            {/* Grafik alanı - Added more spacing */}
            <div className="mt-8 px-8">
              {/* Zaman aralığı seçim butonları - Grafiklerin üstünde */}
              <div className="flex gap-2 mb-6 flex-wrap justify-center">
                <span className="text-sm font-medium mr-2" style={{ color: darkMode ? undefined : colorSettings.text }}>
                  {getTranslation('graphTimeRange', currentLanguage)}:
                </span>
                {["12h", "24h", "1w", "1m", "1y"].map(opt => (
                  <button 
                    key={opt} 
                    className={`px-3 py-1 border rounded ${range === opt ? 'text-white' : ''}`} 
                    style={{ 
                      backgroundColor: range === opt ? (darkMode ? undefined : colorSettings.accent) : 'transparent',
                      color: range === opt ? 'white' : (darkMode ? undefined : colorSettings.text),
                      borderColor: darkMode ? undefined : colorSettings.text
                    }}
                    onClick={() => setRange(opt)}
                  >
                    {opt === '12h' ? getTranslation('hours12', currentLanguage) : 
                     opt === '24h' ? getTranslation('hours24', currentLanguage) : 
                     opt === '1w' ? getTranslation('week1', currentLanguage) : 
                     opt === '1m' ? getTranslation('month1', currentLanguage) : 
                     opt === '1y' ? getTranslation('year1', currentLanguage) : opt}
                  </button>
                ))}
              </div>

                          {/* Grafikler - Added more spacing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {Object.entries(graphComponentMap).map(([key, Component]) => {
                if (visibleCards.includes(key)) {
                  return <div key={key}>{Component()}</div>;
                }
                return null;
              })}
            </div>
            </div>

          </>
        )}

        {/* Admin sekmesi */}
        {currentTab === 'database' && <DatabaseAdmin />}

        {/* Admin Panel sekmesi */}
        {currentTab === 'admin' && <AdminPanel />}

        {/* Settings sekmesi */}
        {currentTab === 'settings' && <SettingsPage currentLanguage={currentLanguage} />}

        {/* Kart ayarları modalı */}
        {showCardModal && userId && selectedMachine?.id !== undefined && (
          <CardSettingsModal
            userId={userId}
            machineId={selectedMachine.id}
            onClose={() => setShowCardModal(false)}
            onSave={(newCards) => {
              setVisibleCards(newCards);
              setShowCardModal(false);
            }}
            currentLanguage={currentLanguage}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;