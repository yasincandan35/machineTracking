import React, { useState, useEffect } from 'react';
import { getTranslation } from '../utils/translations';
import { api } from '../utils/api';
import { User, Calendar, TrendingUp, Package, AlertCircle, Zap, Clock, BarChart3 } from 'lucide-react';

export default function OperatorPerformancePage({
  darkMode = false,
  currentLanguage = 'tr',
  selectedMachine = null,
  colorSettings = {}
}) {
  const [performanceList, setPerformanceList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    employeeId: null
  });

  useEffect(() => {
    if (selectedMachine?.tableName) {
      fetchPerformanceData();
      fetchSummary();
    } else {
      setLoading(false);
    }
  }, [selectedMachine, page, filters]);

  const fetchPerformanceData = async () => {
    if (!selectedMachine?.tableName) return;

    try {
      setLoading(true);
      setError(null);

      const params = {
        machine: selectedMachine.tableName,
        page: page,
        pageSize: 20
      };

      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }
      if (filters.employeeId) {
        params.employeeId = filters.employeeId;
      }

      const response = await api.get('/operatorperformance/list', { params });

      if (response.data?.success) {
        setPerformanceList(response.data.data || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Operatör performans verisi alınamadı:', err);
      setError(err.response?.data?.error || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    if (!selectedMachine?.tableName) return;

    try {
      const params = {
        machine: selectedMachine.tableName
      };

      if (filters.startDate) {
        params.startDate = filters.startDate;
      }
      if (filters.endDate) {
        params.endDate = filters.endDate;
      }
      if (filters.employeeId) {
        params.employeeId = filters.employeeId;
      }

      const response = await api.get('/operatorperformance/summary', { params });

      if (response.data?.success) {
        setSummary(response.data.data);
      }
    } catch (err) {
      console.error('Operatör performans özeti alınamadı:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString;
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    return `${Number(value).toFixed(2)}%`;
  };

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return '-';
    const minutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}dk`;
  };

  if (!selectedMachine || !selectedMachine.tableName) {
    return (
      <div className="p-4 sm:p-6 pt-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <User className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              {currentLanguage === 'tr'
                ? 'Operatör performansını görüntülemek için lütfen bir makine seçin.'
                : 'Please select a machine to view operator performance.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {getTranslation('operatorPerformance', currentLanguage)}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {currentLanguage === 'tr'
            ? 'Operatör performans metrikleri ve vardiya bazlı istatistikler'
            : 'Operator performance metrics and shift-based statistics'}
        </p>
      </div>

      {/* Özet Kartları */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div
            className="p-4 rounded-lg shadow-sm"
            style={{
              backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
              color: darkMode ? undefined : colorSettings.text
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {currentLanguage === 'tr' ? 'Toplam Vardiya' : 'Total Shifts'}
                </p>
                <p className="text-2xl font-bold">{summary.totalShifts || 0}</p>
              </div>
              <Calendar className="text-gray-400" size={24} />
            </div>
          </div>

          <div
            className="p-4 rounded-lg shadow-sm"
            style={{
              backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
              color: darkMode ? undefined : colorSettings.text
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {currentLanguage === 'tr' ? 'Toplam Üretim' : 'Total Production'}
                </p>
                <p className="text-2xl font-bold">{formatNumber(summary.totalProduction)}</p>
              </div>
              <Package className="text-gray-400" size={24} />
            </div>
          </div>

          <div
            className="p-4 rounded-lg shadow-sm"
            style={{
              backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
              color: darkMode ? undefined : colorSettings.text
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {currentLanguage === 'tr' ? 'Ortalama OEE' : 'Average OEE'}
                </p>
                <p className="text-2xl font-bold">{formatPercentage(summary.avgOee)}</p>
              </div>
              <TrendingUp className="text-gray-400" size={24} />
            </div>
          </div>

          <div
            className="p-4 rounded-lg shadow-sm"
            style={{
              backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
              color: darkMode ? undefined : colorSettings.text
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {currentLanguage === 'tr' ? 'Toplam Operatör' : 'Total Operators'}
                </p>
                <p className="text-2xl font-bold">{summary.totalOperators || 0}</p>
              </div>
              <User className="text-gray-400" size={24} />
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div
        className="p-4 rounded-lg shadow-sm mb-6"
        style={{
          backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
          color: darkMode ? undefined : colorSettings.text
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {currentLanguage === 'tr' ? 'Başlangıç Tarihi' : 'Start Date'}
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              {currentLanguage === 'tr' ? 'Bitiş Tarihi' : 'End Date'}
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ startDate: null, endDate: null, employeeId: null });
                setPage(1);
              }}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {currentLanguage === 'tr' ? 'Filtreleri Temizle' : 'Clear Filters'}
            </button>
          </div>
        </div>
      </div>

      {/* Performans Listesi */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">
            {currentLanguage === 'tr' ? 'Yükleniyor...' : 'Loading...'}
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">{error}</div>
        </div>
      ) : performanceList.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="mx-auto mb-4 text-gray-400 dark:text-gray-500" size={48} />
            <p className="text-gray-600 dark:text-gray-400">
              {currentLanguage === 'tr' ? 'Veri bulunamadı' : 'No data available'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            className="rounded-lg shadow-sm overflow-hidden"
            style={{
              backgroundColor: darkMode ? '#1f2937' : colorSettings.infoCard,
              color: darkMode ? undefined : colorSettings.text
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Operatör' : 'Operator'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Vardiya' : 'Shift'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Üretim' : 'Production'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'OEE' : 'OEE'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Fire Oranı' : 'Wastage Ratio'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Duruş' : 'Stoppage'}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {currentLanguage === 'tr' ? 'Enerji' : 'Energy'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {performanceList.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <div className="font-medium">{item.employeeName}</div>
                          {item.position && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.position}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm">
                          <div>{formatDate(item.shiftDate)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.shiftStartTime} - {item.shiftEndTime}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {formatNumber(item.actualProduction)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {formatPercentage(item.oee)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {formatPercentage(item.wastageRatio)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <div>{formatDuration(item.totalStoppageDuration)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.stoppageCount || 0} {currentLanguage === 'tr' ? 'adet' : 'times'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {formatNumber(item.energyConsumptionKwh, 2)} kWh
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sayfalama */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {currentLanguage === 'tr'
                  ? `Sayfa ${page} / ${totalPages}`
                  : `Page ${page} / ${totalPages}`}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {currentLanguage === 'tr' ? 'Önceki' : 'Previous'}
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {currentLanguage === 'tr' ? 'Sonraki' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

