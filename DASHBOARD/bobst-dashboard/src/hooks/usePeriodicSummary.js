import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';

/**
 * Periyodik özet verilerini çeken hook
 * @param {string} period - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @param {string|null} machine - Makine table name (opsiyonel)
 * @param {object} options - { autoRefresh: true, refreshInterval: 30000, start: Date, end: Date }
 * @returns {object} { data, loading, error, refetch }
 */
export const usePeriodicSummary = (period, machine = null, options = {}) => {
  const {
    autoRefresh = true,
    refreshInterval = 1000, // 1 saniye
    start = null,
    end = null
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const fetchData = async () => {
    // Önceki isteği iptal et
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Yeni abort controller oluştur
    abortControllerRef.current = new AbortController();

    try {
      setError(null);
      
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
        setLoading(false);
      } else {
        throw new Error(response.data?.error || 'Veri alınamadı');
      }
    } catch (err) {
      // AbortError'ı görmezden gel (component unmount veya yeni istek)
      if (err.name === 'AbortError') {
        return;
      }

      console.error('Periodic summary verisi alınamadı:', err);
      setError(err.message || 'Veri yüklenirken hata oluştu');
      setLoading(false);
    }
  };

  // İlk yükleme ve period/machine değiştiğinde
  useEffect(() => {
    if (!period) {
      setLoading(false);
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
  }, [period, machine, start?.toISOString(), end?.toISOString()]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !period) {
      return;
    }

    // Interval'i temizle
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Yeni interval başlat
    intervalRef.current = setInterval(() => {
      fetchData();
    }, refreshInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, period, machine]);

  // Manuel yenileme fonksiyonu
  const refetch = () => {
    setLoading(true);
    fetchData();
  };

  return {
    data,
    loading,
    error,
    refetch
  };
};

