import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { dashboardApi } from '../../utils/api';
import { getTranslation } from '../../utils/translations';
import { useNotification } from '../../contexts/NotificationContext';

const MaintenanceRequestModal = ({ isOpen, onClose, machine, currentLanguage = 'tr' }) => {
  const { showSuccess, showError } = useNotification();
  const [faultTypes, setFaultTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    faultType: '',
    description: '',
    notificationCategory: 'maintenance' // Varsayılan olarak bakım
  });

  useEffect(() => {
    if (isOpen) {
      fetchFaultTypes();
    }
  }, [isOpen]);

  const fetchFaultTypes = async () => {
    try {
      const response = await dashboardApi.get('/maintenance/fault-types');
      setFaultTypes(response.data || []);
    } catch (error) {
      console.error('Arıza tipleri alınamadı:', error);
      showError('Arıza tipleri yüklenemedi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.faultType) {
      showError('Lütfen arıza tipi seçin');
      return;
    }

    setLoading(true);
    try {
      await dashboardApi.post('/maintenance/requests', {
        machineName: machine?.name || machine?.machineName || '',
        machineTableName: machine?.tableName || machine?.machineTableName || '',
        faultType: formData.faultType,
        description: formData.description || null,
        notificationCategory: formData.notificationCategory
      });

      showSuccess('Arıza bildirimi başarıyla oluşturuldu');
      setFormData({ faultType: '', description: '', notificationCategory: 'maintenance' });
      onClose();
    } catch (error) {
      console.error('Arıza bildirimi oluşturulamadı:', error);
      showError(error.response?.data?.message || 'Arıza bildirimi oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  // Body overflow'unu kontrol et ve düzelt
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const modalContent = (
    <div 
      style={{ 
        zIndex: 2147483647,
        position: 'fixed',
        top: '0px',
        left: '0px',
        right: '0px',
        bottom: '0px',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        margin: '0px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{ 
          position: 'relative', 
          margin: '0px',
          pointerEvents: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '28rem',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#000000',
          minHeight: '200px'
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {getTranslation('maintenanceRequest', currentLanguage) || 'Arıza Bildirimi'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {getTranslation('machine', currentLanguage) || 'Makine'}
            </label>
            <input
              type="text"
              value={machine?.name || machine?.machineName || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {getTranslation('faultType', currentLanguage) || 'Arıza Tipi'} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.faultType}
              onChange={(e) => setFormData({ ...formData, faultType: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">{getTranslation('selectFaultType', currentLanguage) || 'Arıza tipi seçin'}</option>
              {faultTypes.map((type, index) => (
                <option key={index} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bildirim Kategorisi <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.notificationCategory}
              onChange={(e) => setFormData({ ...formData, notificationCategory: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="maintenance">🔧 Bakım Bildirimleri</option>
              <option value="production">🏭 Üretim Bildirimleri</option>
              <option value="quality">✅ Kalite Bildirimleri</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Bu bildirim seçilen kategoriye göre ilgili personellere gönderilecektir.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {getTranslation('description', currentLanguage) || 'Açıklama'}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={getTranslation('faultDescriptionPlaceholder', currentLanguage) || 'Arıza hakkında detaylı bilgi verin...'}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
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
                : (getTranslation('createRequest', currentLanguage) || 'Bildirim Oluştur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Portal ile body'ye render et
  if (typeof document === 'undefined') {
    return null;
  }
  
  return createPortal(modalContent, document.body);
};

export default MaintenanceRequestModal;

