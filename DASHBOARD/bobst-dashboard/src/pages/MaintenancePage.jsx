import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  MapPin, 
  User, 
  MessageSquare, 
  Camera, 
  Send,
  X,
  Filter,
  Calendar,
  Wrench,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi, api } from '../utils/api';
import { getTranslation } from '../utils/translations';
import { useNotification } from '../contexts/NotificationContext';

const MaintenancePage = ({ currentLanguage = 'tr', darkMode = false }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' veya 'schedules'
  const [requests, setRequests] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newComment, setNewComment] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [shownRequestIds, setShownRequestIds] = useState(new Set()); // Gösterilen bildirim ID'leri
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [machines, setMachines] = useState([]);
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all', 'upcoming', 'completed'
  const [scheduleForm, setScheduleForm] = useState({
    machineName: '',
    machineTableName: '',
    maintenanceType: '',
    description: '',
    startDate: '',
    endDate: '',
    notify30DaysBefore: true,
    notify15DaysBefore: true,
    notify3DaysBefore: true,
    isRecurring: false,
    recurringIntervalDays: null
  });

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
      
      // Periyodik olarak bildirimleri yenile (her 5 saniyede bir)
      const interval = setInterval(() => {
        fetchRequests(false); // Periyodik yenilemede loading gösterme
      }, 5000);
      
      return () => clearInterval(interval);
    } else {
      fetchSchedules();
    }
  }, [activeTab, statusFilter]);

  const fetchRequests = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params = statusFilter !== 'all' ? { status: statusFilter } : {};
      const response = await dashboardApi.get('/maintenance/requests', { params });
      const newRequests = response.data || [];
      
      // Yeni bildirim varsa bildirim göster (sadece daha önce gösterilmemiş olanlar için)
      if (requests.length > 0 && newRequests.length > 0) {
        const existingIds = new Set(requests.map(r => r.id));
        const newRequestIds = newRequests
          .filter(r => !existingIds.has(r.id) && !shownRequestIds.has(r.id))
          .map(r => r.id);
        
        if (newRequestIds.length > 0) {
          const newCount = newRequestIds.length;
          showSuccess(`${newCount} yeni arıza bildirimi geldi!`);
          // Gösterilen bildirim ID'lerini kaydet
          setShownRequestIds(prev => {
            const newSet = new Set(prev);
            newRequestIds.forEach(id => newSet.add(id));
            return newSet;
          });
        }
      }
      
      setRequests(newRequests);
    } catch (error) {
      console.error('Arıza bildirimleri yüklenemedi:', error);
      if (showLoading || requests.length === 0) {
        showError('Arıza bildirimleri yüklenemedi');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = {};
      if (scheduleFilter === 'upcoming') {
        params.isCompleted = false;
      } else if (scheduleFilter === 'completed') {
        params.isCompleted = true;
      }
      const response = await dashboardApi.get('/maintenance/schedules', { params });
      setSchedules(response.data || []);
    } catch (error) {
      console.error('Bakım planları yüklenemedi:', error);
      showError('Bakım planları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Makine listesini yükle
  useEffect(() => {
    const loadMachines = async () => {
      try {
        const response = await api.get('/machines');
        setMachines(response.data || []);
      } catch (error) {
        console.error('Makine listesi yüklenemedi:', error);
      }
    };
    loadMachines();
  }, []);

  const handleCreateSchedule = async () => {
    if (!scheduleForm.machineName || !scheduleForm.maintenanceType || !scheduleForm.startDate || !scheduleForm.endDate) {
      showError('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    // Bitiş tarihi başlangıç tarihinden önce olamaz
    if (new Date(scheduleForm.endDate) < new Date(scheduleForm.startDate)) {
      showError('Bitiş tarihi başlangıç tarihinden önce olamaz');
      return;
    }

    try {
      setLoading(true);
      await dashboardApi.post('/maintenance/schedules', scheduleForm);
      showSuccess('Bakım planı başarıyla oluşturuldu');
      setShowScheduleModal(false);
      setScheduleForm({
        machineName: '',
        machineTableName: '',
        maintenanceType: '',
        description: '',
        startDate: '',
        endDate: '',
        notify30DaysBefore: true,
        notify15DaysBefore: true,
        notify3DaysBefore: true,
        isRecurring: false,
        recurringIntervalDays: null
      });
      fetchSchedules();
    } catch (error) {
      console.error('Bakım planı oluşturulamadı:', error);
      showError(error.response?.data?.message || 'Bakım planı oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSchedule = async (id) => {
    try {
      await dashboardApi.post(`/maintenance/schedules/${id}/complete`);
      showSuccess('Bakım planı tamamlandı olarak işaretlendi');
      fetchSchedules();
      if (selectedSchedule?.id === id) {
        setSelectedSchedule(null);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Bakım planı tamamlanamadı');
    }
  };

  const fetchRequestDetail = async (id) => {
    try {
      const response = await dashboardApi.get(`/maintenance/requests/${id}`);
      setSelectedRequest(response.data);
    } catch (error) {
      console.error('Arıza detayı yüklenemedi:', error);
      showError('Arıza detayı yüklenemedi');
    }
  };

  const handleAcceptRequest = async (id) => {
    try {
      await dashboardApi.post(`/maintenance/requests/${id}/accept`);
      showSuccess('Arıza bildirimi kabul edildi');
      fetchRequests();
      if (selectedRequest?.id === id) {
        fetchRequestDetail(id);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Arıza bildirimi kabul edilemedi');
    }
  };

  const handleMarkArrived = async (id) => {
    try {
      await dashboardApi.post(`/maintenance/requests/${id}/arrived`);
      showSuccess('Geliş tarihi kaydedildi');
      fetchRequests();
      if (selectedRequest?.id === id) {
        fetchRequestDetail(id);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Geliş tarihi kaydedilemedi');
    }
  };

  const handleCompleteRequest = async (id) => {
    try {
      await dashboardApi.post(`/maintenance/requests/${id}/complete`);
      showSuccess('Arıza tamamlandı');
      fetchRequests();
      if (selectedRequest?.id === id) {
        fetchRequestDetail(id);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Arıza tamamlanamadı');
    }
  };

  const handleAddComment = async (requestId) => {
    if (!newComment.trim()) return;

    try {
      await dashboardApi.post(`/maintenance/requests/${requestId}/comments`, {
        content: newComment.trim()
      });
      showSuccess('Yorum eklendi');
      setNewComment('');
      fetchRequestDetail(requestId);
    } catch (error) {
      showError('Yorum eklenemedi');
    }
  };

  const handleUploadPhoto = async (requestId) => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await dashboardApi.post(`/maintenance/requests/${requestId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      showSuccess('Fotoğraf yüklendi');
      setSelectedFile(null);
      fetchRequestDetail(requestId);
    } catch (error) {
      showError('Fotoğraf yüklenemedi');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'accepted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Beklemede',
      accepted: 'Kabul Edildi',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi'
    };
    return statusMap[status] || status;
  };

  const isAssigned = (request) => {
    return request.assignments?.some(a => a.userId === user?.id);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            setActiveTab('requests');
            setSelectedRequest(null);
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'requests'
              ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {getTranslation('maintenanceRequests', currentLanguage) || 'Arıza Bildirimleri'}
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('schedules');
            setSelectedRequest(null);
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'schedules'
              ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {getTranslation('maintenanceSchedules', currentLanguage) || 'Bakım Planları'}
          </div>
        </button>
      </div>

      {activeTab === 'requests' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Requests List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Tümü</option>
                <option value="pending">Beklemede</option>
                <option value="accepted">Kabul Edildi</option>
                <option value="in_progress">Devam Ediyor</option>
                <option value="completed">Tamamlandı</option>
              </select>
            </div>

            {/* Requests */}
            {loading ? (
              <div className="text-center py-8">Yükleniyor...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Arıza bildirimi bulunamadı</div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => fetchRequestDetail(request.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    } ${
                      request.status === 'pending' ? 'pending-notification' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {request.machineName}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                            {getStatusText(request.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          {request.faultType}
                        </p>
                        {request.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 line-clamp-2">
                            {request.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{new Date(request.createdAt).toLocaleString('tr-TR')}</span>
                          {request.assignments?.length > 0 && (
                            <span>{request.assignments.length} kişi atandı</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Request Detail */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <div className="sticky top-4 space-y-4">
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedRequest.machineName}
                    </h2>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Arıza Tipi:</span>
                      <p className="font-medium">{selectedRequest.faultType}</p>
                    </div>
                    {selectedRequest.description && (
                      <div>
                        <span className="text-sm text-gray-500">Açıklama:</span>
                        <p className="text-sm">{selectedRequest.description}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm text-gray-500">Durum:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedRequest.status)}`}>
                        {getStatusText(selectedRequest.status)}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    {!isAssigned(selectedRequest) && selectedRequest.status === 'pending' && (
                      <button
                        onClick={() => handleAcceptRequest(selectedRequest.id)}
                        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                      >
                        Kabul Et
                      </button>
                    )}

                    {isAssigned(selectedRequest) && !selectedRequest.arrivedAt && (
                      <div className="w-full px-4 py-2 bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-md text-center">
                        <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                          ⚠️ "Geldim" butonu machine-screen'de görünecek
                        </p>
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          Makine ekranına gidip bildirim panelinden "Geldim" butonuna tıklayın
                        </p>
                      </div>
                    )}
                    
                    {isAssigned(selectedRequest) && selectedRequest.arrivedAt && !selectedRequest.completedAt && (
                      <button
                        onClick={() => handleCompleteRequest(selectedRequest.id)}
                        className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                      >
                        Tamamlandı
                      </button>
                    )}

                    {/* Comments */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <h3 className="font-medium mb-2">Yorumlar</h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedRequest.comments?.map((comment) => (
                          <div key={comment.id} className="text-sm">
                            <span className="font-medium">{comment.userName}:</span>
                            <span className="ml-2">{comment.content}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Yorum yazın..."
                          className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(selectedRequest.id);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleAddComment(selectedRequest.id)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Photo Upload */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <h3 className="font-medium mb-2">Fotoğraflar</h3>
                      <div className="space-y-2">
                        {selectedRequest.photos?.map((photo) => (
                          <img
                            key={photo.id}
                            src={`http://192.168.1.44:5199${photo.filePath}`}
                            alt="Arıza fotoğrafı"
                            className="w-full rounded-md"
                          />
                        ))}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSelectedFile(e.target.files[0])}
                          className="text-sm"
                        />
                        {selectedFile && (
                          <button
                            onClick={() => handleUploadPhoto(selectedRequest.id)}
                            className="w-full px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm"
                          >
                            Yükle
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                Detayları görmek için bir arıza bildirimi seçin
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bakım Planları Başlık ve Filtre */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {getTranslation('maintenanceSchedules', currentLanguage) || 'Bakım Planları'}
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={scheduleFilter}
                onChange={(e) => setScheduleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">Tümü</option>
                <option value="upcoming">Yaklaşan</option>
                <option value="completed">Tamamlanan</option>
              </select>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                {getTranslation('createSchedule', currentLanguage) || 'Yeni Plan'}
              </button>
            </div>
          </div>

          {/* Bakım Planları Listesi */}
          {loading ? (
            <div className="text-center py-8">Yükleniyor...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {getTranslation('noSchedules', currentLanguage) || 'Bakım planı bulunamadı'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((schedule) => {
                const daysUntil = Math.ceil((new Date(schedule.startDate) - new Date()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysUntil < 0 && !schedule.isCompleted;
                const isUpcoming = daysUntil >= 0 && daysUntil <= 3 && !schedule.isCompleted;
                const durationDays = Math.ceil((new Date(schedule.endDate) - new Date(schedule.startDate)) / (1000 * 60 * 60 * 24)) + 1;
                
                return (
                  <div
                    key={schedule.id}
                    onClick={() => setSelectedSchedule(schedule)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedSchedule?.id === schedule.id
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : isOverdue
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : isUpcoming
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {schedule.machineName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {schedule.maintenanceType}
                        </p>
                      </div>
                      {schedule.isCompleted && (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {new Date(schedule.startDate).toLocaleDateString('tr-TR')} - {new Date(schedule.endDate).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Süre: {durationDays} gün
                      </div>
                      
                      {!schedule.isCompleted && (
                        <div className={`text-sm font-medium ${
                          isOverdue ? 'text-red-600 dark:text-red-400' :
                          isUpcoming ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-gray-600 dark:text-gray-400'
                        }`}>
                          {isOverdue 
                            ? `${Math.abs(daysUntil)} gün gecikmiş`
                            : daysUntil === 0
                            ? 'Bugün'
                            : `${daysUntil} gün kaldı`
                          }
                        </div>
                      )}
                      
                      {schedule.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-2 mt-2">
                          {schedule.description}
                        </p>
                      )}
                    </div>
                    
                    {!schedule.isCompleted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteSchedule(schedule.id);
                        }}
                        className="mt-3 w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm transition-colors"
                      >
                        Tamamlandı
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bakım Planı Detay Modal */}
          {selectedSchedule && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {selectedSchedule.machineName}
                  </h2>
                  <button
                    onClick={() => setSelectedSchedule(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">Bakım Tipi:</span>
                    <p className="font-medium">{selectedSchedule.maintenanceType}</p>
                  </div>
                  
                  {selectedSchedule.description && (
                    <div>
                      <span className="text-sm text-gray-500">Açıklama:</span>
                      <p className="text-sm">{selectedSchedule.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-sm text-gray-500">Başlangıç Tarihi:</span>
                    <p className="font-medium">{new Date(selectedSchedule.startDate).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Bitiş Tarihi:</span>
                    <p className="font-medium">{new Date(selectedSchedule.endDate).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Süre:</span>
                    <p className="font-medium">
                      {Math.ceil((new Date(selectedSchedule.endDate) - new Date(selectedSchedule.startDate)) / (1000 * 60 * 60 * 24)) + 1} gün
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Bildirim Ayarları:</span>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedSchedule.notify30DaysBefore} disabled className="rounded" />
                        <span>30 gün önce bildir</span>
                        {selectedSchedule.notification30DaysSentAt && (
                          <span className="text-xs text-gray-500">
                            (Gönderildi: {new Date(selectedSchedule.notification30DaysSentAt).toLocaleDateString('tr-TR')})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedSchedule.notify15DaysBefore} disabled className="rounded" />
                        <span>15 gün önce bildir</span>
                        {selectedSchedule.notification15DaysSentAt && (
                          <span className="text-xs text-gray-500">
                            (Gönderildi: {new Date(selectedSchedule.notification15DaysSentAt).toLocaleDateString('tr-TR')})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedSchedule.notify3DaysBefore} disabled className="rounded" />
                        <span>3 gün önce bildir</span>
                        {selectedSchedule.notification3DaysSentAt && (
                          <span className="text-xs text-gray-500">
                            (Gönderildi: {new Date(selectedSchedule.notification3DaysSentAt).toLocaleDateString('tr-TR')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {selectedSchedule.isCompleted && selectedSchedule.completedAt && (
                    <div>
                      <span className="text-sm text-gray-500">Tamamlanma Tarihi:</span>
                      <p className="font-medium text-green-600">
                        {new Date(selectedSchedule.completedAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  )}
                  
                  {!selectedSchedule.isCompleted && (
                    <button
                      onClick={() => handleCompleteSchedule(selectedSchedule.id)}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
                    >
                      Tamamlandı
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Yeni Bakım Planı Modal */}
          {showScheduleModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {getTranslation('createSchedule', currentLanguage) || 'Yeni Bakım Planı'}
                  </h2>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); handleCreateSchedule(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getTranslation('machine', currentLanguage) || 'Makine'} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={scheduleForm.machineName}
                      onChange={(e) => {
                        const selected = machines.find(m => m.machineName === e.target.value);
                        setScheduleForm({
                          ...scheduleForm,
                          machineName: e.target.value,
                          machineTableName: selected?.tableName || ''
                        });
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Makine seçin</option>
                      {machines.map((machine) => (
                        <option key={machine.id} value={machine.machineName}>
                          {machine.machineName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getTranslation('maintenanceType', currentLanguage) || 'Bakım Tipi'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={scheduleForm.maintenanceType}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, maintenanceType: e.target.value })}
                      required
                      placeholder="Örn: Periyodik Bakım, Yıllık Bakım, Revizyon"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getTranslation('startDate', currentLanguage) || 'Başlangıç Tarihi'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduleForm.startDate}
                      onChange={(e) => {
                        setScheduleForm({ ...scheduleForm, startDate: e.target.value });
                        // Eğer bitiş tarihi yoksa veya başlangıçtan önceyse, bitiş tarihini otomatik ayarla
                        if (!scheduleForm.endDate || new Date(e.target.value) > new Date(scheduleForm.endDate)) {
                          const endDate = new Date(e.target.value);
                          endDate.setHours(endDate.getHours() + 1); // Varsayılan olarak 1 saat sonra
                          setScheduleForm(prev => ({ ...prev, endDate: endDate.toISOString().slice(0, 16) }));
                        }
                      }}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getTranslation('endDate', currentLanguage) || 'Bitiş Tarihi'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduleForm.endDate}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, endDate: e.target.value })}
                      min={scheduleForm.startDate}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {scheduleForm.startDate && scheduleForm.endDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Süre: {Math.ceil((new Date(scheduleForm.endDate) - new Date(scheduleForm.startDate)) / (1000 * 60 * 60 * 24)) + 1} gün
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {getTranslation('description', currentLanguage) || 'Açıklama'}
                    </label>
                    <textarea
                      value={scheduleForm.description}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                      rows={3}
                      placeholder="Bakım hakkında detaylı bilgi..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {getTranslation('notificationSettings', currentLanguage) || 'Bildirim Ayarları'}
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scheduleForm.notify30DaysBefore}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, notify30DaysBefore: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">30 gün önce bildir</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scheduleForm.notify15DaysBefore}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, notify15DaysBefore: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">15 gün önce bildir</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={scheduleForm.notify3DaysBefore}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, notify3DaysBefore: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-sm">3 gün önce bildir</span>
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {getTranslation('cancel', currentLanguage) || 'İptal'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading 
                        ? (getTranslation('saving', currentLanguage) || 'Kaydediliyor...') 
                        : (getTranslation('create', currentLanguage) || 'Oluştur')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaintenancePage;

