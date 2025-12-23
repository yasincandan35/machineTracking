import React, { useState, useEffect, useMemo } from 'react';
import { PauseCircle, Calendar, Filter, Search, RefreshCw, TrendingDown, Clock, AlertTriangle, BarChart3, Award, Activity } from 'lucide-react';
import { createMachineApi } from '../../utils/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function StoppageAnalysis({ selectedMachine, currentLanguage = 'tr' }) {
  const { theme, isLiquidGlass, isFluid } = useTheme();
  const isDark = theme === 'dark';

  const [stoppageList, setStoppageList] = useState([]);
  const [loadingStoppages, setLoadingStoppages] = useState(false);
  const [jobsList, setJobsList] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // 7 gün öncesi
    return date.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [endTime, setEndTime] = useState('23:59');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'startTime', direction: 'desc' });

  const cardClass = `rounded-xl shadow-md p-6 ${
    isFluid 
      ? 'bg-black/40 backdrop-blur-md border border-white/30'
      : isLiquidGlass 
        ? 'glass-card'
        : 'bg-white dark:bg-gray-800'
  }`;

  // İş listesini çek
  const fetchJobsList = async () => {
    if (!selectedMachine?.tableName || selectedMachine.id === -1) {
      return;
    }

    try {
      setLoadingJobs(true);
      const machineApi = createMachineApi(selectedMachine);
      const response = await machineApi.get('/reports?limit=1000');
      
      if (response.data?.success && response.data.data) {
        const rawJobs = response.data.data || [];

        const jobs = rawJobs
          // En azından bir sipariş numarası olsun
          .filter(job => job.siparis_no)
          .map(job => {
            // Backend bazı yerlerde camelCase, bazı yerlerde snake_case kullanıyor olabilir
            const jobStart =
              job.jobStartTime ||
              job.job_start_time ||
              job.jobstarttime ||
              job.job_startTime;

            const jobEnd =
              job.jobEndTime ||
              job.job_end_time ||
              job.jobendtime ||
              job.job_endTime;

            const createdAt =
              job.createdAt ||
              job.created_at ||
              null;

            return {
              id: job.id,
              siparis_no: job.siparis_no,
              stok_adi: job.stok_adi || job.is_adi || '',
              jobStartTime: jobStart,
              jobEndTime: jobEnd,
              createdAt
            };
          })
          .sort((a, b) => {
            // Tarihe göre sırala (en yeni önce)
            const dateA = a.jobEndTime || a.jobStartTime || a.createdAt || '';
            const dateB = b.jobEndTime || b.jobStartTime || b.createdAt || '';
            return String(dateB).localeCompare(String(dateA));
          });
        
        setJobsList(jobs);
        console.log(`✅ ${jobs.length} iş yüklendi`);
      } else {
        setJobsList([]);
      }
    } catch (error) {
      console.error('İş listesi yüklenemedi:', error);
      setJobsList([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Duruş listesini çek
  const fetchStoppageList = async () => {
    if (!selectedMachine?.tableName || selectedMachine.id === -1) {
      return;
    }

    try {
      setLoadingStoppages(true);
      const machineApi = createMachineApi(selectedMachine);
      const params = new URLSearchParams();
      
      // İş seçilmişse, o işin zaman aralığını kullan
      if (selectedJob) {
        const job = jobsList.find(j => j.id === selectedJob);
        if (job?.jobStartTime && job?.jobEndTime) {
          // İşin başlangıç ve bitiş zamanını kullan
          params.append('start', new Date(job.jobStartTime).toISOString());
          params.append('end', new Date(job.jobEndTime).toISOString());
        } else if (job?.jobStartTime) {
          // Sadece başlangıç zamanı varsa, bugüne kadar
          params.append('start', new Date(job.jobStartTime).toISOString());
          params.append('end', new Date().toISOString());
        }
      } else {
        // Tarih aralığı kullan (tarih + saat bilgisi ile)
        if (startDate) {
          const [hours, minutes] = startTime.split(':');
          const startDateTime = new Date(startDate + `T${hours || '00'}:${minutes || '00'}:00`);
          params.append('start', startDateTime.toISOString());
        }
        if (endDate) {
          const [hours, minutes] = endTime.split(':');
          // Bitiş zamanı için 59 saniye ekle (o saatin sonuna kadar)
          const endDateTime = new Date(endDate + `T${hours || '23'}:${minutes || '59'}:59`);
          params.append('end', endDateTime.toISOString());
        }
      }
      
      const response = await machineApi.get(`/reports/stoppages?${params.toString()}`);
      
      if (response.data?.success && response.data.data) {
        let stoppages = response.data.data;
        
        // İş seçilmişse, o işin zaman aralığına göre ek filtreleme yap
        if (selectedJob) {
          const job = jobsList.find(j => j.id === selectedJob);
          if (job?.jobStartTime && job?.jobEndTime) {
            const jobStart = new Date(job.jobStartTime);
            const jobEnd = new Date(job.jobEndTime);
            stoppages = stoppages.filter(stop => {
              const stopStart = new Date(stop.startTime);
              return stopStart >= jobStart && stopStart <= jobEnd;
            });
          }
        }
        
        setStoppageList(stoppages);
        console.log(`✅ ${stoppages.length} duruş kaydı yüklendi`);
      } else {
        setStoppageList([]);
      }
    } catch (error) {
      console.error('Duruş listesi yüklenemedi:', error);
      setStoppageList([]);
    } finally {
      setLoadingStoppages(false);
    }
  };

  // İş listesini yükle
  useEffect(() => {
    if (selectedMachine?.tableName && selectedMachine.id !== -1) {
      fetchJobsList();
    }
  }, [selectedMachine?.tableName, selectedMachine?.id]);

  // Duruş listesini yükle
  useEffect(() => {
    if (selectedMachine?.tableName && selectedMachine.id !== -1) {
      fetchStoppageList();
    }
  }, [selectedMachine?.tableName, selectedMachine?.id, startDate, startTime, endDate, endTime, selectedJob, jobsList]);

  // Süre formatla
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filtrelenmiş duruş listesi
  const filteredStoppages = useMemo(() => {
    return stoppageList.filter(stop => {
      // Kategori filtresi
      if (filterCategory && stop.categoryName?.toLowerCase().includes(filterCategory.toLowerCase()) === false) {
        return false;
      }
      // Sebep filtresi
      if (filterReason && stop.reasonName?.toLowerCase().includes(filterReason.toLowerCase()) === false) {
        return false;
      }
      // Arama metni
      if (searchText) {
        const searchLower = searchText.toLowerCase();
        const matchesCategory = stop.categoryName?.toLowerCase().includes(searchLower);
        const matchesReason = stop.reasonName?.toLowerCase().includes(searchLower);
        if (!matchesCategory && !matchesReason) {
          return false;
        }
      }
      return true;
    });
  }, [stoppageList, filterCategory, filterReason, searchText]);

  // Özet istatistikler
  const stoppageStats = useMemo(() => {
    if (filteredStoppages.length === 0) {
      return {
        totalCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        mtbf: 0,
        top3ByDuration: [],
        top3Categories: [],
        top3Reasons: [],
        categoryBreakdown: {},
        reasonBreakdown: {}
      };
    }

    const durations = filteredStoppages.map(s => s.durationSeconds || 0);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);
    const avgDuration = totalDuration / filteredStoppages.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations.filter(d => d > 0));

    // MTBF (Mean Time Between Failures) hesapla
    // MTBF = (Toplam zaman - Toplam duruş süresi) / (Duruş sayısı - 1)
    let mtbf = 0;
    if (filteredStoppages.length > 1) {
      // Duruşları zamana göre sırala
      const sortedStoppages = [...filteredStoppages].sort((a, b) => {
        const timeA = new Date(a.startTime || 0).getTime();
        const timeB = new Date(b.startTime || 0).getTime();
        return timeA - timeB;
      });

      const firstStopTime = new Date(sortedStoppages[0].startTime || 0).getTime();
      const lastStopTime = new Date(sortedStoppages[sortedStoppages.length - 1].startTime || 0).getTime();
      const totalTimeSpan = (lastStopTime - firstStopTime) / 1000; // saniye cinsinden
      
      // Toplam çalışma süresi = Toplam zaman - Toplam duruş süresi
      const totalOperatingTime = totalTimeSpan - totalDuration;
      
      // MTBF = Toplam çalışma süresi / (Duruş sayısı - 1)
      mtbf = totalOperatingTime / (filteredStoppages.length - 1);
    }

    // TOP 3 en uzun duruşlar
    const top3ByDuration = [...filteredStoppages]
      .sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0))
      .slice(0, 3);

    // Kategori bazında özet
    const categoryBreakdown = {};
    filteredStoppages.forEach(stop => {
      const cat = stop.categoryName || 'Bilinmeyen';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, totalDuration: 0 };
      }
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].totalDuration += stop.durationSeconds || 0;
    });

    // TOP 3 kategori (toplam süreye göre)
    const top3Categories = Object.entries(categoryBreakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 3);

    // Sebep bazında özet
    const reasonBreakdown = {};
    filteredStoppages.forEach(stop => {
      const reason = stop.reasonName || 'Bilinmeyen';
      if (!reasonBreakdown[reason]) {
        reasonBreakdown[reason] = { count: 0, totalDuration: 0, category: stop.categoryName || 'Bilinmeyen' };
      }
      reasonBreakdown[reason].count++;
      reasonBreakdown[reason].totalDuration += stop.durationSeconds || 0;
    });

    // TOP 3 sebep (toplam süreye göre)
    const top3Reasons = Object.entries(reasonBreakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalDuration - a.totalDuration)
      .slice(0, 3);

    return {
      totalCount: filteredStoppages.length,
      totalDuration,
      avgDuration,
      maxDuration,
      minDuration,
      mtbf,
      top3ByDuration,
      top3Categories,
      top3Reasons,
      categoryBreakdown,
      reasonBreakdown
    };
  }, [filteredStoppages]);

  // Sıralanmış duruş listesi (tablo için)
  const sortedStoppages = useMemo(() => {
    const data = [...filteredStoppages];
    if (!sortConfig?.key) return data;

    return data.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const key = sortConfig.key;

      if (key === 'startTime' || key === 'endTime') {
        const tA = new Date(a[key] || 0).getTime();
        const tB = new Date(b[key] || 0).getTime();
        return (tA - tB) * dir;
      }

      if (key === 'durationSeconds') {
        const vA = a.durationSeconds || 0;
        const vB = b.durationSeconds || 0;
        return (vA - vB) * dir;
      }

      const vA = (a[key] || '').toString().toLowerCase();
      const vB = (b[key] || '').toString().toLowerCase();
      return vA.localeCompare(vB) * dir;
    });
  }, [filteredStoppages, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (!selectedMachine || selectedMachine.id === -1) {
    return (
      <div className={`${cardClass} text-center py-20 text-gray-500 dark:text-gray-400`}>
        <PauseCircle size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">Lütfen bir makine seçin</p>
        <p className="text-sm">Duruş analizi yapmak için üst menüden bir makine seçmelisiniz</p>
      </div>
    );
  }

  return (
    <>
      {/* Filtreler ve Kontroller */}
      <div className={cardClass}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={20} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filtreler</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* İş Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                İş Seçimi
              </label>
              <select
                value={selectedJob || ''}
                onChange={(e) => {
                  const newJobId = e.target.value ? parseInt(e.target.value) : null;
                  setSelectedJob(newJobId);
                  // İş seçildiğinde, o işin tarih aralığını otomatik ayarla (tarih + saat)
                  if (newJobId) {
                    const job = jobsList.find(j => j.id === newJobId);
                    if (job?.jobStartTime) {
                      const start = new Date(job.jobStartTime);
                      setStartDate(start.toISOString().split('T')[0]);
                      const startTimeStr = start.toTimeString().split(':').slice(0, 2).join(':');
                      setStartTime(startTimeStr);
                    }
                    if (job?.jobEndTime) {
                      const end = new Date(job.jobEndTime);
                      setEndDate(end.toISOString().split('T')[0]);
                      const endTimeStr = end.toTimeString().split(':').slice(0, 2).join(':');
                      setEndTime(endTimeStr);
                    }
                  }
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isFluid
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                }`}
                disabled={loadingJobs}
              >
                <option value="">Tüm İşler</option>
                {jobsList.map(job => {
                  const startTime = job.jobStartTime ? new Date(job.jobStartTime).toLocaleString('tr-TR', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '';
                  const endTime = job.jobEndTime ? new Date(job.jobEndTime).toLocaleString('tr-TR', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '';
                  
                  return (
                    <option key={job.id} value={job.id}>
                      {job.siparis_no} {job.stok_adi ? `- ${job.stok_adi}` : ''} 
                      {startTime && ` (${startTime}${endTime ? ` - ${endTime}` : ''})`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Başlangıç Tarihi ve Saati */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Başlangıç Tarihi
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isFluid
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                  }`}
                />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`w-24 px-3 py-2 rounded-lg text-sm ${
                    isFluid
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                  }`}
                />
              </div>
            </div>

            {/* Bitiş Tarihi ve Saati */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar size={16} className="inline mr-1" />
                Bitiş Tarihi
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                    isFluid
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                  }`}
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={`w-24 px-3 py-2 rounded-lg text-sm ${
                    isFluid
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                  }`}
                />
              </div>
            </div>

            {/* Yenile Butonu */}
            <div className="flex items-end">
              <button
                onClick={fetchStoppageList}
                disabled={loadingStoppages}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  isFluid
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-green-500 text-white hover:bg-green-600'
                } ${loadingStoppages ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <RefreshCw size={18} className={loadingStoppages ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>
          </div>

          {/* Ek Filtreler */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {/* Arama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Search size={16} className="inline mr-1" />
                Arama
              </label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Kategori veya sebep ara..."
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isFluid
                    ? 'bg-white/20 text-white border border-white/30 placeholder-white/50'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>

            {/* Kategori Filtresi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kategori Filtresi
              </label>
              <input
                type="text"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                placeholder="Kategori adı..."
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isFluid
                    ? 'bg-white/20 text-white border border-white/30 placeholder-white/50'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>

            {/* Sebep Filtresi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sebep Filtresi
              </label>
              <input
                type="text"
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                placeholder="Sebep adı..."
                className={`w-full px-3 py-2 rounded-lg text-sm ${
                  isFluid
                    ? 'bg-white/20 text-white border border-white/30 placeholder-white/50'
                    : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Downtime Analysis Özeti */}
      {filteredStoppages.length > 0 && (
        <div className={cardClass}>
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={24} className="text-blue-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Downtime Analysis Özeti</h2>
          </div>

          {/* Genel İstatistikler */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className={`p-4 rounded-lg h-full flex flex-col justify-between transition-all duration-[2000ms] hover:scale-105 ${isDark ? 'bg-gray-700' : 'bg-blue-50'} ${loadingStoppages ? 'animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-blue-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Duruş</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stoppageStats.totalCount}</div>
            </div>
            <div className={`p-4 rounded-lg h-full flex flex-col justify-between transition-all duration-[2000ms] hover:scale-105 ${isDark ? 'bg-gray-700' : 'bg-red-50'} ${loadingStoppages ? 'animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={18} className="text-red-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Süre</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(stoppageStats.totalDuration)}</div>
            </div>
            <div className={`p-4 rounded-lg h-full flex flex-col justify-between transition-all duration-[2000ms] hover:scale-105 ${isDark ? 'bg-gray-700' : 'bg-green-50'} ${loadingStoppages ? 'animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ortalama Süre</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(Math.round(stoppageStats.avgDuration))}</div>
            </div>
            <div className={`p-4 rounded-lg h-full flex flex-col justify-between transition-all duration-[2000ms] hover:scale-105 ${isDark ? 'bg-gray-700' : 'bg-purple-50'} ${loadingStoppages ? 'animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <Award size={18} className="text-purple-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">En Uzun Duruş</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatDuration(stoppageStats.maxDuration)}</div>
            </div>
            <div className={`p-4 rounded-lg h-full flex flex-col justify-between transition-all duration-[2000ms] hover:scale-105 ${isDark ? 'bg-gray-700' : 'bg-indigo-50'} ${loadingStoppages ? 'animate-pulse' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">MTBF</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stoppageStats.mtbf > 0 ? formatDuration(Math.round(stoppageStats.mtbf)) : '-'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ort. Arıza Arası Süre</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TOP 3 En Uzun Duruşlar */}
            <div className={`transition-all duration-[2000ms] ${loadingStoppages ? 'opacity-50' : 'opacity-100'}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Award size={20} className="text-yellow-500" />
                TOP 3 En Uzun Duruşlar
              </h3>
              <div className="space-y-3 h-full">
                {stoppageStats.top3ByDuration.map((stop, index) => (
                  <div 
                    key={stop.id || index}
                    className={`p-3 rounded-lg border-l-4 min-h-[120px] flex flex-col justify-between transition-all duration-[2000ms] hover:shadow-md ${
                      index === 0 ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
                      index === 1 ? 'border-gray-400 bg-gray-50 dark:bg-gray-700' :
                      'border-orange-300 bg-orange-50 dark:bg-orange-900/20'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        #{index + 1} {stop.categoryName || 'Bilinmeyen'}
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatDuration(stop.durationSeconds || 0)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {stop.reasonName || 'Sebep belirtilmemiş'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {stop.startTime ? new Date(stop.startTime).toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP 3 Kategoriler */}
            <div className={`transition-all duration-[2000ms] ${loadingStoppages ? 'opacity-50' : 'opacity-100'}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-500" />
                TOP 3 Kategoriler
              </h3>
              <div className="space-y-3 h-full">
                {stoppageStats.top3Categories.map((cat, index) => {
                  const percentage = stoppageStats.totalDuration > 0 
                    ? ((cat.totalDuration / stoppageStats.totalDuration) * 100).toFixed(1)
                    : 0;
                  return (
                    <div 
                      key={cat.name}
                      className={`p-3 rounded-lg border-l-4 min-h-[120px] flex flex-col justify-between transition-all duration-[2000ms] hover:shadow-md ${
                        index === 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' :
                        index === 1 ? 'border-gray-400 bg-gray-50 dark:bg-gray-700' :
                        'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          #{index + 1} {cat.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatDuration(cat.totalDuration)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              index === 0 ? 'bg-blue-500' :
                              index === 1 ? 'bg-gray-400' :
                              'bg-blue-300'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
                          {percentage}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {cat.count} duruş
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TOP 3 Sebepler */}
            <div className={`transition-all duration-[2000ms] ${loadingStoppages ? 'opacity-50' : 'opacity-100'}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <PauseCircle size={20} className="text-red-500" />
                TOP 3 Sebepler
              </h3>
              <div className="space-y-3 h-full">
                {stoppageStats.top3Reasons.map((reason, index) => {
                  const percentage = stoppageStats.totalDuration > 0 
                    ? ((reason.totalDuration / stoppageStats.totalDuration) * 100).toFixed(1)
                    : 0;
                  return (
                    <div 
                      key={reason.name}
                      className={`p-3 rounded-lg border-l-4 min-h-[120px] flex flex-col justify-between transition-all duration-[2000ms] hover:shadow-md ${
                        index === 0 ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
                        index === 1 ? 'border-gray-400 bg-gray-50 dark:bg-gray-700' :
                        'border-red-300 bg-red-50 dark:bg-red-900/20'
                      }`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          #{index + 1} {reason.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatDuration(reason.totalDuration)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 truncate">
                        {reason.category}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              index === 0 ? 'bg-red-500' :
                              index === 1 ? 'bg-gray-400' :
                              'bg-red-300'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-right">
                          {percentage}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {reason.count} duruş
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duruş Listesi */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Duruş Listesi ({filteredStoppages.length} kayıt)
          </h2>
        </div>

        {loadingStoppages ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : sortedStoppages.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <PauseCircle size={48} className="mx-auto mb-2 opacity-50" />
            <p>Duruş kaydı bulunamadı</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <th
                        className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                        onClick={() => handleSort('startTime')}
                      >
                        Başlangıç <span className="ml-1 text-xs">{getSortIndicator('startTime')}</span>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                        onClick={() => handleSort('endTime')}
                      >
                        Bitiş <span className="ml-1 text-xs">{getSortIndicator('endTime')}</span>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                        onClick={() => handleSort('durationSeconds')}
                      >
                        Süre <span className="ml-1 text-xs">{getSortIndicator('durationSeconds')}</span>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                        onClick={() => handleSort('categoryName')}
                      >
                        Kategori <span className="ml-1 text-xs">{getSortIndicator('categoryName')}</span>
                      </th>
                      <th
                        className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                        onClick={() => handleSort('reasonName')}
                      >
                        Sebep <span className="ml-1 text-xs">{getSortIndicator('reasonName')}</span>
                      </th>
                </tr>
              </thead>
              <tbody>
                    {sortedStoppages.map((stop, index) => (
                  <tr 
                    key={stop.id || index}
                    className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {stop.startTime ? new Date(stop.startTime).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {stop.endTime ? new Date(stop.endTime).toLocaleString('tr-TR') : '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100 font-medium">
                      {formatDuration(stop.durationSeconds || 0)}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {stop.categoryName || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {stop.reasonName || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

