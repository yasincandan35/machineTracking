import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useCardStyle } from '../../../hooks/useCardStyle';
import { api } from '../../../utils/api';

export default function ShiftOperatorsInfoCard({ style, currentLanguage = 'tr', selectedMachine = null }) {
  const cardStyle = useCardStyle(style, '140px');
  const [currentShift, setCurrentShift] = useState(null);
  const [adjacentShifts, setAdjacentShifts] = useState({ previous: null, next: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShiftData = async () => {
      // selectedMachine yoksa veya tableName yoksa veri çekme
      if (!selectedMachine || !selectedMachine.tableName) {
        setLoading(false);
        setCurrentShift(null);
        setAdjacentShifts({ previous: null, next: null });
        return;
      }

      try {
        // selectedMachine bir obje ise tableName'i al
        const machine = selectedMachine.tableName;
        const [currentResponse, adjacentResponse] = await Promise.all([
          api.get('/shiftmanagement/current', {
            params: { machine }
          }),
          api.get('/shiftmanagement/adjacent-shifts', {
            params: { machine }
          })
        ]);

        if (currentResponse.data?.success && currentResponse.data?.data) {
          setCurrentShift(currentResponse.data.data);
        } else {
          setCurrentShift(null);
        }

        if (adjacentResponse.data?.success) {
          setAdjacentShifts({
            previous: adjacentResponse.data.previousShift,
            next: adjacentResponse.data.nextShift
          });
        }
      } catch (error) {
        console.warn('Vardiya bilgisi alınamadı:', error);
        setCurrentShift(null);
        setAdjacentShifts({ previous: null, next: null });
      } finally {
        setLoading(false);
      }
    };

    fetchShiftData();
    const interval = setInterval(fetchShiftData, 60000); // Her 1 dakikada bir güncelle

    return () => clearInterval(interval);
  }, [selectedMachine]);

  if (loading) {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-gray-500 dark:text-gray-400">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!currentShift) {
    return (
      <div className={cardStyle.className} style={cardStyle.style}>
        <div className="flex flex-col items-center justify-center h-full gap-2">
          <User size={32} className="text-gray-400 dark:text-gray-500" />
          <div className="text-sm text-gray-500 dark:text-gray-400">Aktif vardiya yok</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cardStyle.className} style={{ ...cardStyle.style, overflow: 'hidden' }}>
      <div className="flex flex-col h-full" style={{ minHeight: 0, overflow: 'hidden' }}>
        <h2 className="text-sm font-semibold mb-1.5" style={{ lineHeight: '1.2', flexShrink: 0 }}>Vardiya Operatörleri</h2>
        
        <div className="flex items-center justify-between gap-1 flex-1 relative" style={{ minHeight: 0, overflow: 'hidden' }}>
          {/* Önceki Vardiya - Sol, Silik, Arkada */}
          <div className="flex-1 flex flex-col items-center gap-0.5 opacity-30 scale-90 z-10 relative" style={{ flexShrink: 0 }}>
            <div 
              className="w-8 h-8 rounded-full bg-slate-500 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold"
              style={{ flexShrink: 0 }}
            >
              {adjacentShifts.previous?.employeeName ? 
                adjacentShifts.previous.employeeName.charAt(0).toUpperCase() : 
                <User size={14} />
              }
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 text-center font-medium leading-tight" style={{ lineHeight: '1.1' }}>
              {adjacentShifts.previous?.employeeName || 'Yok'}
            </div>
            {adjacentShifts.previous && (
              <>
                <div className="text-[8px] text-gray-400 dark:text-gray-500 text-center leading-tight font-medium" style={{ lineHeight: '1' }}>
                  {adjacentShifts.previous.dayName || adjacentShifts.previous.shiftDate}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-500 text-center leading-tight" style={{ lineHeight: '1' }}>
                  {adjacentShifts.previous.startTime} - {adjacentShifts.previous.endTime}
                </div>
              </>
            )}
          </div>

          {/* Şu Anki Vardiya - Orta, Önde */}
          <div className="flex-[1.3] flex flex-col items-center gap-0.5 z-30 relative" style={{ flexShrink: 0 }}>
            <div 
              className="w-11 h-11 rounded-full bg-slate-500 dark:bg-slate-600 flex items-center justify-center text-white text-sm font-bold border-2 shadow-lg"
              style={{
                borderColor: currentShift.color || '#3b82f6',
                boxShadow: `0 0 10px ${currentShift.color || '#3b82f6'}40`,
                flexShrink: 0
              }}
            >
              {currentShift.employeeName ? 
                currentShift.employeeName.charAt(0).toUpperCase() : 
                <User size={18} />
              }
            </div>
            <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 text-center leading-tight" style={{ lineHeight: '1.1' }}>
              {currentShift.employeeName || 'Bilinmiyor'}
            </div>
            <div className="text-[8px] text-gray-400 dark:text-gray-500 text-center leading-tight font-medium" style={{ lineHeight: '1' }}>
              {currentShift.dayName || currentShift.shiftDate}
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight" style={{ lineHeight: '1' }}>
              {currentShift.startTime} - {currentShift.endTime}
            </div>
          </div>

          {/* Sonraki Vardiya - Sağ, Silik, Arkada */}
          <div className="flex-1 flex flex-col items-center gap-0.5 opacity-30 scale-90 z-10 relative" style={{ flexShrink: 0 }}>
            <div 
              className="w-8 h-8 rounded-full bg-slate-500 dark:bg-slate-600 flex items-center justify-center text-white text-xs font-bold"
              style={{ flexShrink: 0 }}
            >
              {adjacentShifts.next?.employeeName ? 
                adjacentShifts.next.employeeName.charAt(0).toUpperCase() : 
                <User size={14} />
              }
            </div>
            <div className="text-[10px] text-gray-600 dark:text-gray-400 text-center font-medium leading-tight" style={{ lineHeight: '1.1' }}>
              {adjacentShifts.next?.employeeName || 'Yok'}
            </div>
            {adjacentShifts.next && (
              <>
                <div className="text-[8px] text-gray-400 dark:text-gray-500 text-center leading-tight font-medium" style={{ lineHeight: '1' }}>
                  {adjacentShifts.next.dayName || adjacentShifts.next.shiftDate}
                </div>
                <div className="text-[9px] text-gray-500 dark:text-gray-500 text-center leading-tight" style={{ lineHeight: '1' }}>
                  {adjacentShifts.next.startTime} - {adjacentShifts.next.endTime}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

