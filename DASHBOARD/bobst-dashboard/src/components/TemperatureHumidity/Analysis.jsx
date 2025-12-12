import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as XLSX from 'xlsx';
import CombinedChart from './CombinedChart';
import HistoricalDataTable from './HistoricalDataTable';
import { getTranslation } from '../../utils/translations';
import { useTheme } from '../../contexts/ThemeContext';
import { API_BASE_URL } from './config';

const Analysis = ({ currentLanguage = 'tr' }) => {
  const { theme } = useTheme();
  const translate = (key) => getTranslation(key, currentLanguage);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // Son 7 gün
  const [endDate, setEndDate] = useState(new Date());
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(true); // Filtrelerin görünürlüğü
  const [colorSettings, setColorSettings] = useState(null);

  // Production URL veya local URL
  useEffect(() => {
    fetchDevices();
    
    // Renk ayarlarını yükle
    const loadColorSettings = () => {
      const saved = localStorage.getItem('tempHumidityColorSettings');
      if (saved) {
        try {
          setColorSettings(JSON.parse(saved));
        } catch (e) {
          console.error('Renk ayarları yüklenemedi:', e);
        }
      } else {
        // Varsayılan ayarlar (3 renk: düşük, normal, yüksek)
        setColorSettings({
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
        });
      }
    };
    
    loadColorSettings();
    
    // Renk ayarları güncellendiğinde yeniden yükle
    const handleColorSettingsUpdate = () => {
      loadColorSettings();
    };
    
    window.addEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
    return () => window.removeEventListener('colorSettingsUpdated', handleColorSettingsUpdate);
  }, []);

  // Otomatik veri yükleme kaldırıldı - sadece buton ile

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/devices`);
      setDevices(response.data);
      if (response.data.length > 0) {
        // Device.DeviceId (int) kullan
        setSelectedDevice((response.data[0].deviceId || response.data[0].id).toString());
      }
    } catch (err) {
      console.error('Cihazlar yüklenemedi:', err);
      setError('Cihazlar yüklenemedi');
    }
  };

  const fetchHistoricalData = async () => {
    if (!selectedDevice) return;
    
    // Tarih sıralaması kontrolü
    if (startDate > endDate) {
      setError('Başlangıç tarihi bitiş tarihinden sonra olamaz!');
      return;
    }
    
    // Önce eski verileri temizle (cache sorununu önlemek için)
    setHistoricalData([]);
    setError(null);
    setLoading(true);
    setHasSearched(true);
    try {
      await fetchHistoricalDataCore(selectedDevice, startDate, endDate);
    } finally {
      setLoading(false);
    }
  };

  // Ortak çekirdek fonksiyon: verilen aralıktaki veriyi getirir
  // deviceId parametresi Device.DeviceId (int) - veritabanındaki DeviceId alanı
  const fetchHistoricalDataCore = async (deviceId, start, end) => {
    try {
      // deviceId artık int, direkt kullan
      const actualDeviceId = parseInt(deviceId);
      
      console.log('🔍 Veri çekiliyor - Device.DeviceId:', actualDeviceId);
      console.log('📅 Tarih aralığı:', start.toLocaleString('sv-SE'), '→', end.toLocaleString('sv-SE'));
      
      // Seçili cihaz bilgisini kontrol et
      const selectedDeviceInfo = devices.find(d => d.deviceId === actualDeviceId || d.id === actualDeviceId);
      console.log('📱 Seçili cihaz bilgisi:', selectedDeviceInfo);
      
      // Cache'i bypass etmek için timestamp ekle
      const url = `${API_BASE_URL}/sensordata/device/${actualDeviceId}/daterange`;
      console.log('🌐 API URL:', url);
      
      const response = await axios.get(url, {
          params: {
            startDate: start.toLocaleString('sv-SE'),
          endDate: end.toLocaleString('sv-SE'),
          _t: Date.now() // Cache bypass için timestamp
        }
      });
      
      // Gelen veriyi direkt set et (önceden temizlendi)
      let data = response.data || [];
      console.log('✅ Veri geldi - Kayıt sayısı:', data.length);
      
      if (data.length > 0) {
        console.log('📊 İlk kayıt:', data[0]);
        console.log('📊 Son kayıt:', data[data.length - 1]);
      } else {
        console.warn('⚠️ Veri bulunamadı! DeviceId:', actualDeviceId);
        console.warn('   Tarih aralığı:', start.toLocaleString('sv-SE'), '→', end.toLocaleString('sv-SE'));
      }
      
      setHistoricalData(data);
      setError(null);
      if (data.length > 0) {
        setShowFilters(false);
      } else {
        setShowFilters(true);
      }
    } catch (err) {
      console.error('❌ Geçmiş veri yüklenemedi:', err);
      console.error('   Hata detayı:', err.response?.data || err.message);
      console.error('   DeviceId:', deviceId);
      setError('Geçmiş veri yüklenemedi');
      setHistoricalData([]); // Hata durumunda da temizle
    }
  };

  // Hızlı aralık kısayolları
  const applyPreset = async (days) => {
    if (!selectedDevice) return;
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start);
    setEndDate(now);
    // Önce eski verileri temizle (cache sorununu önlemek için)
    setHistoricalData([]);
    setError(null);
    setHasSearched(true);
    setLoading(true);
    try {
      await fetchHistoricalDataCore(selectedDevice, start, now);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
  };

  const handleCloseDataPage = () => {
    setShowFilters(true); // Filtreleri göster
    setHistoricalData([]); // Verileri temizle
    setHasSearched(false); // Arama durumunu sıfırla
    setError(null); // Hata mesajını temizle
  };

  // Excel'e aktar fonksiyonu
  const exportToExcel = () => {
    if (!historicalData || historicalData.length === 0) {
      alert('Excel\'e aktarılacak veri bulunamadı!');
      return;
    }

    // Seçili cihaz bilgisini al (historicalData zaten seçilen cihazın bilgileriyle güncellenmiş)
    const deviceName = historicalData.length > 0 
      ? `${historicalData[0].deviceName} - ${historicalData[0].location}`
      : 'Bilinmeyen Cihaz';
    
    // Excel için veri formatı
    const excelData = historicalData.map(item => {
      const date = new Date(item.timestamp);
      return {
        'Zaman Damgası': date.toLocaleString('tr-TR'),
        'Cihaz Adı': item.deviceName || deviceName,
        'Konum': item.location || '',
        'Sıcaklık (°C)': parseFloat(item.temperature).toFixed(2),
        'Nem (%)': parseFloat(item.humidity).toFixed(2)
      };
    });

    // Workbook oluştur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Kolon genişliklerini ayarla
    const colWidths = [
      { wch: 20 }, // Zaman Damgası
      { wch: 25 }, // Cihaz Adı
      { wch: 20 }, // Konum
      { wch: 15 }, // Sıcaklık
      { wch: 12 }  // Nem
    ];
    ws['!cols'] = colWidths;

    // Sheet'i workbook'a ekle
    XLSX.utils.book_append_sheet(wb, ws, 'Sensör Verileri');

    // Dosya adını oluştur
    const startDateStr = startDate.toLocaleDateString('tr-TR').replace(/\./g, '-');
    const endDateStr = endDate.toLocaleDateString('tr-TR').replace(/\./g, '-');
    const fileName = `Sicaklik_Nem_Verileri_${startDateStr}_${endDateStr}.xlsx`;

    // Excel dosyasını indir
    XLSX.writeFile(wb, fileName);
  };

  // Limit aşımı istatistiklerini hesapla
  const calculateLimitStats = () => {
    if (!colorSettings || historicalData.length === 0) {
      return {
        tempLow: 0,
        tempHigh: 0,
        humLow: 0,
        humHigh: 0,
        outOfRange: 0
      };
    }

    const tempSettings = colorSettings.temperature;
    const humSettings = colorSettings.humidity;

    let tempLow = 0;
    let tempHigh = 0;
    let humLow = 0;
    let humHigh = 0;
    let outOfRange = 0;

    historicalData.forEach(item => {
      // Sıcaklık kontrolü
      if (item.temperature < tempSettings.lowLimit) {
        tempLow++;
      } else if (item.temperature >= tempSettings.highLimit) {
        tempHigh++;
      }

      // Nem kontrolü
      if (item.humidity < humSettings.lowLimit) {
        humLow++;
      } else if (item.humidity >= humSettings.highLimit) {
        humHigh++;
      }

      // Değer dışı kontrolü (sıcaklık veya nem limit dışında)
      if (
        item.temperature < tempSettings.lowLimit ||
        item.temperature >= tempSettings.highLimit ||
        item.humidity < humSettings.lowLimit ||
        item.humidity >= humSettings.highLimit
      ) {
        outOfRange++;
      }
    });

    return { tempLow, tempHigh, humLow, humHigh, outOfRange };
  };

  return (
    <div className="analysis-layout">
      <div className="section-card card">
        <h2 className="section-title">📈 Veri Analizi</h2>
      </div>

      {showFilters && (
        <div className="section-card card">
          <h3 className="section-title">🔍 Filtreler</h3>
          {/* Düzen: Sol sütunda cihaz + Verileri Getir; sağ sütunda Başlangıç, Bitiş, Presetler */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Sol üst: Cihaz seçimi */}
            <div className="form-group" style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}>
              <label>Cihaz Seçin:</label>
              <select 
                className="form-control"
                value={selectedDevice}
                onChange={(e) => {
                  // Device.DeviceId (int) kullan
                  setSelectedDevice(e.target.value);
                  // Cihaz değiştiğinde eski verileri temizle
                  setHistoricalData([]);
                  setHasSearched(false);
                  setError(null);
                }}
              >
                <option value="">Tüm Cihazlar</option>
                {devices.map(device => (
                  <option key={device.id} value={(device.deviceId || device.id).toString()}>
                    {device.name} - {device.location} [DeviceId: {device.deviceId || device.id}]
                  </option>
                ))}
              </select>
            </div>
            {/* Sağ üst: Başlangıç */}
            <div className="form-group" style={{ gridColumn: '2 / 3', gridRow: '1 / 2' }}>
              <label>Başlangıç Tarihi:</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd.MM.yyyy HH:mm"
                className="form-control"
              />
            </div>
            {/* Sağ orta: Bitiş */}
            <div className="form-group" style={{ gridColumn: '2 / 3', gridRow: '2 / 3' }}>
              <label>Bitiş Tarihi:</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="dd.MM.yyyy HH:mm"
                className="form-control"
              />
            </div>
            {/* Sağ alt: Preset aralık butonları */}
            <div style={{ gridColumn: '2 / 3', gridRow: '3 / 4', display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => applyPreset(1)} disabled={loading}>Son 1 Gün</button>
              <button className="btn btn-primary" onClick={() => applyPreset(7)} disabled={loading}>Son 1 Hafta</button>
              <button className="btn btn-primary" onClick={() => applyPreset(30)} disabled={loading}>Son 1 Ay</button>
              <button className="btn btn-primary" onClick={() => applyPreset(365)} disabled={loading}>Son 1 Yıl</button>
            </div>
            {/* Sol alt: Verileri Getir */}
            <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3', display: 'flex', justifyContent: 'flex-start', gap: '8px', marginTop: 8 }}>
              <button 
                className="btn btn-primary" 
                onClick={fetchHistoricalData}
                disabled={loading}
              >
                {loading ? 'Yükleniyor...' : 'Verileri Getir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ background: '#f8d7da', color: '#721c24' }}>
          <h4>❌ Hata</h4>
          <p>{error}</p>
        </div>
      )}

      {historicalData.length > 0 && (
        <>
          <div className="section-card card" style={{ textAlign: 'center', display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              className="btn btn-success" 
              onClick={exportToExcel}
              style={{ fontSize: '16px', padding: '12px 24px' }}
            >
              📥 Excel'e Aktar
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleCloseDataPage}
              style={{ fontSize: '16px', padding: '12px 24px' }}
            >
              🚪 Veri Sayfası Kapat
            </button>
          </div>
          
          <div className="section-card card">
            <h3 className="section-title">📊 {translate('tempHumStatistics')}</h3>
            {(() => {
              const limitStats = calculateLimitStats();
              return (
            <div className="stats-grid">
              <div className="stat-card">
                <h4>🌡️ {translate('tempHumTemperature')}</h4>
                <div className="stat-row"><span>{translate('tempHumMin')}</span><strong>{Math.min(...historicalData.map(d => d.temperature)).toFixed(1)}°C</strong></div>
                <div className="stat-row"><span>{translate('tempHumAvg')}</span><strong>{(historicalData.reduce((sum, d) => sum + d.temperature, 0) / historicalData.length).toFixed(1)}°C</strong></div>
                <div className="stat-row"><span>{translate('tempHumMax')}</span><strong>{Math.max(...historicalData.map(d => d.temperature)).toFixed(1)}°C</strong></div>
                    <div className="stat-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#4A90E2' }}>{translate('tempHumTempLowCount')}</span>
                      <strong style={{ color: '#4A90E2' }}>{limitStats.tempLow}</strong>
                    </div>
                    <div className="stat-row">
                      <span style={{ color: '#D0021B' }}>{translate('tempHumTempHighCount')}</span>
                      <strong style={{ color: '#D0021B' }}>{limitStats.tempHigh}</strong>
                    </div>
              </div>
              <div className="stat-card">
                <h4>💧 {translate('tempHumHumidity')}</h4>
                <div className="stat-row"><span>{translate('tempHumMin')}</span><strong>{Math.min(...historicalData.map(d => d.humidity)).toFixed(1)}%</strong></div>
                <div className="stat-row"><span>{translate('tempHumAvg')}</span><strong>{(historicalData.reduce((sum, d) => sum + d.humidity, 0) / historicalData.length).toFixed(1)}%</strong></div>
                <div className="stat-row"><span>{translate('tempHumMax')}</span><strong>{Math.max(...historicalData.map(d => d.humidity)).toFixed(1)}%</strong></div>
                    <div className="stat-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#4A90E2' }}>{translate('tempHumHumLowCount')}</span>
                      <strong style={{ color: '#4A90E2' }}>{limitStats.humLow}</strong>
                    </div>
                    <div className="stat-row">
                      <span style={{ color: '#D0021B' }}>{translate('tempHumHumHighCount')}</span>
                      <strong style={{ color: '#D0021B' }}>{limitStats.humHigh}</strong>
                    </div>
              </div>
              <div className="stat-card">
                <h4>📈 Veri Sayısı</h4>
                <div className="stat-row"><span>{translate('tempHumTotalRecords')}</span><strong>{historicalData.length}</strong></div>
                <div className="stat-row"><span>Periyot</span><strong>{Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))} gün</strong></div>
                    <div className="stat-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#F5A623' }}>{translate('tempHumOutOfRangeCount')}</span>
                      <strong style={{ color: '#F5A623' }}>{limitStats.outOfRange}</strong>
                    </div>
              </div>
              <div className="stat-card">
                <h4>⏰ Zaman Aralığı</h4>
                <div className="stat-row"><span>Başlangıç</span><strong>{new Date(historicalData[0].timestamp).toLocaleString('tr-TR')}</strong></div>
                <div className="stat-row"><span>Bitiş</span><strong>{new Date(historicalData[historicalData.length - 1].timestamp).toLocaleString('tr-TR')}</strong></div>
              </div>
            </div>
              );
            })()}
          </div>

          <div className="section-card card">
            <CombinedChart data={historicalData} currentLanguage={currentLanguage} />
          </div>
          <div className="section-card card">
            <HistoricalDataTable data={historicalData} currentLanguage={currentLanguage} />
          </div>
        </>
      )}

      {!loading && hasSearched && historicalData.length === 0 && (
        <div className="card dark-card no-data-card" style={{ marginTop: '150px' }}>
          <h3 style={{ color: '#ffffff' }}>📊 Veri Bulunamadı</h3>
          <p>Seçilen tarih aralığında veri bulunamadı.</p>
        </div>
      )}
    </div>
  );
};

export default Analysis;
