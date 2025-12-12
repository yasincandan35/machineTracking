import React, { useRef, useState, useEffect } from 'react';
import { Settings, AlertTriangle, MoreHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { useMachineScreen } from '../context';

const StopReasonCategories = ({ selectedCategory, setSelectedCategory, handleStopReason }) => {
  // API'den gelen veriler
  const { machineApi } = useMachineScreen();
  const [stopReasons, setStopReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStopReasons();
  }, [machineApi]);

  const applyFallbackData = () => {
    setStopReasons({
      unwinder: {
        displayName: 'Unwinder',
        reasons: [
          { id: 1, name: 'Bobbin Bekleme', sortOrder: 1 },
          { id: 2, name: 'Bobbin Değişimi', sortOrder: 2 },
          { id: 3, name: 'Bobbin Hatası', sortOrder: 3 }
        ]
      },
      infeed: {
        displayName: 'Infeed',
        reasons: [
          { id: 4, name: 'Kağıt Bekleme', sortOrder: 1 },
          { id: 5, name: 'Kağıt Değişimi', sortOrder: 2 },
          { id: 6, name: 'Kağıt Sıkışması', sortOrder: 3 }
        ]
      }
    });
  };

  const loadStopReasons = async () => {
    try {
      setLoading(true);

      const { data: categories } = await machineApi.get('/stoppagereasons/categories');

      const formattedData = {};

      for (const category of categories) {
        if ((category.categoryCode && category.categoryCode.toLowerCase() === 'tanimsiz') ||
            (category.displayName && category.displayName.trim().toLowerCase() === 'tanımsız')) {
          continue;
        }

        const { data: reasons } = await machineApi.get(`/stoppagereasons/reasons/${category.id}`);

        const visibleReasons = Array.isArray(reasons)
          ? reasons.filter(r => r.id !== 35 && (r.reasonName || '').trim().toLowerCase() !== 'tanımsız')
          : [];

        formattedData[category.categoryCode] = {
          id: category.id,
          displayName: category.displayName,
          reasons: visibleReasons.map(r => ({
            id: r.id,
            name: r.reasonName,
            sortOrder: r.sortOrder,
          })),
        };
      }

      setStopReasons(formattedData);
      setError(null);
    } catch (error) {
      console.error('Duruş sebepleri yüklenemedi:', error);
      setError('Duruş sebepleri yüklenemedi');
      applyFallbackData();
    } finally {
      setLoading(false);
    }
  };

  // Dokunmatik scroll için state'ler
  const [isScrolling, setIsScrolling] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef(null);
  const dragDistanceRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [tappedCategory, setTappedCategory] = useState(null);
  const [pressedReasonId, setPressedReasonId] = useState(null);

  // Touch/Mouse event handlers
  const handleStart = (e) => {
    setIsScrolling(true);
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setStartY(clientY);
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
    dragDistanceRef.current = 0;
    isDraggingRef.current = false;
  };

  const handleMove = (e) => {
    if (!isScrolling) return;
    e.preventDefault();
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTop + deltaY;
    }
    // Eğer drag mesafesi belirli eşiği aşarsa, tıklama toggle çalışmasın
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(deltaY));
    if (dragDistanceRef.current > 6) {
      isDraggingRef.current = true;
    }
  };

  const handleEnd = () => {
    setIsScrolling(false);
    // Drag bittiğinde kısa süre sonra resetle
    setTimeout(() => {
      isDraggingRef.current = false;
      dragDistanceRef.current = 0;
    }, 0);
  };

  // Loading durumu
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Duruş sebepleri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error durumu
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
          <button 
            onClick={loadStopReasons}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  // Kategori listesi
  const categories = Object.keys(stopReasons).map(key => ({
    key,
    name: stopReasons[key].displayName,
    icon: getCategoryIcon(key),
    reasons: stopReasons[key].reasons
  }));

  // Kategori ikonları
  function getCategoryIcon(categoryKey) {
    const iconMap = {
      unwinder: Settings,
      infeed: Settings,
      printingUnit1: AlertTriangle,
      printingUnit2: AlertTriangle,
      printingUnit3: AlertTriangle,
      printingUnit4: AlertTriangle,
      printingUnit5: AlertTriangle,
      printingUnit6: AlertTriangle,
      printingUnit7: AlertTriangle,
      printingUnit8: AlertTriangle,
      printingUnit9: AlertTriangle,
      printingUnit10: AlertTriangle,
      printingUnit11: AlertTriangle,
      printingUnit12: AlertTriangle,
      qualityControl: AlertTriangle,
      loopControl: Settings,
      dieCutterCreaser: AlertTriangle
    };
    return iconMap[categoryKey] || Settings;
  }

  // Duruş sebebi seçildiğinde - SEBEP ID VE ADI GÖNDER
  const handleReasonClick = (reason) => {
    // Sebep ID'si ve adını gönder
    handleStopReason({
      id: reason.id,
      name: reason.name,
      categoryId: stopReasons[selectedCategory]?.id
    });
  };

  // Kategori seçildiğinde
  const handleCategoryClick = (categoryKey) => {
    // Scroll/drag sırasında toggle etme
    if (isDraggingRef.current) return;
    
    // Tıklama efekti için
    setTappedCategory(categoryKey);
    setTimeout(() => setTappedCategory(null), 300);
    
    setSelectedCategory(selectedCategory === categoryKey ? null : categoryKey);
  };

  // Mobil kontrolü
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  return (
    <div 
      ref={scrollRef}
      className={selectedCategory ? 'category-selected' : 'category-not-selected'}
      style={isMobile ? {
        // Mobilde inline style'ları kaldır, CSS kontrol etsin
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden'
      } : {
        // PC'de grid layout
        display: 'grid', 
        gridTemplateColumns: '320px 1fr',
        gap: '1rem',
        alignItems: 'stretch',
        height: '55vh',
        maxHeight: '55vh',
        overflow: 'hidden'
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseMove={isScrolling ? handleMove : undefined}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      {/* Sol kolon: Kategori listesi */}
      <div style={isMobile ? {
        // Mobilde CSS kontrol etsin
        backgroundColor: 'rgba(51, 65, 85, 0.3)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '10px',
        padding: '0.5rem'
      } : {
        // PC'de normal
        backgroundColor: 'rgba(51, 65, 85, 0.3)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '14px',
        padding: '0.75rem',
        height: '100%',
        overflowY: 'auto'
      }} className="no-scrollbar">
      {categories.map((category) => {
        const IconComponent = category.icon;
          const isSelected = selectedCategory === category.key;
        return (
            <div key={category.key}
              onClick={() => handleCategoryClick(category.key)}
              className={tappedCategory === category.key ? 'category-tap-effect' : ''}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.5rem',
                borderRadius: '10px',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(59,130,246,0.18)' : 'transparent',
                border: isSelected ? '1px solid rgba(59,130,246,0.55)' : '1px solid rgba(148,163,184,0.25)',
                boxShadow: isSelected ? 'inset 0 0 0 1px rgba(59,130,246,0.25)' : 'none',
                transition: 'transform 0.1s ease, background-color 0.1s ease'
              }}
            >
              <div style={{
                width: '36px', height: '36px',
                backgroundColor: 'rgba(51,65,85,0.25)',
                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <IconComponent size={18} color={isSelected ? '#93c5fd' : '#f8fafc'} />
              </div>
              <div style={{ color: '#f8fafc', fontWeight: isSelected ? 700 : 600 }}>
                {category.name}
              </div>
            </div>
          );
        })}
            </div>
            
      {/* Sağ kolon: Seçilen kategorinin sebepleri */}
            <div style={isMobile ? {
        // Mobilde CSS kontrol etsin
        backgroundColor: 'rgba(51, 65, 85, 0.3)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '10px',
        padding: '0.5rem'
      } : {
        // PC'de normal
        backgroundColor: 'rgba(51, 65, 85, 0.3)',
        border: '1px solid rgba(148,163,184,0.2)',
        borderRadius: '14px',
        padding: '1rem',
        height: '100%',
        overflowY: 'auto'
      }} className="no-scrollbar">
        {selectedCategory ? (
          (() => {
            const active = categories.find(c => c.key === selectedCategory);
            const reasons = active?.reasons || [];
            return (
              <div className="fade-in-up" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                {reasons.map((reason, idx) => (
                <button
                  key={reason.id}
                    className="fade-in-up"
                  style={{
                      padding: '1rem 1.1rem',
                      backgroundColor: pressedReasonId === reason.id ? 'rgba(59,130,246,0.25)' : 'rgba(51, 65, 85, 0.6)',
                      border: pressedReasonId === reason.id ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(148, 163, 184, 0.35)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '1rem',
                      fontWeight: 600,
                    textAlign: 'left',
                      transition: 'background 0.08s ease, border-color 0.08s ease, transform 0.08s ease',
                      animationDelay: `${idx * 50}ms`,
                      animationFillMode: 'both',
                      willChange: 'transform, opacity'
                  }}
                    onTouchStart={() => setPressedReasonId(reason.id)}
                    onTouchEnd={() => setPressedReasonId(null)}
                    onTouchCancel={() => setPressedReasonId(null)}
                    onMouseDown={() => setPressedReasonId(reason.id)}
                    onMouseUp={() => setPressedReasonId(null)}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.55)';
                  }}
                  onMouseLeave={(e) => {
                    setPressedReasonId(null);
                    e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.35)';
                  }}
                  onClick={() => handleReasonClick(reason)}
                >
                  {reason.name}
                </button>
              ))}
            </div>
            );
          })()
        ) : (
          <div style={{
            height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#cbd5e1', fontSize: '1rem', fontWeight: 600,
            textAlign: 'center'
          }}>
            Lütfen bir kategori seçin
          </div>
        )}
      </div>
    </div>
  );
};

export default StopReasonCategories; 