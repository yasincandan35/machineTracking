import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import DeviceCard from './DeviceCard.jsx';
import { API_BASE_URL } from './config';

const Dashboard = ({ currentLanguage = 'tr' }) => {
  const [devices, setDevices] = useState([]);
  const [latestData, setLatestData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pollIntervalMs, setPollIntervalMs] = useState(1000);
  const devicesRef = useRef([]);
  const liveIntervalRef = useRef(null);

  useEffect(() => {
    devicesRef.current = devices;
    setPollIntervalMs(1000);
  }, [devices]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await fetchDevices();
      await fetchLatestData();
    };
    init();
    
    const cleanupInterval = setInterval(() => {
      const TIMEOUT_SECONDS = 30; // 30 saniye zaman aşımı
      const now = new Date();
      
      setLatestData(prevData => {
        return prevData.filter(data => {
          if (!data || !data.timestamp) return false;
          
          try {
            const lastUpdate = new Date(data.timestamp);
            if (isNaN(lastUpdate.getTime())) return false;
            
            const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
            return timeDiff <= TIMEOUT_SECONDS && timeDiff >= 0;
          } catch (e) {
            return false;
          }
        });
      });
    }, 1000);
    
    return () => {
      isMounted = false;
      stopLiveInterval();
      clearInterval(cleanupInterval);
    };
  }, []);

  useEffect(() => {
    stopLiveInterval();
    liveIntervalRef.current = setInterval(() => {
      fetchLatestData();
    }, pollIntervalMs);

    return () => {
      stopLiveInterval();
    };
  }, [pollIntervalMs]);

  const stopLiveInterval = () => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
  };

  const fetchDevices = async () => {
    try {
      // Cihaz listesini çek
      const devicesResponse = await axios.get(`${API_BASE_URL}/devices`);
      setDevices(devicesResponse.data);
      
      // İlk yüklemede son verileri bir kez çek (WS gelene kadar boş kalmasın)
      const allLatestData = await axios.get(`${API_BASE_URL}/sensordata/latest`);
      
      const TIMEOUT_SECONDS = 30; // 30 saniye zaman aşımı
      const now = new Date();
      
      // En son gelen verileri latestData'ya set et (deviceName ile eşleştir)
      // Sadece 30 saniye içindeki geçerli verileri ekle
      const latestDataArray = allLatestData.data
        .map(latest => {
          const matchedDevice = devicesResponse.data.find(d => d.name === latest.deviceName);
          return {
            id: matchedDevice?.id || 0,
            deviceName: latest.deviceName,
            ipAddress: matchedDevice?.ipAddress || '',
            location: matchedDevice?.location || '',
            temperature: latest.temperature || 0,
            humidity: latest.humidity || 0,
            timestamp: latest.timestamp || new Date().toISOString()
          };
        })
        .filter(data => {
          // Timestamp kontrolü: 30 saniye içindeki verileri filtrele
          if (!data.timestamp) return false;
          try {
            const lastUpdate = new Date(data.timestamp);
            if (isNaN(lastUpdate.getTime())) return false;
            const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
            return timeDiff <= TIMEOUT_SECONDS && timeDiff >= 0;
          } catch (e) {
            return false;
          }
        });
      
      setLatestData(latestDataArray);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError('Veri çekilemedi. Backend bağlantısını kontrol edin.');
      setLoading(false);
    }
  };

  const fetchLatestData = async () => {
    try {
      const payload = (await axios.get(`${API_BASE_URL}/live/sensordata`)).data;
      const TIMEOUT_SECONDS = 30;
      const now = new Date();
      const latest = payload
        .map(latest => {
          // Device.DeviceId (int) ile eşleştir
          const matchedDevice = devicesRef.current.find(d =>
            d.deviceId === latest.deviceId || d.deviceId === latest.deviceUniqueId || d.ipAddress === latest.ipAddress
          );
          
          return {
            id: matchedDevice?.id || 0,
            deviceId: matchedDevice?.deviceId || latest.deviceId || 0,
            deviceName: latest.deviceName,
            ipAddress: matchedDevice?.ipAddress || latest.ipAddress || '',
            location: matchedDevice?.location || latest.location || '',
            temperature: latest.temperature || 0,
            humidity: latest.humidity || 0,
            timestamp: latest.timestamp || new Date().toISOString()
          };
        })
        .filter(data => {
          if (!data.timestamp) return false;
          try {
            const lastUpdate = new Date(data.timestamp);
            if (isNaN(lastUpdate.getTime())) return false;
            const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000;
            return timeDiff <= TIMEOUT_SECONDS && timeDiff >= 0;
          } catch {
            return false;
    }
        });

      setLatestData(latest);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Son veriler alınamadı:', err);
      setError('Canlı veri alınamadı. Backend bağlantısını kontrol edin.');
      setLatestData([]);
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Veriler yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>❌ Hata</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={async () => {
          await fetchDevices();
          await fetchLatestData();
        }}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="devices-grid">
        {devices.map(device => {
          // Device.DeviceId (int) ile eşleştir
          const deviceData = latestData.find(data => 
            data.deviceId === device.deviceId || 
            data.id === device.id || 
            data.ipAddress === device.ipAddress
          );
          // latestData undefined ise (henüz yüklenmemiş), deviceData'yı undefined olarak geç
          // Bu sayede DeviceCard, veri yokken küçük boyutta render edilir
          return (
            <DeviceCard
              currentLanguage={currentLanguage}
              key={device.id}
              device={device}
              latestData={deviceData}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;