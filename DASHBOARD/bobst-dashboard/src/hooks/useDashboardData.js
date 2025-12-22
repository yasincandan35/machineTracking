import { useState, useEffect } from 'react';
import { api, sensorApi } from '../utils/api';
import { getTranslation } from '../utils/translations';

export const useDashboardData = (userId, currentLanguage, activeTab = 'home') => {
  const [liveData, setLiveData] = useState(null);
  const [range, setRange] = useState('24h');
  const [rangeData, setRangeData] = useState([]);
  const [machineList, setMachineList] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const shouldFetchLive = activeTab === 'home' || activeTab === 'analysis';
  const shouldFetchRange = activeTab === 'analysis'; // Sadece analiz sekmesinde range verisi gerekli

  // Makine listesini yükle fonksiyonu
  const loadMachineList = async () => {
    try {
      const res = await api.get('/machines');
      
      // Backend'den gelen veriyi kontrol et
      if (!res.data || !Array.isArray(res.data)) {
        console.warn('⚠️ Backend\'den geçersiz veri geldi:', res.data);
        setMachineList([{
          id: -1,
          name: 'Main Dashboard',
          tableName: 'all'
        }]);
        return;
      }
      
      // Backend'den gelen verileri map et
      const machines = res.data
        .map(m => {
          // IP_Address kaldırıldı - artık tüm API'ler tek backend'den geliyor
          return {
            id: m.id,
            name: m.machineName,
            tableName: m.tableName
          };
        });
      
      // 🆕 "Main Dashboard" ekle - tüm makinaları gösterir
      // Duplicate ID kontrolü yap - daha agresif filtreleme
      const seenIds = new Set();
      const uniqueMachines = machines.filter(machine => {
        if (seenIds.has(machine.id)) {
          console.warn(`⚠️ Duplicate ID atlandı: ${machine.id} - ${machine.name}`);
          return false;
        }
        seenIds.add(machine.id);
        return true;
      });
      
      const list = [
        {
          id: -1,
          name: 'Main Dashboard',
          tableName: 'all'
        },
        ...uniqueMachines
      ];
      
      // Final kontrol - ID'leri kontrol et
      const finalSeenIds = new Set();
      const finalList = list.filter(machine => {
        if (finalSeenIds.has(machine.id)) {
          console.error(`❌ Final duplicate ID bulundu ve atlandı: ${machine.id} - ${machine.name}`);
          return false;
        }
        finalSeenIds.add(machine.id);
        return true;
      });
      
      setMachineList(finalList);
      
      // Eğer selectedMachine yoksa veya listede yoksa, ilk makineyi seç
      setSelectedMachine(prevSelected => {
        if (!finalList || finalList.length === 0) {
          return prevSelected;
        }
        
        if (!prevSelected) {
          return finalList[0];
        }

        const existing = finalList.find(m => m.id === prevSelected.id);
        return existing ?? finalList[0];
      });
    } catch (err) {
      console.error('❌ Makine listesi alınamadı (DashboardBackend):', err);
      // Hata durumunda en azından Main Dashboard'u göster
      setMachineList([{
        id: -1,
        name: 'Main Dashboard',
        tableName: 'all'
      }]);
    }
  };

  // Makine listesi çek - 🆕 DashboardBackend'den
  useEffect(() => {
    loadMachineList();
    
    // Her 30 saniyede bir makine listesini yenile (yeni makine eklenmiş olabilir)
    const interval = setInterval(() => {
      loadMachineList();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Son seçilen makineyi getir - 🆕 DashboardBackend'den (Users.LastSelectedMachineId)
  useEffect(() => {
    if (!userId || machineList.length === 0) {
      return;
    }
    
    api.get(`/preferences/last-machine?userId=${userId}`)
      .then(res => {
        const lastId = res.data?.machineId;
        const match = machineList.find(m => m.id === lastId);
        setSelectedMachine(prevSelected => {
          // Eğer seçili makine zaten aynıysa, state'i güncelleme (blink'i önlemek için)
          if (match && prevSelected && prevSelected.id === match.id) {
            return prevSelected; // Aynı makine, state değişikliği yapma
          }
          if (match) {
            console.log('✅ Son seçilen makina yüklendi:', match.name);
            return match;
          }
          if (prevSelected) {
            return prevSelected;
          }
          return machineList[0];
        });
      })
      .catch(err => {
        console.warn('❌ Son makine alınamadı:', err);
        setSelectedMachine(prevSelected => prevSelected ?? machineList[0]);
      });
  }, [userId, machineList]);

  // PLC Data Collector'dan canlı veri çek - DİNAMİK IP
  useEffect(() => {
    if (!selectedMachine) {
      console.log('⚠️ selectedMachine yok, veri çekilmiyor');
      return;
    }

    if (!shouldFetchLive) {
      console.log('⏸️ Aktif sekme canlı veri gerektirmiyor, PLC istekleri durduruldu');
      setLiveData(null);
      return;
    }
    
    // Main Dashboard ise veri çekme (her makina kendi kartında çekecek)
    if (selectedMachine.id === -1) {
      console.log('🌐 Main Dashboard seçildi, PLC verisi çekilmiyor (her makine kendi kartında çekecek)');
      // Main Dashboard'da liveData'yı temizle
      setLiveData(null);
      return;
    }
    
    // Duruş sebebi bilgisini çekme fonksiyonu
    const fetchStoppageReason = async (machineTableName) => {
      try {
        const reasonResponse = await api.get('/plcdata/current-stoppage-reason', {
          params: { machine: machineTableName }
        });
        
        if (reasonResponse.data && reasonResponse.data.hasReason && reasonResponse.data.categoryId > 0 && reasonResponse.data.reasonId > 0) {
          // Kategori ve sebep isimlerini al
          try {
            const { data: categories } = await api.get('/stoppagereasons/categories', {
              params: { machine: machineTableName }
            });
            const category = categories.find(c => c.id === reasonResponse.data.categoryId);
            
            if (category) {
              const { data: reasons } = await api.get(`/stoppagereasons/reasons/${category.id}`, {
                params: { machine: machineTableName }
              });
              const reason = reasons.find(r => r.id === reasonResponse.data.reasonId);
              
              if (reason) {
                setLiveData(prevData => ({
                  ...prevData,
                  stopReason: reason.reasonName
                }));
              } else {
                setLiveData(prevData => ({
                  ...prevData,
                  stopReason: null
                }));
              }
            } else {
              setLiveData(prevData => ({
                ...prevData,
                stopReason: null
              }));
            }
          } catch (error) {
            console.warn('⚠️ Kategori/sebep isimleri alınamadı:', error);
            setLiveData(prevData => ({
              ...prevData,
              stopReason: null
            }));
          }
        } else {
          // Duruş sebebi henüz girilmemiş
          setLiveData(prevData => ({
            ...prevData,
            stopReason: null
          }));
        }
      } catch (error) {
        console.warn('⚠️ Duruş sebebi alınamadı:', error);
        setLiveData(prevData => ({
          ...prevData,
          stopReason: null
        }));
      }
    };
    
    const fetchPLCData = () => {
      // Artık tüm API'ler tek backend'den geliyor (DashboardBackend - port 5199)
      const isProduction = window.location.hostname === 'track.bychome.xyz';
      const baseUrl = isProduction 
        ? 'https://yyc.bychome.xyz/api/plcdata/data'
        : 'http://192.168.1.44:5199/api/plcdata/data';
      
      // Makine parametresi ekle (tableName)
      const apiUrl = selectedMachine?.tableName 
        ? `${baseUrl}?machine=${encodeURIComponent(selectedMachine.tableName)}`
        : baseUrl;
      
      fetch(apiUrl)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Expected JSON but got ${contentType}`);
          }
          return res.json();
        })
        .then(data => {
          const newLiveData = {
            machineSpeed: data.machineSpeed || 0,
            dieSpeed: data.dieSpeed || 0,
            machineDieCounter: data.machineDieCounter || 0,
            ethylAcetateConsumption: data.ethylAcetateConsumption || 0,
            ethylAlcoholConsumption: data.ethylAlcoholConsumption || 0,
            paperConsumption: data.paperConsumption || 0,
            lastStopEpoch: data.lastStopEpoch || 0,
            stoppageDuration: data.stoppageDuration || 0,
            lastStopDT: data.lastStopEpoch ? new Date(data.lastStopEpoch * 1000).toLocaleString('tr-TR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }) : null,
            // API'dan gelen ms cinsinden; sn'ye çevir
            stopDurationSec: data.stoppageDuration ? (data.stoppageDuration / 1000) : 0,
            sicaklik: 25 + Math.random() * 5,
            nem: 45 + Math.random() * 10,
            actualProduction: data.actualProduction || 0,
            remainingWork: data.remainingWork || 0,
            estimatedTime: data.estimatedTime || 0,
            overProduction: data.overProduction || 0,
            completionPercentage: data.completionPercentage || 0,
            totalStops: data.totalStops || 0,
            setupStops: data.setupStops || 0,
            faultStops: data.faultStops || 0,
            qualityStops: data.qualityStops || 0,
            wastageBeforeDie: data.wastageBeforeDie || 0,
            wastageAfterDie: data.wastageAfterDie || 0,
            wastageRatio: data.wastageRatio || 0,
            totalStoppageDuration: data.totalStoppageDuration || 0,
            totalStoppageDurationSec: data.totalStoppageDuration ? (data.totalStoppageDuration / 1000) : 0,
            // OEE verileri (PLC'den hesaplanmış)
            overallOEE: data.overallOEE || 0,
            availability: data.availability || 0,
            performance: data.performance || 0,
            quality: data.quality || 0,
            uretimHizAdetDakika: data.uretimHizAdetDakika || 0,
            hedefUretimHizAdetDakika: data.hedefUretimHizAdetDakika || 0,
            plannedTime: data.plannedTime || 0,
            // Enerji verileri (EMD4 analizör) - optimize edilmiş
            voltageL1: data.voltageL1 !== undefined ? data.voltageL1 : -1,
            voltageL2: data.voltageL2 !== undefined ? data.voltageL2 : -1,
            voltageL3: data.voltageL3 !== undefined ? data.voltageL3 : -1,
            currentL1: data.currentL1 !== undefined ? data.currentL1 : -1,
            currentL2: data.currentL2 !== undefined ? data.currentL2 : -1,
            currentL3: data.currentL3 !== undefined ? data.currentL3 : -1,
            activePowerW: data.activePowerW !== undefined ? data.activePowerW : -1,
            totalEnergyKwh: data.totalEnergyKwh !== undefined ? data.totalEnergyKwh : -1,
            energyStatus: data.energyStatus || 'Bekleniyor',
            // Robot Palletizing verileri
            qualifiedBundle: data.qualifiedBundle || 0,
            defectiveBundle: data.defectiveBundle || 0,
            goodPallets: data.goodPallets || 0,
            defectivePallets: data.defectivePallets || 0
          };
          
          setLiveData(prevData => ({
            ...prevData, // Eski veriler (job verileri)
            ...newLiveData // Yeni PLC verileri (üzerine yaz)
          }));
          
          // Duruş sebebi bilgisini çek (sadece duruş varsa)
          if (data.stoppageDuration > 0) {
            fetchStoppageReason(selectedMachine.tableName);
          } else {
            // Duruş yoksa duruş sebebini temizle
            setLiveData(prevData => ({
              ...prevData,
              stopReason: null
            }));
          }
        })
        .catch(err => {
          console.error("❌ PLCDataCollector'dan veri alınamadı:", err);
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
            overProduction: 0,
            completionPercentage: 0,
            totalStops: 0,
            setupStops: 0,
            faultStops: 0,
            qualityStops: 0,
            wastageBeforeDie: 0,
            wastageAfterDie: 0,
            wastageRatio: 0
          }));
        });
    };

    const intv = setInterval(fetchPLCData, 200);
    fetchPLCData(); // İlk çağrı
    
    return () => clearInterval(intv);
  }, [selectedMachine, shouldFetchLive]); // 🆕 selectedMachine değişince yeniden bağlan

  // Job data çek - DİNAMİK IP
  useEffect(() => {
    if (!selectedMachine) {
      console.log('⚠️ selectedMachine yok, job verisi çekilmiyor');
      return;
    }

    if (!shouldFetchLive) {
      console.log('⏸️ Aktif sekme job verisi gerektirmiyor');
      return;
    }
    
    const fetchJobData = () => {
      if (!selectedMachine || selectedMachine.id === -1) {
        console.log('🌐 Main Dashboard - Job verileri atlanıyor');
        return;
      }
      
      if (!selectedMachine?.tableName) {
        console.log('⚠️ Makine tableName bulunamadı');
        return;
      }
      
      console.log('🔄 Job verisi veritabanından çekiliyor:', selectedMachine.name, selectedMachine.tableName);
      
      // Veritabanından aktif iş emri verilerini oku
      api.get('/plcdata/active-job', {
        params: { machine: selectedMachine.tableName }
      })
      .then(res => {
        const jobData = res.data;
        if (jobData.success && jobData.data) {
          setLiveData(prevData => ({
            ...(prevData || {}),
            orderNumber: jobData.data.siparis_no || '',
            totalQuantity: jobData.data.toplam_miktar || 0,
            remainingQuantity: jobData.data.kalan_miktar || 0,
            uretimTipi: jobData.data.uretim_tipi || '',
            stokAdi: jobData.data.stok_adi || '',
            hiz: jobData.data.hiz || 0,
            hedefHiz: jobData.data.hedef_hiz || 0,
            setSayisi: jobData.data.set_sayisi || 0,
            bundle: jobData.data.bundle || '',
            silindirCevresi: jobData.data.silindir_cevresi || 0,
            brutKartonMt: jobData.data.brut_karton_mt ?? 0,
            paletAdet: jobData.data.palet_adet ?? 0,
            setup: jobData.data.setup || 0,
          }));
        } else {
          console.log('⚠️ Aktif iş emri bulunamadı');
        }
      })
      .catch(err => {
        console.error('❌ Job verisi yüklenemedi:', err);
        console.error('❌ Hata detayı:', err.response?.status, err.response?.data, err.config?.url);
      });
    };

    fetchJobData();
    const intv = setInterval(fetchJobData, 5000);
    return () => clearInterval(intv);
  }, [currentLanguage, selectedMachine, shouldFetchLive]); // 🆕 selectedMachine değişince yeniden bağlan

  // Range verisi çek (sadece analiz sekmesi için)
  useEffect(() => {
    if (!shouldFetchRange) {
      setRangeData([]);
      return;
    }

    // Main Dashboard (id: -1) için range verisi çekme
    if (!selectedMachine?.tableName || selectedMachine.id === -1) {
      setRangeData([]);
      return;
    }
    
    sensorApi.get(`/api/sensors/period?range=${range}&machineId=${selectedMachine.tableName}`)
      .then(res => {
        // API response formatını kontrol et
        const responseData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setRangeData(responseData);
      })
      .catch(err => {
        // AdminPanel gibi sayfalarda bu hata normal olabilir, sessizce yakala
        if (activeTab !== 'admin' && activeTab !== 'database' && activeTab !== 'roles') {
          console.error('Range data fetch error', err);
        }
        setRangeData([]);
      });
  }, [range, selectedMachine, currentLanguage, shouldFetchRange, activeTab]);

  return {
    liveData,
    range,
    setRange,
    rangeData,
    machineList,
    selectedMachine,
    setSelectedMachine,
    refreshMachineList: loadMachineList // Makine listesini manuel olarak yenilemek için
  };
};
