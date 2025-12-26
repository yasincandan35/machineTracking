import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../utils/api';

// Session ID oluştur (sayfa yüklendiğinde bir kez)
const getSessionId = () => {
  if (!window.sessionStorage.getItem('activitySessionId')) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    window.sessionStorage.setItem('activitySessionId', sessionId);
    return sessionId;
  }
  return window.sessionStorage.getItem('activitySessionId');
};

// Batch log'ları tutmak için
let logBuffer = [];
let lastFlushTime = Date.now();
const FLUSH_INTERVAL = 10000; // 10 saniyede bir batch gönder
const MAX_BUFFER_SIZE = 20; // Maksimum buffer boyutu

// Buffer'ı temizle ve backend'e gönder
const flushLogBuffer = async () => {
  if (logBuffer.length === 0) return;
  
  const logsToSend = [...logBuffer];
  logBuffer = [];
  lastFlushTime = Date.now();
  
  try {
    await api.post('/activitylog/log-batch', logsToSend);
  } catch (error) {
    console.error('Activity log batch error:', error);
    // Hata durumunda log'ları kaybetme, tekrar buffer'a ekle (sınırlı)
    if (logBuffer.length < MAX_BUFFER_SIZE) {
      logBuffer = [...logBuffer, ...logsToSend.slice(0, MAX_BUFFER_SIZE - logBuffer.length)];
    }
  }
};

// Periyodik olarak buffer'ı temizle
setInterval(flushLogBuffer, FLUSH_INTERVAL);

/**
 * Kullanıcı aktivite takibi için hook
 * @param {Object} options - Tracking options
 * @param {string} options.currentTab - Current tab name (Dashboard için)
 * @param {string} options.currentSubTab - Current sub-tab name (Home için: dashboard, periodicSummaries, vb.)
 * @param {Object} options.selectedMachine - Selected machine object
 * @param {boolean} options.enabled - Tracking enabled/disabled
 */
export const useActivityTracking = ({ currentTab, currentSubTab, selectedMachine, enabled = true }) => {
  const location = useLocation();
  const sessionIdRef = useRef(getSessionId());
  const lastPageRef = useRef(null);
  const lastTabRef = useRef(null);
  const lastSubTabRef = useRef(null);
  const lastMachineIdRef = useRef(null);
  const pageEnterTimeRef = useRef(Date.now());
  const tabEnterTimeRef = useRef(Date.now());
  const lastActivityLogTimeRef = useRef(Date.now());

  // Sayfa bilgisini al
  const getCurrentPage = useCallback(() => {
    return location.pathname || '/';
  }, [location.pathname]);

  // Activity log gönder
  const logActivity = useCallback(async (eventType, options = {}) => {
    if (!enabled) return;

    const currentPage = getCurrentPage();
    const currentMachineId = selectedMachine?.id;
    const currentMachineName = selectedMachine?.machineName;

    const logData = {
      EventType: eventType,
      Page: currentPage,
      Tab: currentTab || null,
      SubTab: currentSubTab || null,
      MachineId: currentMachineId || null,
      MachineName: currentMachineName || null,
      SessionId: sessionIdRef.current,
      ...options
    };

    // Buffer'a ekle
    logBuffer.push(logData);

    // Buffer doluysa hemen gönder
    if (logBuffer.length >= MAX_BUFFER_SIZE) {
      await flushLogBuffer();
    }
  }, [enabled, getCurrentPage, currentTab, currentSubTab, selectedMachine]);

  // Sayfa değişimini takip et
  useEffect(() => {
    if (!enabled) return;

    const currentPage = getCurrentPage();
    
    if (lastPageRef.current !== currentPage) {
      // Önceki sayfada geçirilen süreyi kaydet
      if (lastPageRef.current !== null) {
        const duration = Math.floor((Date.now() - pageEnterTimeRef.current) / 1000);
        if (duration > 0) {
          logActivity('time_spent', {
            Page: lastPageRef.current,
            Tab: lastTabRef.current,
            SubTab: lastSubTabRef.current,
            Duration: duration
          });
        }
      }

      // Yeni sayfa görüntüleme log'u
      logActivity('page_view', {
        Page: currentPage,
        Tab: currentTab || null,
        SubTab: currentSubTab || null
      });

      lastPageRef.current = currentPage;
      pageEnterTimeRef.current = Date.now();
    }
  }, [location.pathname, enabled, logActivity, currentTab, currentSubTab, getCurrentPage]);

  // Tab değişimini takip et
  useEffect(() => {
    if (!enabled || !currentTab) return;

    if (lastTabRef.current !== currentTab) {
      // Önceki tab'de geçirilen süreyi kaydet
      if (lastTabRef.current !== null) {
        const duration = Math.floor((Date.now() - tabEnterTimeRef.current) / 1000);
        if (duration > 0) {
          logActivity('time_spent', {
            Tab: lastTabRef.current,
            SubTab: lastSubTabRef.current,
            Duration: duration
          });
        }
      }

      // Yeni tab görüntüleme log'u
      logActivity('tab_change', {
        Tab: currentTab,
        SubTab: currentSubTab || null
      });

      lastTabRef.current = currentTab;
      tabEnterTimeRef.current = Date.now();
    }
  }, [currentTab, enabled, logActivity, currentSubTab]);

  // Sub-tab değişimini takip et
  useEffect(() => {
    if (!enabled || !currentSubTab) return;

    if (lastSubTabRef.current !== currentSubTab) {
      logActivity('subtab_change', {
        SubTab: currentSubTab,
        Tab: currentTab || null
      });

      lastSubTabRef.current = currentSubTab;
    }
  }, [currentSubTab, enabled, logActivity, currentTab]);

  // Makine seçimini takip et
  useEffect(() => {
    if (!enabled || !selectedMachine?.id) return;

    if (lastMachineIdRef.current !== selectedMachine.id) {
      logActivity('machine_selected', {
        MachineId: selectedMachine.id,
        MachineName: selectedMachine.machineName,
        Action: 'select_machine'
      });

      lastMachineIdRef.current = selectedMachine.id;
    }
  }, [selectedMachine?.id, enabled, logActivity, selectedMachine?.machineName]);

  // Periyodik olarak zaman geçişini kaydet (her 30 saniyede bir)
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastLog = Math.floor((now - lastActivityLogTimeRef.current) / 1000);
      
      if (timeSinceLastLog >= 30) {
        logActivity('time_spent', {
          Duration: 30,
          Page: getCurrentPage(),
          Tab: currentTab || null,
          SubTab: currentSubTab || null
        });
        lastActivityLogTimeRef.current = now;
      }
    }, 30000); // 30 saniye

    return () => clearInterval(interval);
  }, [enabled, logActivity, getCurrentPage, currentTab, currentSubTab]);

  // Sayfa kapatılırken buffer'ı temizle
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (logBuffer.length > 0) {
        // Synchronous olarak göndermeye çalış
        navigator.sendBeacon('/api/activitylog/log-batch', JSON.stringify(logBuffer));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Component unmount olurken de buffer'ı temizle
      if (logBuffer.length > 0) {
        flushLogBuffer();
      }
    };
  }, []);

  // Manual log fonksiyonu (özel aksiyonlar için)
  const logCustomAction = useCallback((action, details = {}) => {
    logActivity('action', {
      Action: action,
      Details: details
    });
  }, [logActivity]);

  return {
    logCustomAction,
    sessionId: sessionIdRef.current
  };
};

