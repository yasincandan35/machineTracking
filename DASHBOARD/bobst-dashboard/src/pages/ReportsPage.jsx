import React, { useState, useEffect, useContext } from 'react';
import { createMachineApi } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNotification } from '../contexts/NotificationContext';
import { getTranslation } from '../utils/translations';
import ReportGenerator from '../components/Reports/ReportGenerator';
import { 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  Clock,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  PieChart,
  Users,
  User,
  Activity
} from 'lucide-react';

const ReportsPage = ({ darkMode = false, currentLanguage = 'tr', selectedMachine }) => {
  const { user, token } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // State management
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedReports, setExpandedReports] = useState(new Set());
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Arama ve sayfalandırma
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Duruş verileri için state'ler
  const [stoppageData, setStoppageData] = useState([]);
  const [stoppageSummary, setStoppageSummary] = useState([]);
  const [loadingStoppage, setLoadingStoppage] = useState(false);
  
  // Operatör verileri için state'ler
  const [operatorSummary, setOperatorSummary] = useState([]);
  const [loadingOperator, setLoadingOperator] = useState(false);
  
  // Hız grafiği için state'ler
  const [speedData, setSpeedData] = useState([]);
  const [loadingSpeed, setLoadingSpeed] = useState(false);
  
  // OEE için state'ler
  const [oeeData, setOeeData] = useState(null);
  const [loadingOee, setLoadingOee] = useState(false);

  // Dil yönetimi artık Dashboard'dan geliyor, bu useEffect kaldırıldı

  // Load reports - DİNAMİK IP
  const loadReports = async () => {
    if (!selectedMachine || selectedMachine.id === -1 || !selectedMachine.tableName) {
      console.warn('⚠️ Makine seçilmedi');
      return;
    }

    setLoading(true);
    try {
      const machineApi = createMachineApi(selectedMachine);
      const response = await machineApi.get('/reports?limit=1000');
      if (response.data.success) {
        setReports(response.data.data || []);
        console.log(`✅ ${response.data.data?.length || 0} rapor yüklendi`);
      } else {
        showError(response.data.message || 'Raporlar yüklenemedi');
      }
    } catch (error) {
      console.error('Raporlar yüklenemedi:', error);
      showError(
        getTranslation('reportsLoadError', currentLanguage),
        getTranslation('notificationError', currentLanguage)
      );
    } finally {
      setLoading(false);
    }
  };

  // Duruş verilerini yükle
  const loadStoppageData = async (startTime, endTime) => {
    if (!selectedMachine || selectedMachine.id === -1 || !selectedMachine.tableName) {
      console.warn('⚠️ Makine seçilmedi');
      return;
    }
    
    try {
      console.log('🔄 Duruş verileri yükleniyor:', { startTime, endTime });
      setLoadingStoppage(true);
      const params = new URLSearchParams();
      if (startTime) params.append('start', startTime);
      if (endTime) params.append('end', endTime);
      
      const machineApi = createMachineApi(selectedMachine);
      console.log('📡 Duruş API çağrısı:', `/reports/stoppages?${params.toString()}`);
      const response = await machineApi.get(`/reports/stoppages?${params.toString()}`);
      console.log('📊 Duruş verileri yanıtı:', response.data);
      
      const summaryResponse = await machineApi.get(`/reports/stoppage-summary?${params.toString()}`);
      console.log('📊 Duruş özeti yanıtı:', summaryResponse.data);
      
      if (response.data.success) {
        setStoppageData(response.data.data);
        console.log('✅ Duruş verileri yüklendi:', response.data.data?.length || 0, 'kayıt');
      }
      if (summaryResponse.data.success) {
        setStoppageSummary(summaryResponse.data.data);
        console.log('✅ Duruş özeti yüklendi:', summaryResponse.data.data?.length || 0, 'kayıt');
      }
    } catch (error) {
      console.error('❌ Duruş verileri yüklenemedi:', error);
    } finally {
      setLoadingStoppage(false);
    }
  };

  // Operatör verilerini yükle
  const loadOperatorData = async (startTime, endTime) => {
    if (!selectedMachine || selectedMachine.id === -1 || !selectedMachine.tableName) {
      console.warn('⚠️ Makine seçilmedi');
      return;
    }
    
    try {
      setLoadingOperator(true);
      const params = new URLSearchParams();
      if (startTime) params.append('start', startTime);
      if (endTime) params.append('end', endTime);
      
      const machineApi = createMachineApi(selectedMachine);
      console.log('🔄 Operatör verileri yükleniyor:', { startTime, endTime });
      
      const response = await machineApi.get(`/reports/operator-summary?${params.toString()}`);
      
      console.log('📊 Operatör verileri yanıtı:', response.data);
      
      if (response.data.success) {
        setOperatorSummary(response.data.data || []);
        console.log('✅ Operatör verileri yüklendi:', response.data.data?.length || 0, 'kayıt');
      } else {
        console.error('❌ Operatör verileri yüklenemedi:', response.data.error);
        setOperatorSummary([]);
      }
    } catch (error) {
      console.error('❌ Operatör verileri yüklenirken hata:', error);
      setOperatorSummary([]);
    } finally {
      setLoadingOperator(false);
    }
  };

  // Hız verilerini yükle - gerçek veritabanından
  const loadSpeedData = async (startTime, endTime) => {
    if (!selectedMachine || selectedMachine.id === -1 || !selectedMachine.tableName) {
      console.warn('⚠️ Makine seçilmedi');
      setSpeedData([]);
      return;
    }

    try {
      setLoadingSpeed(true);
      
      const params = new URLSearchParams();
      if (startTime) params.append('start', startTime);
      if (endTime) params.append('end', endTime);
      
      const machineApi = createMachineApi(selectedMachine);
      console.log('🔄 Hız verileri yükleniyor:', { startTime, endTime });
      
      const response = await machineApi.get(`/reports/speed-data?${params.toString()}`);
      
      console.log('📊 Hız verileri yanıtı:', response.data);
      
      if (response.data.success) {
        const rawData = response.data.data || [];
        
        // Veriyi grafik için formatla ve örnekleme yap
        let processedData = rawData;
        
        // Eğer çok fazla veri varsa örnekleme yap
        if (rawData.length > 2000) {
          const step = Math.ceil(rawData.length / 2000);
          processedData = rawData.filter((_, index) => index % step === 0);
          console.log(`📊 Veri örnekleme: ${rawData.length} -> ${processedData.length} kayıt`);
        }
        
        const formattedData = processedData.map(item => {
          const timestamp = new Date(item.timestamp);
          const timeStr = timestamp.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          return {
            time: timeStr,
            actualSpeed: item.machineSpeed,
            targetSpeed: selectedReport?.hedef_hiz || 200 // JobEndReports'tan hedef hızı al
          };
        });
        
        setSpeedData(formattedData);
        console.log('✅ Hız verileri yüklendi:', formattedData.length, 'kayıt');
      } else {
        console.error('❌ Hız verileri yüklenemedi:', response.data.error);
        setSpeedData([]);
      }
    } catch (error) {
      console.error('❌ Hız verileri yüklenirken hata:', error);
      setSpeedData([]);
    } finally {
      setLoadingSpeed(false);
    }
  };

  // OEE verilerini yükle
  const loadOEEData = async (reportId) => {
    if (!selectedMachine || selectedMachine.id === -1 || !selectedMachine.tableName) {
      console.warn('⚠️ Makine seçilmedi');
      return;
    }
    
    try {
      setLoadingOee(true);
      
      const machineApi = createMachineApi(selectedMachine);
      console.log('🔄 OEE verileri yükleniyor:', { reportId });
      
      const response = await machineApi.get(`/reports/oee-calculation/${reportId}`);
      
      console.log('📊 OEE verileri yanıtı:', response.data);
      
      if (response.data.success) {
        console.log('📊 OEE Ham Veriler:', response.data.data);
        setOeeData(response.data.data);
        console.log('✅ OEE verileri yüklendi');
      } else {
        console.error('❌ OEE verileri yüklenemedi:', response.data.error);
        setOeeData(null);
      }
    } catch (error) {
      console.error('❌ OEE verileri yüklenirken hata:', error);
      setOeeData(null);
    } finally {
      setLoadingOee(false);
    }
  };

  useEffect(() => {
    if (token && selectedMachine?.tableName && selectedMachine.id !== -1) {
      loadReports();
    }
  }, [token, selectedMachine?.tableName, selectedMachine?.id]); // 🆕 Makina değişince yeniden yükle

  // Toggle report expansion
  const toggleReportExpansion = (reportId) => {
    const newExpanded = new Set(expandedReports);
    if (newExpanded.has(reportId)) {
      newExpanded.delete(reportId);
    } else {
      newExpanded.add(reportId);
    }
    setExpandedReports(newExpanded);
  };

  // Show report details
  const showReportDetails = (report) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  // Filtreleme ve sayfalandırma hesaplamaları
  const filteredReports = reports.filter(report => 
    report.siparis_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.is_adi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentReports = filteredReports.slice(startIndex, endIndex);

  // Sayfa değiştiğinde en üste scroll
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Arama değiştiğinde sayfa 1'e dön
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Modal açıldığında verileri yükle
  useEffect(() => {
    if (showDetailModal && selectedReport) {
      console.log('🔄 Modal açıldı, veriler yükleniyor...', {
        reportId: selectedReport.id,
        startTime: selectedReport.jobStartTime,
        endTime: selectedReport.jobEndTime
      });
      
      const loadData = async () => {
        try {
          await Promise.all([
            loadStoppageData(selectedReport.jobStartTime, selectedReport.jobEndTime),
            loadOperatorData(selectedReport.jobStartTime, selectedReport.jobEndTime),
            loadSpeedData(selectedReport.jobStartTime, selectedReport.jobEndTime),
            loadOEEData(selectedReport.id)
          ]);
          
          console.log('✅ Tüm veriler yüklendi!');
        } catch (error) {
          console.error('❌ Veri yükleme hatası:', error);
        }
      };
      
      loadData();
    }
  }, [showDetailModal, selectedReport]);

  // Export report to PDF - Modal'ın tıpatıp aynısı
  const exportToPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      const modalContent = document.querySelector('.fixed.inset-0');
      
      if (modalContent) {
        // Modal içeriğini al ve OEE bileşenlerini düzelt
        let modalHTML = modalContent.innerHTML;
        
        // OEE bileşenlerini bul ve düzelt
        modalHTML = modalHTML.replace(
          /<div class="[^"]*oee-components[^"]*">(.*?)<\/div>/gs,
          (match, content) => {
            return `<div class="oee-components" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important;">${content}</div>`;
          }
        );
        
        // OEE component'lerini düzelt
        modalHTML = modalHTML.replace(
          /<div class="[^"]*oee-component[^"]*">(.*?)<\/div>/gs,
          (match, content) => {
            return `<div class="oee-component" style="background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important;">${content}</div>`;
          }
        );

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Rapor - ${selectedReport?.siparis_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { overflow: hidden; margin: 0; padding: 0; }
              .overflow-y-auto { overflow: visible !important; }
              .max-h-95vh { max-height: none !important; }
              .min-h-screen { min-height: auto !important; }
              .fixed { position: static !important; }
              .inset-0 { position: static !important; }
              .z-50 { z-index: auto !important; }
              .bg-black { background: transparent !important; }
              .bg-opacity-50 { background: transparent !important; }
              .shadow-lg { box-shadow: none !important; }
              .shadow-xl { box-shadow: none !important; }
              .p-8 { padding: 1rem !important; }
              .py-4 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
              .py-6 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
              .py-8 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
              .px-6 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
              .px-8 { padding-left: 1rem !important; padding-right: 1rem !important; }
              .pt-6 { padding-top: 0.75rem !important; }
              .pb-4 { padding-bottom: 0.5rem !important; }
              .pb-6 { padding-bottom: 0.75rem !important; }
              .mt-6 { margin-top: 0.75rem !important; }
              .mt-8 { margin-top: 1rem !important; }
              .mb-3 { margin-bottom: 0.5rem !important; }
              .mb-4 { margin-bottom: 0.75rem !important; }
              .mb-6 { margin-bottom: 1rem !important; }
              .mb-8 { margin-bottom: 1rem !important; }
              .gap-2 { gap: 0.25rem !important; }
              .gap-3 { gap: 0.5rem !important; }
              .gap-6 { gap: 0.75rem !important; }
              .gap-8 { gap: 1rem !important; }
              .space-y-2 > * + * { margin-top: 0.25rem !important; }
              .space-y-4 > * + * { margin-top: 0.5rem !important; }
              .space-y-6 > * + * { margin-top: 0.75rem !important; }
              .space-y-8 > * + * { margin-top: 1rem !important; }
              .text-xs { font-size: 0.65rem !important; line-height: 0.9rem !important; }
              .text-sm { font-size: 0.7rem !important; line-height: 1rem !important; }
              .text-base { font-size: 0.75rem !important; line-height: 1.1rem !important; }
              .text-lg { font-size: 0.8rem !important; line-height: 1.2rem !important; }
              .text-xl { font-size: 0.9rem !important; line-height: 1.3rem !important; }
              .text-2xl { font-size: 1rem !important; line-height: 1.4rem !important; }
              .text-3xl { font-size: 1.1rem !important; line-height: 1.5rem !important; }
              .text-4xl { font-size: 1.2rem !important; line-height: 1.6rem !important; }
              .h-48 { height: 6rem !important; }
              .h-64 { height: 8rem !important; }
              .h-80 { height: 10rem !important; }
              .h-96 { height: 12rem !important; }
              .w-48 { width: 6rem !important; }
              .w-64 { width: 8rem !important; }
              .w-80 { width: 10rem !important; }
              .w-96 { width: 12rem !important; }
              .max-w-6xl { max-width: 100% !important; width: 100% !important; }
              /* A4 sayfa boyutu */
              @page { 
                size: A4; 
                margin: 1cm; 
              }
              .w-full { width: 100% !important; }
              .mx-auto { margin-left: auto !important; margin-right: auto !important; }
              .oee-components { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important; width: 100% !important; max-width: 100% !important; }
              .oee-component { display: block !important; background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important; width: 100% !important; max-width: 100% !important; float: left !important; box-sizing: border-box !important; }
              .oee-component-value { font-size: 0.8rem !important; font-weight: 700 !important; margin-bottom: 0.25rem !important; }
              .oee-component-label { font-size: 0.6rem !important; color: #6b7280 !important; }
              @media print {
                @page { 
                  size: A4; 
                  margin: 1cm; 
                }
                body { margin: 0; padding: 0; overflow: visible !important; }
                .overflow-y-auto { overflow: visible !important; }
                .max-h-95vh { max-height: none !important; }
                .min-h-screen { min-height: auto !important; }
                .fixed { position: static !important; }
                .inset-0 { position: static !important; }
                .z-50 { z-index: auto !important; }
                .bg-black { background: transparent !important; }
                .bg-opacity-50 { background: transparent !important; }
                .shadow-lg { box-shadow: none !important; }
                .shadow-xl { box-shadow: none !important; }
                .page-break-inside-avoid { page-break-inside: avoid !important; }
                .grid { display: grid !important; }
                .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                /* OEE Components - Yazdırma için özel */
                div[class*="oee-components"] { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important; width: 100% !important; max-width: 100% !important; }
                div[class*="oee-component"] { display: block !important; background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important; width: 100% !important; max-width: 100% !important; float: left !important; box-sizing: border-box !important; }
                div[class*="oee-component-value"] { font-size: 0.8rem !important; font-weight: 700 !important; margin-bottom: 0.25rem !important; }
                div[class*="oee-component-label"] { font-size: 0.6rem !important; color: #6b7280 !important; }
                /* Flexbox fallback */
                .flex { display: flex !important; }
                .flex-row { flex-direction: row !important; }
                .justify-between { justify-content: space-between !important; }
                .items-center { align-items: center !important; }
                .gap-2 { gap: 0.5rem !important; }
                .gap-3 { gap: 0.75rem !important; }
                .gap-6 { gap: 1rem !important; }
                .gap-8 { gap: 1.5rem !important; }
              }
            </style>
          </head>
          <body>
            ${modalHTML}
          </body>
          </html>
        `);
        
        printWindow.document.close();
        // Grafiklerin render olması için yeterli süre bekle
        setTimeout(() => printWindow.print(), 1500);
        showSuccess('PDF yazdırma penceresi açıldı!');
      } else {
        showError('Modal içeriği bulunamadı!');
      }
    } catch (error) {
      console.error('PDF export error:', error);
      showError('PDF oluşturulurken hata oluştu: ' + error.message);
    }
  };

  // Print report - Modal'ın tıpatıp aynısı
  const printReport = () => {
    try {
      const printWindow = window.open('', '_blank');
      const modalContent = document.querySelector('.fixed.inset-0');
      
      if (modalContent) {
        // Modal içeriğini al ve OEE bileşenlerini düzelt
        let modalHTML = modalContent.innerHTML;
        
        // OEE bileşenlerini bul ve düzelt
        modalHTML = modalHTML.replace(
          /<div class="[^"]*oee-components[^"]*">(.*?)<\/div>/gs,
          (match, content) => {
            return `<div class="oee-components" style="display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important;">${content}</div>`;
          }
        );
        
        // OEE component'lerini düzelt
        modalHTML = modalHTML.replace(
          /<div class="[^"]*oee-component[^"]*">(.*?)<\/div>/gs,
          (match, content) => {
            return `<div class="oee-component" style="background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important;">${content}</div>`;
          }
        );

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Rapor - ${selectedReport?.siparis_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { overflow: hidden; margin: 0; padding: 0; }
              .overflow-y-auto { overflow: visible !important; }
              .max-h-95vh { max-height: none !important; }
              .min-h-screen { min-height: auto !important; }
              .fixed { position: static !important; }
              .inset-0 { position: static !important; }
              .z-50 { z-index: auto !important; }
              .bg-black { background: transparent !important; }
              .bg-opacity-50 { background: transparent !important; }
              .shadow-lg { box-shadow: none !important; }
              .shadow-xl { box-shadow: none !important; }
              .p-8 { padding: 1rem !important; }
              .py-4 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
              .py-6 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
              .py-8 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
              .px-6 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
              .px-8 { padding-left: 1rem !important; padding-right: 1rem !important; }
              .pt-6 { padding-top: 0.75rem !important; }
              .pb-4 { padding-bottom: 0.5rem !important; }
              .pb-6 { padding-bottom: 0.75rem !important; }
              .mt-6 { margin-top: 0.75rem !important; }
              .mt-8 { margin-top: 1rem !important; }
              .mb-3 { margin-bottom: 0.5rem !important; }
              .mb-4 { margin-bottom: 0.75rem !important; }
              .mb-6 { margin-bottom: 1rem !important; }
              .mb-8 { margin-bottom: 1rem !important; }
              .gap-2 { gap: 0.25rem !important; }
              .gap-3 { gap: 0.5rem !important; }
              .gap-6 { gap: 0.75rem !important; }
              .gap-8 { gap: 1rem !important; }
              .space-y-2 > * + * { margin-top: 0.25rem !important; }
              .space-y-4 > * + * { margin-top: 0.5rem !important; }
              .space-y-6 > * + * { margin-top: 0.75rem !important; }
              .space-y-8 > * + * { margin-top: 1rem !important; }
              .text-xs { font-size: 0.65rem !important; line-height: 0.9rem !important; }
              .text-sm { font-size: 0.7rem !important; line-height: 1rem !important; }
              .text-base { font-size: 0.75rem !important; line-height: 1.1rem !important; }
              .text-lg { font-size: 0.8rem !important; line-height: 1.2rem !important; }
              .text-xl { font-size: 0.9rem !important; line-height: 1.3rem !important; }
              .text-2xl { font-size: 1rem !important; line-height: 1.4rem !important; }
              .text-3xl { font-size: 1.1rem !important; line-height: 1.5rem !important; }
              .text-4xl { font-size: 1.2rem !important; line-height: 1.6rem !important; }
              .h-48 { height: 6rem !important; }
              .h-64 { height: 8rem !important; }
              .h-80 { height: 10rem !important; }
              .h-96 { height: 12rem !important; }
              .w-48 { width: 6rem !important; }
              .w-64 { width: 8rem !important; }
              .w-80 { width: 10rem !important; }
              .w-96 { width: 12rem !important; }
              .max-w-6xl { max-width: 100% !important; width: 100% !important; }
              /* A4 sayfa boyutu */
              @page { 
                size: A4; 
                margin: 1cm; 
              }
              .w-full { width: 100% !important; }
              .mx-auto { margin-left: auto !important; margin-right: auto !important; }
              .oee-components { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important; width: 100% !important; max-width: 100% !important; }
              .oee-component { display: block !important; background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important; width: 100% !important; max-width: 100% !important; float: left !important; box-sizing: border-box !important; }
              .oee-component-value { font-size: 0.8rem !important; font-weight: 700 !important; margin-bottom: 0.25rem !important; }
              .oee-component-label { font-size: 0.6rem !important; color: #6b7280 !important; }
              @media print {
                @page { 
                  size: A4; 
                  margin: 1cm; 
                }
                body { margin: 0; padding: 0; overflow: visible !important; }
                .overflow-y-auto { overflow: visible !important; }
                .max-h-95vh { max-height: none !important; }
                .min-h-screen { min-height: auto !important; }
                .fixed { position: static !important; }
                .inset-0 { position: static !important; }
                .z-50 { z-index: auto !important; }
                .bg-black { background: transparent !important; }
                .bg-opacity-50 { background: transparent !important; }
                .shadow-lg { box-shadow: none !important; }
                .shadow-xl { box-shadow: none !important; }
                .page-break-inside-avoid { page-break-inside: avoid !important; }
                .grid { display: grid !important; }
                .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
                .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
                .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
                /* OEE Components - Yazdırma için özel */
                div[class*="oee-components"] { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 0.5rem !important; width: 100% !important; max-width: 100% !important; }
                div[class*="oee-component"] { display: block !important; background: white !important; border: 1px solid #cceeff !important; padding: 0.5rem !important; text-align: center !important; width: 100% !important; max-width: 100% !important; float: left !important; box-sizing: border-box !important; }
                div[class*="oee-component-value"] { font-size: 0.8rem !important; font-weight: 700 !important; margin-bottom: 0.25rem !important; }
                div[class*="oee-component-label"] { font-size: 0.6rem !important; color: #6b7280 !important; }
                /* Flexbox fallback */
                .flex { display: flex !important; }
                .flex-row { flex-direction: row !important; }
                .justify-between { justify-content: space-between !important; }
                .items-center { align-items: center !important; }
                .gap-2 { gap: 0.5rem !important; }
                .gap-3 { gap: 0.75rem !important; }
                .gap-6 { gap: 1rem !important; }
                .gap-8 { gap: 1.5rem !important; }
              }
            </style>
          </head>
          <body>
            ${modalHTML}
          </body>
          </html>
        `);
        
        printWindow.document.close();
        // Grafiklerin render olması için yeterli süre bekle
        setTimeout(() => printWindow.print(), 1500);
        showSuccess('Yazdırma penceresi açıldı!');
      } else {
        showError('Modal içeriği bulunamadı!');
      }
    } catch (error) {
      console.error('Print error:', error);
      showError('Yazdırma sırasında hata oluştu: ' + error.message);
    }
  };

  // Format duration
  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '00:00:00';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    
    if (isNaN(diffMs)) return '00:00:00';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format duration from seconds
  const formatDurationFromSeconds = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Dakikaları ss:dd:ss formatına çevir
  const formatDurationFromMinutes = (totalMinutes) => {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{getTranslation('reports', currentLanguage)}</h1>
          <p className="text-gray-600 dark:text-gray-400">{getTranslation('reportsDescription', currentLanguage)}</p>
        </div>

        {/* Reports List */}
        <div className={`rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText size={24} />
                {getTranslation('recentReports', currentLanguage)}
              </h2>
              <div className="text-sm text-gray-500">
                {filteredReports.length} rapor bulundu
              </div>
            </div>
            
            {/* Arama Kutusu */}
            <div className="relative">
              <input
                type="text"
                placeholder="İş emri veya iş adına göre ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full px-4 py-3 pl-10 rounded-lg border-2 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all`}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">{getTranslation('loading', currentLanguage)}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <FileText size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{getTranslation('noReports', currentLanguage)}</p>
            </div>
          ) : currentReports.length === 0 ? (
            <div className="p-12 text-center">
              <FileText size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {searchTerm ? 'Arama kriterinize uygun rapor bulunamadı' : 'Henüz rapor bulunmuyor'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Aramayı Temizle
                </button>
              )}
            </div>
          ) : (
            <>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {currentReports.map((report) => (
                <div key={report.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="text-lg font-semibold">{report.siparis_no}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          report.CompletionPercentage >= 100 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {report.CompletionPercentage >= 100 ? getTranslation('completed', currentLanguage) : getTranslation('inProgress', currentLanguage)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>{formatDate(report.jobEndTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} />
                          <span>{formatDuration(report.jobStartTime, report.jobEndTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Target size={16} />
                          <span>{report.actualProduction?.toLocaleString() || 0} adet</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={16} />
                          <span>%{report.completionPercentage || 0}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => toggleReportExpansion(report.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          darkMode 
                            ? 'hover:bg-gray-700' 
                            : 'hover:bg-gray-100'
                        }`}
                        title={expandedReports.has(report.id) ? getTranslation('hide', currentLanguage) : getTranslation('show', currentLanguage)}
                      >
                        {expandedReports.has(report.id) ? 
                          <ChevronDown size={20} /> : 
                          <ChevronRight size={20} />
                        }
                      </button>
                      
                      <button
                        onClick={() => showReportDetails(report)}
                        className={`p-2 rounded-lg transition-colors ${
                          darkMode 
                            ? 'hover:bg-gray-700' 
                            : 'hover:bg-gray-100'
                        }`}
                        title={getTranslation('showDetails', currentLanguage)}
                      >
                        <Eye size={20} />
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowDetailModal(true);
                          setTimeout(() => printReport(), 2500);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          darkMode 
                            ? 'hover:bg-gray-700' 
                            : 'hover:bg-gray-100'
                        }`}
                        title={getTranslation('printReport', currentLanguage)}
                      >
                        <FileText size={20} />
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedReport(report);
                          setShowDetailModal(true);
                          setTimeout(() => exportToPDF(), 2500);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          darkMode 
                            ? 'hover:bg-gray-700' 
                            : 'hover:bg-gray-100'
                        }`}
                        title={getTranslation('downloadPDF', currentLanguage)}
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedReports.has(report.id) && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Üretim Bilgileri</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{getTranslation('realProduction', currentLanguage)}:</span>
                              <span>{report.actualProduction?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('remainingWork', currentLanguage)}:</span>
                              <span>{report.remainingWork?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('completionRatio', currentLanguage)}:</span>
                              <span>%{report.completionPercentage || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('overProduction', currentLanguage)}:</span>
                              <span>{report.overProduction?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold mb-2">{getTranslation('consumptionDetails', currentLanguage)}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{getTranslation('ethylAlcohol', currentLanguage)}:</span>
                              <span>{report.ethylAlcoholConsumption?.toFixed(2) || 0}L</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('ethylAcetate', currentLanguage)}:</span>
                              <span>{report.ethylAcetateConsumption?.toFixed(2) || 0}L</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('paper', currentLanguage)}:</span>
                              <span>{report.paperConsumption?.toFixed(2) || 0}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('energyConsumption', currentLanguage) || 'Enerji Tüketimi'}:</span>
                              <span>{report.energyConsumptionKwh?.toFixed(2) || 0} kWh</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold mb-2">{getTranslation('wastageDetails', currentLanguage)}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span>{getTranslation('wastageBeforeDie', currentLanguage)}:</span>
                              <span>{report.wastageBeforeDie?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('wastageAfterDie', currentLanguage)}:</span>
                              <span>{report.wastageAfterDie?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('wastageRatio', currentLanguage)}:</span>
                              <span>%{report.wastageRatio?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('qualifiedBundle', currentLanguage)}:</span>
                              <span>{report.qualifiedBundle?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('defectiveBundle', currentLanguage)}:</span>
                              <span>{report.defectiveBundle?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('goodPallets', currentLanguage)}:</span>
                              <span>{report.goodPallets?.toLocaleString() || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{getTranslation('defectivePallets', currentLanguage)}:</span>
                              <span>{report.defectivePallets?.toLocaleString() || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  {/* Sayfa Bilgisi */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Sayfa {currentPage} / {totalPages} ({filteredReports.length} rapor)
                  </div>
                  
                  {/* Pagination Butonları */}
                  <div className="flex items-center gap-2">
                    {/* İlk Sayfa */}
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        currentPage === 1
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                      title="İlk sayfa"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {/* Önceki Sayfa */}
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 1
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      Önceki
                    </button>
                    
                    {/* Sayfa Numaraları */}
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, index) => {
                        const page = index + 1;
                        // Sadece mevcut sayfa etrafındaki 5 sayfayı göster
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 2 && page <= currentPage + 2)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`w-10 h-10 rounded-lg transition-colors ${
                                currentPage === page
                                  ? 'bg-blue-500 text-white font-semibold'
                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          page === currentPage - 3 ||
                          page === currentPage + 3
                        ) {
                          return <span key={page} className="px-2 text-gray-400">...</span>;
                        }
                        return null;
                      })}
                    </div>
                    
                    {/* Sonraki Sayfa */}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === totalPages
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      Sonraki
                    </button>
                    
                    {/* Son Sayfa */}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        currentPage === totalPages
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                      }`}
                      title="Son sayfa"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Report Detail Modal */}
        {showDetailModal && selectedReport && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDetailModal(false);
              }
            }}
          >
            <div className={`p-8 rounded-lg w-full max-w-6xl max-h-[95vh] overflow-y-auto ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">{getTranslation('reportDetails', currentLanguage)}</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <EyeOff size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sol Panel - Genel Bilgiler */}
                <div className="space-y-6">
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Target size={20} />
                      {getTranslation('jobOrderInfo', currentLanguage)}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('jobOrderNo', currentLanguage)}:</span>
                        <span className="font-medium">{selectedReport.siparis_no}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('totalQuantity', currentLanguage)}:</span>
                        <span>{selectedReport.toplam_miktar?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('remainingQuantity', currentLanguage)}:</span>
                        <span>{selectedReport.kalan_miktar?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('setCount', currentLanguage)}:</span>
                        <span>{selectedReport.set_sayisi || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('productionType', currentLanguage)}:</span>
                        <span>{selectedReport.uretim_tipi || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('stockName', currentLanguage)}:</span>
                        <span className="text-xs">{selectedReport.stok_adi || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('bundle', currentLanguage)}:</span>
                        <span>{selectedReport.bundle || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('cylinderCircumference', currentLanguage)}:</span>
                        <span>{selectedReport.silindir_cevresi || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('targetSpeed', currentLanguage)}:</span>
                        <span>{selectedReport.hedef_hiz || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock size={20} />
                      {getTranslation('timeInfo', currentLanguage)}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('startTime', currentLanguage)}:</span>
                        <span>{formatDate(selectedReport.jobStartTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('endTime', currentLanguage)}:</span>
                        <span>{formatDate(selectedReport.jobEndTime)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('duration', currentLanguage)}:</span>
                        <span className="font-medium">{formatDuration(selectedReport.jobStartTime, selectedReport.jobEndTime)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sağ Panel - Üretim ve Duruş Bilgileri */}
                <div className="space-y-6">
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp size={20} />
                      {getTranslation('productionDetails', currentLanguage)}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('realProduction', currentLanguage)}:</span>
                        <span className="font-medium">{selectedReport.actualProduction?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('remainingWork', currentLanguage)}:</span>
                        <span>{selectedReport.remainingWork?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('completionRatio', currentLanguage)}:</span>
                        <span className="font-medium">%{selectedReport.completionPercentage || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('overProduction', currentLanguage)}:</span>
                        <span>{selectedReport.overProduction?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle size={20} />
                      {getTranslation('wastageDetails', currentLanguage)}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('wastageBeforeDie', currentLanguage)}:</span>
                        <span>{selectedReport.wastageBeforeDie?.toFixed(2) || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('wastageAfterDie', currentLanguage)}:</span>
                        <span>{selectedReport.wastageAfterDie?.toFixed(2) || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('wastageRatio', currentLanguage)}:</span>
                        <span className="font-medium">%{selectedReport.wastageRatio?.toFixed(2) || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle size={20} />
                      {getTranslation('robotPalletizing', currentLanguage) || 'Robot Paletleme'}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('qualifiedBundle', currentLanguage)}:</span>
                        <span>{selectedReport.qualifiedBundle?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('defectiveBundle', currentLanguage)}:</span>
                        <span>{selectedReport.defectiveBundle?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('goodPallets', currentLanguage)}:</span>
                        <span>{selectedReport.goodPallets?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('defectivePallets', currentLanguage)}:</span>
                        <span>{selectedReport.defectivePallets?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle size={20} />
                      {getTranslation('consumptionDetails', currentLanguage)}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{getTranslation('ethylAlcohol', currentLanguage)}:</span>
                        <span>{selectedReport.ethylAlcoholConsumption?.toFixed(2) || 0}L</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('ethylAcetate', currentLanguage)}:</span>
                        <span>{selectedReport.ethylAcetateConsumption?.toFixed(2) || 0}L</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('paper', currentLanguage)}:</span>
                        <span>{selectedReport.paperConsumption?.toFixed(2) || 0}m</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{getTranslation('energyConsumption', currentLanguage)}:</span>
                        <span className="font-medium">{selectedReport.energyConsumptionKwh?.toFixed(2) || 0} kWh</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Duruş Dağılımı Pasta Grafiği */}
              <div className="mt-6">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <PieChart size={20} />
                    {getTranslation('stoppageDistribution', currentLanguage)}
                  </h4>
                  
                  {loadingStoppage ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : stoppageSummary.length > 0 ? (
                    <div className="space-y-4">
                      {/* Pasta Grafiği */}
                      <div className="flex items-center justify-center">
                        <div className="relative w-64 h-64">
                          <svg viewBox="0 0 200 200" className="w-full h-full">
                            {(() => {
                              const total = stoppageSummary.reduce((sum, item) => sum + item.totalDurationSeconds, 0);
                              let cumulativePercentage = 0;
                              const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316'];
                              
                              return stoppageSummary.map((item, index) => {
                                const percentage = (item.totalDurationSeconds / total) * 100;
                                const startAngle = (cumulativePercentage / 100) * 360;
                                const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
                                cumulativePercentage += percentage;
                                
                                const radius = 80;
                                const centerX = 100;
                                const centerY = 100;
                                
                                const startAngleRad = (startAngle - 90) * (Math.PI / 180);
                                const endAngleRad = (endAngle - 90) * (Math.PI / 180);
                                
                                const x1 = centerX + radius * Math.cos(startAngleRad);
                                const y1 = centerY + radius * Math.sin(startAngleRad);
                                const x2 = centerX + radius * Math.cos(endAngleRad);
                                const y2 = centerY + radius * Math.sin(endAngleRad);
                                
                                const largeArcFlag = percentage > 50 ? 1 : 0;
                                
                                const pathData = [
                                  `M ${centerX} ${centerY}`,
                                  `L ${x1} ${y1}`,
                                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                                  'Z'
                                ].join(' ');
                                
                                return (
                                  <path
                                    key={index}
                                    d={pathData}
                                    fill={colors[index % colors.length]}
                                    stroke="white"
                                    strokeWidth="2"
                                  />
                                );
                              });
                            })()}
                          </svg>
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {stoppageSummary.map((item, index) => {
                          const total = stoppageSummary.reduce((sum, i) => sum + i.totalDurationSeconds, 0);
                          const percentage = ((item.totalDurationSeconds / total) * 100).toFixed(1);
                          const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#f97316'];
                          
                          return (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div 
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: colors[index % colors.length] }}
                              ></div>
                              <div className="flex-1">
                                <div className="font-medium">
                                  {item.categoryName || 'Bilinmeyen'}
                                  {item.categoryId > 0 && item.reasonId > 0 && (
                                    <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({item.categoryId}-{item.reasonId})</span>
                                  )}
                                  {item.count > 0 && (
                                    <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">{item.count} kez</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">{item.reasonName || 'Bilinmeyen Sebep'}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatDurationFromSeconds(item.totalDurationSeconds)}</div>
                                <div className="text-gray-500 text-xs">({percentage}%)</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Özet Bilgiler */}
                      <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">{getTranslation('totalStoppage', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">
                              {formatDurationFromSeconds(stoppageSummary.reduce((sum, item) => sum + item.totalDurationSeconds, 0))}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('stoppageCount', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">
                              {stoppageSummary.reduce((sum, item) => sum + item.count, 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <PieChart size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Bu zaman aralığında duruş verisi bulunamadı</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Operatör/Vardiya Özeti */}
              <div className="mt-6">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Users size={20} />
                    {getTranslation('shiftAndOperatorWorkTimes', currentLanguage)}
                  </h4>
                  
                  {loadingOperator ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : operatorSummary.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {operatorSummary.map((operator, index) => (
                          <div key={index} className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'}`}>
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <User size={20} className="text-blue-600 dark:text-blue-300" />
                              </div>
                              <div>
                                <h5 className="font-medium">{operator.operatorName}</h5>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{operator.shiftName}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">{getTranslation('shiftWorkTime', currentLanguage)}:</span>
                                <span className="font-medium text-lg">
                                  {formatDurationFromSeconds(operator.totalWorkSeconds)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Toplam Özet */}
                      <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                        <div className="text-center">
                          <div className="text-sm text-gray-500 mb-1">{getTranslation('totalWorkTime', currentLanguage)}</div>
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatDurationFromSeconds(operatorSummary.reduce((sum, op) => sum + op.totalWorkSeconds, 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Bu zaman aralığında operatör verisi bulunamadı</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hız Grafiği */}
              <div className="mt-6">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity size={20} />
                    {getTranslation('machineSpeedGraph', currentLanguage)}
                  </h4>
                  
                  {loadingSpeed ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : speedData.length > 0 ? (
                    <div className="space-y-4">
                      {/* Hız Grafiği */}
                      <div className="relative h-64 w-full">
                        <svg viewBox="0 0 800 200" className="w-full h-full">
                          {/* Grid çizgileri */}
                          <defs>
                            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                              <path d="M 40 0 L 0 0 0 20" fill="none" stroke={darkMode ? '#374151' : '#e5e7eb'} strokeWidth="0.5"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" />
                          
                          {/* Y ekseni etiketleri */}
                          {(() => {
                            const maxSpeed = Math.max(...speedData.map(d => Math.max(d.actualSpeed, d.targetSpeed)));
                            const minSpeed = Math.min(...speedData.map(d => Math.min(d.actualSpeed, d.targetSpeed)));
                            const range = maxSpeed - minSpeed;
                            const padding = range * 0.1;
                            const yMin = minSpeed - padding;
                            const yMax = maxSpeed + padding;
                            
                            return [yMin, (yMin + yMax) / 2, yMax].map((value, index) => (
                              <text
                                key={index}
                                x="10"
                                y={200 - ((value - yMin) / (yMax - yMin)) * 180 + 10}
                                fontSize="12"
                                fill={darkMode ? '#9ca3af' : '#6b7280'}
                                textAnchor="start"
                              >
                                {Math.round(value)}
                              </text>
                            ));
                          })()}
                          
                          {/* X ekseni etiketleri */}
                          {speedData.map((point, index) => (
                            <text
                              key={index}
                              x={50 + (index * 700) / (speedData.length - 1)}
                              y="195"
                              fontSize="10"
                              fill={darkMode ? '#9ca3af' : '#6b7280'}
                              textAnchor="middle"
                            >
                              {point.time}
                            </text>
                          ))}
                          
                          {/* Hedef hız çizgisi */}
                          {(() => {
                            const maxSpeed = Math.max(...speedData.map(d => Math.max(d.actualSpeed, d.targetSpeed)));
                            const minSpeed = Math.min(...speedData.map(d => Math.min(d.actualSpeed, d.targetSpeed)));
                            const range = maxSpeed - minSpeed;
                            const padding = range * 0.1;
                            const yMin = minSpeed - padding;
                            const yMax = maxSpeed + padding;
                            
                            const points = speedData.map((point, index) => {
                              const x = 50 + (index * 700) / (speedData.length - 1);
                              const y = 200 - ((point.targetSpeed - yMin) / (yMax - yMin)) * 180;
                              return `${x},${y}`;
                            }).join(' ');
                            
                            return (
                              <polyline
                                points={points}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                              />
                            );
                          })()}
                          
                          {/* Gerçek hız çizgisi */}
                          {(() => {
                            const maxSpeed = Math.max(...speedData.map(d => Math.max(d.actualSpeed, d.targetSpeed)));
                            const minSpeed = Math.min(...speedData.map(d => Math.min(d.actualSpeed, d.targetSpeed)));
                            const range = maxSpeed - minSpeed;
                            const padding = range * 0.1;
                            const yMin = minSpeed - padding;
                            const yMax = maxSpeed + padding;
                            
                            const points = speedData.map((point, index) => {
                              const x = 50 + (index * 700) / (speedData.length - 1);
                              const y = 200 - ((point.actualSpeed - yMin) / (yMax - yMin)) * 180;
                              return `${x},${y}`;
                            }).join(' ');
                            
                            return (
                              <polyline
                                points={points}
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="3"
                              />
                            );
                          })()}
                        </svg>
                      </div>
                      
                      {/* Legend */}
                      <div className="flex items-center justify-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-blue-500"></div>
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{getTranslation('actualSpeed', currentLanguage)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-0.5 bg-red-500 border-dashed border-t-2"></div>
                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{getTranslation('targetSpeed', currentLanguage)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Activity size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Bu zaman aralığında hız verisi bulunamadı</p>
                    </div>
                  )}
                </div>
              </div>

              {/* OEE Hesaplama */}
              <div className="mt-6">
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp size={20} />
                    {getTranslation('oeeCalculation', currentLanguage)}
                  </h4>
                  
                  {loadingOee ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : oeeData ? (
                    <div className="space-y-6">
                      {/* OEE Ana Kartı */}
                      <div className={`p-6 rounded-lg text-center ${darkMode ? 'bg-gray-600' : 'bg-white'} border-2 border-blue-200`}>
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          %{oeeData.oee}
                        </div>
                        <div className="text-lg text-gray-600 dark:text-gray-300">{getTranslation('generalOEE', currentLanguage)}</div>
                      </div>

                      {/* OEE Bileşenleri */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Availability */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} border`}>
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            %{oeeData.availability}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{getTranslation('availability', currentLanguage)}</div>
                          <div className="text-xs text-gray-500">
                            Erişilebilirlik
                          </div>
                        </div>

                        {/* Performance */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} border`}>
                          <div className="text-2xl font-bold text-yellow-600 mb-1">
                            %{oeeData.performance}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{getTranslation('performance', currentLanguage)}</div>
                          <div className="text-xs text-gray-500">
                            Performans
                          </div>
                        </div>

                        {/* Quality */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} border`}>
                          <div className="text-2xl font-bold text-red-600 mb-1">
                            %{oeeData.quality}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">{getTranslation('quality', currentLanguage)}</div>
                          <div className="text-xs text-gray-500">
                            Kalite
                          </div>
                        </div>
                      </div>

                      {/* Detaylı Hesaplama */}
                      <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-600' : 'bg-white'} border mb-4`}>
                        <h5 className="font-semibold mb-3">{getTranslation('calculationDetails', currentLanguage)}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">{getTranslation('plannedTime', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{formatDurationFromMinutes(oeeData.planlananSure)}</span>
                            {oeeData.setupTime > 0 && (
                              <span className="ml-2 text-xs text-gray-400">(Setup: {formatDurationFromMinutes(oeeData.setupTime)})</span>
                            )}
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('realWorkTime', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{formatDurationFromMinutes(oeeData.gercekCalismaSuresi)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('targetProduction', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{oeeData.hedefUretim.toLocaleString()} adet</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('realProduction', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{oeeData.actualProduction.toLocaleString()} adet</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('wastageBeforeDie', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{oeeData.dieOncesiAdet} adet</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('wastageAfterDie', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{oeeData.wastageAfterDie} adet</span>
                          </div>
                          <div>
                            <span className="text-gray-500">{getTranslation('totalWastage', currentLanguage)}:</span>
                            <span className="ml-2 font-medium">{oeeData.hataliUretim} adet</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Duruş Süresi:</span>
                            <span className="ml-2 font-medium">{formatDurationFromMinutes(oeeData.durusSuresiDakika || (oeeData.totalStoppageDuration / 1000 / 60))}</span>
                          </div>
                        </div>
                      </div>

                      {/* Formül Detayları */}
                      <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} border`}>
                        <h5 className="font-semibold mb-4 text-lg">OEE Hesaplama Formülleri</h5>
                        
                        {/* Availability Formülü */}
                        <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-blue-900/30' : 'bg-blue-50'} border border-blue-200`}>
                          <h6 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">1. Availability (Erişilebilirlik)</h6>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Planlanan süre içinde ne kadar süre çalışıldığı</p>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded mb-3 font-mono text-sm">
                            Availability = (Run Time / Planned Production Time) × 100
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Planlanan Süre:</span> {oeeData.planlananSure.toFixed(2)} dakika</div>
                            <div><span className="font-medium">Duruş Süresi:</span> {oeeData.durusSuresiDakika?.toFixed(2) || (oeeData.totalStoppageDuration / 1000 / 60).toFixed(2)} dakika</div>
                            <div><span className="font-medium">Run Time:</span> {oeeData.planlananSure.toFixed(2)} - {oeeData.durusSuresiDakika?.toFixed(2) || (oeeData.totalStoppageDuration / 1000 / 60).toFixed(2)} = {oeeData.runTimeForAvailability?.toFixed(2) || (oeeData.planlananSure - (oeeData.durusSuresiDakika || (oeeData.totalStoppageDuration / 1000 / 60))).toFixed(2)} dakika</div>
                            <div className="font-semibold text-blue-700 dark:text-blue-300">
                              Availability = ({oeeData.runTimeForAvailability?.toFixed(2) || (oeeData.planlananSure - (oeeData.durusSuresiDakika || (oeeData.totalStoppageDuration / 1000 / 60))).toFixed(2)} / {oeeData.planlananSure.toFixed(2)}) × 100 = {oeeData.availability.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Performance Formülü */}
                        <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-green-900/30' : 'bg-green-50'} border border-green-200`}>
                          <h6 className="font-semibold text-green-800 dark:text-green-200 mb-2">2. Performance (Performans)</h6>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Gerçek üretim hızının ideal üretim hızına oranı</p>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded mb-3 font-mono text-sm">
                            Performance = (Ideal Cycle Time × Total Count) / Run Time × 100
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Silindir Çevresi:</span> {oeeData.silindirCevresi} mm = {(oeeData.silindirCevresi / 1000).toFixed(5)} m</div>
                            <div><span className="font-medium">Hedef Hız:</span> {oeeData.hedefHiz} m/dk</div>
                            <div><span className="font-medium">Set Sayısı:</span> {oeeData.setSayisi} adet/tur</div>
                            <div><span className="font-medium">Ideal Cycle Time:</span> ({(oeeData.silindirCevresi / 1000).toFixed(5)} / ({oeeData.hedefHiz} × {oeeData.setSayisi})) = {oeeData.idealCycleTime?.toFixed(8) || ((oeeData.silindirCevresi / 1000) / (oeeData.hedefHiz * oeeData.setSayisi)).toFixed(8)} dakika/adet</div>
                            <div><span className="font-medium">Gerçek Çalışma Süresi:</span> {oeeData.gercekCalismaSuresi.toFixed(2)} dakika</div>
                            <div><span className="font-medium">Run Time (Performance):</span> {oeeData.gercekCalismaSuresi.toFixed(2)} - {oeeData.durusSuresiDakika?.toFixed(2) || (oeeData.totalStoppageDuration / 1000 / 60).toFixed(2)} = {oeeData.runTimeForPerformance?.toFixed(2) || (oeeData.gercekCalismaSuresi - (oeeData.durusSuresiDakika || (oeeData.totalStoppageDuration / 1000 / 60))).toFixed(2)} dakika</div>
                            <div><span className="font-medium">Gerçek Üretim:</span> {oeeData.actualProduction.toLocaleString()} adet</div>
                            <div><span className="font-medium">Toplam Fire:</span> {oeeData.hataliUretim.toLocaleString()} adet</div>
                            <div><span className="font-medium">Total Count (Fireler Dahil):</span> {oeeData.actualProduction.toLocaleString()} + {oeeData.hataliUretim.toLocaleString()} = {(oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim)).toLocaleString()} adet</div>
                            <div><span className="font-medium">Ideal Üretim Süresi:</span> {oeeData.idealCycleTime?.toFixed(8) || ((oeeData.silindirCevresi / 1000) / (oeeData.hedefHiz * oeeData.setSayisi)).toFixed(8)} × {(oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim)).toLocaleString()} = {((oeeData.idealCycleTime || ((oeeData.silindirCevresi / 1000) / (oeeData.hedefHiz * oeeData.setSayisi))) * (oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim))).toFixed(2)} dakika</div>
                            <div className="font-semibold text-green-700 dark:text-green-300">
                              Performance = ({((oeeData.idealCycleTime || ((oeeData.silindirCevresi / 1000) / (oeeData.hedefHiz * oeeData.setSayisi))) * (oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim))).toFixed(2)} / {oeeData.runTimeForPerformance?.toFixed(2) || (oeeData.gercekCalismaSuresi - (oeeData.durusSuresiDakika || (oeeData.totalStoppageDuration / 1000 / 60))).toFixed(2)}) × 100 = {oeeData.performance.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Quality Formülü */}
                        <div className={`mb-6 p-4 rounded-lg ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'} border border-purple-200`}>
                          <h6 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">3. Quality (Kalite)</h6>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Üretilen ürünlerin ne kadarının hatasız olduğu</p>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded mb-3 font-mono text-sm">
                            Quality = (Good Count / Total Count) × 100
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Gerçek Üretim (Good Count):</span> {oeeData.actualProduction.toLocaleString()} adet</div>
                            <div><span className="font-medium">Toplam Fire:</span> {oeeData.hataliUretim.toLocaleString()} adet</div>
                            <div><span className="font-medium">Total Count (Fireler Dahil):</span> {oeeData.actualProduction.toLocaleString()} + {oeeData.hataliUretim.toLocaleString()} = {(oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim)).toLocaleString()} adet</div>
                            <div className="font-semibold text-purple-700 dark:text-purple-300">
                              Quality = ({oeeData.actualProduction.toLocaleString()} / {(oeeData.totalCount || (oeeData.actualProduction + oeeData.hataliUretim)).toLocaleString()}) × 100 = {oeeData.quality.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Genel OEE Formülü */}
                        <div className={`p-4 rounded-lg ${darkMode ? 'bg-orange-900/30' : 'bg-orange-50'} border border-orange-200`}>
                          <h6 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">4. Genel OEE</h6>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Üç bileşenin çarpımı (yüzde değerleri olduğu için 10000'e bölünür)</p>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded mb-3 font-mono text-sm">
                            OEE = (Availability × Performance × Quality) / 10000
                          </div>
                          <div className="space-y-2 text-sm">
                            <div><span className="font-medium">Availability:</span> {oeeData.availability.toFixed(2)}%</div>
                            <div><span className="font-medium">Performance:</span> {oeeData.performance.toFixed(2)}%</div>
                            <div><span className="font-medium">Quality:</span> {oeeData.quality.toFixed(2)}%</div>
                            <div className="font-semibold text-orange-700 dark:text-orange-300 text-lg">
                              OEE = ({oeeData.availability.toFixed(2)} × {oeeData.performance.toFixed(2)} × {oeeData.quality.toFixed(2)}) / 10000 = {oeeData.oee.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <TrendingUp size={48} className="mx-auto mb-2 opacity-50" />
                      <p>OEE verisi bulunamadı</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Açıklama */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">{getTranslation('timeFormatExplanation', currentLanguage)}</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {getTranslation('timeFormatDescription', currentLanguage)}
                  {getTranslation('timeFormatExample', currentLanguage)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
