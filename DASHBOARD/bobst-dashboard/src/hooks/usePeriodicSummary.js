import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

/**
 * Periyodik özet verilerini çeken hook
 * @param {string} period - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @param {string|null} machine - Makine table name (opsiyonel)
 * @param {object} options - { autoRefresh: true, refreshInterval: 30000, start: Date, end: Date, daysCount: number, currentSlide: number }
 * @returns {object} { data, loading, error, refetch } veya { dataArray, loading, error, refetch } (daysCount > 1 ise)
 */
export const usePeriodicSummary = (period, machine = null, options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 1000, // 1 saniye
    start = null,
    end = null,
    daysCount = 1, // Kaç günlük veri çekilecek (sadece daily için)
    currentSlide = 0 // Carousel'da hangi slide aktif (sadece daily için, 0 = bugün)
  } = options;

  const [data, setData] = useState(null);
  const [dataArray, setDataArray] = useState([]); // Birden fazla gün için
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);
  const dataArrayRef = useRef([]); // Closure problemi için ref

  const fetchData = async (onlyToday = false) => {
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Yeni abort controller oluştur
    abortControllerRef.current = new AbortController();

    try {
      setError(null);
      
      // Eğer daily ve daysCount > 1 ise, birden fazla günlük veri çek
      if (period === 'daily' && daysCount > 1) {
        // Eğer sadece bugün için fetch yapılacaksa (auto-refresh), sadece bugün için fetch yap
        // ve mevcut dataArray'i güncelle (diğer günler aynı kalır)
        if (onlyToday && dataArrayRef.current.length > 0) {
          // Sadece bugün için fetch yap
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const dayStart = new Date(today);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(today);
          dayEnd.setHours(23, 59, 59, 999);
          
          const params = {
            period: 'daily',
            start: dayStart.toISOString(),
            end: dayEnd.toISOString()
          };

          if (machine) {
            params.machine = machine;
          }

          const response = await api.get('/reports/periodic-summary', {
            params,
            signal: abortControllerRef.current.signal
          });

          if (response.data && response.data.success) {
            // Sadece bugünün verisini güncelle (index 0), diğer günler aynı kalır
            const updatedArray = [...dataArrayRef.current];
            updatedArray[0] = response.data;
            setDataArray(updatedArray);
            dataArrayRef.current = updatedArray; // Ref'i de güncelle
            setData(null);
            setLoading(false);
            return;
          }
        }
        
        // İlk yükleme veya tüm günler için fetch
        const promises = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < daysCount; i++) {
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() - i);
          
          const dayStart = new Date(targetDate);
          dayStart.setHours(0, 0, 0, 0);
          
          const dayEnd = new Date(targetDate);
          dayEnd.setHours(23, 59, 59, 999);
          
          const params = {
            period: 'daily',
            start: dayStart.toISOString(),
            end: dayEnd.toISOString()
          };

          if (machine) {
            params.machine = machine;
          }

          promises.push(
            api.get('/reports/periodic-summary', {
              params,
              signal: abortControllerRef.current.signal
            }).then(res => res.data)
          );
        }
        
        const results = await Promise.allSettled(promises);
        const validResults = results
          .filter(r => r.status === 'fulfilled' && r.value && r.value.success)
          .map(r => r.value);
        
        if (validResults.length > 0) {
          setDataArray(validResults);
          dataArrayRef.current = validResults; // Ref'i de güncelle
          setData(null); // Tek veri yerine array kullan
          setLoading(false);
        } else {
          // Eğer hiç veri yoksa hata göster
          setError('Veri alınamadı');
          setLoading(false);
        }
      } else {
        // Tek günlük veri çekme (mevcut mantık)
        const params = {
          period: period.toLowerCase()
        };

        if (machine) {
          params.machine = machine;
        }

        if (start) {
          params.start = start.toISOString();
        }

        if (end) {
          params.end = end.toISOString();
        }

        const response = await api.get('/reports/periodic-summary', {
          params,
          signal: abortControllerRef.current.signal
        });

        if (response.data && response.data.success) {
          setData(response.data);
          setDataArray([]); // Array'i temizle
          setLoading(false);
        } else {
          throw new Error(response.data?.error || 'Veri alınamadı');
        }
      }
    } catch (err) {
      // AbortError veya CanceledError'ı görmezden gel (component unmount veya yeni istek)
      // Bu durumlar normaldir ve hata olarak gösterilmemeli
      if (err.name === 'AbortError' || err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.message === 'canceled') {
        // İptal edilen isteklerde mevcut veriyi koru, sadece return et
        return;
      }

      // 404 veya diğer HTTP hatalarını da sessizce geç (veri yoksa sadece loading'i kapat)
      if (err.response?.status === 404 || err.message?.includes('404') || err.message?.includes('Request failed with status code 404')) {
        // 404 hatası = veri bulunamadı, bu normal bir durum olabilir
        setData(null);
        setDataArray([]);
        setError(null); // Hata gösterme
        setLoading(false);
        return;
      }

      // Diğer hataları da sessizce geç, sadece console'a yaz
      console.warn('Periodic summary verisi alınamadı:', err.message || err);
      // Mevcut veri varsa koru, yoksa sessizce geç
      if (!data && dataArray.length === 0) {
        setData(null);
        setDataArray([]);
        setError(null); // Hata gösterme
        setLoading(false);
      }
    }
  };

  // İlk yükleme ve period/machine değiştiğinde
  useEffect(() => {
    if (!period) {
      setLoading(false);
      return;
    }

    // Makine seçilmediğinde veri çekme
    if (!machine) {
      setData(null);
      setDataArray([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    fetchData();

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [period, machine, start?.toISOString(), end?.toISOString(), daysCount]);

  // Auto-refresh
  // Daily için: Sadece bugün (currentSlide === 0) ise otomatik yenile
  // Diğer periyotlar için: autoRefresh true ise otomatik yenile
  useEffect(() => {
    // Daily için sadece bugün (index 0) ise otomatik yenile, diğer günler geçmiş veri olduğu için yenileme
    const shouldRefresh = period === 'daily' && daysCount > 1 
      ? (autoRefresh && currentSlide === 0) // Daily carousel: sadece bugün için yenile
      : autoRefresh; // Diğer periyotlar: autoRefresh'e göre
    
    if (!shouldRefresh || !period || !machine) {
      return;
    }

    // Interval'i temizle
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Yeni interval başlat
    // Daily carousel için: Sadece bugün için fetch yap (onlyToday = true)
    // Diğer periyotlar için: Tüm veriyi fetch yap
    intervalRef.current = setInterval(() => {
      if (period === 'daily' && daysCount > 1) {
        // Daily carousel: Sadece bugün için fetch yap, geçmiş günler aynı kalır
        fetchData(true); // onlyToday = true
      } else {
        // Diğer periyotlar: Tüm veriyi fetch yap
        fetchData(false);
      }
    }, refreshInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, period, machine, currentSlide, daysCount]);

  // Manuel yenileme fonksiyonu
  const refetch = () => {
    setLoading(true);
    fetchData();
  };

  return {
    data,
    dataArray, // Birden fazla gün için
    loading,
    error,
    refetch
  };
};

