import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from './config';

const Settings = ({ currentLanguage = 'tr' }) => {
  const { theme } = useTheme();
  const translate = (key) => getTranslation(key, currentLanguage);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    deviceId: '',
    ipAddress: '',
    temperatureOffset: 0,
    humidityOffset: 0,
    referenceTemperature: '',
    referenceHumidity: '',
    currentTemperature: '',
    currentHumidity: '',
    directTemperatureOffset: '',
    directHumidityOffset: '',
    isActive: true
  });

  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationDevice, setCalibrationDevice] = useState(null);
  const [calibrationMode, setCalibrationMode] = useState('reference'); // 'reference' veya 'direct'

  // Renk ayarları state (3 renk: düşük, normal, yüksek)
  const [colorSettings, setColorSettings] = useState({
    temperature: {
      lowColor: '#4A90E2',    // Mavi
      normalColor: '#7ED321',  // Yeşil
      highColor: '#D0021B',    // Kırmızı
      lowLimit: 20,            // Düşük limit
      highLimit: 25            // Yüksek limit
    },
    humidity: {
      lowColor: '#4A90E2',     // Mavi
      normalColor: '#7ED321',  // Yeşil
      highColor: '#D0021B',    // Kırmızı
      lowLimit: 50,            // Düşük limit
      highLimit: 60            // Yüksek limit
    }
  });

  // Production URL veya local URL
  // LocalStorage'dan renk ayarlarını yükle
  useEffect(() => {
    const savedColors = localStorage.getItem('tempHumidityColorSettings');
    if (savedColors) {
      try {
        setColorSettings(JSON.parse(savedColors));
      } catch (e) {
        console.error('Renk ayarları yüklenemedi:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, []);

  // Arduino verilerini otomatik çek (IP adresi varsa ve cihaz aktifse)
  useEffect(() => {
    if (formData.ipAddress && showAddForm && formData.isActive) {
      const interval = setInterval(() => {
        handleFetchArduinoData();
      }, 5000); // Her 5 saniyede bir

      return () => clearInterval(interval);
    }
  }, [formData.ipAddress, showAddForm, formData.isActive]);

  // Mesajları otomatik kaybolma
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000); // 5 saniye sonra kaybol
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 8000); // 8 saniye sonra kaybol (hata mesajları daha uzun)
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/devices`);
      setDevices(response.data);
      setError(null);
    } catch (err) {
      console.error('Cihazlar yüklenemedi:', err);
      setError('Cihazlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingDevice) {
        await axios.put(`${API_BASE_URL}/devices/${editingDevice.id}`, formData);
        setSuccess('Cihaz başarıyla güncellendi!');
      } else {
        await axios.post(`${API_BASE_URL}/devices`, formData);
        setSuccess('Cihaz başarıyla eklendi!');
      }
      
      setFormData({ name: '', location: '', deviceId: '', ipAddress: '' });
      setEditingDevice(null);
      setShowAddForm(false);
      fetchDevices();
    } catch (err) {
      console.error('Cihaz kaydedilemedi:', err);
      setError('Cihaz kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (device) => {
    setEditingDevice(device);
    
    // Arduino'dan offset değerlerini oku
    let temperatureOffset = 0;
    let humidityOffset = 0;
    
    if (device.ipAddress) {
      try {
        const response = await axios.get(`${API_BASE_URL}/arduino/calibrate/${device.ipAddress}`);
        if (response.data.success) {
          temperatureOffset = response.data.temperatureOffset || 0;
          humidityOffset = response.data.humidityOffset || 0;
        }
      } catch (err) {
        console.warn('Arduino\'dan offset değerleri okunamadı:', err);
        // Hata durumunda varsayılan değerleri kullan
      }
    }
    
    setFormData({
      name: device.name,
      location: device.location,
      deviceId: device.deviceId,
      ipAddress: device.ipAddress,
      temperatureOffset: temperatureOffset,
      humidityOffset: humidityOffset,
      isActive: device.isActive !== undefined ? device.isActive : true,
      referenceTemperature: '',
      referenceHumidity: '',
      currentTemperature: '',
      currentHumidity: ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm('Bu cihazı silmek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/devices/${deviceId}`);
      setSuccess('Cihaz başarıyla silindi!');
      fetchDevices();
    } catch (err) {
      console.error('Cihaz silinemedi:', err);
      setError('Cihaz silinemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({ 
      name: '', 
      location: '', 
      deviceId: '', 
      ipAddress: '', 
      temperatureOffset: 0, 
      humidityOffset: 0,
      referenceTemperature: '',
      referenceHumidity: '',
      currentTemperature: '',
      currentHumidity: '',
      directTemperatureOffset: '',
      directHumidityOffset: '',
      isActive: true
    });
    setEditingDevice(null);
    setShowAddForm(false);
  };

  const handleCalibrate = async (device) => {
    setCalibrationDevice(device);
    
    // Arduino'dan offset değerlerini oku
    let temperatureOffset = 0;
    let humidityOffset = 0;
    
    if (device.ipAddress) {
      try {
        const response = await axios.get(`${API_BASE_URL}/arduino/calibrate/${device.ipAddress}`);
        if (response.data.success) {
          temperatureOffset = response.data.temperatureOffset || 0;
          humidityOffset = response.data.humidityOffset || 0;
        }
      } catch (err) {
        console.warn('Arduino\'dan offset değerleri okunamadı:', err);
        // Hata durumunda varsayılan değerleri kullan
      }
    }
    
    setFormData({
      ...formData,
      ipAddress: device.ipAddress,
      temperatureOffset: temperatureOffset,
      humidityOffset: humidityOffset,
      isActive: device.isActive,
      referenceTemperature: '',
      referenceHumidity: '',
      currentTemperature: '',
      currentHumidity: '',
      directTemperatureOffset: '',
      directHumidityOffset: ''
    });
    setShowCalibrationModal(true);
  };

  const handleCloseCalibrationModal = () => {
    setShowCalibrationModal(false);
    setCalibrationDevice(null);
    setCalibrationMode('reference');
    setFormData({
      ...formData,
      referenceTemperature: '',
      referenceHumidity: '',
      currentTemperature: '',
      currentHumidity: '',
      directTemperatureOffset: '',
      directHumidityOffset: ''
    });
  };

  const handleSendTemperatureCalibration = async () => {
    if (!formData.ipAddress) {
      setError('IP adresi gerekli!');
      return;
    }

    let temperatureOffset = 0;

    if (calibrationMode === 'reference') {
      // Onaylı cihaz ile kalibrasyon
    if (!formData.referenceTemperature || !formData.currentTemperature) {
      setError('Onaylı ve Arduino sıcaklık değerleri gerekli!');
      return;
      }
      temperatureOffset = (formData.referenceTemperature || 0) - (formData.currentTemperature || 0);
    } else {
      // Direkt offset ile kalibrasyon
      if (formData.directTemperatureOffset === '' || formData.directTemperatureOffset === null || formData.directTemperatureOffset === undefined) {
        setError('Sıcaklık offset değeri gerekli!');
        return;
      }
      temperatureOffset = parseFloat(formData.directTemperatureOffset) || 0;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      const calibrationData = {
        ipAddress: formData.ipAddress,
        temperatureOffset: temperatureOffset
        // humidityOffset gönderme - Arduino mevcut değeri koruyacak
      };

      const response = await axios.post(
        `${API_BASE_URL}/arduino/calibrate`,
        calibrationData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.success) {
        setSuccess(`✅ Sıcaklık kalibrasyonu gönderildi! (+${temperatureOffset.toFixed(1)}°C)`);
        
        // Arduino'dan güncel offset değerlerini tekrar oku
        try {
          const readResponse = await axios.get(`${API_BASE_URL}/arduino/calibrate/${formData.ipAddress}`);
          if (readResponse.data.success) {
            setFormData({
              ...formData,
              temperatureOffset: readResponse.data.temperatureOffset || 0
            });
          }
        } catch (err) {
          console.warn('Güncel offset değerleri okunamadı:', err);
        }
      } else {
        setError(response.data.message || 'Arduino sıcaklık kalibrasyonu reddetti!');
      }
    } catch (err) {
      console.error('Sıcaklık kalibrasyonu gönderilemedi:', err);
      if (err.response?.data?.message) {
        setError(`❌ ${err.response.data.message}`);
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        setError(`❌ Backend'e bağlanılamadı!`);
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
        setError('⏰ Backend yanıt vermiyor!');
      } else {
        setError(`❌ Sıcaklık kalibrasyonu gönderilemedi: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendHumidityCalibration = async () => {
    if (!formData.ipAddress) {
      setError('IP adresi gerekli!');
      return;
    }

    let humidityOffset = 0;

    if (calibrationMode === 'reference') {
      // Onaylı cihaz ile kalibrasyon
    if (!formData.referenceHumidity || !formData.currentHumidity) {
      setError('Onaylı ve Arduino nem değerleri gerekli!');
      return;
      }
      humidityOffset = (formData.referenceHumidity || 0) - (formData.currentHumidity || 0);
    } else {
      // Direkt offset ile kalibrasyon
      if (formData.directHumidityOffset === '' || formData.directHumidityOffset === null || formData.directHumidityOffset === undefined) {
        setError('Nem offset değeri gerekli!');
        return;
      }
      humidityOffset = parseFloat(formData.directHumidityOffset) || 0;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      const calibrationData = {
        ipAddress: formData.ipAddress,
        humidityOffset: humidityOffset
        // temperatureOffset gönderme - Arduino mevcut değeri koruyacak
      };

      const response = await axios.post(
        `${API_BASE_URL}/arduino/calibrate`,
        calibrationData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.success) {
        setSuccess(`✅ Nem kalibrasyonu gönderildi! (+${humidityOffset.toFixed(1)}%)`);
        
        // Arduino'dan güncel offset değerlerini tekrar oku
        try {
          const readResponse = await axios.get(`${API_BASE_URL}/arduino/calibrate/${formData.ipAddress}`);
          if (readResponse.data.success) {
            setFormData({
              ...formData,
              humidityOffset: readResponse.data.humidityOffset || 0
            });
          }
        } catch (err) {
          console.warn('Güncel offset değerleri okunamadı:', err);
        }
      } else {
        setError(response.data.message || 'Arduino nem kalibrasyonu reddetti!');
      }
    } catch (err) {
      console.error('Nem kalibrasyonu gönderilemedi:', err);
      if (err.response?.data?.message) {
        setError(`❌ ${err.response.data.message}`);
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        setError(`❌ Backend'e bağlanılamadı!`);
      } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
        setError('⏰ Backend yanıt vermiyor!');
      } else {
        setError(`❌ Nem kalibrasyonu gönderilemedi: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFetchArduinoData = async () => {
    if (!formData.ipAddress) {
      setError('IP adresi gerekli!');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `http://${formData.ipAddress}/data`,
        {
          timeout: 5000
        }
      );

      if (response.data && response.data.temperature && response.data.humidity) {
        setFormData(prev => ({
          ...prev,
          currentTemperature: response.data.temperature,
          currentHumidity: response.data.humidity
        }));
        setSuccess(`✅ Arduino verileri güncellendi! (${response.data.temperature}°C, ${response.data.humidity}%)`);
      } else {
        setError('Arduino\'dan geçersiz veri alındı!');
      }
    } catch (err) {
      console.error('Arduino verileri alınamadı:', err);
      if (err.code === 'ECONNREFUSED') {
        setError(`❌ Arduino'ya bağlanılamadı! IP: ${formData.ipAddress} - Arduino çalışıyor mu?`);
      } else if (err.code === 'ETIMEDOUT') {
        setError('⏰ Arduino yanıt vermiyor! Bağlantı zaman aşımı.');
      } else {
        setError(`❌ Arduino verileri alınamadı: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Renk ayarlarını kaydet
  const handleSaveColorSettings = () => {
    try {
      localStorage.setItem('tempHumidityColorSettings', JSON.stringify(colorSettings));
      setSuccess('✅ Renk ayarları başarıyla kaydedildi!');
      // Tüm component'leri yenilemek için event gönder
      window.dispatchEvent(new Event('colorSettingsUpdated'));
    } catch (e) {
      setError('❌ Renk ayarları kaydedilemedi!');
    }
  };

  // Renk ayarlarını sıfırla
  const handleResetColorSettings = () => {
    const defaultSettings = {
      temperature: {
        lowColor: '#4A90E2',
        normalColor: '#7ED321',
        highColor: '#D0021B',
        lowLimit: 20,
        highLimit: 25
      },
      humidity: {
        lowColor: '#4A90E2',
        normalColor: '#7ED321',
        highColor: '#D0021B',
        lowLimit: 50,
        highLimit: 60
      }
    };
    setColorSettings(defaultSettings);
    localStorage.setItem('tempHumidityColorSettings', JSON.stringify(defaultSettings));
    setSuccess('✅ Renk ayarları varsayılan değerlere sıfırlandı!');
    window.dispatchEvent(new Event('colorSettingsUpdated'));
  };

  // Tema durumuna göre stiller
  const isLightTheme = theme === 'light';
  const deviceCardBg = isLightTheme ? 'rgba(255, 255, 255, 0.9)' : 'rgba(26, 26, 46, 0.8)';
  const deviceCardBorder = isLightTheme ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)';
  const deviceCardText = isLightTheme ? '#1a1a2e' : '#bdc3c7';
  const deviceCardTextSecondary = isLightTheme ? '#6b7280' : '#95a5a6';
  const formBg = isLightTheme ? 'rgba(255, 255, 255, 0.95)' : 'rgba(26, 26, 46, 0.95)';
  const formBorder = isLightTheme ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)';
  const modalBg = isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(26, 26, 46, 0.95)';
  const modalBorder = isLightTheme ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.1)';
  const modalOverlay = isLightTheme ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.8)';
  const infoBoxBg = isLightTheme ? 'rgba(255, 255, 255, 0.7)' : 'rgba(26, 26, 46, 0.5)';
  const infoBoxBorder = isLightTheme ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)';
  const infoBoxText = isLightTheme ? '#1a1a2e' : '#ffffff';
  const closeButtonColor = isLightTheme ? '#1a1a2e' : '#ffffff';

  return (
    <div className={`temp-hum-root theme-${theme}`} style={{ width: '100%', maxWidth: '100%', padding: '0' }}>
      <h2 className="color-settings-heading" style={{ marginBottom: '30px' }}>⚙️ Cihaz Ayarları</h2>

      {/* Popup Mesajları */}
      {error && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(220, 53, 69, 0.95)',
          color: '#ffffff',
          padding: '15px 20px',
          borderRadius: '12px',
          border: '1px solid rgba(220, 53, 69, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          maxWidth: '400px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>❌</span>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '5px' }}>Hata</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>{error}</div>
            </div>
            <button 
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                marginLeft: '10px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {success && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(40, 167, 69, 0.95)',
          color: '#ffffff',
          padding: '15px 20px',
          borderRadius: '12px',
          border: '1px solid rgba(40, 167, 69, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 9999,
          maxWidth: '400px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '5px' }}>Başarılı</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>{success}</div>
            </div>
            <button 
              onClick={() => setSuccess(null)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0',
                marginLeft: '10px'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div style={{ 
        background: deviceCardBg, 
        border: deviceCardBorder,
        borderRadius: '16px',
        marginBottom: '40px',
        width: '100%',
        maxWidth: '95vw',
        margin: '0 auto',
        padding: '40px 20px',
        minHeight: '200px',
        boxShadow: isLightTheme ? '0 4px 12px rgba(0, 0, 0, 0.08)' : '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px'
        }}>
          <h3 className="color-settings-heading" style={{ margin: '0', fontSize: '28px', fontWeight: '700' }}>📱 Kayıtlı Cihazlar</h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
            style={{
              fontSize: '18px',
              padding: '15px 30px',
              borderRadius: '12px',
              fontWeight: '700',
              minWidth: '200px'
            }}
          >
            ➕ Yeni Cihaz Ekle
          </button>
        </div>

        {showAddForm && (
          <div style={{ 
            marginTop: '35px', 
            background: formBg, 
            border: formBorder,
            borderRadius: '16px',
            padding: '35px',
            width: '100%',
            minHeight: '300px',
            boxShadow: isLightTheme ? '0 2px 8px rgba(0, 0, 0, 0.06)' : '0 2px 8px rgba(0, 0, 0, 0.2)'
          }}>
            <h4 className="color-settings-heading" style={{ margin: '0 0 30px 0', fontSize: '24px', fontWeight: '600' }}>
              {editingDevice ? '✏️ Cihaz Düzenle' : '➕ Yeni Cihaz Ekle'}
            </h4>
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">Cihaz Adı:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">Konum:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">Cihaz ID:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.deviceId}
                      onChange={(e) => setFormData({...formData, deviceId: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">IP Adresi:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                      placeholder="192.168.1.100"
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="row">
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">📡 Cihaz Durumu:</label>
                    <select
                      className="form-control"
                      value={formData.isActive !== undefined ? formData.isActive : true}
                      onChange={(e) => setFormData({...formData, isActive: e.target.value === 'true'})}
                    >
                      <option value={true}>🟢 Aktif</option>
                      <option value={false}>🔴 Pasif</option>
                    </select>
                    <small className="color-settings-helper">Pasif cihazlar sorgulanmaz</small>
                  </div>
                </div>
              </div>
              
              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={loading}
                >
                  {loading ? 'Kaydediliyor...' : (editingDevice ? 'Güncelle' : 'Kaydet')}
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={handleCancel}
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && !showAddForm ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Cihazlar yükleniyor...</p>
          </div>
        ) : (
          <div style={{ marginTop: '30px' }}>
            {devices.map(device => (
              <div key={device.id} style={{ 
                background: deviceCardBg, 
                border: deviceCardBorder,
                borderRadius: '16px',
                padding: '30px',
                marginBottom: '25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                minHeight: '120px',
                boxShadow: isLightTheme ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ flex: 1 }}>
                  <h4 className="color-settings-heading" style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                    📱 {device.name}
                  </h4>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ color: deviceCardText, fontSize: '14px' }}>
                      📍 {device.location}
                    </span>
                    <span style={{ color: deviceCardText, fontSize: '14px' }}>
                      🆔 {device.deviceId}
                    </span>
                    <span style={{ color: deviceCardText, fontSize: '14px' }}>
                      🌐 {device.ipAddress}
                    </span>
                    <span style={{ color: deviceCardTextSecondary, fontSize: '12px' }}>
                      📅 {new Date(device.createdDate).toLocaleDateString('tr-TR')}
                    </span>
                    <span style={{ 
                      color: device.isActive ? '#28a745' : '#dc3545', 
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: device.isActive 
                        ? (isLightTheme ? 'rgba(40, 167, 69, 0.15)' : 'rgba(40, 167, 69, 0.1)')
                        : (isLightTheme ? 'rgba(220, 53, 69, 0.15)' : 'rgba(220, 53, 69, 0.1)'),
                      border: `1px solid ${device.isActive ? 'rgba(40, 167, 69, 0.4)' : 'rgba(220, 53, 69, 0.4)'}`
                    }}>
                      {device.isActive ? '🟢 Aktif' : '🔴 Pasif'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleEdit(device)}
                    style={{ 
                      fontSize: '13px', 
                      padding: '6px 12px', 
                      borderRadius: '6px',
                      fontWeight: '500'
                    }}
                  >
                    ✏️ Düzenle
                  </button>
                  <button 
                    className="btn btn-info"
                    onClick={() => handleCalibrate(device)}
                    style={{ 
                      fontSize: '13px', 
                      padding: '6px 12px', 
                      borderRadius: '6px',
                      fontWeight: '500',
                      backgroundColor: '#17a2b8',
                      borderColor: '#17a2b8',
                      color: '#fff'
                    }}
                  >
                    🔧 Kalibrasyon
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDelete(device.id)}
                    style={{ 
                      fontSize: '13px', 
                      padding: '6px 12px', 
                      borderRadius: '6px',
                      fontWeight: '500'
                    }}
                  >
                    🗑️ Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {devices.length === 0 && !loading && (
          <div className="card text-center" style={{ 
            background: deviceCardBg, 
            border: deviceCardBorder,
            padding: '40px',
            borderRadius: '16px'
          }}>
            <h4 className="color-settings-heading" style={{ marginBottom: '10px' }}>📱 Henüz cihaz eklenmemiş</h4>
            <p className="color-settings-text">Yeni cihaz eklemek için yukarıdaki butonu kullanın.</p>
          </div>
        )}
      </div>

      {/* Renk Ayarları Bölümü */}
      <div className={`color-settings-section theme-${theme}`} style={{ 
        borderRadius: '16px',
        marginTop: '40px',
        width: '100%',
        maxWidth: '95vw',
        margin: '40px auto 0',
        padding: '40px 20px'
      }}>
        <h3 className="color-settings-title" style={{ margin: '0 0 30px 0', fontSize: '28px', fontWeight: '700' }}>
          🎨 {translate('tempHumColorSettings')}
        </h3>
        <p className="color-settings-desc" style={{ marginBottom: '30px' }}>
          {translate('tempHumColorSettingsDesc')}
        </p>

        {/* Sıcaklık Renk Ayarları */}
        <div className={`color-settings-card theme-${theme}`} style={{ 
          borderRadius: '12px',
          padding: '25px',
          marginBottom: '25px'
        }}>
          <h4 className="color-settings-card-title" style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
            🌡️ {translate('tempHumTemperatureColorSettings')}
          </h4>
          
          <div className="row" style={{ marginBottom: '20px' }}>
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumLowColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.temperature.lowColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, lowColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.temperature.lowColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, lowColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">&lt; {colorSettings.temperature.lowLimit}°C</small>
            </div>
            
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumNormalColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.temperature.normalColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, normalColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.temperature.normalColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, normalColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">{colorSettings.temperature.lowLimit}°C - {colorSettings.temperature.highLimit}°C</small>
            </div>
            
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumHighColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.temperature.highColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, highColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.temperature.highColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    temperature: { ...colorSettings.temperature, highColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">&gt;= {colorSettings.temperature.highLimit}°C</small>
            </div>
          </div>

          <div className="row">
            <div className="col-6">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumLowLimit')} (°C):</label>
              <input
                type="number"
                value={colorSettings.temperature.lowLimit}
                onChange={(e) => setColorSettings({
                  ...colorSettings,
                  temperature: { ...colorSettings.temperature, lowLimit: parseFloat(e.target.value) || 0 }
                })}
                step="0.1"
                className="color-settings-input"
                style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
              />
            </div>
            <div className="col-6">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumHighLimit')} (°C):</label>
              <input
                type="number"
                value={colorSettings.temperature.highLimit}
                onChange={(e) => setColorSettings({
                  ...colorSettings,
                  temperature: { ...colorSettings.temperature, highLimit: parseFloat(e.target.value) || 0 }
                })}
                step="0.1"
                className="color-settings-input"
                style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>

        {/* Nem Renk Ayarları */}
        <div className={`color-settings-card theme-${theme}`} style={{ 
          borderRadius: '12px',
          padding: '25px',
          marginBottom: '25px'
        }}>
          <h4 className="color-settings-card-title" style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '600' }}>
            💧 {translate('tempHumHumidityColorSettings')}
          </h4>
          
          <div className="row" style={{ marginBottom: '20px' }}>
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumLowColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.humidity.lowColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, lowColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.humidity.lowColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, lowColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">&lt; {colorSettings.humidity.lowLimit}%</small>
            </div>
            
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumNormalColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.humidity.normalColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, normalColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.humidity.normalColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, normalColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">{colorSettings.humidity.lowLimit}% - {colorSettings.humidity.highLimit}%</small>
            </div>
            
            <div className="col-3">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumHighColor')}:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={colorSettings.humidity.highColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, highColor: e.target.value }
                  })}
                  style={{ width: '60px', height: '40px', cursor: 'pointer', borderRadius: '6px', border: 'none' }}
                />
                <input
                  type="text"
                  value={colorSettings.humidity.highColor}
                  onChange={(e) => setColorSettings({
                    ...colorSettings,
                    humidity: { ...colorSettings.humidity, highColor: e.target.value }
                  })}
                  className="color-settings-input"
                  style={{ flex: 1, padding: '8px', borderRadius: '6px' }}
                />
              </div>
              <small className="color-settings-helper">&gt;= {colorSettings.humidity.highLimit}%</small>
            </div>
          </div>

          <div className="row">
            <div className="col-6">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumLowLimit')} (%):</label>
              <input
                type="number"
                value={colorSettings.humidity.lowLimit}
                onChange={(e) => setColorSettings({
                  ...colorSettings,
                  humidity: { ...colorSettings.humidity, lowLimit: parseFloat(e.target.value) || 0 }
                })}
                step="0.1"
                className="color-settings-input"
                style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
              />
            </div>
            <div className="col-6">
              <label className="color-settings-label" style={{ marginBottom: '8px', display: 'block' }}>{translate('tempHumHighLimit')} (%):</label>
              <input
                type="number"
                value={colorSettings.humidity.highLimit}
                onChange={(e) => setColorSettings({
                  ...colorSettings,
                  humidity: { ...colorSettings.humidity, highLimit: parseFloat(e.target.value) || 0 }
                })}
                step="0.1"
                className="color-settings-input"
                style={{ width: '100%', padding: '8px', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>

        {/* Kaydet ve Sıfırla Butonları */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button 
            className="btn btn-success"
            onClick={handleSaveColorSettings}
            style={{ 
              fontSize: '16px', 
              padding: '12px 30px', 
              borderRadius: '8px',
              fontWeight: '600',
              minWidth: '150px'
            }}
          >
            💾 {translate('tempHumSave')}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleResetColorSettings}
            style={{ 
              fontSize: '16px', 
              padding: '12px 30px', 
              borderRadius: '8px',
              fontWeight: '600',
              minWidth: '150px'
            }}
          >
            🔄 {translate('tempHumReset')}
          </button>
        </div>
      </div>

      {/* Kalibrasyon Modal */}
      {showCalibrationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: modalOverlay,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: modalBg,
            border: modalBorder,
            borderRadius: '16px',
            padding: '30px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="color-settings-heading" style={{ margin: 0 }}>🔧 Kalibrasyon - {calibrationDevice?.name}</h3>
              <button 
                onClick={handleCloseCalibrationModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: closeButtonColor,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0'
                }}
              >
                ×
              </button>
            </div>

            {/* Kalibrasyon Modu Seçimi */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setCalibrationMode('reference')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `2px solid ${calibrationMode === 'reference' ? '#667eea' : (isLightTheme ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)')}`,
                  background: calibrationMode === 'reference' ? '#667eea' : (isLightTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 46, 0.5)'),
                  color: calibrationMode === 'reference' ? '#ffffff' : (isLightTheme ? '#1a1a2e' : '#ffffff'),
                  cursor: 'pointer',
                  fontWeight: calibrationMode === 'reference' ? '600' : '400',
                  transition: 'all 0.3s ease'
                }}
              >
                📏 Onaylı Cihaz ile
              </button>
              <button
                type="button"
                onClick={() => setCalibrationMode('direct')}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: `2px solid ${calibrationMode === 'direct' ? '#667eea' : (isLightTheme ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)')}`,
                  background: calibrationMode === 'direct' ? '#667eea' : (isLightTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(26, 26, 46, 0.5)'),
                  color: calibrationMode === 'direct' ? '#ffffff' : (isLightTheme ? '#1a1a2e' : '#ffffff'),
                  cursor: 'pointer',
                  fontWeight: calibrationMode === 'direct' ? '600' : '400',
                  transition: 'all 0.3s ease'
                }}
              >
                🎯 Direkt Offset
              </button>
            </div>

            {calibrationMode === 'reference' ? (
              <>
            {/* Onaylı Cihaz Değerleri */}
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(40, 167, 69, 0.1)', borderRadius: '8px', border: '1px solid rgba(40, 167, 69, 0.3)' }}>
              <h5 className="color-settings-heading" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📏 Onaylı Cihaz Değerleri
              </h5>
              <div className="row">
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">🌡️ Onaylı Sıcaklık:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.referenceTemperature || ''}
                        onChange={(e) => setFormData({...formData, referenceTemperature: parseFloat(e.target.value) || ''})}
                        placeholder="25.0"
                        step="0.1"
                        style={{ flex: 1 }}
                      />
                      <span className="color-settings-text" style={{ fontSize: '14px' }}>°C</span>
                    </div>
                    <small className="color-settings-helper">Onaylı cihazınızda gördüğünüz sıcaklık</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">💧 Onaylı Nem:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.referenceHumidity || ''}
                        onChange={(e) => setFormData({...formData, referenceHumidity: parseFloat(e.target.value) || ''})}
                        placeholder="60.0"
                        step="0.1"
                        style={{ flex: 1 }}
                      />
                      <span className="color-settings-text" style={{ fontSize: '14px' }}>%</span>
                    </div>
                    <small className="color-settings-helper">Onaylı cihazınızda gördüğünüz nem</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Arduino Mevcut Değerleri */}
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.3)' }}>
              <h5 className="color-settings-heading" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📱 Arduino Mevcut Değerleri
              </h5>
              <div className="row">
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">🌡️ Arduino Sıcaklık:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        flex: 1, 
                        padding: '12px 16px', 
                        background: infoBoxBg, 
                        border: infoBoxBorder, 
                        borderRadius: '8px',
                        color: infoBoxText,
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        {formData.currentTemperature ? `${formData.currentTemperature}°C` : 'Veri bekleniyor...'}
                      </div>
                    </div>
                    <small className="color-settings-helper">Arduino'dan otomatik gelen sıcaklık</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">💧 Arduino Nem:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        flex: 1, 
                        padding: '12px 16px', 
                        background: infoBoxBg, 
                        border: infoBoxBorder, 
                        borderRadius: '8px',
                        color: infoBoxText,
                        fontSize: '16px',
                        fontWeight: '600',
                        textAlign: 'center'
                      }}>
                        {formData.currentHumidity ? `${formData.currentHumidity}%` : 'Veri bekleniyor...'}
                      </div>
                    </div>
                    <small className="color-settings-helper">Arduino'dan otomatik gelen nem</small>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <button 
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={handleFetchArduinoData}
                  disabled={loading || !formData.isActive}
                  style={{ 
                    fontSize: '12px', 
                    padding: '6px 12px',
                    opacity: !formData.isActive ? 0.5 : 1
                  }}
                >
                  🔄 Arduino Verilerini Yenile
                </button>
                {!formData.isActive && (
                  <div style={{ color: '#dc3545', fontSize: '12px', marginTop: '5px' }}>
                    ⚠️ Pasif cihazlar için Arduino verisi çekilemez
                  </div>
                )}
              </div>
            </div>

            {/* Hesaplanan Düzeltmeler */}
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(220, 53, 69, 0.1)', borderRadius: '8px', border: '1px solid rgba(220, 53, 69, 0.3)' }}>
              <h5 className="color-settings-heading" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧮 Hesaplanan Düzeltmeler
              </h5>
              <div className="row">
                <div className="col-6">
                  <div style={{ padding: '10px', background: infoBoxBg, border: infoBoxBorder, borderRadius: '6px' }}>
                    <div className="color-settings-text" style={{ fontSize: '14px', marginBottom: '5px' }}>🌡️ Sıcaklık Düzeltmesi:</div>
                    <div style={{ color: '#ffc107', fontSize: '18px', fontWeight: 'bold' }}>
                      {(() => {
                        const ref = formData.referenceTemperature || 0;
                        const curr = formData.currentTemperature || 0;
                        const diff = ref - curr;
                        return diff > 0 ? `+${diff.toFixed(1)}°C` : `${diff.toFixed(1)}°C`;
                      })()}
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div style={{ padding: '10px', background: infoBoxBg, border: infoBoxBorder, borderRadius: '6px' }}>
                    <div className="color-settings-text" style={{ fontSize: '14px', marginBottom: '5px' }}>💧 Nem Düzeltmesi:</div>
                    <div style={{ color: '#ffc107', fontSize: '18px', fontWeight: 'bold' }}>
                      {(() => {
                        const ref = formData.referenceHumidity || 0;
                        const curr = formData.currentHumidity || 0;
                        const diff = ref - curr;
                        return diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </>
            ) : (
              <>
            {/* Direkt Offset Girişi */}
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
              <h5 className="color-settings-heading" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎯 Direkt Offset Değerleri
              </h5>
              <div className="row">
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">🌡️ Sıcaklık Offset:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.directTemperatureOffset || ''}
                        onChange={(e) => setFormData({...formData, directTemperatureOffset: e.target.value})}
                        placeholder="0.0"
                        step="0.1"
                        style={{ flex: 1 }}
                      />
                      <span className="color-settings-text" style={{ fontSize: '14px' }}>°C</span>
                    </div>
                    <small className="color-settings-helper">Örnek: +2.5 (2.5°C artır), -1.0 (1.0°C azalt)</small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-group">
                    <label className="color-settings-label">💧 Nem Offset:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.directHumidityOffset || ''}
                        onChange={(e) => setFormData({...formData, directHumidityOffset: e.target.value})}
                        placeholder="0.0"
                        step="0.1"
                        style={{ flex: 1 }}
                      />
                      <span className="color-settings-text" style={{ fontSize: '14px' }}>%</span>
                    </div>
                    <small className="color-settings-helper">Örnek: +5.0 (5% artır), -3.0 (3% azalt)</small>
                  </div>
                </div>
              </div>
            </div>
              </>
            )}

            {/* Mevcut Offset Değerleri - Her iki modda da göster */}
            <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
              <h5 className="color-settings-heading" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📊 Arduino'da Kayıtlı Offset Değerleri
              </h5>
              <div className="row">
                <div className="col-6">
                  <div style={{ padding: '10px', background: infoBoxBg, border: infoBoxBorder, borderRadius: '6px' }}>
                    <div className="color-settings-text" style={{ fontSize: '14px', marginBottom: '5px' }}>🌡️ Sıcaklık Offset:</div>
                    <div style={{ color: '#667eea', fontSize: '18px', fontWeight: 'bold' }}>
                      {formData.temperatureOffset !== undefined && formData.temperatureOffset !== null 
                        ? (formData.temperatureOffset > 0 ? `+${formData.temperatureOffset.toFixed(2)}°C` : `${formData.temperatureOffset.toFixed(2)}°C`)
                        : '0.00°C'}
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div style={{ padding: '10px', background: infoBoxBg, border: infoBoxBorder, borderRadius: '6px' }}>
                    <div className="color-settings-text" style={{ fontSize: '14px', marginBottom: '5px' }}>💧 Nem Offset:</div>
                    <div style={{ color: '#667eea', fontSize: '18px', fontWeight: 'bold' }}>
                      {formData.humidityOffset !== undefined && formData.humidityOffset !== null 
                        ? (formData.humidityOffset > 0 ? `+${formData.humidityOffset.toFixed(2)}%` : `${formData.humidityOffset.toFixed(2)}%`)
                        : '0.00%'}
                    </div>
                  </div>
                </div>
              </div>
              <small className="color-settings-helper" style={{ display: 'block', marginTop: '10px', textAlign: 'center' }}>
                Bu değerler Arduino'nun EEPROM'una kayıtlı mevcut offset değerleridir
              </small>
            </div>

            {/* Kalibrasyon Butonları */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                type="button"
                className="btn btn-warning"
                onClick={handleSendTemperatureCalibration}
                disabled={loading}
                style={{ backgroundColor: '#ffc107', borderColor: '#ffc107', color: '#000' }}
              >
                🌡️ Sıcaklık Kalibrasyonu Gönder
              </button>
              <button 
                type="button"
                className="btn btn-info"
                onClick={handleSendHumidityCalibration}
                disabled={loading}
                style={{ backgroundColor: '#17a2b8', borderColor: '#17a2b8', color: '#fff' }}
              >
                💧 Nem Kalibrasyonu Gönder
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={handleCloseCalibrationModal}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
