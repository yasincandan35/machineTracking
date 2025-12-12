import React, { useState, useEffect, memo } from 'react';
import { Gauge, Zap, Trash2, Droplet, Activity } from 'lucide-react';
import { useMachineScreen } from '../context';

const LiveInfoCard = memo(() => {
  const { machineApi } = useMachineScreen();
  const [liveData, setLiveData] = useState({
    machineSpeed: 0,
    dieSpeed: 0,
    wastageAfterDie: 0,
    wastageBeforeDie: 0,
    wastageRatio: 0,
    ethylAcetateConsumption: 0,
    ethylAlcoholConsumption: 0
  });

  // Canlı verileri çek
  const fetchLiveData = async () => {
    try {
      const { data } = await machineApi.get('/plcdata/data');
      if (!data) return;

      setLiveData({
        machineSpeed: data.machineSpeed || 0,
        dieSpeed: data.dieSpeed || 0,
        wastageAfterDie: data.wastageAfterDie || 0,
        wastageBeforeDie: data.wastageBeforeDie || 0,
        wastageRatio: data.wastageRatio || 0,
        ethylAcetateConsumption: data.ethylAcetateConsumption || 0,
        ethylAlcoholConsumption: data.ethylAlcoholConsumption || 0,
      });
    } catch (error) {
      console.error('Canlı veri okuma hatası:', error);
    }
  };

  // Component mount ve her 2 saniyede bir güncelle
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 2000);
    return () => clearInterval(interval);
  }, [machineApi]);

  // Fire oranına göre renk
  const getWastageColor = (ratio) => {
    if (ratio < 2) return '#10b981'; // yeşil
    if (ratio < 7) return '#f59e0b'; // sarı
    return '#ef4444'; // kırmızı
  };

  return (
    <div className="live-info-card">
      <div className="card-header">
        <Activity size={18} />
        <h2>Canlı Bilgiler</h2>
      </div>
      
      <div className="live-info-grid">
        {/* Makina Hızı */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <Gauge size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Makina Hızı</span>
            <span className="live-info-value">{liveData.machineSpeed.toFixed(1)} <span className="live-info-unit">mpm</span></span>
          </div>
        </div>

        {/* Kalıp Hızı */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <Zap size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Kalıp Hızı</span>
            <span className="live-info-value">{liveData.dieSpeed.toFixed(1)} <span className="live-info-unit">v/dk</span></span>
          </div>
        </div>

        {/* Fire (After Die) */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <Trash2 size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Fire</span>
            <span className="live-info-value">{liveData.wastageAfterDie.toFixed(0)} <span className="live-info-unit">adet</span></span>
          </div>
        </div>

        {/* Fire Oranı */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: `linear-gradient(135deg, ${getWastageColor(liveData.wastageRatio)} 0%, ${getWastageColor(liveData.wastageRatio)}dd 100%)` }}>
            <Trash2 size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Fire Oranı</span>
            <span className="live-info-value" style={{ color: getWastageColor(liveData.wastageRatio) }}>
              {liveData.wastageRatio.toFixed(2)} <span className="live-info-unit">%</span>
            </span>
          </div>
        </div>

        {/* Etil Asetat */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}>
            <Droplet size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Etil Asetat</span>
            <span className="live-info-value">{liveData.ethylAcetateConsumption.toFixed(2)} <span className="live-info-unit">L</span></span>
          </div>
        </div>

        {/* Etil Alkol */}
        <div className="live-info-item">
          <div className="live-info-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
            <Droplet size={14} />
          </div>
          <div className="live-info-content">
            <span className="live-info-label">Etil Alkol</span>
            <span className="live-info-value">{liveData.ethylAlcoholConsumption.toFixed(2)} <span className="live-info-unit">L</span></span>
          </div>
        </div>
      </div>
    </div>
  );
});

LiveInfoCard.displayName = 'LiveInfoCard';

export default LiveInfoCard;

