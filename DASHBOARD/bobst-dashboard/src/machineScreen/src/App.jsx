import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  TrendingDown,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Square,
  Info,
  Search,
  BarChart3,
  Wrench,
  MapPin
} from 'lucide-react';
import './App.css';
import StopReasonCategories from './components/StopReasonCategories';
import VirtualKeyboard from './components/VirtualKeyboard';
import NumericKeypad from './components/NumericKeypad';
import StoppageInfoCard from './components/StoppageInfoCard';
import LiveInfoCard from './components/LiveInfoCard';
import { ThemeProvider } from './contexts/ThemeContext';
import { createMachineApi } from '../../utils/api';
import { dashboardApi } from '../../utils/api';
import { getTranslation } from '../../utils/translations';
import { MachineScreenContext, useMachineScreen } from './context';
import MaintenanceRequestModal from '../../components/Modals/MaintenanceRequestModal';
import { useAuth } from '../../contexts/AuthContext';

const UNDEFINED_CATEGORY_TOKENS = ['tanimsiz', 'tanımsız'];
const UNDEFINED_REASON_TOKENS = ['tanımsız', 'tanimsiz'];

const MachineScreenInner = ({ machineApi, machineTableName, machineName, language: languageProp }) => {
  const { language: languageFromContext = 'tr' } = useMachineScreen();
  const { user } = useAuth();
  const language = languageProp || languageFromContext || 'tr';
  const translate = (key) => getTranslation(key, language);
  // Ana durumlar
  const [machineStatus, setMachineStatus] = useState('running'); // 'running' | 'stopped'
  const [plcConnected, setPlcConnected] = useState(false);
  const [showOrderInput, setShowOrderInput] = useState(false);
  const [showStopReason, setShowStopReason] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [showWorkEndConfirmation, setShowWorkEndConfirmation] = useState(false);
  const [isEndingWork, setIsEndingWork] = useState(false); // İş sonu işlemi devam ediyor mu?
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [myMaintenanceRequests, setMyMaintenanceRequests] = useState([]);
  const [showMaintenanceRequests, setShowMaintenanceRequests] = useState(true); // Varsayılan olarak açık
  const [maintenanceButtonExpanded, setMaintenanceButtonExpanded] = useState(false);
  const maintenanceButtonTimeoutRef = useRef(null);
  const hasShownStopReasonModalRef = useRef(false); // Modal bir kere gösterildi mi?
  
  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // Notification fonksiyonları
  const addNotification = (type, message, duration = 5000) => {
    const id = Date.now();
    const notification = { id, type, message, duration };
    setNotifications(prev => [...prev, notification]);
    
    // Otomatik kapanma
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };
  
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // Virtual Keyboard functions
  const openVirtualKeyboard = (target, currentValue = '', event) => {
    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      setKeyboardPosition({
        x: rect.left,
        y: rect.bottom + 10
      });
    }
    setKeyboardTarget(target);
    // Modu belirle
    if (target === 'orderNumber') {
      setKeyboardMode('number');
      setShowNumericKeypad(true);
      setShowVirtualKeyboard(false);
    } else {
      setKeyboardMode('full');
      setShowVirtualKeyboard(true);
      setShowNumericKeypad(false);
    }
    setKeyboardValue(''); // Tümünü seçmek için boş başlat
  };

  const closeVirtualKeyboard = () => {
    setShowVirtualKeyboard(false);
    setShowNumericKeypad(false);
    setKeyboardTarget(null);
    setKeyboardValue('');
  };

  const handleKeyboardInput = (value, shouldClose = false) => {
    if (keyboardTarget === 'orderNumber') {
      setOrderNumber(value);
    }
    // Enter'a basıldığında mevcut hedefe göre aksiyon al
    if (shouldClose) {
      closeVirtualKeyboard();
      if (keyboardTarget === 'orderNumber') {
        fetchOrderData();
      }
    }
  };

  const switchKeyboardMode = (newMode) => {
    setKeyboardMode(newMode);
    setShowVirtualKeyboard(true);
  };
  
  // İş emri bilgileri
  const [currentOrder, setCurrentOrder] = useState(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [newOrderData, setNewOrderData] = useState(null); // Yeni iş emri sorgulama için
  const [showNewOrderConfirmation, setShowNewOrderConfirmation] = useState(false);
  const orderInputRef = useRef(null);
  
  // Virtual Keyboard states
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState(null);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 });
  const [keyboardMode, setKeyboardMode] = useState('number'); // 'number' | 'full'
  const [showNumericKeypad, setShowNumericKeypad] = useState(false);
  const [undefinedStopIds, setUndefinedStopIds] = useState({ categoryId: null, reasonId: null });
  // Son gönderilen duruş sebebi değerlerini sakla (tekrar göndermeyi önlemek için)
  const lastSentStoppageReason = useRef({ categoryId: null, reasonId: null });
  
  useEffect(() => {
    let isMounted = true;

    const loadUndefinedStopIds = async () => {
      try {
        const { data: categories } = await machineApi.get('/stoppagereasons/categories');
        if (!Array.isArray(categories)) return;

        const undefinedCategory = categories.find((category) => {
          const code = (category.categoryCode || '').trim().toLowerCase();
          const display = (category.displayName || '').trim().toLowerCase();
          return UNDEFINED_CATEGORY_TOKENS.includes(code) || UNDEFINED_CATEGORY_TOKENS.includes(display);
        });

        if (!undefinedCategory) return;

        const { data: reasons } = await machineApi.get(`/stoppagereasons/reasons/${undefinedCategory.id}`);
        if (!Array.isArray(reasons)) return;

        const undefinedReason = reasons.find((reason) => {
          const name = (reason.reasonName || '').trim().toLowerCase();
          return UNDEFINED_REASON_TOKENS.includes(name);
        });

        if (undefinedReason && isMounted) {
          setUndefinedStopIds({
            categoryId: undefinedCategory.id,
            reasonId: undefinedReason.id,
          });
        }
      } catch (error) {
        console.warn('Tanımsız duruş ID bilgisi alınamadı:', error);
      }
    };

    loadUndefinedStopIds();

    return () => {
      isMounted = false;
    };
  }, [machineApi]);

  // Makine duyurularını çek
  useEffect(() => {
    let isMounted = true;

    const fetchAnnouncements = async () => {
      try {
        const { data } = await machineApi.get('/machineannouncements/active');
        if (isMounted && Array.isArray(data)) {
          setAnnouncements(data);
        }
      } catch (error) {
        console.warn('Duyurular alınamadı:', error);
      }
    };

    fetchAnnouncements();
    const intervalId = setInterval(fetchAnnouncements, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // PLC'den gelen üretim verileri
  const [productionData, setProductionData] = useState({
    actualProduction: 0,
    remainingWork: 0,
    estimatedTime: 0,
    targetProduction: 0,
    patternValue: 0,
    stoppageType: 0,
    completionPercentage: 0
  });

  // Dokunmatik sağ tık (context menu) engelleme - mouse için izin ver
  useEffect(() => {
    const lastPointerTypeRef = { current: 'mouse' };
    
    const handlePointerDown = (e) => {
      // Pointer type'ı kaydet - sadece touch için context menu engelle
      if (e.pointerType) {
        lastPointerTypeRef.current = e.pointerType;
      }
    };

    const handleContextMenu = (e) => {
      // Sadece touch için context menu'yu engelle, mouse için izin ver
      if (lastPointerTypeRef.current === 'touch') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Pointer event'i passive olarak ekle (preventDefault çağrılmıyor)
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    // Context menu event'i non-passive olarak ekle (preventDefault gerekli)
    window.addEventListener('contextmenu', handleContextMenu, { passive: false });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // Duruş süreleri
  const [stoppageData, setStoppageData] = useState({
    totalStoppageDuration: 0, // Toplam duruş süresi (ms)
    stoppageDuration: 0       // Son duruş süresi (ms)
  });

  // PLC'den gelen duruş süresi (milisaniye)
  const [plcStoppageDuration, setPlcStoppageDuration] = useState(0);

  // Duruş süresi takip sistemi
  const [stopStartTime, setStopStartTime] = useState(null);
  const [stopDuration, setStopDuration] = useState(0);
  const [stopTimer, setStopTimer] = useState(null);
  const [selectedStopCategory, setSelectedStopCategory] = useState(null);
  const [selectedStopReason, setSelectedStopReason] = useState('');
  const [selectedStopReasonId, setSelectedStopReasonId] = useState(null); // Sebep ID'sini sakla
  const [isSplittingStoppage, setIsSplittingStoppage] = useState(false);
  const [stopLogs, setStopLogs] = useState([]);
  const [showDowntimeOverlay, setShowDowntimeOverlay] = useState(false);

  // Duruş sebepleri
  const stopReasons = {
    setup: [
      'Malzeme Değişimi',
      'Kalıp Değişimi', 
      'Ayarlama',
      'Temizlik',
      'Bakım',
      'Kontrol'
    ],
    fault: [
      'Elektrik Arızası',
      'Mekanik Arızası',
      'Hidrolik Arızası',
      'Pnömatik Arızası',
      'Sensör Arızası',
      'Kontrol Arızası'
    ],
    other: [
      'Hafta Bitimi',
      'Molalar',
      'Planlı Duruş'
    ]
  };

  // Duruş süresi formatla (saat:dakika:saniye)
  const formatStopDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // PLC'den gelen duruş süresini formatla (milisaniye -> ss:dd:sn)
  const formatPlcStoppageDuration = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Milisaniyeyi ss:dd:ss formatına çevir
  const formatStoppageDuration = (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Duruş başladığında
  const startStopTimer = () => {
    // Eğer zaten timer çalışıyorsa, yeni timer başlatma
    if (stopTimer) {
      return;
    }
    
    const startTime = new Date();
    setStopStartTime(startTime);
    setStopDuration(0);
    
    // LocalStorage'a kaydet
    localStorage.setItem('stopStartTime', startTime.toISOString());
    
    // Her saniye güncelle
    const timer = setInterval(() => {
      setStopDuration(prev => prev + 1);
    }, 1000);
    
    setStopTimer(timer);
  };

  // Duruş bittiğinde
  const stopStopTimer = async () => {
    // Zaten temizlenmişse tekrar çağrılmasını engelle
    if (!stopStartTime) {
      console.log('⚠️ stopStopTimer: stopStartTime yok, kayıt yapılmıyor');
      return;
    }
    
    if (stopTimer) {
      clearInterval(stopTimer);
      setStopTimer(null);
    }
    
    // Gerçek süreyi hesapla (stopStartTime ile şimdiki zaman arasındaki fark)
    const endTime = new Date();
    const actualDurationSeconds = Math.floor((endTime.getTime() - stopStartTime.getTime()) / 1000);
    
    // Minimum duruş süresi kontrolü (30 saniye altındaki duruşlar kaydedilmez)
    const MIN_DURATION_SECONDS = 30;
    if (actualDurationSeconds < MIN_DURATION_SECONDS) {
      console.log(`⚠️ Duruş süresi çok kısa (${actualDurationSeconds}s), kayıt yapılmıyor (min: ${MIN_DURATION_SECONDS}s)`);
      // State'leri temizle ama kayıt yapma
      setStopStartTime(null);
      setStopDuration(0);
      setSelectedStopCategory(null);
      setSelectedStopReason('');
      setSelectedStopReasonId(null);
      localStorage.removeItem('stopStartTime');
      return;
    }
    
    // Duruş kaydını oluştur (gerçek süreyi kullan)
    const stopLog = {
      id: Date.now(),
      startTime: stopStartTime,
      endTime: endTime,
      duration: actualDurationSeconds, // Gerçek hesaplanan süre
      category: selectedStopCategory || 'Tanımsız',
      reason: selectedStopReason || 'Tanımsız',
      formattedDuration: formatStopDuration(actualDurationSeconds)
    };
    
    setStopLogs(prev => [...prev, stopLog]);
    
    // Eğer sebep seçilmemişse veya onaylanmamışsa, "Tanımsız" olarak backend'e kaydet
    // Not: selectedStopReasonId null ise henüz onaylanmamış demektir
    if (!selectedStopCategory || !selectedStopReason || !selectedStopReasonId) {
      try {
        const { categoryId, reasonId } = undefinedStopIds;
        if (categoryId && reasonId) {
          // Sadece değerler değiştiyse gönder (tekrar göndermeyi önle)
          if (lastSentStoppageReason.current.categoryId !== categoryId || 
              lastSentStoppageReason.current.reasonId !== reasonId) {
            console.log(`⚠️ Sebep seçilmemiş veya onaylanmamış (süre: ${actualDurationSeconds}s), tanımsız olarak kaydediliyor...`);
            const { data } = await machineApi.post('/plcdata/stoppage-reason', {
              categoryId,
              reasonId,
            });

            if (data?.success) {
              console.log(`✅ Tanımsız duruş sebebi kaydedildi (süre: ${actualDurationSeconds}s)`);
              lastSentStoppageReason.current = { categoryId, reasonId };
            } else {
              console.warn('⚠️ Tanımsız duruş kaydı başarısız:', data?.error);
            }
          } else {
            console.log(`ℹ️ Tanımsız duruş sebebi zaten gönderilmiş (Kategori: ${categoryId}, Sebep: ${reasonId}), tekrar gönderilmiyor`);
          }
        } else {
          console.warn('⚠️ Tanımsız duruş ID bilgisi bulunamadı, backend varsayılanı kullanılacak.');
        }
      } catch (error) {
        console.error('❌ Tanımsız duruş sebebi kaydetme hatası:', error);
      }
    } else {
      console.log(`✅ Sebep onaylanmış (${selectedStopReason}), tanımsız kaydı yapılmıyor`);
    }
    
    // State'leri temizle (stopStartTime'ı null yaparak tekrar çağrılmasını engelle)
    const currentStopStartTime = stopStartTime; // Şimdilik sakla
    setStopStartTime(null);
    setStopDuration(0);
    setSelectedStopCategory(null);
    setSelectedStopReason('');
    setSelectedStopReasonId(null); // ID'yi de temizle
    
    // LocalStorage'dan temizle
    localStorage.removeItem('stopStartTime');
  };

  // Sayfa yüklendiğinde duruş süresini kontrol et
  const checkStopStatus = () => {
    const savedStopTime = localStorage.getItem('stopStartTime');
    if (savedStopTime) {
      const startTime = new Date(savedStopTime);
      const now = new Date();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      
      setStopStartTime(startTime);
      setStopDuration(elapsedSeconds);
      setShowDowntimeOverlay(true); // Eğer sayfa yüklendiğinde duruş varsa overlay'i göster
      
      // Timer başlatma kısmını kaldırdık - useEffect'te halledilecek
    }
  };

  // PLC durumunu oku
  const fetchPlcStatus = async () => {
    try {
      const { data } = await machineApi.get('/plcdata/plc-status');
      if (data?.success) {
        setPlcConnected(Boolean(data.connected));
          setMachineStatus(data.machine_stopped ? 'stopped' : 'running');
      }
    } catch (error) {
      setPlcConnected(false);
    }
  };

  // Tüm verileri tek seferde oku (API'den) - /api/plcdata/data endpoint'inden
  const fetchAllData = async () => {
    try {
      const { data } = await machineApi.get('/plcdata/data');
        if (data) {
          setProductionData({
            actualProduction: data.actualProduction || 0,
            remainingWork: data.remainingWork || 0,
            estimatedTime: data.estimatedTime || 0,
            targetProduction: data.targetProduction || 0,
            patternValue: data.patternValue || 0,
            stoppageType: data.stoppageType || 0,
          completionPercentage: data.completionPercentage || 0,
          });
          
          setStoppageData({
            totalStoppageDuration: data.totalStoppageDuration || data.TotalStoppageDuration || 0,
          stoppageDuration: data.stoppageDuration || data.StoppageDuration || 0,
          });
          
          if (data.stoppageDuration !== undefined) {
            setPlcStoppageDuration(data.stoppageDuration || 0);
        }
      }
    } catch (error) {
      console.error('Veri okuma hatası:', error);
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
      const { data } = await machineApi.post('/plcdata/job', {
        orderNumber: orderNumber.trim(),
      });

      if (data?.success && data.data) {
            setNewOrderData(data.data);
            setShowNewOrderConfirmation(true);
        } else {
        addNotification('error', data?.message || 'İş emri bulunamadı!');
      }
    } catch (error) {
      addNotification('error', `Bağlantı hatası: ${error.message}`);
    } finally {
      setIsLoadingOrder(false);
    }
  };

  // İş emri verisini API'den çek ve currentOrder'a set et
  const [cachedJobData, setCachedJobData] = useState(null);
  const fetchCachedJobData = async () => {
    // Veritabanından aktif iş emri verilerini oku
    try {
      if (!machineTableName) {
        return;
      }
      
      const { data } = await machineApi.get('/plcdata/active-job', {
        params: { machine: machineTableName }
      });
      
      if (data?.success && data.data) {
        setCurrentOrder(data.data);
        setCachedJobData(data.data);
        localStorage.setItem('currentOrder', JSON.stringify(data.data));
      } else {
        setCurrentOrder(null);
        localStorage.removeItem('currentOrder');
      }
    } catch (error) {
      console.error('❌ Machine screen: İş emri okuma hatası:', error);
      setCurrentOrder(null);
      localStorage.removeItem('currentOrder');
    }
  };

  // Duruş sebebini PLC'ye gönder (artık kullanılmıyor, stoppage-reason kullanılıyor)
  const sendStoppageTypeToPlc = async (stoppageType) => {
    // Bu fonksiyon artık kullanılmıyor, stoppage-reason endpoint'i kullanılıyor
    console.log('⚠️ sendStoppageTypeToPlc artık kullanılmıyor, stoppage-reason kullanılmalı');
    return;
  };

  // Duruş sebebi seçildiğinde
  const handleStopReasonSelect = (category, reason) => {
    setSelectedStopCategory(category);
    setSelectedStopReason(reason);
    setSelectedStopReasonId(null); // Eski yöntemde ID yok, null bırak
    setShowStopReason(false);
    
    console.log(`Duruş Sebebi Seçildi: ${category} - ${reason}`);
  };

  // Duruş sebebi seç - YENİ HAL (ID ve ad ile)
  const handleStopReason = (reasonData) => {
    // reasonData: { id, name, categoryId }
    setSelectedReason(`${reasonData.name} (ID: ${reasonData.id})`);
    setSelectedStopCategory(reasonData.categoryId);
    setSelectedStopReason(reasonData.name);
    setSelectedStopReasonId(reasonData.id); // ID'yi sakla
    setShowConfirmation(true);
    
    console.log(`Duruş Sebebi Seçildi: Kategori ID: ${reasonData.categoryId}, Sebep: ${reasonData.name} (ID: ${reasonData.id})`);
  };

  // Onay verildiğinde
  const handleConfirmStopReason = async () => {
    console.log(`Duruş Sebebi Onaylandı: ${selectedReason}`);
    
    // ReasonId kontrolü - önce state'ten, yoksa string'den parse et
    const reasonId = selectedStopReasonId || (() => {
      const match = selectedReason.match(/\(ID:\s*(\d+)\)/);
      return match ? parseInt(match[1]) : null;
    })();
    
    if (!reasonId || !selectedStopCategory) {
      console.error('❌ Sebep ID veya kategori ID bulunamadı');
      addNotification('error', 'Duruş sebebi bilgisi eksik!');
      return;
    }
    
    // PLCDataCollector'a sebep bilgilerini gönder
    // Her zaman gönder - kullanıcı değiştirmek istediğinde de güncellensin
    try {
      const { data } = await machineApi.post('/plcdata/stoppage-reason', {
        categoryId: selectedStopCategory, 
        reasonId,
      });

      if (data?.success) {
        console.log('✅ Duruş sebebi PLCDataCollector\'a gönderildi');
        addNotification('success', 'Duruş sebebi başarıyla seçildi!');
        lastSentStoppageReason.current = { categoryId: selectedStopCategory, reasonId };
      } else {
        console.error('❌ Duruş sebebi gönderme başarısız:', data?.error);
        addNotification('error', 'Duruş sebebi gönderme başarısız: ' + (data?.error || 'Bilinmeyen hata'));
      }
    } catch (error) {
      console.error('❌ Duruş sebebi gönderme hatası:', error);
      addNotification('error', 'Duruş sebebi gönderme hatası: ' + error.message);
    }
    
    setShowConfirmation(false);
    setShowStopReason(false);
    setSelectedCategory(null);
  };

  // Paylaşımlı duruş: mevcut duruşu böl ve yeni segment başlat
  const handleSplitStoppage = async () => {
    if (isSplittingStoppage) return;
    setIsSplittingStoppage(true);
    try {
      const { data } = await machineApi.post('/plcdata/split-stoppage', {
        categoryId: selectedStopCategory || undefined,
        reasonId: selectedStopReasonId || undefined
      });

      if (data?.success) {
        addNotification('success', 'Paylaşımlı duruş kaydedildi');
        // Aktif seçimleri sıfırla ki yeni segment için yeniden seçilsin
        setSelectedStopCategory(null);
        setSelectedStopReason('');
        setSelectedStopReasonId(null);
        setSelectedReason('');
        setShowConfirmation(false);
      } else {
        addNotification('error', data?.error || 'Paylaşımlı duruş kaydedilemedi');
      }
    } catch (error) {
      console.error('❌ Paylaşımlı duruş bölme hatası:', error);
      addNotification('error', error?.response?.data?.error || 'Paylaşımlı duruş kaydedilemedi');
    } finally {
      setIsSplittingStoppage(false);
    }
  };

  // Onay iptal edildiğinde
  const handleCancelStopReason = () => {
    setShowConfirmation(false);
    setSelectedReason('');
  };

  // İş sonu
  const handleWorkEnd = () => {
    // İş emri yoksa iş sonu yapılamaz
    if (!currentOrder) {
      addNotification('error', 'Bir iş emri girmeden işi sonlandıramazsınız!');
      return;
    }
    setShowWorkEndConfirmation(true);
  };

  // İş sonu onayı
  const handleConfirmWorkEnd = async () => {
    console.log('🎯 handleConfirmWorkEnd fonksiyonu çağrıldı!');
    console.log('🔍 currentOrder:', currentOrder);

    // Zaten bir iş sonu isteği gönderildiyse tekrar çalıştırma
    if (isEndingWork) {
      console.log('⚠️ İş sonu işlemi zaten devam ediyor, tekrar tıklama yok sayıldı');
      return;
    }

    if (!currentOrder) {
      console.log('❌ currentOrder null! İş emri bulunamadı.');
      addNotification('error', 'Bir iş emri girmeden işi sonlandıramazsınız!');
      setShowWorkEndConfirmation(false);
      return;
    }

    try {
      setIsEndingWork(true);
        console.log('🚀 İş sonu işlemi başladı...');
        console.log('📋 Mevcut iş emri:', currentOrder);
        console.log('⏰ İş başlangıç zamanı:', localStorage.getItem('orderTimestamp'));
        
        // İş başlangıç zamanını güvenli şekilde al
        const orderTimestamp = localStorage.getItem('orderTimestamp');
        let jobStartTime;
        
        if (orderTimestamp) {
          const timestamp = parseInt(orderTimestamp);
          // Timestamp'in geçerli olup olmadığını kontrol et
          if (!isNaN(timestamp) && timestamp > 0 && timestamp < Date.now() + 86400000) { // 24 saat içinde
            jobStartTime = new Date(timestamp).toISOString();
          } else {
            console.warn('⚠️ Geçersiz timestamp, şu anki zaman kullanılıyor');
            jobStartTime = new Date().toISOString();
          }
        } else {
          console.warn('⚠️ orderTimestamp bulunamadı, şu anki zaman kullanılıyor');
          jobStartTime = new Date().toISOString();
        }
        
        // İş başında kaydedilen totalEnergyKwh değerini al
        const totalEnergyKwhStart = localStorage.getItem('totalEnergyKwhStart');
        let energyStartValue = 0;
        if (totalEnergyKwhStart) {
          energyStartValue = parseFloat(totalEnergyKwhStart);
          console.log('💾 İş başında kaydedilen totalEnergyKwh:', energyStartValue, 'kWh');
        } else {
          console.warn('⚠️ totalEnergyKwhStart bulunamadı, 0 kullanılıyor');
        }
        
        const requestData = {
          orderNumber: currentOrder.siparis_no,
          jobStartTime: jobStartTime,
          jobEndTime: new Date().toISOString(),
          totalEnergyKwhStart: energyStartValue
        };
        
        console.log('📤 Gönderilecek veri:', requestData);
        const response = await machineApi.post('/plcdata/job-end', requestData);
        console.log('📥 API Response:', response);
        const data = response?.data;

        if (data?.success) {
          console.log('✅ İş sonu raporu kaydedildi ve PLC reset sinyali gönderildi:', data);
          setShowWorkEndConfirmation(false);
          setShowOrderInput(true);
        } else {
          console.error('❌ İş sonu raporu kaydedilemedi:', data);
          const errorMessage = data?.error || data?.message || 'Bilinmeyen hata';
          console.error('❌ Hata detayı:', errorMessage);
          addNotification('error', 'İş sonu raporu kaydedilemedi: ' + errorMessage);
          setShowWorkEndConfirmation(false);
        }

        // 6. State'leri temizle
        setCurrentOrder(null);
        localStorage.removeItem('currentOrder');
        localStorage.removeItem('orderTimestamp');
        localStorage.removeItem('totalEnergyKwhStart'); // İş başında kaydedilen enerji değerini temizle
        setProductionData({
          actualProduction: 0,
          remainingWork: 0,
          estimatedTime: 0,
          targetProduction: 0,
          patternValue: 0,
          stoppageType: 0,
          completionPercentage: 0
        });
        setStoppageData({
          totalStoppageDuration: 0,
          stoppageDuration: 0
        });
        setStopLogs([]);

        // 7. Başarı mesajı
        addNotification('success', 'İş sonu raporu başarıyla kaydedildi ve PLC reset edildi!');
      } catch (error) {
        console.error('❌ İş sonu işlemi başarısız:', error);
        console.error('❌ Error response:', error?.response);
        console.error('❌ Error data:', error?.response?.data);
        const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Bilinmeyen hata';
        addNotification('error', 'İş sonu işlemi sırasında hata oluştu: ' + errorMessage);
        // Hata durumunda da onay penceresini kapat
        setShowWorkEndConfirmation(false);
      } finally {
        setIsEndingWork(false);
      }
  };


  // İş sonu iptal
  const handleCancelWorkEnd = () => {
    setShowWorkEndConfirmation(false);
  };

  // Yeni iş emri onayı
  const handleConfirmNewOrder = async () => {
    if (newOrderData) {
      try {
        // İş başlangıç zamanını ekle (timestamp olarak)
        const jobStartTime = Date.now();
        
        // İş başında totalEnergyKwh değerini al ve kaydet
        let totalEnergyKwhStart = 0;
        try {
          const { data: plcData } = await machineApi.get('/plcdata/data');
          if (plcData && (plcData.totalEnergyKwh !== undefined || plcData.TotalEnergyKwh !== undefined)) {
            totalEnergyKwhStart = plcData.totalEnergyKwh || plcData.TotalEnergyKwh || 0;
            localStorage.setItem('totalEnergyKwhStart', totalEnergyKwhStart.toString());
            console.log('💾 İş başında totalEnergyKwh kaydedildi:', totalEnergyKwhStart, 'kWh');
          }
        } catch (energyError) {
          console.warn('⚠️ totalEnergyKwh değeri alınamadı:', energyError);
        }
        
        const orderDataWithTimestamp = {
          ...newOrderData,
          jobStartTime: jobStartTime,
          totalEnergyKwhStart: totalEnergyKwhStart
        };
        
        // PLC'ye veri yaz
        console.log('🔌 PLC\'ye iş emri verisi yazılıyor...');
        const { data } = await machineApi.post('/plcdata/job-write', orderDataWithTimestamp);

        if (data?.success) {
          console.log('✅ PLC\'ye veri yazıldı:', data);
            setCurrentOrder(orderDataWithTimestamp);
            localStorage.setItem('currentOrder', JSON.stringify(orderDataWithTimestamp));
            localStorage.setItem('orderTimestamp', jobStartTime.toString());
            setNewOrderData(null);
            setShowNewOrderConfirmation(false);
            setShowOrderInput(false);
            addNotification('success', 'Yeni iş emri başarıyla onaylandı ve PLC\'ye yazıldı!');
          } else {
          addNotification('error', 'PLC\'ye veri yazılamadı: ' + (data?.error || 'Bilinmeyen hata'));
        }
      } catch (error) {
        console.error('❌ PLC yazma hatası:', error);
        addNotification('error', 'PLC\'ye veri yazma hatası: ' + error.message);
      }
    }
  };

  // Yeni iş emri onayını iptal et
  const handleCancelNewOrder = () => {
    setNewOrderData(null);
    setShowNewOrderConfirmation(false);
    setShowOrderInput(false);
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

  // Backend'den aktif duruş sebebini oku (farklı cihazlarda görülebilir olması için)
  useEffect(() => {
    let isMounted = true;
    let intervalId = null;

    const fetchCurrentStoppageReason = async () => {
      try {
        const { data } = await machineApi.get('/plcdata/current-stoppage-reason');
        
        if (!isMounted) return;

        if (data && data.hasReason && data.categoryId > 0 && data.reasonId > 0) {
          // Kategori ve sebep isimlerini al
          try {
            const { data: categories } = await machineApi.get('/stoppagereasons/categories');
            const category = categories.find(c => c.id === data.categoryId);
            
            if (category) {
              const { data: reasons } = await machineApi.get(`/stoppagereasons/reasons/${category.id}`);
              const reason = reasons.find(r => r.id === data.reasonId);
              
              if (reason) {
                // State'leri güncelle
                setSelectedStopCategory(data.categoryId);
                setSelectedStopReason(reason.reasonName);
                setSelectedStopReasonId(data.reasonId);
                setSelectedReason(`${reason.reasonName} (ID: ${data.reasonId})`);
                console.log(`✅ Backend'den aktif duruş sebebi okundu: ${category.displayName} - ${reason.reasonName}`);
              }
            }
          } catch (error) {
            console.warn('⚠️ Kategori/sebep isimleri alınamadı:', error);
          }
        } else {
          // Aktif duruş sebebi yok, state'leri temizle (sadece backend'den okunan değerler için)
          // Kullanıcı henüz seçim yapmadıysa temizleme
          if (data && !data.hasReason) {
            // Backend'de aktif sebep yok, ama kullanıcı henüz seçim yapmış olabilir
            // Bu durumda state'leri temizlemeyelim, sadece backend'den okunan değerler için
          }
        }
      } catch (error) {
        console.warn('⚠️ Aktif duruş sebebi okunamadı:', error);
      }
    };

    // İlk yüklemede oku
    fetchCurrentStoppageReason();

    // Her 5 saniyede bir kontrol et (makine duruyorsa)
    if (machineStatus === 'stopped') {
      intervalId = setInterval(fetchCurrentStoppageReason, 5000);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [machineStatus, machineApi]);

  // Makine durumu değiştiğinde
  useEffect(() => {
    if (machineStatus === 'stopped' && !stopStartTime && !stopTimer) {
      // Makine durdu, sayaç başlat
      startStopTimer();
      // Sadece duruyor state'ine yeni geçildiyse modal aç
      if (!hasShownStopReasonModalRef.current) {
        setShowStopReason(true); // Duruş sebebi seçim ekranını aç
        hasShownStopReasonModalRef.current = true;
      }
      setShowDowntimeOverlay(true); // Duruş overlay'ini göster
    } else if (machineStatus === 'running' && stopStartTime) {
      // Makine çalışmaya başladı, sayaç durdur
      stopStopTimer();
      setShowStopReason(false);
      setShowDowntimeOverlay(false); // Duruş overlay'ini gizle
      hasShownStopReasonModalRef.current = false; // Reset - bir sonraki duruşta tekrar açılsın
    }
  }, [machineStatus, stopStartTime, stopTimer]); // showStopReason dependency'den çıkarıldı

  // Sayfa yüklendiğinde duruş durumunu kontrol et ve timer başlat
  useEffect(() => {
    checkStopStatus();
  }, []);

  // Eğer sayfa yüklendiğinde duruş durumu varsa timer başlat
  useEffect(() => {
    if (stopStartTime && !stopTimer && machineStatus === 'stopped') {
      const timer = setInterval(() => {
        setStopDuration(prev => prev + 1);
      }, 1000);
      setStopTimer(timer);
      setShowDowntimeOverlay(true); // Timer başladığında overlay'i göster
    }
  }, [stopStartTime, stopTimer, machineStatus]);

  // Admin panel kontrolü
  useEffect(() => {
    if (window.location.pathname === '/adminPanel') {
      window.location.href = '/adminPanel.html';
      return;
    }
  }, []);

  // Kullanıcının kabul ettiği bildirimleri çek
  const fetchMyMaintenanceRequests = async () => {
    if (!user?.id) {
      return;
    }
    
    try {
      // Tüm bildirimleri çek (status filtresi olmadan)
      const response = await dashboardApi.get('/maintenance/requests', {
        params: {} // Tüm bildirimleri çek
      });
      const allRequests = response.data || [];
      
      // Kabul edilmiş ve henüz tamamlanmamış bildirimleri filtrele (kullanıcı ID kontrolü yok - herkes görebilir)
      const myRequests = allRequests.filter(req => {
        const hasAssignments = req.assignments && req.assignments.length > 0; // En az bir atama var mı
        const notCompleted = !req.completedAt;
        const statusOk = req.status === 'accepted' || req.status === 'in_progress';
        return hasAssignments && notCompleted && statusOk;
      });
      
      setMyMaintenanceRequests(myRequests);
    } catch (error) {
      console.error('Bildirimler yüklenemedi:', error);
    }
  };

  // Bildirim geldim butonu
  const handleMarkArrived = async (requestId) => {
    try {
      await dashboardApi.post(`/maintenance/requests/${requestId}/arrived`);
      addNotification('success', 'Geliş tarihi kaydedildi');
      fetchMyMaintenanceRequests();
    } catch (error) {
      addNotification('error', 'Geliş tarihi kaydedilemedi');
    }
  };

  // Bildirim tamamlandı butonu
  const handleCompleteMaintenance = async (requestId) => {
    try {
      await dashboardApi.post(`/maintenance/requests/${requestId}/complete`);
      addNotification('success', 'Arıza tamamlandı');
      fetchMyMaintenanceRequests();
    } catch (error) {
      addNotification('error', 'Arıza tamamlanamadı');
    }
  };

  // Periyodik veri okuma
  useEffect(() => {
    // Sayfa kaydırmayı engelle
    const preventScroll = (e) => {
      // Sadece sayfa kaydırmayı engelle, element içi scroll'ları engelleme
      if (e.target === document.body || e.target === document.documentElement) {
        e.preventDefault();
      }
    };

    // Touch event'lerini engelle
    const preventTouchMove = (e) => {
      // Sadece sayfa kaydırmayı engelle, element içi scroll'ları engelleme
      if (e.target === document.body || e.target === document.documentElement) {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventTouchMove, { passive: false });
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Kiosk modu kontrolü
    const isKioskMode = window.location.search.includes('kiosk=true') || 
                       window.navigator.userAgent.includes('Kiosk') ||
                       window.location.hostname !== 'localhost';
    
    // Kiosk modu toggle için F11 tuşu (normal modda fullscreen açar, kiosk modunda devre dışı)
    const handleKeyDown = (e) => {
      // F11 tuşu - Normal modda fullscreen aç/kapat, kiosk modunda devre dışı
      if (e.key === 'F11') {
        if (!isKioskMode) {
          e.preventDefault();
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
              console.log('Fullscreen açılamadı:', err);
            });
          } else {
            document.exitFullscreen().catch(err => {
              console.log('Fullscreen kapatılamadı:', err);
            });
          }
        } else {
          // Kiosk modunda F11 devre dışı
          e.preventDefault();
        }
      }
      
      if (isKioskMode) {
        // Kiosk modunda bazı tuşları devre dışı bırak
        if (e.altKey && e.key === 'Tab') e.preventDefault();
        if (e.key === 'Meta' || e.key === 'Super') e.preventDefault();
        if (e.ctrlKey && e.altKey && e.key === 'Delete') e.preventDefault();
        if (e.key === 'F12') e.preventDefault(); // F12 devre dışı
        if (e.key === 'F5') e.preventDefault(); // F5 (yenile) devre dışı
        if (e.ctrlKey && e.key === 'r') e.preventDefault(); // Ctrl+R devre dışı
        if (e.ctrlKey && e.key === 'F5') e.preventDefault(); // Ctrl+F5 devre dışı
        if (e.key === 'F4' && e.altKey) e.preventDefault(); // Alt+F4 devre dışı
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Sayfa yüklendiğinde localStorage'dan iş emrini yükle (varsa)
    const savedOrder = localStorage.getItem('currentOrder');
    if (savedOrder) {
      try {
        const orderData = JSON.parse(savedOrder);
        setCurrentOrder(orderData);
      } catch (error) {
        console.error('localStorage\'dan iş emri okuma hatası:', error);
      }
    }
    
    fetchPlcStatus();
    fetchAllData();
    fetchCachedJobData(); // API'den güncel veriyi çek ve currentOrder'ı güncelle
    fetchMyMaintenanceRequests(); // Kullanıcının bildirimlerini çek
    
    const pollMs = 200; // 200ms polling
    const maintenancePollMs = 30000; // 30 saniyede bir bildirimleri yenile

    const interval = setInterval(() => {
      fetchPlcStatus();
      fetchAllData();
    }, pollMs);

    const jobInterval = setInterval(() => {
      fetchCachedJobData(); // Her 10 saniyede bir API'den güncel iş emrini çek
    }, 10000);

    // Bildirimleri periyodik olarak yenile (30 saniyede bir)
    const maintenanceInterval = setInterval(() => {
      if (user?.id) {
        fetchMyMaintenanceRequests();
      }
    }, 30000);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventTouchMove);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      clearInterval(interval);
      clearInterval(jobInterval);
      clearInterval(maintenanceInterval);
    };
  }, [machineApi, user?.id]);

  // Saat güncelleme
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Component unmount olduğunda timer'ları temizle
  useEffect(() => {
    return () => {
      if (stopTimer) {
        clearInterval(stopTimer);
      }
    };
  }, [stopTimer]);


  // İş emri giriş modal'ı açıldığında input'a focus yap
  useEffect(() => {
    if (showOrderInput && orderInputRef.current) {
      // Kısa bir delay ile focus yap (modal animasyonu için)
      setTimeout(() => {
        orderInputRef.current?.focus();
      }, 100);
    }
  }, [showOrderInput]);

  const announcementText = useMemo(
    () =>
      announcements
        .map(item => (item.message || '').trim())
        .filter(Boolean)
        .join(' • '),
    [announcements]
  );

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
            {/* Makine silüeti - Dashboard ile aynı görsel path'i kullan */}
            <img src="/lpng/l3komple.png" alt="Makine Komple" className="machine-img-comple" />
          </div>
                  
                  <div className="top-bar-right">
          <div className="connection-status">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className={`connection-dot ${plcConnected ? 'connected' : 'disconnected'}`} />
                <span>PLC {plcConnected ? 'Bağlı' : 'Bağlantı Yok'}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                {machineName || machineTableName || 'Makine'}
              </span>
            </div>
          </div>
          <div className="datetime-display">
            <div className="date">{currentTime.toLocaleDateString('tr-TR')}</div>
            <div className="time">{currentTime.toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>
      </div>

        {announcementText && (
          <div className="announcement-bar">
            <div className="announcement-track">
              <span>{announcementText}</span>
              <span aria-hidden="true">{announcementText}</span>
            </div>
          </div>
        )}

      {/* Duruş Süresi Overlay */}
      {showDowntimeOverlay && (
        <div className="downtime-overlay">
          <div className="downtime-content">
            <div className="downtime-header">
              <div className="downtime-icon">
                <AlertTriangle size={48} />
              </div>
              <div className="downtime-text">
                <span className="downtime-label">DURUŞ SÜRESİ (PLC)</span>
                <span className="downtime-time">{formatPlcStoppageDuration(plcStoppageDuration)}</span>
              </div>
              <button 
                className="downtime-close-btn"
                onClick={() => setShowDowntimeOverlay(false)}
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <span className="label">{`${translate('jobOrderNo')}:`}</span>
                    <span className="value">{currentOrder.siparis_no}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('totalQuantity')}:`}</span>
                    <span className="value">{parseInt(currentOrder.toplam_miktar).toLocaleString()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('remainingQuantity')}:`}</span>
                    <span className="value">{currentOrder.kalan_miktar ? parseInt(currentOrder.kalan_miktar).toLocaleString() : 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('cylinderCircumference')}:`}</span>
                    <span className="value">{parseFloat((currentOrder.silindir_cevresi || 0).toString().replace(',', '.')).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('bundle')}:`}</span>
                    <span className="value">{currentOrder.bundle}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('targetSpeed')}:`}</span>
                    <span className="value">{currentOrder.hedef_hiz}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{`${translate('setCount')}:`}</span>
                    <span className="value">{currentOrder.set_sayisi}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-order-card">
                <Database size={48} />
                <h3>İş Emri Yok</h3>
                <p>Makine durduğunda iş emri girebilirsiniz</p>
                <button 
                  className="primary-button"
                  onClick={() => setShowOrderInput(true)}
                >
                  İş Emri Gir
                </button>
              </div>
            )}

            {/* Duruş Bilgileri Kartı - Sol panelde, kalan alanı dolduracak */}
            <StoppageInfoCard currentOrder={currentOrder} />
          </div>

          {/* Sağ Panel - Üretim Bilgileri */}
          <div className="right-panel">
            <div className="production-card" style={{ position: 'relative', overflow: 'visible' }}>
              <div className="card-header">
                <TrendingUp size={24} />
                <h2>Üretim Bilgileri</h2>
              </div>
              
              {/* Sağ ortada grafik ikonu */}
              <div style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#3b82f6',
                opacity: 0.3,
                zIndex: 1,
                pointerEvents: 'none'
              }}>
                <BarChart3 size={60} />
              </div>
              
              <div style={{ paddingRight: '5rem', position: 'relative', zIndex: 2 }}>
                {/* Ana metrikler */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(2, 1fr)', 
                  gap: '0.75rem', 
                  marginBottom: '1rem',
                  width: '100%'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Gerçek:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6', lineHeight: '1.2' }}>
                      {productionData.actualProduction.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Hedef:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#64748b', lineHeight: '1.2' }}>
                      {productionData.targetProduction > 0 ? productionData.targetProduction.toLocaleString() : (cachedJobData?.kalan_miktar ? parseInt(cachedJobData.kalan_miktar).toLocaleString() : (currentOrder?.kalan_miktar ? parseInt(currentOrder.kalan_miktar).toLocaleString() : '0'))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Kalan İş:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b', lineHeight: '1.2' }}>
                      {productionData.remainingWork.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Tahmini Süre:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#64748b', lineHeight: '1.2' }}>
                      {formatTime(productionData.estimatedTime)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Son Duruş:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', lineHeight: '1.2' }}>
                      {formatStoppageDuration(stoppageData.stoppageDuration)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Toplam Duruş:</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', lineHeight: '1.2' }}>
                      {formatStoppageDuration(stoppageData.totalStoppageDuration)}
                    </div>
                  </div>
                </div>

                {/* Tamamlanan ve Progress Bar */}
                {(() => {
                  // API'den gelen completionPercentage değerini kullan, yoksa hesapla
                  const completionPercent = productionData.completionPercentage > 0 
                    ? productionData.completionPercentage 
                    : (() => {
                        const targetProd = productionData.targetProduction > 0 
                          ? productionData.targetProduction 
                          : (cachedJobData?.kalan_miktar ? parseInt(cachedJobData.kalan_miktar) : (currentOrder?.kalan_miktar ? parseInt(currentOrder.kalan_miktar) : 0));
                        return targetProd > 0 
                          ? (productionData.actualProduction / targetProd) * 100 
                          : 0;
                      })();
                  
                  const getProgressColor = () => {
                    if (completionPercent >= 100) return '#22c55e';
                    if (completionPercent >= 80) return '#3b82f6';
                    if (completionPercent >= 60) return '#f59e0b';
                    return '#ef4444';
                  };

                  const getStatusColor = () => {
                    if (completionPercent >= 100) return '#22c55e';
                    if (completionPercent >= 80) return '#3b82f6';
                    if (completionPercent >= 60) return '#f59e0b';
                    return '#ef4444';
                  };

                  const getTrendIcon = () => {
                    if (completionPercent >= 100) return <TrendingUp size={16} style={{ color: '#22c55e' }} />;
                    if (completionPercent >= 80) return <TrendingUp size={16} style={{ color: '#3b82f6' }} />;
                    return <TrendingDown size={16} style={{ color: '#ef4444' }} />;
                  };

                  return (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Tamamlanan:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {getTrendIcon()}
                          <span style={{ 
                            fontSize: '1rem', 
                            fontWeight: 'bold', 
                            color: getStatusColor() 
                          }}>
                            {completionPercent.toFixed(3)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: '8px', 
                        backgroundColor: 'rgba(148, 163, 184, 0.2)', 
                        borderRadius: '9999px',
                        overflow: 'hidden'
                      }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            backgroundColor: getProgressColor(),
                            borderRadius: '9999px',
                            transition: 'width 0.5s ease, background-color 0.5s ease',
                            width: `${Math.min(completionPercent, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Canlı Bilgiler Kartı */}
            <LiveInfoCard />
          </div>
        </div>

      {/* Alt Butonlar - Çalışıyor ekranı */}
      <div className="bottom-buttons">
        {/* İş emri sadece iş yokken girilebilir; devam eden işte değiştirme yok */}
        {!currentOrder && (
          <button 
            className="secondary-button"
            onClick={() => setShowOrderInput(true)}
          >
            <QrCode size={18} />
            İş Emri Gir
          </button>
        )}
        <button 
          className="primary-button"
          onClick={() => setShowStopReason(true)}
          disabled={machineStatus === 'running'}
        >
          <AlertTriangle size={18} />
          Duruş Sebebi
        </button>
        <button 
          className="danger-button"
          onClick={handleWorkEnd}
          disabled={machineStatus === 'running'}
        >
          <CheckCircle size={18} />
          İş Sonu
        </button>
        {/* Arıza Bildirimi Butonu - bottomBar içinde, sağda - Framer Motion ile (PC) / Direkt tıklama (Mobil) */}
        <motion.button
          className="maintenance-button-minimal"
          onClick={() => {
            // Mobilde direkt modal aç (window.innerWidth <= 768)
            if (window.innerWidth <= 768) {
              setShowMaintenanceModal(true);
              return;
            }
            
            // PC'de animasyonlu açılma
            if (maintenanceButtonExpanded) {
              // Timeout'u temizle
              if (maintenanceButtonTimeoutRef.current) {
                clearTimeout(maintenanceButtonTimeoutRef.current);
                maintenanceButtonTimeoutRef.current = null;
              }
              setMaintenanceButtonExpanded(false);
              setShowMaintenanceModal(true);
            } else {
              setMaintenanceButtonExpanded(true);
              // Önceki timeout'u temizle
              if (maintenanceButtonTimeoutRef.current) {
                clearTimeout(maintenanceButtonTimeoutRef.current);
              }
              // 5 saniye sonra otomatik kapan
              maintenanceButtonTimeoutRef.current = setTimeout(() => {
                setMaintenanceButtonExpanded(false);
                maintenanceButtonTimeoutRef.current = null;
              }, 5000);
            }
          }}
          title="Arıza Bildirimi"
          layout
          animate={{
            width: maintenanceButtonExpanded ? 140 : 32,
            paddingLeft: maintenanceButtonExpanded ? '12px' : '0px',
            paddingRight: maintenanceButtonExpanded ? '12px' : '0px',
            gap: maintenanceButtonExpanded ? '8px' : '0px',
          }}
          transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1],
            layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{
            justifyContent: maintenanceButtonExpanded ? 'flex-start' : 'center',
          }}
        >
          <motion.div
            animate={{
              rotate: maintenanceButtonExpanded ? 360 : 0,
            }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{ 
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              marginRight: maintenanceButtonExpanded ? 8 : 0,
            }}
          >
            <AlertTriangle size={16} />
          </motion.div>
          <AnimatePresence>
            {maintenanceButtonExpanded && (
              <motion.span
                key="maintenance-text"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 200 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1],
                  opacity: { 
                    duration: 0.3,
                    delay: 0.05,
                  },
                  maxWidth: {
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1],
                  },
                }}
                style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  display: 'inline-block',
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: '#ef4444' 
                }}
              >
                Arıza Bildirimi
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Arıza Bildirimleri - Kullanıcının kabul ettiği bildirimler (Çalışıyor ekranı) */}
      {myMaintenanceRequests.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          maxWidth: '400px',
          maxHeight: '400px',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          borderRadius: '16px',
          padding: '1rem',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={20} color="#f59e0b" />
              <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                Arıza Bildirimlerim
              </h3>
            </div>
            <button
              onClick={() => setShowMaintenanceRequests(!showMaintenanceRequests)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showMaintenanceRequests ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
          
          {showMaintenanceRequests && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myMaintenanceRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    backgroundColor: 'rgba(51, 65, 85, 0.6)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {request.machineName}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {request.faultType}
                    </div>
                  </div>
                  
                  {!request.arrivedAt && (
                    <div>
                      <button
                        onClick={() => handleMarkArrived(request.id)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: 'rgba(147, 51, 234, 0.8)',
                          border: '1px solid rgba(147, 51, 234, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(147, 51, 234, 1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'rgba(147, 51, 234, 0.8)';
                        }}
                      >
                        <MapPin size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />
                        Geldim
                      </button>
                      <p style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        textAlign: 'center',
                        marginTop: '0.25rem',
                        fontStyle: 'italic'
                      }}>
                        ⚠️ Sadece bakım personeli tarafından basılacaktır
                      </p>
                    </div>
                  )}
                  
                  {request.arrivedAt && !request.completedAt && (
                    <button
                      onClick={() => handleCompleteMaintenance(request.id)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.8)';
                      }}
                    >
                      <CheckCircle size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />
                      Tamamlandı
                    </button>
                  )}
                  
                  {request.completedAt && (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      borderRadius: '8px',
                      color: '#22c55e',
                      fontSize: '0.8rem',
                      textAlign: 'center'
                    }}>
                      ✓ Tamamlandı
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        {/* Ana ekranda duruş süresi göster - KALDIR */}


      {/* Virtual Keyboard */}
      <VirtualKeyboard
        isVisible={showVirtualKeyboard}
        onClose={closeVirtualKeyboard}
        onInput={handleKeyboardInput}
        currentValue={keyboardValue}
        placeholder=""
        mode={keyboardMode}
        position={keyboardPosition}
        onSwitchMode={switchKeyboardMode}
      />
      <NumericKeypad
        isVisible={showNumericKeypad}
        onClose={closeVirtualKeyboard}
        onInput={handleKeyboardInput}
        currentValue={orderNumber}
        position={keyboardPosition}
      />

      {/* Arıza Bildirimi Modal */}
      {showMaintenanceModal && (
        <MaintenanceRequestModal
          isOpen={showMaintenanceModal}
          onClose={() => {
            console.log('Modal kapatılıyor');
            setShowMaintenanceModal(false);
          }}
          machine={{
            name: machineName,
            machineName: machineName,
            tableName: machineTableName,
            machineTableName: machineTableName
          }}
          currentLanguage={language}
        />
      )}

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
            <span className="status-subtitle">
              {selectedStopReasonId && selectedStopCategory && selectedStopReason
                ? `${selectedStopReason}`
                : 'Duruş Sebebi Seçilmedi'}
            </span>
          </div>
          <div className="status-pulse"></div>
        </div>
        
        {/* Makine Resimleri */}
        <div className="machine-images">
          {/* Makine silüeti - Dashboard ile aynı görsel path'i kullan */}
          <img src="/lpng/l3komple.png" alt="Makine Komple" className="machine-img-comple" />
        </div>
        
        <div className="top-bar-right">
          <div className="connection-status">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className={`connection-dot ${plcConnected ? 'connected' : 'disconnected'}`} />
                <span>PLC {plcConnected ? 'Bağlı' : 'Bağlantı Yok'}</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                {machineName || machineTableName || 'Makine'}
              </span>
            </div>
          </div>
          <div className="datetime-display">
            <div className="date">{currentTime.toLocaleDateString('tr-TR')}</div>
            <div className="time">{currentTime.toLocaleTimeString('tr-TR')}</div>
          </div>
        </div>
      </div>

      {announcementText && (
        <div className="announcement-bar">
          <div className="announcement-track">
            <span>{announcementText}</span>
            <span aria-hidden="true">{announcementText}</span>
          </div>
        </div>
      )}

      {/* Duruş Süresi Overlay */}
      {showDowntimeOverlay && (
        <div className="downtime-overlay">
          <div className="downtime-content">
            <div className="downtime-header">
              <div className="downtime-icon">
                <AlertTriangle size={48} />
              </div>
              <div className="downtime-text">
                <span className="downtime-label">DURUŞ SÜRESİ (PLC)</span>
                <span className="downtime-time">{formatPlcStoppageDuration(plcStoppageDuration)}</span>
              </div>
              <button 
                className="downtime-close-btn"
                onClick={() => setShowDowntimeOverlay(false)}
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <span className="label">{`${translate('jobOrderNo')}:`}</span>
                  <span className="value">{currentOrder.siparis_no}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('totalQuantity')}:`}</span>
                  <span className="value">{parseInt(currentOrder.toplam_miktar).toLocaleString()}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('remainingQuantity')}:`}</span>
                  <span className="value">{currentOrder.kalan_miktar ? parseInt(currentOrder.kalan_miktar).toLocaleString() : 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('cylinderCircumference')}:`}</span>
                  <span className="value">{parseFloat((currentOrder.silindir_cevresi || 0).toString().replace(',', '.')).toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('bundle')}:`}</span>
                  <span className="value">{currentOrder.bundle}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('targetSpeed')}:`}</span>
                  <span className="value">{currentOrder.hedef_hiz}</span>
                </div>
                <div className="detail-row">
                  <span className="label">{`${translate('setCount')}:`}</span>
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
          <div className="production-card" style={{ position: 'relative', overflow: 'visible' }}>
            <div className="card-header">
              <TrendingUp size={24} />
              <h2>Üretim Bilgileri</h2>
            </div>
            
            {/* Sağ ortada grafik ikonu */}
            <div style={{
              position: 'absolute',
              right: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#3b82f6',
              opacity: 0.3,
              zIndex: 1,
              pointerEvents: 'none'
            }}>
              <BarChart3 size={60} />
            </div>
            
            <div style={{ paddingRight: '5rem', position: 'relative', zIndex: 2 }}>
              {/* Ana metrikler */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '0.75rem', 
                marginBottom: '1rem',
                width: '100%'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Gerçek:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#3b82f6', lineHeight: '1.2' }}>
                    {productionData.actualProduction.toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Hedef:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#64748b', lineHeight: '1.2' }}>
                    {productionData.targetProduction > 0 ? productionData.targetProduction.toLocaleString() : (cachedJobData?.kalan_miktar ? parseInt(cachedJobData.kalan_miktar).toLocaleString() : (currentOrder?.kalan_miktar ? parseInt(currentOrder.kalan_miktar).toLocaleString() : '0'))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Kalan İş:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b', lineHeight: '1.2' }}>
                    {productionData.remainingWork.toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Tahmini Süre:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#64748b', lineHeight: '1.2' }}>
                    {formatTime(productionData.estimatedTime)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Son Duruş:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', lineHeight: '1.2' }}>
                    {formatStoppageDuration(stoppageData.stoppageDuration)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', fontWeight: '500' }}>Toplam Duruş:</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444', lineHeight: '1.2' }}>
                    {formatStoppageDuration(stoppageData.totalStoppageDuration)}
                  </div>
                </div>
              </div>

              {/* Tamamlanan Ürün Miktarı ve Progress Bar */}
              {(() => {
                // API'den gelen completionPercentage değerini kullan, yoksa hesapla
                const completionPercent = productionData.completionPercentage > 0 
                  ? productionData.completionPercentage 
                  : (() => {
                      const targetProd = productionData.targetProduction > 0 
                        ? productionData.targetProduction 
                        : (cachedJobData?.kalan_miktar ? parseInt(cachedJobData.kalan_miktar) : (currentOrder?.kalan_miktar ? parseInt(currentOrder.kalan_miktar) : 0));
                      return targetProd > 0 
                        ? (productionData.actualProduction / targetProd) * 100 
                        : 0;
                    })();
                
                const getProgressColor = () => {
                  if (completionPercent >= 100) return '#22c55e';
                  if (completionPercent >= 80) return '#3b82f6';
                  if (completionPercent >= 60) return '#f59e0b';
                  return '#ef4444';
                };

                const getStatusColor = () => {
                  if (completionPercent >= 100) return '#22c55e';
                  if (completionPercent >= 80) return '#3b82f6';
                  if (completionPercent >= 60) return '#f59e0b';
                  return '#ef4444';
                };

                const getTrendIcon = () => {
                  if (completionPercent >= 100) return <TrendingUp size={16} style={{ color: '#22c55e' }} />;
                  if (completionPercent >= 80) return <TrendingUp size={16} style={{ color: '#3b82f6' }} />;
                  return <TrendingDown size={16} style={{ color: '#ef4444' }} />;
                };

                return (
                  <div style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Tamamlanan:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {getTrendIcon()}
                        <span style={{ 
                          fontSize: '1rem', 
                          fontWeight: 'bold', 
                          color: getStatusColor() 
                        }}>
                          {completionPercent.toFixed(3)}%
                        </span>
                      </div>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      backgroundColor: 'rgba(148, 163, 184, 0.2)', 
                      borderRadius: '9999px',
                      overflow: 'hidden'
                    }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          backgroundColor: getProgressColor(),
                          borderRadius: '9999px',
                          transition: 'width 0.5s ease, background-color 0.5s ease',
                          width: `${Math.min(completionPercent, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Canlı Bilgiler Kartı */}
          <LiveInfoCard />
        </div>

      </div>


      {/* Arıza Bildirimleri - Kullanıcının kabul ettiği bildirimler */}
      {myMaintenanceRequests.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          maxWidth: '400px',
          maxHeight: '400px',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          borderRadius: '16px',
          padding: '1rem',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Wrench size={20} color="#f59e0b" />
              <h3 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                Arıza Bildirimlerim
              </h3>
            </div>
            <button
              onClick={() => setShowMaintenanceRequests(!showMaintenanceRequests)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              {showMaintenanceRequests ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
          
          {showMaintenanceRequests && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myMaintenanceRequests.map((request) => (
                <div
                  key={request.id}
                  style={{
                    backgroundColor: 'rgba(51, 65, 85, 0.6)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    border: '1px solid rgba(148, 163, 184, 0.2)'
                  }}
                >
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                      {request.machineName}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {request.faultType}
                    </div>
                  </div>
                  
                  {!request.arrivedAt && (
                    <div>
                      <button
                        onClick={() => handleMarkArrived(request.id)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: 'rgba(147, 51, 234, 0.8)',
                          border: '1px solid rgba(147, 51, 234, 0.3)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'rgba(147, 51, 234, 1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'rgba(147, 51, 234, 0.8)';
                        }}
                      >
                        <MapPin size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />
                        Geldim
                      </button>
                      <p style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        textAlign: 'center',
                        marginTop: '0.25rem',
                        fontStyle: 'italic'
                      }}>
                        ⚠️ Sadece bakım personeli tarafından basılacaktır
                      </p>
                    </div>
                  )}
                  
                  {request.arrivedAt && !request.completedAt && (
                    <button
                      onClick={() => handleCompleteMaintenance(request.id)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(34, 197, 94, 0.8)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        marginTop: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.8)';
                      }}
                    >
                      <CheckCircle size={14} style={{ marginRight: '0.25rem', display: 'inline' }} />
                      Tamamlandı
                    </button>
                  )}
                  
                  {request.completedAt && (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      borderRadius: '8px',
                      color: '#22c55e',
                      fontSize: '0.8rem',
                      textAlign: 'center'
                    }}>
                      ✓ Tamamlandı
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alt Butonlar */}
      <div className="bottom-buttons">
        {/* İş emri sadece iş yokken girilebilir; devam eden işte değiştirme yok */}
        {!currentOrder && (
          <button 
            className="secondary-button"
            onClick={() => setShowOrderInput(true)}
          >
            <QrCode size={18} />
            İş Emri Gir
          </button>
        )}
        <button 
          className="primary-button"
          onClick={() => setShowStopReason(true)}
          disabled={machineStatus === 'running'}
        >
          <AlertTriangle size={18} />
          Duruş Sebebi
        </button>
        <button 
          className="danger-button"
          onClick={handleWorkEnd}
          disabled={machineStatus === 'running'}
        >
          <CheckCircle size={18} />
          İş Sonu
        </button>
        {/* Arıza Bildirimi Butonu - bottomBar içinde, sağda - Framer Motion ile (PC) / Direkt tıklama (Mobil) */}
        <motion.button
          className="maintenance-button-minimal"
          onClick={() => {
            // Mobilde direkt modal aç (window.innerWidth <= 768)
            if (window.innerWidth <= 768) {
              setShowMaintenanceModal(true);
              return;
            }
            
            // PC'de animasyonlu açılma
            if (maintenanceButtonExpanded) {
              // Timeout'u temizle
              if (maintenanceButtonTimeoutRef.current) {
                clearTimeout(maintenanceButtonTimeoutRef.current);
                maintenanceButtonTimeoutRef.current = null;
              }
              setMaintenanceButtonExpanded(false);
              setShowMaintenanceModal(true);
            } else {
              setMaintenanceButtonExpanded(true);
              // Önceki timeout'u temizle
              if (maintenanceButtonTimeoutRef.current) {
                clearTimeout(maintenanceButtonTimeoutRef.current);
              }
              // 5 saniye sonra otomatik kapan
              maintenanceButtonTimeoutRef.current = setTimeout(() => {
                setMaintenanceButtonExpanded(false);
                maintenanceButtonTimeoutRef.current = null;
              }, 5000);
            }
          }}
          title="Arıza Bildirimi"
          layout
          animate={{
            width: maintenanceButtonExpanded ? 140 : 32,
            paddingLeft: maintenanceButtonExpanded ? '12px' : '0px',
            paddingRight: maintenanceButtonExpanded ? '12px' : '0px',
            gap: maintenanceButtonExpanded ? '8px' : '0px',
          }}
          transition={{
            duration: 0.4,
            ease: [0.4, 0, 0.2, 1],
            layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
          }}
          style={{
            justifyContent: maintenanceButtonExpanded ? 'flex-start' : 'center',
          }}
        >
          <motion.div
            animate={{
              rotate: maintenanceButtonExpanded ? 360 : 0,
            }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{ 
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              marginRight: maintenanceButtonExpanded ? 8 : 0,
            }}
          >
            <AlertTriangle size={16} />
          </motion.div>
          <AnimatePresence>
            {maintenanceButtonExpanded && (
              <motion.span
                key="maintenance-text"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 200 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1],
                  opacity: { 
                    duration: 0.3,
                    delay: 0.05,
                  },
                  maxWidth: {
                    duration: 0.4,
                    ease: [0.4, 0, 0.2, 1],
                  },
                }}
                style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  display: 'inline-block',
                  fontSize: '0.75rem', 
                  fontWeight: 600, 
                  color: '#ef4444' 
                }}
              >
                Arıza Bildirimi
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Paylaşımlı Duruş Bilgi Modalı */}

      {/* Duruş Sebebi Modal'ı - DÜZELTİLMİŞ HALİ */}
      {showStopReason && (
        <div 
          className="stop-reason-modal"
          style={window.innerWidth <= 768 ? {
            // Mobil: CSS'te tanımlı, inline style minimal
            position: 'fixed',
            zIndex: 99999
          } : {
            // PC: Normal modal
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
            className="stop-reason-modal-content"
            style={window.innerWidth <= 768 ? {
              // Mobil: CSS'te tanımlı, inline style minimal - genişlik sınırlaması yok
              backgroundColor: '#1e293b',
              overflowY: 'auto',
              width: '100%',
              maxWidth: '100%'
            } : {
              // PC: Normal modal içeriği
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
            className="no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal başlığı */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              rowGap: '0.75rem',
              columnGap: '0.75rem',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div>
                <h2 style={{ color: '#f8fafc', fontSize: '2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Duruş Sebebi Seçin
                </h2>
                <div style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#cbd5e1',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <span style={{ fontWeight: 700, color: '#e2e8f0' }}>Aktif Sebep:</span>
                  {selectedStopReasonId && selectedStopCategory ? (
                    <span style={{ color: '#e2e8f0' }}>
                      {selectedStopReason} <span style={{ color: '#94a3b8' }}>({selectedStopCategory}-{selectedStopReasonId})</span>
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Seçili sebep yok</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      borderRadius: '12px',
                      color: '#3b82f6',
                      cursor: isSplittingStoppage ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      minWidth: '170px',
                      opacity: isSplittingStoppage ? 0.6 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (isSplittingStoppage) return;
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                      e.target.style.transform = 'scale(1.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                      e.target.style.transform = 'scale(1)';
                    }}
                    onClick={handleSplitStoppage}
                    disabled={isSplittingStoppage}
                  >
                    <AlertTriangle size={20} style={{ marginRight: '0.5rem' }} />
                    {isSplittingStoppage ? 'Kaydediliyor...' : 'Paylaşımlı Duruş'}
                  </button>
                </div>
                <button 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontSize: '0.9rem',
                    fontWeight: 600
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
                    handleWorkEnd();
                  }}
                >
                  <CheckCircle size={20} style={{ marginRight: '0.5rem' }} />
                  İş Sonu
                </button>
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
            </div>
            
            {/* Duruş sebebi kategorileri */}
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
            zIndex: 100000
          }}
          onClick={handleCancelStopReason}
        >
          <div 
            style={{
              backgroundColor: '#1e293b',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '450px',
              width: '90%',
              maxHeight: '80vh',
              border: '1px solid rgba(148, 163, 184, 0.3)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Onay başlığı */}
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem',
              flex: '1'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.75rem'
              }}>
                <CheckCircle size={24} color="#3b82f6" />
              </div>
              <h2 style={{ 
                color: '#f8fafc', 
                fontSize: '1.25rem', 
                fontWeight: 700,
                marginBottom: '0.5rem',
                lineHeight: '1.3'
              }}>
                Duruş Sebebi Onayı
              </h2>
              <p style={{ 
                color: '#94a3b8', 
                fontSize: '0.9rem',
                lineHeight: '1.4',
                margin: 0
              }}>
                <strong style={{ color: '#f8fafc' }}>{selectedReason}</strong> sebebini seçmeyi onaylıyor musunuz?
              </p>
            </div>
            
            {/* Butonlar */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <button
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                  e.target.style.transform = 'scale(1)';
                }}
                onClick={handleCancelStopReason}
              >
                İptal
              </button>
              
              <button
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '12px',
                  color: '#22c55e',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.3)';
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                  e.target.style.transform = 'scale(1)';
                }}
                onClick={handleConfirmStopReason}
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
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '450px',
            width: '90%',
            maxHeight: '80vh',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            textAlign: 'center',
            animation: 'scaleIn 0.3s ease',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Icon */}
            <div style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              flexShrink: 0
            }}>
              <CheckCircle size={30} color="#ef4444" />
            </div>

            {/* Başlık */}
            <h2 style={{ 
              color: '#f8fafc', 
              fontSize: '1.4rem', 
              fontWeight: 700, 
              marginBottom: '0.75rem',
              lineHeight: '1.3',
              flex: '1'
            }}>
              İş Sonu Onayı
            </h2>

            {/* Mesaj */}
            <p style={{ 
              color: '#cbd5e1', 
              fontSize: '0.95rem', 
              marginBottom: '1.5rem',
              lineHeight: '1.4',
              flex: '1'
            }}>
              Mevcut iş emrini sonlandırmak ve üretimi durdurmak istediğinizden emin misiniz?
            </p>

            {/* Butonlar */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexShrink: 0
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
                  backgroundColor: isEndingWork ? 'rgba(148, 163, 184, 0.6)' : 'rgba(239, 68, 68, 0.8)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isEndingWork ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  if (isEndingWork) return;
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 1)';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                }}
                onMouseLeave={(e) => {
                  if (isEndingWork) return;
                  e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.8)';
                  e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onClick={handleConfirmWorkEnd}
                disabled={isEndingWork}
              >
                {isEndingWork ? 'İş Sonu İşleniyor...' : 'İş Sonu'}
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
          zIndex: 9999998
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '20px',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
            animation: 'scaleIn 0.3s ease'
          }}
          className="no-scrollbar"
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <QrCode size={20} color="#3b82f6" />
                </div>
                <h2 style={{ 
                  color: '#f8fafc', 
                  fontSize: '1.5rem', 
                  fontWeight: 700,
                  margin: 0
                }}>
                  {showNewOrderConfirmation ? 'İş Emri Onayı' : 'Yeni İş Emri Girişi'}
                </h2>
              </div>
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
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
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Yeni İş Emri Onay Sistemi */}
              {showNewOrderConfirmation && newOrderData ? (
                <div style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Info size={14} color="#3b82f6" />
                    </div>
                    <h3 style={{
                      color: '#3b82f6',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      margin: 0
                    }}>
                      İş Emri Bilgileri
                    </h3>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem',
                    marginBottom: '0.5rem'
                  }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('jobOrderNo')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.siparis_no}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('stockName')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.stok_adi}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('productionType')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.uretim_tipi}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('totalQuantity')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.toplam_miktar?.toLocaleString()}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('remainingQuantity')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.kalan_miktar?.toLocaleString()}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('setCount')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.set_sayisi}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('cylinderCircumference')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.silindir_cevresi}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('targetSpeed')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.hedef_hiz}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{`${translate('bundle')}:`}</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.bundle}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Hız (Orijinal):</span>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.9rem' }}>{newOrderData.hiz}</div>
                    </div>
                    </div>
                    </div>
              ) : null}

              {!showNewOrderConfirmation && (
                <>
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
                  Yeni İş Emri Numarası
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
                        onClick={(e) => {
                          // Textbox'ı temizle ve seç
                          setOrderNumber('');
                          openVirtualKeyboard('orderNumber', '', e);
                        }}
                    style={{
                      flex: 1,
                      padding: '1rem 1.25rem',
                      backgroundColor: 'rgba(51, 65, 85, 0.6)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '1rem',
                      outline: 'none',
                          transition: 'all 0.2s ease',
                          cursor: 'pointer'
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
                        onClick={fetchOrderData}
                        disabled={isLoadingOrder}
                      >
                        {isLoadingOrder ? (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTop: '2px solid #ffffff',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                        ) : (
                          <Search size={20} />
                        )}

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
                </>
              )}
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
                onClick={showNewOrderConfirmation ? handleCancelNewOrder : () => setShowOrderInput(false)}
              >
                İptal
              </button>
              
              {showNewOrderConfirmation && newOrderData ? (
                /* Yeni İş Emri Onay Butonları */
                <>
                  <button 
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'rgba(51, 65, 85, 0.6)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '100px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.8)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(51, 65, 85, 0.6)';
                    }}
                    onClick={() => {
                      setShowNewOrderConfirmation(false);
                      setNewOrderData(null);
                    }}
                  >
                    Geri
                  </button>
                  
                  
                  <button 
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: 'rgba(34, 197, 94, 0.8)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      minWidth: '100px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.8)';
                    }}
                    onClick={handleConfirmNewOrder}
                  >
                    Onayla
                  </button>
                </>
              ) : (
                /* Normal Sorgula Butonu */
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
              )}
            </div>
          </div>
        </div>
      )}


      {/* Notifications */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000100,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {notifications.map(notification => {
          const icons = {
            success: CheckCircle,
            error: AlertCircle,
            warning: AlertTriangle,
            info: Info
          };
          
          const colors = {
            success: {
              bg: 'rgba(34, 197, 94, 0.95)',
              border: 'rgba(34, 197, 94, 0.3)',
              text: '#ffffff'
            },
            error: {
              bg: 'rgba(239, 68, 68, 0.95)',
              border: 'rgba(239, 68, 68, 0.3)',
              text: '#ffffff'
            },
            warning: {
              bg: 'rgba(245, 158, 11, 0.95)',
              border: 'rgba(245, 158, 11, 0.3)',
              text: '#ffffff'
            },
            info: {
              bg: 'rgba(59, 130, 246, 0.95)',
              border: 'rgba(59, 130, 246, 0.3)',
              text: '#ffffff'
            }
          };
          
          const Icon = icons[notification.type];
          const color = colors[notification.type];
          
          return (
            <div
              key={notification.id}
              style={{
                backgroundColor: color.bg,
                border: `1px solid ${color.border}`,
                borderRadius: '12px',
                padding: '16px',
                minWidth: '300px',
                maxWidth: '400px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(10px)',
                animation: 'slideInRight 0.3s ease-out',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <Icon size={20} color={color.text} />
              <span style={{
                color: color.text,
                fontSize: '14px',
                fontWeight: '500',
                flex: 1
              }}>
                {notification.message}
              </span>
              <button
                onClick={() => removeNotification(notification.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: color.text,
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.target.style.opacity = '0.7';
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Virtual Keyboard */}
      <VirtualKeyboard
        isVisible={showVirtualKeyboard}
        onClose={closeVirtualKeyboard}
        onInput={handleKeyboardInput}
        currentValue={keyboardValue}
        placeholder=""
        mode={keyboardMode}
        position={keyboardPosition}
        onSwitchMode={switchKeyboardMode}
      />
      <NumericKeypad
        isVisible={showNumericKeypad}
        onClose={closeVirtualKeyboard}
        onInput={handleKeyboardInput}
        currentValue={orderNumber}
        position={keyboardPosition}
      />

      {/* Arıza Bildirimi Modal */}
      {showMaintenanceModal && (
        <MaintenanceRequestModal
          isOpen={showMaintenanceModal}
          onClose={() => {
            console.log('Modal kapatılıyor');
            setShowMaintenanceModal(false);
          }}
          machine={{
            name: machineName,
            machineName: machineName,
            tableName: machineTableName,
            machineTableName: machineTableName
          }}
          currentLanguage={language}
        />
      )}

    </div>
  );



};

const MachineScreenApp = ({ machineInfo, language = 'tr' }) => {
  const machineId = machineInfo?.id ?? machineInfo?.assignedMachineId ?? null;
  const machineTableName = machineInfo?.tableName ?? machineInfo?.assignedMachineTable ?? null;
  const machineName = machineInfo?.name ?? machineInfo?.machineName ?? machineInfo?.assignedMachineName ?? '';

  const machineApi = useMemo(() => createMachineApi(machineTableName), [machineTableName]);

  const machineContextValue = useMemo(() => ({
    machineApi,
    machineId,
    machineTableName,
    machineName,
    language,
  }), [machineApi, machineId, machineTableName, machineName, language]);

  if (!machineTableName) {
  return (
      <div className="w-full h-full flex items-center justify-center text-center text-red-600 dark:text-red-400 font-semibold text-lg">
        Bu kullanıcıya atanmış bir makine bulunamadı. Lütfen sistem yöneticisine başvurun.
      </div>
    );
  }

  return (
    <MachineScreenContext.Provider value={machineContextValue}>
    <ThemeProvider>
      <div className="machine-screen-root">
          <MachineScreenInner
            machineApi={machineApi}
            machineTableName={machineTableName}
            machineName={machineName}
            language={language}
          />
      </div>
    </ThemeProvider>
    </MachineScreenContext.Provider>
  );
};

export default MachineScreenApp;

