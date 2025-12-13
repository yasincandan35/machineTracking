import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useColor } from '../contexts/ColorContext';
import { Palette, Monitor, Save, RotateCcw, Bell, Send, CheckCircle, Settings, Plus, Trash2, Edit2, X } from 'lucide-react';
import { getTranslation } from '../utils/translations';
import { dashboardApi, api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { getFCMToken } from '../config/firebase';

const SettingsPage = ({ currentLanguage = 'tr' }) => {
  const { user, token } = useAuth();
  const { colorSettings, saveColorSettings, resetToDefault, defaultColors } = useColor();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('personalization');
  const [localColorSettings, setLocalColorSettings] = useState(colorSettings);
  const [isLoading, setIsLoading] = useState(false);
  
  // Bildirim testi için state'ler
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [testTitle, setTestTitle] = useState('Test Bildirimi');
  const [testBody, setTestBody] = useState('Bu bir test bildirimidir.');
  const [testCategory, setTestCategory] = useState('maintenance');
  const [sendingTest, setSendingTest] = useState(false);
  const [myFCMToken, setMyFCMToken] = useState(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Bildirim ayarları için state'ler
  const [notificationSettings, setNotificationSettings] = useState([]);
  const [machines, setMachines] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [notificationForm, setNotificationForm] = useState({
    machineId: null,
    notificationType: '',
    isEnabled: true,
    threshold: null,
    thresholdUnit: '',
    notificationTitle: '',
    notificationBody: ''
  });

  // Renk tercihlerini kaydet
  const saveColorPreferences = async () => {
    setIsLoading(true);
    const success = await saveColorSettings(localColorSettings);
    if (success) {
      alert(getTranslation('colorPreferencesSaved', currentLanguage));
    } else {
      alert(getTranslation('colorPreferencesNotSaved', currentLanguage));
    }
    setIsLoading(false);
  };

  // Varsayılan renklere dön
  const handleResetToDefault = async () => {
    setLocalColorSettings(defaultColors);
    await resetToDefault();
  };

  const handleColorChange = (key, value) => {
    setLocalColorSettings(prev => ({
      ...prev,
      [key]: value
}));
  };

  // Kullanıcıları getir (bildirim testi için)
  useEffect(() => {
    if (activeTab === 'notification-test' && token) {
      fetchUsers();
      checkMyFCMToken();
    }
  }, [activeTab, token]);

  // Bildirim ayarlarını yükle
  useEffect(() => {
    if (activeTab === 'notification-settings' && token) {
      fetchNotificationSettings();
      fetchMachines();
      fetchNotificationTypes();
    }
  }, [activeTab, token]);

  // Kendi FCM token'ımı kontrol et
  const checkMyFCMToken = async () => {
    try {
      const token = await getFCMToken();
      setMyFCMToken(token);
    } catch (error) {
      console.log('FCM token alınamadı:', error);
      setMyFCMToken(null);
    }
  };

  // Bildirim izni iste ve token'ı kaydet
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showError('Bu tarayıcı bildirimleri desteklemiyor.');
      return;
    }

    setRequestingPermission(true);
    try {
      // Bildirim izni iste
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // FCM token'ı al
        const fcmToken = await getFCMToken();
        
        if (fcmToken) {
          // Token'ı backend'e kaydet
          try {
            await dashboardApi.post('/maintenance/device-token', {
              token: fcmToken,
              platform: 'web',
              deviceName: navigator.userAgent,
              appVersion: '1.0.0'
            });
            
            setMyFCMToken(fcmToken);
            showSuccess('Bildirim izni verildi ve token kaydedildi! Artık bildirim alabilirsiniz.');
          } catch (error) {
            console.error('Token kaydedilemedi:', error);
            showError('Token kaydedilemedi: ' + (error.response?.data?.message || error.message));
          }
        } else {
          showError('FCM token alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
        }
      } else if (permission === 'denied') {
        showError('Bildirim izni reddedildi. Tarayıcı ayarlarından bildirim iznini açmanız gerekiyor.');
      } else {
        showError('Bildirim izni verilmedi.');
      }
    } catch (error) {
      console.error('Bildirim izni hatası:', error);
      showError('Bildirim izni istenirken hata oluştu: ' + error.message);
    } finally {
      setRequestingPermission(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data || []);
    } catch (err) {
      console.error('Kullanıcılar alınamadı:', err);
    }
  };

  // Bildirim ayarlarını getir
  const fetchNotificationSettings = async () => {
    try {
      const response = await dashboardApi.get('/notificationsettings');
      setNotificationSettings(response.data || []);
    } catch (err) {
      console.error('Bildirim ayarları alınamadı:', err);
      showError('Bildirim ayarları yüklenemedi');
    }
  };

  // Makineleri getir
  const fetchMachines = async () => {
    try {
      const response = await dashboardApi.get('/notificationsettings/machines');
      setMachines(response.data || []);
    } catch (err) {
      console.error('Makineler alınamadı:', err);
      showError('Makineler yüklenemedi: ' + (err.response?.data?.message || err.message));
    }
  };

  // Bildirim tiplerini getir
  const fetchNotificationTypes = async () => {
    try {
      const response = await dashboardApi.get('/notificationsettings/types');
      setNotificationTypes(response.data || []);
    } catch (err) {
      console.error('Bildirim tipleri alınamadı:', err);
    }
  };

  // Bildirim ayarı kaydet
  const handleSaveNotificationSetting = async () => {
    if (!notificationForm.notificationType) {
      showError('Lütfen bildirim tipi seçin');
      return;
    }

    try {
      if (editingSetting) {
        // Güncelle
        await dashboardApi.put(`/notificationsettings/${editingSetting.id}`, notificationForm);
        showSuccess('Bildirim ayarı güncellendi');
      } else {
        // Yeni ekle
        await dashboardApi.post('/notificationsettings', notificationForm);
        showSuccess('Bildirim ayarı eklendi');
      }
      
      setShowNotificationModal(false);
      fetchNotificationSettings();
    } catch (err) {
      console.error('Bildirim ayarı kaydedilemedi:', err);
      showError(err.response?.data?.message || 'Bildirim ayarı kaydedilemedi');
    }
  };

  // Bildirim ayarı sil
  const handleDeleteNotificationSetting = async (id) => {
    if (!window.confirm('Bu bildirim ayarını silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await dashboardApi.delete(`/notificationsettings/${id}`);
      showSuccess('Bildirim ayarı silindi');
      fetchNotificationSettings();
    } catch (err) {
      console.error('Bildirim ayarı silinemedi:', err);
      showError('Bildirim ayarı silinemedi');
    }
  };

  // Bildirim tipi seçildiğinde varsayılan değerleri doldur
  const handleNotificationTypeChange = (typeValue) => {
    const type = notificationTypes.find(t => t.value === typeValue);
    if (type) {
      setNotificationForm(prev => ({
        ...prev,
        notificationType: typeValue,
        threshold: type.defaultThreshold || null,
        thresholdUnit: type.defaultThresholdUnit || '',
        notificationTitle: prev.notificationTitle || type.defaultTitle || '',
        notificationBody: prev.notificationBody || type.defaultBody || ''
      }));
    } else {
      setNotificationForm(prev => ({
        ...prev,
        notificationType: typeValue
      }));
    }
  };

  // Test bildirimi gönder
  const sendTestNotification = async () => {
    if (!selectedUserId) {
      showError('Lütfen bir kullanıcı seçin');
      return;
    }

    if (!testTitle.trim() || !testBody.trim()) {
      showError('Lütfen başlık ve mesaj girin');
      return;
    }

    setSendingTest(true);
    try {
      const payload = {
        UserId: parseInt(selectedUserId),
        Title: testTitle.trim(),
        Body: testBody.trim(),
        Category: testCategory
      };
      
      console.log('Gönderilen payload:', payload);
      
      const response = await dashboardApi.post('/maintenance/test-notification', payload);

      if (response.status === 200) {
        showSuccess('Test bildirimi başarıyla gönderildi!');
        setTestTitle('Test Bildirimi');
        setTestBody('Bu bir test bildirimidir.');
      }
    } catch (error) {
      console.error('Test bildirimi gönderilemedi:', error);
      const errorData = error.response?.data;
      const errorMessage = errorData?.message || errorData?.title || error.message || 'Bilinmeyen hata';
      console.error('Hata detayı:', errorData);
      
      // Token yoksa daha açıklayıcı mesaj göster
      if (errorData?.hasToken === false) {
        showError('⚠️ ' + errorMessage);
      } else {
        showError('Test bildirimi gönderilemedi: ' + errorMessage);
      }
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">{getTranslation('settings', currentLanguage)}</h1>
      
      {/* Tab menüsü */}
      <div className="flex border-b mb-6 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('personalization')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'personalization'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Palette className="inline w-4 h-4 mr-2" />
          {getTranslation('personalization', currentLanguage)}
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'system'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Monitor className="inline w-4 h-4 mr-2" />
          {getTranslation('system', currentLanguage)}
        </button>
        <button
          onClick={() => setActiveTab('notification-settings')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'notification-settings'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Settings className="inline w-4 h-4 mr-2" />
          Bildirim Ayarları
        </button>
        <button
          onClick={() => setActiveTab('notification-test')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'notification-test'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <Bell className="inline w-4 h-4 mr-2" />
          Bildirim Testi
        </button>
      </div>

      {/* Kişiselleştirme sekmesi */}
      {activeTab === 'personalization' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">{getTranslation('colorSettings', currentLanguage)}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {getTranslation('colorSettingsDescription', currentLanguage)}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Arkaplan */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{getTranslation('backgroundColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#f8fafc"
                  />
                </div>
              </div>

              {/* Info Kartları */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{getTranslation('infoCards', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.infoCard}
                    onChange={(e) => handleColorChange('infoCard', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.infoCard}
                    onChange={(e) => handleColorChange('infoCard', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Sidebar */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{getTranslation('sidebar', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.sidebar}
                    onChange={(e) => handleColorChange('sidebar', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.sidebar}
                    onChange={(e) => handleColorChange('sidebar', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#1f2937"
                  />
                </div>
              </div>

              {/* Metin Rengi */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{getTranslation('textColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.text}
                    onChange={(e) => handleColorChange('text', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#1f2937"
                  />
                </div>
              </div>

              {/* Vurgu Rengi */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{getTranslation('accentColor', currentLanguage)}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={localColorSettings.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-12 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localColorSettings.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>


            {/* Butonlar */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={saveColorPreferences}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isLoading ? getTranslation('saving', currentLanguage) : getTranslation('save', currentLanguage)}
              </button>
              <button
                onClick={handleResetToDefault}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <RotateCcw className="w-4 h-4" />
                {getTranslation('default', currentLanguage)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sistem sekmesi */}
      {activeTab === 'system' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">{getTranslation('systemSettings', currentLanguage)}</h2>
          <p className="text-gray-600 dark:text-gray-400">{getTranslation('systemSettingsDescription', currentLanguage)}</p>
        </div>
      )}

      {/* Bildirim Ayarları sekmesi */}
      {activeTab === 'notification-settings' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                  🔔 Bildirim Ayarları
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Makina bazlı özelleştirilebilir bildirim ayarlarınızı yönetin. Hangi bildirimleri almak istediğinizi seçebilir ve eşik değerlerini ayarlayabilirsiniz.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingSetting(null);
                  setNotificationForm({
                    machineId: null,
                    notificationType: '',
                    isEnabled: true,
                    threshold: null,
                    thresholdUnit: '',
                    notificationTitle: '',
                    notificationBody: ''
                  });
                  setShowNotificationModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Yeni Bildirim Ayarı
              </button>
            </div>

            {/* Bildirim Ayarları Listesi */}
            <div className="space-y-4">
              {notificationSettings.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Henüz bildirim ayarı eklenmemiş.</p>
                  <p className="text-sm mt-2">Yeni bildirim ayarı eklemek için yukarıdaki butona tıklayın.</p>
                </div>
              ) : (
                notificationSettings.map((setting) => (
                  <div
                    key={setting.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800 dark:text-white">
                            {setting.machineName}
                          </h3>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            setting.isEnabled
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {setting.isEnabled ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <strong>Tip:</strong> {notificationTypes.find(t => t.value === setting.notificationType)?.label || setting.notificationType}
                        </p>
                        {setting.threshold && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            <strong>Eşik:</strong> {setting.threshold} {setting.thresholdUnit || ''}
                          </p>
                        )}
                        {setting.notificationTitle && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <strong>Başlık:</strong> {setting.notificationTitle}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const type = notificationTypes.find(t => t.value === setting.notificationType);
                            setEditingSetting(setting);
                            setNotificationForm({
                              machineId: setting.machineId,
                              notificationType: setting.notificationType,
                              isEnabled: setting.isEnabled,
                              threshold: setting.threshold,
                              thresholdUnit: setting.thresholdUnit || (type?.defaultThresholdUnit || ''),
                              notificationTitle: setting.notificationTitle || (type?.defaultTitle || ''),
                              notificationBody: setting.notificationBody || (type?.defaultBody || '')
                            });
                            setShowNotificationModal(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNotificationSetting(setting.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bildirim Testi sekmesi */}
      {activeTab === 'notification-test' && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">🔔 Bildirim Testi</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Push notification sistemini test etmek için burayı kullanabilirsiniz. Seçtiğiniz kullanıcıya test bildirimi gönderilir.
          </p>

          {/* Kendi bildirim durumum */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  Bildirim Durumunuz
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {myFCMToken ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Bildirimler aktif - Token kayıtlı
                    </span>
                  ) : (
                    <span>Bildirim izni verilmemiş veya token kayıtlı değil</span>
                  )}
                </p>
              </div>
              {!myFCMToken && (
                <button
                  onClick={requestNotificationPermission}
                  disabled={requestingPermission}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium transition-colors"
                >
                  {requestingPermission ? 'İşleniyor...' : 'Bildirim İzni Ver'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Kullanıcı Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kullanıcı Seç <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Kullanıcı seçin...</option>
                {users
                  .filter(u => u.isActive)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.role}) - {user.email || 'Email yok'}
                    </option>
                  ))}
              </select>
            </div>

            {/* Kategori Seçimi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bildirim Kategorisi
              </label>
              <select
                value={testCategory}
                onChange={(e) => setTestCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="maintenance">🔧 Bakım Bildirimleri</option>
                <option value="production">🏭 Üretim Bildirimleri</option>
                <option value="quality">✅ Kalite Bildirimleri</option>
              </select>
            </div>

            {/* Başlık */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bildirim Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Test Bildirimi"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Mesaj */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bildirim Mesajı <span className="text-red-500">*</span>
              </label>
              <textarea
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                rows={4}
                placeholder="Bu bir test bildirimidir."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Gönder Butonu */}
            <div>
              <button
                onClick={sendTestNotification}
                disabled={sendingTest || !selectedUserId || !testTitle.trim() || !testBody.trim()}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sendingTest ? 'Gönderiliyor...' : 'Test Bildirimi Gönder'}
              </button>
            </div>

            {/* Bilgi Notu */}
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Not:</strong> Bildirimin alınabilmesi için seçilen kullanıcının cihazında FCM token'ı kayıtlı olmalı ve bildirim izni verilmiş olmalıdır.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bildirim Ayarı Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                  {editingSetting ? 'Bildirim Ayarını Düzenle' : 'Yeni Bildirim Ayarı'}
                </h3>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Makine Seçimi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Makine <span className="text-gray-500">(Boş bırakılırsa tüm makineler için geçerli olur)</span>
                  </label>
                  <select
                    value={notificationForm.machineId !== null && notificationForm.machineId !== undefined ? String(notificationForm.machineId) : ''}
                    onChange={(e) => {
                      const selectedValue = e.target.value;
                      const newMachineId = selectedValue === '' || selectedValue === 'null' ? null : parseInt(selectedValue, 10);
                      
                      if (isNaN(newMachineId) && newMachineId !== null) {
                        return;
                      }
                      
                      setNotificationForm({
                        ...notificationForm,
                        machineId: newMachineId
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">Tüm Makineler</option>
                    {machines && machines.length > 0 ? (
                      machines.map((machine) => (
                        <option key={machine.id} value={String(machine.id)}>
                          {machine.machineName}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>Makineler yükleniyor...</option>
                    )}
                  </select>
                </div>

                {/* Bildirim Tipi */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bildirim Tipi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={notificationForm.notificationType}
                    onChange={(e) => handleNotificationTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Seçiniz...</option>
                    {notificationTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aktif/Pasif */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={notificationForm.isEnabled}
                    onChange={(e) => setNotificationForm(prev => ({
                      ...prev,
                      isEnabled: e.target.checked
                    }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bildirimi aktif et
                  </label>
                </div>

                {/* Eşik Değeri */}
                {notificationForm.notificationType && notificationTypes.find(t => t.value === notificationForm.notificationType)?.defaultThreshold !== null && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Eşik Değeri
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={notificationForm.threshold || ''}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          threshold: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="20"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Birim
                      </label>
                      <select
                        value={notificationForm.thresholdUnit || ''}
                        onChange={(e) => setNotificationForm(prev => ({
                          ...prev,
                          thresholdUnit: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Birim seçiniz...</option>
                        {notificationForm.notificationType && (() => {
                          const selectedType = notificationTypes.find(t => t.value === notificationForm.notificationType);
                          if (selectedType?.availableUnits) {
                            return selectedType.availableUnits.map((unit) => (
                              <option key={unit.value} value={unit.value}>
                                {unit.label}
                              </option>
                            ));
                          }
                          // Fallback: Eğer availableUnits yoksa, bildirim tipine göre varsayılan birimler
                          if (notificationForm.notificationType === 'stoppage_duration') {
                            return (
                              <>
                                <option value="minutes">Dakika</option>
                                <option value="hours">Saat</option>
                              </>
                            );
                          } else if (['speed_reached', 'production_complete', 'fire_threshold', 'oee_threshold'].includes(notificationForm.notificationType)) {
                            return <option value="percent">Yüzde (%)</option>;
                          }
                          return null;
                        })()}
                      </select>
                    </div>
                  </div>
                )}

                {/* Özelleştirilebilir Başlık */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bildirim Başlığı (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={notificationForm.notificationTitle || ''}
                    onChange={(e) => setNotificationForm(prev => ({
                      ...prev,
                      notificationTitle: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Özelleştirilebilir başlık"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Kullanılabilir değişkenler: {'{machineName}'}, {'{threshold}'}, {'{currentValue}'}
                  </p>
                </div>

                {/* Özelleştirilebilir Mesaj */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bildirim Mesajı (Opsiyonel)
                  </label>
                  <textarea
                    value={notificationForm.notificationBody || ''}
                    onChange={(e) => setNotificationForm(prev => ({
                      ...prev,
                      notificationBody: e.target.value
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Özelleştirilebilir mesaj"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Kullanılabilir değişkenler: {'{machineName}'}, {'{threshold}'}, {'{currentValue}'}, {'{currentSpeed}'}
                  </p>
                </div>
              </div>

              {/* Butonlar */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveNotificationSetting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingSetting ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
