import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Clock, 
  Target, 
  AlertTriangle, 
  Settings, 
  CheckCircle,
  X,
  QrCode,
  Database,
  TrendingUp,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Square
} from 'lucide-react';
import './App.css';
import StopReasonCategories from './components/StopReasonCategories';
const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.1.44:8080';

const App = () => {
  // Ana durumlar
  const [machineStatus, setMachineStatus] = useState('running'); // 'running' | 'stopped'
  const [plcConnected, setPlcConnected] = useState(false);
  const [showOrderInput, setShowOrderInput] = useState(false);
  const [showStopReason, setShowStopReason] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showWorkEndConfirmation, setShowWorkEndConfirmation] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // İş emri bilgileri
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const orderInputRef = useRef(null);
  
  // PLC'den gelen üretim verileri
  const [productionData, setProductionData] = useState({
    actualProduction: 0,
    remainingWork: 0,
    estimatedTime: 0,
    totalStops: 0,
    setupStops: 0,
    faultStops: 0,
    qualityStops: 0,
    targetProduction: 0,
    patternValue: 0,
    stoppageType: 0
  });



  // PLC durumunu oku
  const fetchPlcStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/plc-status`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPlcConnected(data.connected);
          setMachineStatus(data.machine_stopped ? 'stopped' : 'running');
        }
      }
    } catch (error) {
      setPlcConnected(false);
    }
  };

  // Üretim verilerini oku (PLC'den)
  const fetchProductionData = async () => {
    try {
      const response = await fetch(`${API_URL}/production-data`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setProductionData({
            actualProduction: data.data.actualProduction || 0,
            remainingWork: data.data.remainingWork || 0,
            estimatedTime: data.data.estimatedTime || 0,
            totalStops: data.data.totalStops || 0,
            setupStops: data.data.setupStops || 0,
            faultStops: data.data.faultStops || 0,
            qualityStops: data.data.qualityStops || 0,
            targetProduction: data.data.targetProduction || 0,
            patternValue: data.data.patternValue || 0,
            stoppageType: data.data.stoppageType || 0
          });
        }
      }
    } catch (error) {
      console.error('Üretim verileri okuma hatası:', error);
    }
  };

  // İş emri verisi çek
  const fetchOrderData = async () => {
    if (!orderNumber.trim()) {
      alert('Lütfen iş emri numarası giriniz!');
      return;
    }

    setIsLoadingOrder(true);
    try {
      const response = await fetch(`${API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNumber.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setCurrentOrder(data.data);
          // LocalStorage'a kaydet
          localStorage.setItem('currentOrder', JSON.stringify(data.data));
          localStorage.setItem('orderTimestamp', Date.now().toString());
          setShowOrderInput(false);
        } else {
          alert(data.message || 'İş emri bulunamadı!');
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      alert(`Bağlantı hatası: ${error.message}`);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  // Duruş sebebini PLC'ye gönder
  const sendStoppageTypeToPlc = async (stoppageType) => {
    try {
      const response = await fetch(`${API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stoppageType: stoppageType })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Duruş sebebi PLC\'ye gönderildi:', stoppageType);
        } else {
          console.error('Duruş sebebi gönderme başarısız:', data.error || 'Bilinmeyen hata');
        }
      } else {
        const errorData = await response.json();
        console.error('Duruş sebebi gönderme hatası:', errorData.error || `HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Duruş sebebi gönderme hatası:', error);
    }
  };

  // Duruş sebebi seç
  const handleStopReason = (reason) => {
    setSelectedReason(reason);
    setShowConfirmation(true);
  };

  // Onay işlemi
  const handleConfirmReason = () => {
    console.log('Duruş sebebi onaylandı:', selectedReason);
    
    // Duruş sebebi kodunu belirle
    let stoppageType = 0;
    if (selectedReason.includes('Setup') || selectedReason.includes('Ayarlama') || selectedReason.includes('Malzeme') || selectedReason.includes('Kalıp') || selectedReason.includes('Temizlik') || selectedReason.includes('Bakım') || selectedReason.includes('Kontrol')) {
      stoppageType = 1; // Setup
    } else if (selectedReason.includes('Arıza') || selectedReason.includes('Elektrik') || selectedReason.includes('Mekanik') || selectedReason.includes('Hidrolik') || selectedReason.includes('Pnömatik') || selectedReason.includes('Sensör') || selectedReason.includes('Kontrol')) {
      stoppageType = 2; // Fault
    } else if (selectedReason.includes('Kalite')) {
      stoppageType = 3; // Quality
    } else {
      stoppageType = 4; // Other
    }
    
    // PLC'ye duruş sebebi gönder
    sendStoppageTypeToPlc(stoppageType);
    
    setShowConfirmation(false);
    setShowStopReason(false);
    setSelectedCategory(null);
    setSelectedReason('');
  };

  // Onay iptal
  const handleCancelReason = () => {
    setShowConfirmation(false);
    setSelectedReason('');
  };

  // İş sonu
  const handleWorkEnd = () => {
    setShowWorkEndConfirmation(true);
  };

  // İş sonu onayı
  const handleConfirmWorkEnd = () => {
    if (currentOrder) {
      // Veritabanına son verileri yaz
      console.log('İş sonu - Son veriler kaydedildi:', productionData);
      // PLC'ye reset sinyali gönder
      console.log('PLC reset sinyali gönderildi');
      setCurrentOrder(null);
      // LocalStorage'ı temizle
      localStorage.removeItem('currentOrder');
      localStorage.removeItem('orderTimestamp');
      setProductionData({
        actualProduction: 0,
        remainingWork: 0,
        estimatedTime: 0,
        totalStops: 0,
        setupStops: 0,
        faultStops: 0,
        qualityStops: 0,
        targetProduction: 0,
        patternValue: 0,
        stoppageType: 0
      });
      setShowWorkEndConfirmation(false);
    }
  };

  // İş sonu iptal
  const handleCancelWorkEnd = () => {
    setShowWorkEndConfirmation(false);
  };

  // Süreyi formatla: dakika → saat:dakika
  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return "0dk";
    
    if (minutes < 60) {
      return `${minutes}dk`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}s ${mins}dk`;
    }
  };

  // Periyodik veri okuma
  useEffect(() => {
    // LocalStorage'dan iş emri bilgilerini oku
    const savedOrder = localStorage.getItem('currentOrder');
    const orderTimestamp = localStorage.getItem('orderTimestamp');
    
    if (savedOrder && orderTimestamp) {
      const orderData = JSON.parse(savedOrder);
      const timestamp = parseInt(orderTimestamp);
      const now = Date.now();
      
      // 24 saat içinde kaydedilmişse kullan
      if (now - timestamp < 24 * 60 * 60 * 1000) {
        setCurrentOrder(orderData);
        console.log('LocalStorage\'dan iş emri yüklendi:', orderData);
      } else {
        // 24 saatten eskiyse temizle
        localStorage.removeItem('currentOrder');
        localStorage.removeItem('orderTimestamp');
      }
    }
    
    fetchPlcStatus();
    fetchProductionData();
    
    const interval = setInterval(() => {
      fetchPlcStatus();
      fetchProductionData();
    }, 1000); // Her saniye yenile

    return () => clearInterval(interval);
  }, []);

  // Saat güncelleme
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // İş emri giriş modal'ı açıldığında input'a focus yap
  useEffect(() => {
    if (showOrderInput && orderInputRef.current) {
      // Kısa bir delay ile focus yap (modal animasyonu için)
      setTimeout(() => {
        orderInputRef.current?.focus();
      }, 100);
    }
  }, [showOrderInput]);

  // Makine çalışıyor ekranı
  if (machineStatus === 'running') {
    return (
      <div className="app-container running">

        {/* Üst Bilgi Çubuğu */}
        <div className="top-bar">
          <div className="status-indicator running">
                      <div className="status-icon">
            <Settings size={20} />
          </div>
          <div className="status-text">
            <span className="status-label">ÇALIŞIYOR</span>
            <span className="status-subtitle">Üretim Aktif</span>
          </div>
            <div className="status-pulse"></div>
          </div>
          
          {/* Makine Resimleri */}
          <div className="machine-images">
            <img src="/l3png/l3komple.png" alt="Makine Komple" className="machine-img-comple" />
          </div>
                  
                  <div className="top-bar-right">
          <div className="connection-status">
            <div className={`connection-dot ${plcConnected ? 'connected' : 'disconnected'}`} />
            <span>PLC {plcConnected ? 'Bağlı' : 'Bağlantı Yok'}</span>
          </div>
          <div className="datetime-display">
            <div className="date">{currentTime.toLocaleDateString('tr-TR')}</div>
            <div className="time">{currentTime.toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>
      </div>

        {/* Ana İçerik */}
        <div className="main-content">
          {/* Sol Panel - İş Emri Bilgileri */}
          <div className="left-panel">
            {currentOrder ? (
              <div className="order-card">
                <div className="card-header">
                  <Target size={24} />
                  <h2>Aktif İş Emri</h2>
                </div>
                <div className="order-details">
                  <div className="detail-row">
                    <span className="label">İş Emri No:</span>
                    <span className="value">{currentOrder.siparis_no}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Toplam Miktar:</span>
                    <span className="value">{parseInt(currentOrder.toplam_miktar).toLocaleString()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Silindir Çevresi:</span>
                    <span className="value">{parseFloat((currentOrder.silindir_cevresi || 0).toString().replace(',', '.')).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Bundle:</span>
                    <span className="value">{currentOrder.bundle}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Hedef Hız:</span>
                    <span className="value">{currentOrder.hedef_hiz}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Set Sayısı:</span>
                    <span className="value">{currentOrder.set_sayisi}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-order-card">
                <Database size={48} />
                <h3>İş Emri Yok</h3>
                <p>Makine durduğunda iş emri girebilirsiniz</p>
              </div>
            )}
          </div>

          {/* Sağ Panel - Üretim Bilgileri */}
          <div className="right-panel">
            <div className="production-card">
              <div className="card-header">
                <TrendingUp size={24} />
                <h2>Üretim Bilgileri</h2>
              </div>
              
              <div className="production-grid">
                {/* Basım Adet - En Üstte */}
                <div className="metric-item">
                  <div className="metric-icon">
                    <Target size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Basım Adet</span>
                    <span className="metric-value">{productionData.actualProduction.toLocaleString()}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Clock size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Kalan İş</span>
                    <span className="metric-value">{productionData.remainingWork.toLocaleString()}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Clock size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Tahmini Süre</span>
                    <span className="metric-value">{formatTime(productionData.estimatedTime)}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Toplam Duruş</span>
                    <span className="metric-value">{productionData.totalStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Settings size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">İş Hazırlık</span>
                    <span className="metric-value">{productionData.setupStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <AlertCircle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Arıza Duruş</span>
                    <span className="metric-value">{productionData.faultStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Kalite Duruş</span>
                    <span className="metric-value">{productionData.qualityStops}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    );
  }

  // Makine durdu ekranı
  return (
    <div className="app-container stopped">

      {/* Üst Bilgi Çubuğu */}
      <div className="top-bar">
        <div className="status-indicator stopped">
          <div className="status-icon">
            <Settings size={20} />
          </div>
          <div className="status-text">
            <span className="status-label">DURUYOR</span>
            <span className="status-subtitle">Üretim Beklemede</span>
          </div>
          <div className="status-pulse"></div>
        </div>
        
        {/* Makine Resimleri */}
        <div className="machine-images">
          <img src="/l3png/l3komple.png" alt="Makine Komple" className="machine-img-comple" />
        </div>
        
        <div className="top-bar-right">
          <div className="connection-status">
            <div className={`connection-dot ${plcConnected ? 'connected' : 'disconnected'}`} />
            <span>PLC {plcConnected ? 'Bağlı' : 'Bağlantı Yok'}</span>
          </div>
          <div className="datetime-display">
            <div className="date">{currentTime.toLocaleDateString('tr-TR')}</div>
            <div className="time">{currentTime.toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>
      </div>

      {/* Ana İçerik */}
      <div className="main-content">
        {/* Sol Panel - İş Emri Bilgileri */}
        <div className="left-panel">
          {currentOrder ? (
            <div className="order-card">
              <div className="card-header">
                <Target size={24} />
                <h2>Aktif İş Emri</h2>
              </div>
              <div className="order-details">
                <div className="detail-row">
                  <span className="label">İş Emri No:</span>
                  <span className="value">{currentOrder.siparis_no}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Toplam Miktar:</span>
                  <span className="value">{parseInt(currentOrder.toplam_miktar).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Silindir Çevresi:</span>
                  <span className="value">{parseFloat((currentOrder.silindir_cevresi || 0).toString().replace(',', '.')).toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Bundle:</span>
                  <span className="value">{currentOrder.bundle}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Hedef Hız:</span>
                  <span className="value">{currentOrder.hedef_hiz}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Set Sayısı:</span>
                  <span className="value">{currentOrder.set_sayisi}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-order-card">
              <Database size={48} />
              <h3>İş Emri Yok</h3>
              <p>Yeni iş emri girmek için tıklayın</p>
              <button 
                className="primary-button"
                onClick={() => setShowOrderInput(true)}
              >
                İş Emri Gir
              </button>
            </div>
          )}
        </div>

        {/* Sağ Panel - Üretim Bilgileri */}
        <div className="right-panel">
          <div className="production-card">
            <div className="card-header">
              <TrendingUp size={24} />
              <h2>Üretim Bilgileri</h2>
            </div>
            
            <div className="production-grid">
              {/* Basım Adet - En Üstte */}
              <div className="metric-item">
                <div className="metric-icon">
                  <Target size={20} />
                </div>
                <div className="metric-content">
                  <span className="metric-label">Basım Adet</span>
                  <span className="metric-value">{productionData.actualProduction.toLocaleString()}</span>
                </div>
              </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Clock size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Kalan İş</span>
                    <span className="metric-value">{productionData.remainingWork.toLocaleString()}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Clock size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Tahmini Süre</span>
                    <span className="metric-value">{formatTime(productionData.estimatedTime)}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Toplam Duruş</span>
                    <span className="metric-value">{productionData.totalStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <Settings size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">İş Hazırlık</span>
                    <span className="metric-value">{productionData.setupStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <AlertCircle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Arıza Duruş</span>
                    <span className="metric-value">{productionData.faultStops}</span>
                  </div>
                </div>
                <div className="metric-item">
                  <div className="metric-icon">
                    <CheckCircle size={20} />
                  </div>
                  <div className="metric-content">
                    <span className="metric-label">Kalite Duruş</span>
                    <span className="metric-value">{productionData.qualityStops}</span>
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>

      {/* Alt Butonlar */}
      <div className="bottom-buttons">
        <button 
          className="secondary-button"
          onClick={() => setShowOrderInput(true)}
        >
          <QrCode size={20} />
          İş Emri Değiştir
        </button>
        <button 
          className="primary-button"
          onClick={() => setShowStopReason(true)}
        >
          <AlertTriangle size={20} />
          Duruş Sebebi
        </button>
        <button 
          className="danger-button"
          onClick={handleWorkEnd}
        >
          <CheckCircle size={20} />
          İş Sonu
        </button>
      </div>

      {/* Duruş Sebebi Modal'ı */}
      {showStopReason && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
          }}
          onClick={() => {
            setShowStopReason(false);
            setSelectedCategory(null);
          }}
        >
          <div 
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '1400px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal içeriği burada kalacak */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <h2 style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 700 }}>Duruş Sebebi Seçin</h2>
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  e.target.style.transform = 'scale(1)';
                }}
                onClick={() => {
                  setShowStopReason(false);
                  setSelectedCategory(null);
                }}
              >
                <X size={24} />
              </button>
            </div>
            
            <StopReasonCategories 
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              handleStopReason={handleStopReason}
            />
          </div>
        </div>
      )}

      {/* Onay Modal'ı */}
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '24px',
            padding: '3rem',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            textAlign: 'center',
            animation: 'scaleIn 0.3s ease'
          }}>
            {/* Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem auto',
              border: '2px solid rgba(59, 130, 246, 0.3)'
            }}>
              <AlertTriangle size={40} color="#3b82f6" />
            </div>

            {/* Başlık */}
            <h2 style={{ 
              color: '#f8fafc', 
              fontSize: '1.8rem', 
              fontWeight: 700, 
              marginBottom: '1rem',
              lineHeight: '1.3'
            }}>
              Duruş Sebebi Onayı
            </h2>

            {/* Mesaj */}
            <p style={{ 
              color: '#cbd5e1', 
              fontSize: '1.1rem', 
              marginBottom: '2.5rem',
              lineHeight: '1.6'
            }}>
              <strong style={{ color: '#f8fafc' }}>"{selectedReason}"</strong> duruş sebebini seçmek istediğinizden emin misiniz?
            </p>

            {/* Butonlar */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                }}
                onClick={handleCancelReason}
              >
                İptal
              </button>
              
              <button
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
                  e.target.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.8)';
                  e.target.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                }}
                onClick={handleConfirmReason}
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İş Sonu Onay Modal'ı */}
      {showWorkEndConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '24px',
            padding: '3rem',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            textAlign: 'center',
            animation: 'scaleIn 0.3s ease'
          }}>
            {/* Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem auto',
              border: '2px solid rgba(239, 68, 68, 0.3)'
            }}>
              <CheckCircle size={40} color="#ef4444" />
            </div>

            {/* Başlık */}
            <h2 style={{ 
              color: '#f8fafc', 
              fontSize: '1.8rem', 
              fontWeight: 700, 
              marginBottom: '1rem',
              lineHeight: '1.3'
            }}>
              İş Sonu Onayı
            </h2>

            {/* Mesaj */}
            <p style={{ 
              color: '#cbd5e1', 
              fontSize: '1.1rem', 
              marginBottom: '2.5rem',
              lineHeight: '1.6'
            }}>
              Mevcut iş emrini sonlandırmak ve üretimi durdurmak istediğinizden emin misiniz?
            </p>

            {/* Butonlar */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                }}
                onClick={handleCancelWorkEnd}
              >
                İptal
              </button>
              
              <button
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 1)';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onClick={handleConfirmWorkEnd}
              >
                İş Sonu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* İş Emri Giriş Modal'ı */}
      {showOrderInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '24px',
            padding: '3rem',
            maxWidth: '600px',
            width: '90%',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            animation: 'scaleIn 0.3s ease'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <QrCode size={24} color="#3b82f6" />
                </div>
                <h2 style={{ 
                  color: '#f8fafc', 
                  fontSize: '2rem', 
                  fontWeight: 700,
                  margin: 0
                }}>
                  İş Emri Girişi
                </h2>
              </div>
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  e.target.style.transform = 'scale(1)';
                }}
                onClick={() => setShowOrderInput(false)}
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Content */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{
                marginBottom: '1.5rem'
              }}>
                <label style={{
                  display: 'block',
                  color: '#f8fafc',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  marginBottom: '0.75rem'
                }}>
                  İş Emri Numarası
                </label>
                <div style={{
                  display: 'flex',
                  gap: '0.75rem'
                }}>
                  <input
                    ref={orderInputRef}
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Barkod okuyun veya numara girin..."
                    onKeyPress={(e) => e.key === 'Enter' && fetchOrderData()}
                    style={{
                      flex: 1,
                      padding: '1rem 1.25rem',
                      backgroundColor: 'rgba(51, 65, 85, 0.6)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.target.borderColor = 'rgba(59, 130, 246, 0.5)';
                      e.target.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                    }}
                    onBlur={(e) => {
                      e.target.borderColor = 'rgba(148, 163, 184, 0.3)';
                      e.target.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                    }}
                  />
                  <button 
                    style={{
                      padding: '1rem 1.25rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
                    }}
                    onClick={() => {/* Barkod okuyucu aktif */}}
                  >
                    <QrCode size={20} />
                  </button>
                </div>
              </div>
              
              {/* Bilgi */}
              <div style={{
                padding: '1rem',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
                borderLeft: '4px solid #3b82f6'
              }}>
                <p style={{
                  color: '#cbd5e1',
                  fontSize: '0.9rem',
                  margin: 0,
                  lineHeight: '1.5'
                }}>
                  💡 <strong>İpucu:</strong> Barkod okuyucu ile hızlı giriş yapabilir veya manuel olarak numara girebilirsiniz.
                </p>
              </div>
            </div>
            
            {/* Buttons */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button 
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(51, 65, 85, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                  e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                }}
                onClick={() => setShowOrderInput(false)}
              >
                İptal
              </button>
              
              <button 
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.8)';
                }}
                onClick={fetchOrderData}
                disabled={isLoadingOrder}
              >
                {isLoadingOrder ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Yükleniyor...
                  </div>
                ) : (
                  'Sorgula'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );




};

export default App; 