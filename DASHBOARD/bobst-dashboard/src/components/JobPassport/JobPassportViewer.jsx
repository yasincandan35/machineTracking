import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../../contexts/ThemeContext';
import { MACHINE_CONFIG, BACKEND_URL } from './utils/constants';
import { createColorBar, lightenColor } from './utils/colorHelpers';
import { adjustVizkozite, adjustSolvent, adjustVizkoziteSeconds, adjustVizkoziteTemperature } from './utils/adjustments';
import { printJobPassport } from './utils/printJobPassport';
import { printSingleUnit, printAllUnits } from './utils/printSingleUnit';
import DataCategory from './components/DataCategory';

const JobPassportViewer = () => {
  const { theme, isLiquidGlass } = useTheme();
  const isDark = theme === 'dark';
  
  // State - localStorage initializer (SADECE İLK RENDER'DA ÇALIŞIR)
  const [selectedMachine, setSelectedMachine] = useState(() => {
    try {
      const saved = localStorage.getItem('jobPassportQuery');
      if (saved) {
        const data = JSON.parse(saved);
        return data.machine || '';
      }
    } catch (err) {}
    return '';
  });
  
  const [stokKodu, setStokKodu] = useState(() => {
    try {
      const saved = localStorage.getItem('jobPassportQuery');
      if (saved) {
        const data = JSON.parse(saved);
        return data.stokKodu || '';
      }
    } catch (err) {}
    return '';
  });
  
  const [jobData, setJobData] = useState(() => {
    try {
      const saved = localStorage.getItem('jobPassportQuery');
      if (saved) {
        const data = JSON.parse(saved);
        return data.jobData || null;
      }
    } catch (err) {}
    return null;
  });
  
  const [cardPositions, setCardPositions] = useState(() => {
    try {
      const saved = localStorage.getItem('jobPassportQuery');
      if (saved) {
        const data = JSON.parse(saved);
        return data.positions || {};
      }
    } catch (err) {}
    return {};
  });
  
  const [customColors, setCustomColors] = useState(() => {
    try {
      const saved = localStorage.getItem('jobPassportQuery');
      if (saved) {
        const data = JSON.parse(saved);
        return data.colors || {};
      }
    } catch (err) {}
    return {};
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [draggedSlot, setDraggedSlot] = useState(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [selectedUnitForColor, setSelectedUnitForColor] = useState(null);
  const [tempColor, setTempColor] = useState('#808080');
  const [tempIsMetallic, setTempIsMetallic] = useState(false);

  // Backend status check
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(`${BACKEND_URL}/api/health`, { timeout: 2000 });
        setBackendStatus('online');
      } catch (err) {
        setBackendStatus('offline');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);
  

  // Fetch job data
  const fetchJobData = async () => {
    if (!selectedMachine) {
      setError('Lütfen önce makina seçiniz');
      return;
    }

    if (!stokKodu.trim()) {
      setError('Lütfen stok kodunu girin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/job-data`, {
        stok_kodu: stokKodu
      });

      if (response.data.success) {
        const data = response.data.data;
        console.log("🎯 Backend'den gelen data:", data);
        console.log("🔧 DR Blade açıları:", data.dr_blade_angles);
        
        // WATER:100% formatını düzelt
        if (data.solvent_orani) {
          data.solvent_orani = data.solvent_orani.map(solvent => {
            if (solvent && /WATER\s*:?\s*100\s*%?/i.test(solvent)) {
              return 'WATER 100 : EAL 0%';
            }
            return solvent;
          });
        }
        
        // VARNISH'ler için default vizkozite set et
        if (!data.vizkozite) {
          data.vizkozite = [];
        }
        
        if (data.renk_siralama) {
          data.renk_siralama.forEach((renk, index) => {
            const solvent = data.solvent_orani?.[index] || '';
            const isVarnish = /VARNISH/i.test(renk) || /VARNISH/i.test(solvent);
            
            if (!data.vizkozite[index] || data.vizkozite[index] === '-') {
              if (isVarnish) {
                data.vizkozite[index] = '12 sn / 25 C';
              } else {
                data.vizkozite[index] = '3,1 sn / 20 C';
              }
            }
          });
        }
        
        setJobData(data);
        setBackendStatus('online');
        
        // Sorgu sonuçlarını localStorage'a kaydet
        localStorage.setItem('jobPassportQuery', JSON.stringify({
          machine: selectedMachine,
          stokKodu: stokKodu,
          jobData: data,
          positions: cardPositions,
          colors: customColors
        }));
        
        // Initial positions (FREE olanları hariç)
        const initialPositions = {};
        for (let i = 0; i < data.renk_siralama.length; i++) {
          const renk = data.renk_siralama[i];
          if (renk && renk.trim() !== '' && renk !== '-' && !renk.toLowerCase().includes('free')) {
            initialPositions[i + 1] = i;
          }
        }
        setCardPositions(initialPositions);
      } else {
        setError(response.data.error || 'Veri bulunamadı');
        setJobData(null);
      }
    } catch (err) {
      console.error('API hatası:', err);
      setError('Backend çalışmıyor. Lütfen start_backend.bat çalıştırın.');
      setJobData(null);
      setBackendStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchJobData();
  };

  // Sorguyu temizle
  const handleClearQuery = () => {
    setJobData(null);
    setStokKodu('');
    setSelectedMachine('');
    setCardPositions({});
    setCustomColors({});
    setError('');
    localStorage.removeItem('jobPassportQuery');
  };

  // Drag & Drop handlers
  const handleDragStart = (slotNumber) => setDraggedSlot(slotNumber);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetSlot) => {
    if (draggedSlot === null || draggedSlot === targetSlot) {
      setDraggedSlot(null);
      return;
    }

    const newPositions = { ...cardPositions };
    const draggedUnitIndex = newPositions[draggedSlot];
    const targetUnitIndex = newPositions[targetSlot];
    
    if (draggedUnitIndex !== undefined && targetUnitIndex !== undefined) {
      newPositions[draggedSlot] = targetUnitIndex;
      newPositions[targetSlot] = draggedUnitIndex;
    } else if (draggedUnitIndex !== undefined && targetUnitIndex === undefined) {
      delete newPositions[draggedSlot];
      newPositions[targetSlot] = draggedUnitIndex;
    }
    
    setCardPositions(newPositions);
    setDraggedSlot(null);
  };
  const handleDragEnd = () => setDraggedSlot(null);

  // Kart silme
  const handleDeleteCard = (slotNumber) => {
    if (window.confirm('Bu kartı silmek istediğinizden emin misiniz?')) {
      const newPositions = { ...cardPositions };
      delete newPositions[slotNumber];
      setCardPositions(newPositions);
    }
  };

  // Adjustments
  const handleAdjustVizkozite = (unitIndex, direction) => {
    const result = adjustVizkozite(jobData, unitIndex, direction);
    if (result) setJobData(result);
  };
  
  const handleAdjustVizkoziteSeconds = (unitIndex, direction) => {
    const result = adjustVizkoziteSeconds(jobData, unitIndex, direction);
    if (result) setJobData(result);
  };
  
  const handleAdjustVizkoziteTemperature = (unitIndex, direction) => {
    const result = adjustVizkoziteTemperature(jobData, unitIndex, direction);
    if (result) setJobData(result);
  };

  const handleAdjustSolvent = (unitIndex, direction) => {
    const result = adjustSolvent(jobData, unitIndex, direction);
    if (result) setJobData(result);
  };

  // Render helpers
  const totalUnits = selectedMachine ? MACHINE_CONFIG[selectedMachine].units : 0;
  
  // Aktif üniteleri bul (dolu kartlar)
  const getActiveUnits = () => {
    if (!jobData) return [];
    const active = [];
    Object.entries(cardPositions).forEach(([slotNumber, unitIndex]) => {
      const renk = jobData.renk_siralama?.[unitIndex];
      if (renk && renk !== '-') {
        active.push({
          slotNumber: parseInt(slotNumber),
          unitIndex,
          renk,
          silindir: jobData.silindir_kodlari?.[unitIndex] || '-',
          murekkep: jobData.murekkep_kodlari?.[unitIndex] || '-',
          vizkozite: jobData.vizkozite?.[unitIndex] || '3,1 sn / 20 C',
          solvent: jobData.solvent_orani?.[unitIndex] || '-',
          medium: jobData.medium_kodlari?.[unitIndex] || '-',
          toner: jobData.toner_kodlari?.[unitIndex] || '-',
          drBlade: '-', // Select'ten okunacak
          drBladeAngle: '-' // Select/Input'tan okunacak
        });
      }
    });
    return active.sort((a, b) => b.slotNumber - a.slotNumber); // Büyükten küçüğe
  };

  return (
    <>
      {/* Color Picker Modal */}
      {colorPickerOpen && (
        <ColorPickerModal
          tempColor={tempColor}
          setTempColor={setTempColor}
          tempIsMetallic={tempIsMetallic}
          setTempIsMetallic={setTempIsMetallic}
          onClose={() => setColorPickerOpen(false)}
          onApply={() => {
            if (selectedUnitForColor !== null) {
              setCustomColors(prev => ({
                ...prev,
                [selectedUnitForColor]: { color: tempColor, isMetallic: tempIsMetallic }
              }));
            }
            setColorPickerOpen(false);
          }}
          lightenColor={lightenColor}
        />
      )}

      {/* Responsive CSS */}
      <style>{`
        .job-passport-container {
          width: max-content;
          margin: 0 auto;
          transform-origin: top center;
        }

        /* Tam ekran (1920+ px) */
        @media (min-width: 1920px) {
          .job-passport-container {
            transform: scale(1);
          }
        }

        /* Orta ekran (1600-1919px) */
        @media (max-width: 1919px) {
          .job-passport-container {
            transform: scale(0.80);
          }
        }

        /* Küçük ekran (1366-1599px) */
        @media (max-width: 1599px) {
          .job-passport-container {
            transform: scale(0.68);
          }
        }

        /* Çok küçük ekran (1366px altı) */
        @media (max-width: 1365px) {
          .job-passport-container {
            transform: scale(0.57);
          }
        }

        /* Print için dark mode'u kapat */
        @media print {
          .job-passport-page {
            background: white !important;
          }
          .printable-content {
            background: white !important;
          }
          .data-category {
            background: rgba(255, 255, 255, 0.6) !important;
            border: 1px solid rgba(0, 0, 0, 0.1) !important;
          }
          .category-label, .category-value {
            color: #333 !important;
          }
          .print-title h2 {
            color: #1f2937 !important;
          }
          
          /* Checkbox label'larını düzelt - checkbox olmadan ortalansın */
          .checkbox-label {
            justify-content: center !important;
            gap: 0 !important;
          }
          
          /* DR Blade Select'leri düz metin gibi göster */
          .blade-select, .blade-angle-select {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            text-align: center !important;
            font-weight: 600 !important;
          }
          
          /* Blade angle input'ları gizle, sadece değeri göster */
          .blade-angle-input {
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            text-align: center !important;
          }
        }
      `}</style>

      <div className={`job-passport-page min-h-screen w-full ${
        isLiquidGlass 
          ? 'liquid-glass' 
          : isDark 
            ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
            : 'bg-gradient-to-br from-slate-50 to-blue-50'
      }`}>
        {/* Header */}
        <div className={`${
          isLiquidGlass 
            ? 'glass-card' 
            : isDark
              ? 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700'
        } text-white shadow-2xl no-print`}>
          <div className="w-full px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">EGEM Makine Takip Sistemi</h1>
                <p className="text-indigo-200 mt-1">İş Pasaportu Sorgulama Sistemi</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  backendStatus === 'online' ? 'bg-green-400' :
                  backendStatus === 'offline' ? 'bg-red-400' :
                  'bg-yellow-400 animate-pulse'
                }`} />
                <span className="text-sm">
                  {backendStatus === 'online' ? 'Backend Çalışıyor' :
                   backendStatus === 'offline' ? 'Backend Çalışmıyor' :
                   'Kontrol Ediliyor...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="w-full px-8 py-8 no-print">
          {backendStatus === 'offline' && (
            <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-6 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-red-500 text-2xl">⚠️</div>
                <div>
                  <h3 className="text-lg font-bold text-red-800 mb-2">Backend Çalışmıyor</h3>
                  <p className="text-red-700 mb-2">
                    Job Passport backend servisi çalışmıyor. Lütfen başlatın:
                  </p>
                  <div className="bg-red-900/10 p-3 rounded font-mono text-sm text-red-800">
                    cd bobst-dashboard/backend<br/>
                    start_backend.bat
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSearch} className={`${
            isLiquidGlass 
              ? 'glass-card' 
              : isDark
                ? 'bg-gray-800'
                : 'bg-white'
          } rounded-xl shadow-lg p-8 max-w-4xl mx-auto`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Makina Seçin</label>
                <select
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="">Seçiniz</option>
                  {Object.entries(MACHINE_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Stok Kodu</label>
                <input
                  type="text"
                  value={stokKodu}
                  onChange={(e) => setStokKodu(e.target.value)}
                  placeholder="Örn: MGJTI80661"
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all ${
                    isDark 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="flex items-end gap-3">
                <button
                  type="submit"
                  disabled={loading || backendStatus === 'offline'}
                  className="flex-1 px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Yükleniyor...' : '🔍 Sorgula'}
                </button>
                
                {jobData && (
                  <button
                    type="button"
                    onClick={handleClearQuery}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg hover:from-red-600 hover:to-rose-700 transition-all font-semibold shadow-md flex items-center gap-2"
                    title="Sorguyu temizle"
                  >
                    ✕ Kapat
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className={`mt-4 p-4 border rounded-lg ${
                isDark 
                  ? 'bg-red-900/20 border-red-700 text-red-400' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Results */}
        {jobData && (
          <div className="w-full px-8 pb-8">
            <div className={`printable-content rounded-xl shadow-lg ${
              isLiquidGlass ? 'glass-card' : isDark ? 'bg-gray-800' : 'bg-white'
            }`} style={{ maxWidth: '100%', width: '100%' }}>
              {/* Title */}
              <div className={`print-title text-center py-6 ${
                isLiquidGlass ? '' : isDark ? 'bg-gray-800' : 'bg-white'
              }`}>
                <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {MACHINE_CONFIG[selectedMachine]?.name} - {jobData.is_adi || stokKodu}
                </h2>
              </div>

              {/* Main Content */}
              <div className="w-full">
                <div className="job-passport-container" style={{ transformOrigin: 'top center', transform: 'scale(1)', transition: 'transform 0.3s ease' }}>
                  
                  {/* Printing Units Row */}
                  <div className="printing-units-row" style={{ transformOrigin: 'top center' }}>
                    <div className="flex justify-center items-end" style={{ gap: '3px', marginBottom: '20px' }}>
                      {Array.from({ length: totalUnits }, (_, i) => totalUnits - i).map(unitNumber => (
                        <div key={unitNumber} className="flex flex-col items-center" style={{ width: '180px', height: 'auto', position: 'relative' }}>
                          {/* Ünite Numarası */}
                          <div style={{
                            position: 'absolute',
                            top: '170px',
                            left: '10%',
                            transform: 'translateX(-50%)',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            color: '#FF3333',
                            textShadow: '0 1px 0 rgba(255,255,255,0.3), 0 -1px 0 rgba(0,0,0,0.7)',
                            opacity: 0.85,
                            zIndex: 5,
                            pointerEvents: 'none',
                            mixBlendMode: 'multiply'
                          }}>
                            {unitNumber}
                          </div>
                          <img 
                            src="/lpng/printingUnit.png" 
                            alt={`Unit ${unitNumber}`}
                            style={{ width: '180px', height: 'auto', objectFit: 'contain' }}
                          />
                        </div>
                      ))}
                      {/* Genel - Empty space */}
                      <div style={{ width: '180px' }} />
                    </div>

                    {/* Info Cards Row */}
                    <div className="flex justify-center" style={{ gap: '3px' }}>
                      {Array.from({ length: totalUnits }, (_, i) => totalUnits - i).map(slotNumber => {
                        const unitIndex = cardPositions[slotNumber];
                        const hasCard = unitIndex !== undefined;

                        if (hasCard) {
                          const renk = jobData.renk_siralama?.[unitIndex] || '-';
                          const silindir = jobData.silindir_kodlari?.[unitIndex] || '-';
                          const murekkep = jobData.murekkep_kodlari?.[unitIndex] || '-';
                          const solvent = jobData.solvent_orani?.[unitIndex] || '-';
                          const medium = jobData.medium_kodlari?.[unitIndex] || '-';
                          const toner = jobData.toner_kodlari?.[unitIndex] || '-';

                          // VARNISH kontrolü - renk VEYA solvent'te olabilir
                          const isVarnish = /VARNISH/i.test(renk) || /VARNISH/i.test(solvent);
                          
                          // Vizkozite değerini al - eğer VARNISH ise ve değer yoksa veya "-----" ise varsayılan değer kullan
                          let vizkozite = jobData.vizkozite?.[unitIndex] || '';
                          if (isVarnish && (!vizkozite || vizkozite === '-----' || vizkozite.trim() === '')) {
                            vizkozite = '25 sn / 20 C';
                            // jobData'yı güncelle
                            if (!jobData.vizkozite) {
                              jobData.vizkozite = [];
                            }
                            jobData.vizkozite[unitIndex] = vizkozite;
                          }

                          const solventRegex = /EAL\s*\d+\s*[;,]\s*EAC\s*\d+/i;
                          const waterRegex = /WATER\s*:?\s*\d+\s*%?\s*[;:,]?\s*(?:EAL\s*\d+\s*%?)?/i;
                          const varnishRegex = /VARNISH/i;
                          const hasSolventButtons = solventRegex.test(solvent) || waterRegex.test(solvent) || varnishRegex.test(solvent);

                          const customColorData = customColors[unitIndex];
                          const colorBarImage = renk && renk !== '-' 
                            ? createColorBar(renk.toLowerCase(), customColorData)
                            : null;

                          return (
                            <UnitCard
                              key={`slot-${slotNumber}`}
                              slotNumber={slotNumber}
                              unitIndex={unitIndex}
                              renk={renk}
                              silindir={silindir}
                              murekkep={murekkep}
                              vizkozite={vizkozite}
                              solvent={solvent}
                              medium={medium}
                              toner={toner}
                              isVarnish={isVarnish}
                              hasSolventButtons={hasSolventButtons}
                              colorBarImage={colorBarImage}
                              selectedMachine={selectedMachine}
                              customColors={customColors}
                              jobData={jobData}
                              onAdjustVizkozite={(dir) => handleAdjustVizkozite(unitIndex, dir)}
                              onAdjustVizkoziteSeconds={(dir) => handleAdjustVizkoziteSeconds(unitIndex, dir)}
                              onAdjustVizkoziteTemperature={(dir) => handleAdjustVizkoziteTemperature(unitIndex, dir)}
                              onAdjustSolvent={(dir) => handleAdjustSolvent(unitIndex, dir)}
                              onColorClick={() => {
                                const currentColor = customColors[unitIndex] || { color: '#808080', isMetallic: false };
                                setTempColor(currentColor.color);
                                setTempIsMetallic(currentColor.isMetallic);
                                setSelectedUnitForColor(unitIndex);
                                setColorPickerOpen(true);
                              }}
                              onDeleteCard={() => handleDeleteCard(slotNumber)}
                              onDragStart={() => handleDragStart(slotNumber)}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(slotNumber)}
                              onDragEnd={handleDragEnd}
                              isDragging={draggedSlot === slotNumber}
                              isDark={isDark}
                            />
                          );
                        } else {
                          return (
                            <EmptySlot
                              key={`slot-${slotNumber}`}
                              slotNumber={slotNumber}
                              onDragOver={handleDragOver}
                              onDrop={() => handleDrop(slotNumber)}
                            />
                          );
                        }
                      })}

                      {/* Genel Card */}
                      <GeneralCard jobData={jobData} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Print Buttons */}
              <div className="mt-8 pb-8 text-center flex justify-center gap-4 no-print">
                <button
                  onClick={() => printJobPassport('a4', selectedMachine)}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>A4 Yazdır</span>
                </button>
                <button
                  onClick={() => printJobPassport('a3', selectedMachine)}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                >
                  <span>🖨️</span>
                  <span>A3 Yazdır</span>
                </button>
              </div>

              {/* Tek Ünite Yazdırma Butonları */}
              <div className="mt-6 text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Tek Ünite Yazdır (A4 Dikey)</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {getActiveUnits().map(unit => (
                    <button
                      key={unit.slotNumber}
                      onClick={() => printSingleUnit(unit, unit.slotNumber, MACHINE_CONFIG[selectedMachine]?.name, jobData?.is_adi)}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm"
                    >
                      Ünite {unit.slotNumber}
                    </button>
                  ))}
                  
                  {/* Tümünü Yazdır Butonu */}
                  {getActiveUnits().length > 0 && (
                    <button
                      onClick={() => printAllUnits(getActiveUnits(), MACHINE_CONFIG[selectedMachine]?.name, jobData?.is_adi)}
                      className="px-8 py-2 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-sm border-2 border-orange-700"
                    >
                      🖨️ Tümünü Yazdır
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// Renk isminden border rengi al
const getColorCode = (colorName, customColors = {}, unitIndex) => {
  // Custom color varsa kullan
  if (customColors[unitIndex]?.color) {
    return customColors[unitIndex].color;
  }

  if (!colorName || colorName === '-') return '#dee2e6';

  const colorMap = {
    'black': '#2c2c2c', 'green': '#00b300', 'grey': '#808080', 'gray': '#808080',
    'yellow': '#FFFF00', 'cyan': '#0008e6', 'magenta': '#FF00FF', 'red': '#dc2626',
    'blue': '#2563eb', 'white': '#e0e0e0', 'orange': '#f97316', 'purple': '#9333ea',
    'pink': '#ec4899', 'brown': '#a16207', 'gold': '#FFD700', 'silver': '#C0C0C0', 
    'bronze': '#CD7F32', 'bronz': '#CD7F32'
  };

  const color = colorName.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (color.includes(key)) return value;
  }

  return '#dee2e6';
};

// UnitCard Component (basitleştirilmiş - detayları ayrı dosyaya taşınacak)
const UnitCard = ({ 
  slotNumber, unitIndex, renk, silindir, murekkep, vizkozite, solvent, medium, toner, 
  isVarnish, hasSolventButtons, colorBarImage, selectedMachine, customColors, jobData,
  onAdjustVizkozite, onAdjustVizkoziteSeconds, onAdjustVizkoziteTemperature, 
  onAdjustSolvent, onColorClick, onDeleteCard,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragging, isDark
}) => {
  const [holdInterval, setHoldInterval] = React.useState(null);

  const handleMouseDown = (direction, callback) => {
    callback(direction);
    const interval = setInterval(() => callback(direction), 120);
    setHoldInterval(interval);
  };

  const handleMouseUp = () => {
    if (holdInterval) {
      clearInterval(holdInterval);
      setHoldInterval(null);
    }
  };

  React.useEffect(() => {
    return () => {
      if (holdInterval) clearInterval(holdInterval);
    };
  }, [holdInterval]);

  // Renk çubuğu rengini border için al (custom color dahil)
  const borderColor = getColorCode(renk, customColors, unitIndex);
  
  // Debug log
  console.log(`🔍 UnitCard ${slotNumber} - jobData:`, jobData);
  console.log(`🔧 DR Blade açıları:`, jobData?.dr_blade_angles);

  return (
    <div 
      style={{
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        border: '2px solid #dee2e6',
        boxShadow: `inset 0 0 0 3px ${borderColor}`,
        borderRadius: '12px',
        padding: 0,
        width: '180px',
        minHeight: '300px',
        height: 'auto',
        textAlign: 'center',
        position: 'relative',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        cursor: 'grab',
        opacity: isDragging ? 0.5 : 1
      }}
      draggable="true"
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Color Bar */}
      {colorBarImage && (
        <div 
          style={{
            width: '100%',
            height: '35px',
            borderRadius: '10px 10px 0 0',
            flexShrink: 0,
            backgroundImage: `url('${colorBarImage}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            position: 'relative'
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onColorClick) onColorClick();
          }}
          title="Renk özelleştirmek için tıklayın"
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        />
      )}

      {/* Delete Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (onDeleteCard) onDeleteCard();
        }}
        className="no-print"
        style={{
          position: 'absolute',
          top: colorBarImage ? '40px' : '8px',
          right: '8px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '1px solid #ef4444',
          background: 'white',
          color: '#ef4444',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          padding: 0,
          lineHeight: 1,
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#ef4444';
          e.currentTarget.style.color = 'white';
          e.currentTarget.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'white';
          e.currentTarget.style.color = '#ef4444';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Kartı Sil"
      >
        ×
      </button>

      {/* Card Content */}
      <div style={{ padding: '0 20px 20px 20px', position: 'relative' }}>
        <div style={{ paddingTop: '12px', fontSize: '20px', fontWeight: '700', color: '#667eea', marginBottom: '12px' }}>
          Ünite {slotNumber}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <DataCategory label="Renk" value={renk} isDark={isDark} />
          <DataCategory label="Silindir" value={silindir} isDark={isDark} />
          <DataCategory label="Mürekkep" value={murekkep} isDark={isDark} />
          
          {/* Vizkozite with buttons */}
          {isVarnish ? (
            // VARNISH için iki ayrı kontrol: Saniye ve Derece (tek satırda gösterim)
            <div className="data-category" style={{ 
              background: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(255, 255, 255, 0.6)', 
              borderRadius: '8px', 
              padding: '8px', 
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)' 
            }}>
              {/* Başlık ve Butonlar */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {/* Saniye kontrol */}
                <button 
                  onMouseDown={() => handleMouseDown('down', onAdjustVizkoziteSeconds)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '18px', height: '18px', padding: 0,
                    border: '1px solid #3b82f6', borderRadius: '3px',
                    background: 'white', color: '#3b82f6',
                    fontSize: '10px', cursor: 'pointer',
                    flexShrink: 0, userSelect: 'none'
                  }}
                  title="Saniye azalt"
                >
                  ◄
                </button>
                <button 
                  onMouseDown={() => handleMouseDown('up', onAdjustVizkoziteSeconds)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '18px', height: '18px', padding: 0,
                    border: '1px solid #3b82f6', borderRadius: '3px',
                    background: 'white', color: '#3b82f6',
                    fontSize: '10px', cursor: 'pointer',
                    flexShrink: 0, userSelect: 'none'
                  }}
                  title="Saniye arttır"
                >
                  ►
                </button>
                
                <div className="category-label" style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#9ca3af' : '#555', textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: '4px', marginRight: '4px' }}>
                  Vizkozite
                </div>
                
                {/* Derece kontrol */}
                <button 
                  onMouseDown={() => handleMouseDown('down', onAdjustVizkoziteTemperature)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '18px', height: '18px', padding: 0,
                    border: '1px solid #ef4444', borderRadius: '3px',
                    background: 'white', color: '#ef4444',
                    fontSize: '10px', cursor: 'pointer',
                    flexShrink: 0, userSelect: 'none'
                  }}
                  title="Derece azalt"
                >
                  ◄
                </button>
                <button 
                  onMouseDown={() => handleMouseDown('up', onAdjustVizkoziteTemperature)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '18px', height: '18px', padding: 0,
                    border: '1px solid #ef4444', borderRadius: '3px',
                    background: 'white', color: '#ef4444',
                    fontSize: '10px', cursor: 'pointer',
                    flexShrink: 0, userSelect: 'none'
                  }}
                  title="Derece arttır"
                >
                  ►
                </button>
              </div>
              
              {/* Değer - tek satırda */}
              <div className="category-value" style={{ fontSize: '13px', color: isDark ? '#e5e7eb' : '#333', fontWeight: '500', textAlign: 'center' }}>
                {vizkozite}
              </div>
            </div>
          ) : (
            // Normal vizkozite (tek kontrol)
            <div className="data-category" style={{ 
              background: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(255, 255, 255, 0.6)', 
              borderRadius: '8px', 
              padding: '8px', 
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)' 
            }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <button 
                onMouseDown={() => handleMouseDown('down', onAdjustVizkozite)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="no-print"
                style={{
                  width: '20px',
                  height: '20px',
                  padding: 0,
                  border: '1px solid #667eea',
                  borderRadius: '4px',
                  background: 'white',
                  color: '#667eea',
                  fontSize: '12px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  userSelect: 'none'
                }}
              >
                ◄
              </button>
                <div className="category-label" style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#9ca3af' : '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Vizkozite
              </div>
              <button 
                onMouseDown={() => handleMouseDown('up', onAdjustVizkozite)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="no-print"
                style={{
                  width: '20px',
                  height: '20px',
                  padding: 0,
                  border: '1px solid #667eea',
                  borderRadius: '4px',
                  background: 'white',
                  color: '#667eea',
                  fontSize: '12px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  userSelect: 'none'
                }}
              >
                ►
              </button>
            </div>
              <div className="category-value" style={{ fontSize: '13px', color: isDark ? '#e5e7eb' : '#333', fontWeight: '500' }}>{vizkozite}</div>
          </div>
          )}
          
          {/* Solvent with buttons */}
          <div className="data-category" style={{ 
            background: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(255, 255, 255, 0.6)', 
            borderRadius: '8px', 
            padding: '8px', 
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginBottom: '4px', color: isDark ? '#9ca3af' : '#555' }}>
              {hasSolventButtons && (
                <button 
                  onMouseDown={() => handleMouseDown('down', onAdjustSolvent)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '20px',
                    height: '20px',
                    padding: 0,
                    border: '1px solid #667eea',
                    borderRadius: '4px',
                    background: 'white',
                    color: '#667eea',
                    fontSize: '12px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    userSelect: 'none'
                  }}
                >
                  ◄
                </button>
              )}
              <div className="category-label" style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#9ca3af' : '#555', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Solvent
              </div>
              {hasSolventButtons && (
                <button 
                  onMouseDown={() => handleMouseDown('up', onAdjustSolvent)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="no-print"
                  style={{
                    width: '20px',
                    height: '20px',
                    padding: 0,
                    border: '1px solid #667eea',
                    borderRadius: '4px',
                    background: 'white',
                    color: '#667eea',
                    fontSize: '12px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    userSelect: 'none'
                  }}
                >
                  ►
                </button>
              )}
            </div>
            <div className="category-value" style={{ fontSize: '13px', color: isDark ? '#e5e7eb' : '#333', fontWeight: '500' }}>{solvent}</div>
          </div>

          <DataCategory label="Medium" value={medium} isDark={isDark} />
          <DataCategory label="Toner" value={toner} formatToner={true} isDark={isDark} />
          
          {/* DR Blade */}
          <div className="data-category" style={{ 
            background: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(255, 255, 255, 0.6)', 
            borderRadius: '8px', 
            padding: '8px', 
            border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)' 
          }}>
            <div className="category-label" style={{ fontSize: '11px', fontWeight: '600', color: isDark ? '#9ca3af' : '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              DR. Blade
            </div>
            <div className="category-value" style={{ fontSize: '13px', color: isDark ? '#e5e7eb' : '#333', fontWeight: '500' }}>
              <select className="blade-select" style={{ 
                width: '100%', 
                padding: '6px 8px', 
                border: isDark ? '1px solid #4b5563' : '1px solid #ddd', 
                borderRadius: '4px', 
                background: isDark ? '#374151' : 'white', 
                fontSize: '12px', 
                color: isDark ? '#e5e7eb' : '#333' 
              }}>
                <option value="">Seçiniz</option>
                <option value="DEATWYLER">DAETWYLER</option>
                <option value="SWEED CUT">SWEED CUT</option>
                <option value="TKM">TKM</option>
              </select>
            </div>
          </div>

          {/* DR Blade Angle */}
          <div className="data-category" style={{ background: 'rgba(255, 255, 255, 0.6)', borderRadius: '8px', padding: '8px', border: '1px solid rgba(0, 0, 0, 0.1)' }}>
            <div className="category-label" style={{ fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              DR. Blade Açısı
            </div>
            <div className="category-value" style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
              {selectedMachine === 'lemanic1' ? (
                <div className="blade-angle-container" style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>V:</span>
                    <input 
                      type="number" 
                      placeholder="0"
                      min="0"
                      max="60"
                      className="blade-angle-input"
                      defaultValue={jobData?.dr_blade_angles?.V || ''}
                      onInput={(e) => {
                        const val = parseInt(e.target.value);
                        if (val < 0) e.target.value = 0;
                        if (val > 60) e.target.value = 60;
                      }}
                      style={{ width: '45px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', fontSize: '12px', color: '#333', textAlign: 'center' }}
                    />
                  </div>
                  <span className="blade-separator" style={{ fontWeight: 'bold', color: '#666', fontSize: '14px' }}>-</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontWeight: '600' }}>H:</span>
                    <input 
                      type="number" 
                      placeholder="10"
                      min="10"
                      max="40"
                      className="blade-angle-input"
                      defaultValue={jobData?.dr_blade_angles?.H || ''}
                      onInput={(e) => {
                        const val = parseInt(e.target.value);
                        if (val < 10) e.target.value = 10;
                        if (val > 40) e.target.value = 40;
                      }}
                      style={{ width: '45px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', fontSize: '12px', color: '#333', textAlign: 'center' }}
                    />
                  </div>
                </div>
              ) : (
                <div className="blade-angle-container" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <select className="blade-angle-select" style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', fontSize: '12px', color: '#333' }}>
                    <option value="">X</option>
                    {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="blade-separator" style={{ fontWeight: 'bold', color: '#666', fontSize: '14px' }}>-</span>
                  <select className="blade-angle-select" style={{ flex: 1, padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', background: 'white', fontSize: '12px', color: '#333' }}>
                    <option value="">Y</option>
                    {['A','B','C','D','E'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Empty Slot Component
const EmptySlot = ({ slotNumber, onDragOver, onDrop }) => (
  <div 
    style={{
      width: '180px',
      minHeight: '300px',
      height: 'auto',
      border: '2px dashed #ccc',
      borderRadius: '12px',
      background: 'rgba(0, 0, 0, 0.02)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      padding: '20px'
    }}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <div style={{ fontSize: '20px', fontWeight: '700', color: '#999', marginBottom: '20px', textAlign: 'center' }}>
      Ünite {slotNumber}
    </div>
    <div style={{ color: '#bbb', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
      Boş Slot
    </div>
  </div>
);

// General Card Component
const GeneralCard = ({ jobData }) => (
  <div style={{
    background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
    border: '2px solid #2196f3',
    width: '180px',
    minHeight: '300px',
    height: 'auto',
    padding: '20px',
    borderRadius: '12px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start'
  }}>
    <div style={{ fontSize: '20px', fontWeight: '700', color: '#667eea', marginBottom: '12px' }}>
      Genel
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#666' }}>
      <DataCategory label="İşin Adı" value={jobData.is_adi || '-'} />
      <DataCategory label="Silindir Çevresi" value={jobData.silindir_cevresi ? jobData.silindir_cevresi + ' mm' : '-'} />
      <DataCategory label="Karton" value={jobData.karton || '-'} />
    </div>
  </div>
);

// Color Picker Modal Component
const ColorPickerModal = ({ tempColor, setTempColor, tempIsMetallic, setTempIsMetallic, onClose, onApply, lightenColor }) => (
  <div 
    className="no-print"
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}
    onClick={onClose}
  >
    <div 
      style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        minWidth: '400px',
        maxWidth: '500px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#667eea', marginBottom: '24px', textAlign: 'center' }}>
        Renk Özelleştir
      </h2>
      
      {/* Color Picker */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '8px' }}>
          Renk Seçin
        </label>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="color" 
            value={tempColor}
            onChange={(e) => setTempColor(e.target.value)}
            style={{
              width: '80px',
              height: '50px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          />
          <input 
            type="text" 
            value={tempColor}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                setTempColor(val);
              }
            }}
            placeholder="#000000"
            style={{
              flex: 1,
              padding: '12px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              fontSize: '16px',
              fontFamily: 'monospace'
            }}
          />
        </div>
      </div>

      {/* Metallic Toggle */}
      <div className="no-print" style={{ marginBottom: '32px' }}>
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={tempIsMetallic}
            onChange={(e) => setTempIsMetallic(e.target.checked)}
            style={{
              width: '24px',
              height: '24px',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '16px', fontWeight: '600', color: '#333' }}>
            Metalik Efekt
          </span>
        </label>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '8px' }}>
          Önizleme
        </label>
        <div style={{
          width: '100%',
          height: '60px',
          borderRadius: '8px',
          border: '2px solid #ddd',
          background: tempIsMetallic 
            ? `linear-gradient(90deg, ${tempColor}, ${lightenColor(tempColor, 60)}, ${tempColor})`
            : tempColor
        }} />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            padding: '12px 24px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#555',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
        >
          İptal
        </button>
        <button
          onClick={onApply}
          style={{
            flex: 1,
            padding: '12px 24px',
            background: 'linear-gradient(90deg, #667eea, #764ba2)',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            color: 'white',
            cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Uygula
        </button>
      </div>
    </div>
  </div>
);

export default JobPassportViewer;

