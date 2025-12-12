import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Clock, Activity, Palette } from 'lucide-react';
import { getTranslation } from '../utils/translations';

const ProfilePage = ({ currentLanguage = 'tr' }) => {
  const { user } = useAuth();

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          👤 Profilim
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Hesap bilgileriniz ve oturum detayları
        </p>
      </div>

      <div className="space-y-6">
        {/* Kullanıcı Bilgileri Kartı */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <User className="text-blue-500" size={24} />
            Kullanıcı Bilgileri
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kullanıcı Adı */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-md">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Kullanıcı Adı</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{user?.username}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                <Mail className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">E-posta</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{user?.email || '-'}</p>
              </div>
            </div>

            {/* Rol */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-14 h-14 bg-purple-500 rounded-full flex items-center justify-center shadow-md">
                <Shield className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Rol</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user?.role === 'admin' ? '🛡️ Yönetici' : 
                   user?.role === 'manager' ? '👔 Müdür' :
                   user?.role === 'engineer' ? '⚙️ Mühendis' :
                   user?.role === 'technical' ? '🔧 Teknisyen' :
                   user?.role === 'shiftEngineer' ? '🔧 Vardiya Müh.' :
                   '👤 Kullanıcı'}
                </p>
              </div>
            </div>

            {/* Tema */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
                <Palette className="text-white" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tema</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user?.theme === 'dark' ? '🌙 Koyu' : 
                   user?.theme === 'liquid-glass' ? '✨ Liquid Glass' : 
                   '☀️ Açık'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Oturum Bilgileri Kartı */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
            <Activity className="text-green-500" size={24} />
            Oturum Bilgileri
          </h2>
          
          <div className="space-y-4">
            {/* Hesap Oluşturulma */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Calendar className="text-blue-500" size={22} />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Hesap Oluşturulma</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(user?.createdAt)}
              </span>
            </div>

            {/* Son Giriş */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="text-green-500" size={22} />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Son Giriş</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(user?.lastLogin)}
              </span>
            </div>

            {/* Son Görülme */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Clock className="text-orange-500" size={22} />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Son Görülme</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatDate(user?.lastSeen)}
              </span>
            </div>

            {/* Hesap Durumu */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <Activity className="text-purple-500" size={22} />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Hesap Durumu</span>
              </div>
              <span className={`px-4 py-1 rounded-full text-sm font-semibold ${
                user?.isActive 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
              }`}>
                {user?.isActive ? '✅ Aktif' : '⛔ Pasif'}
              </span>
            </div>

            {/* Online Durumu */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${
                  user?.isOnline ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-gray-400'
                }`}></div>
                <span className="text-gray-700 dark:text-gray-300 font-medium">Bağlantı Durumu</span>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                {user?.isOnline ? '🟢 Çevrimiçi' : '⚫ Çevrimdışı'}
              </span>
            </div>
          </div>
        </div>

        {/* İstatistikler Kartı (Gelecek için hazır) */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-xl shadow-xl text-white">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📊 Dashboard İstatistikleri
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center hover:bg-white/20 transition-all">
              <p className="text-3xl font-bold">-</p>
              <p className="text-sm opacity-90">Toplam Giriş</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center hover:bg-white/20 transition-all">
              <p className="text-3xl font-bold">-</p>
              <p className="text-sm opacity-90">Geri Bildirim</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center hover:bg-white/20 transition-all">
              <p className="text-3xl font-bold">-</p>
              <p className="text-sm opacity-90">Yorumlar</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-4 rounded-lg text-center hover:bg-white/20 transition-all">
              <p className="text-3xl font-bold">-</p>
              <p className="text-sm opacity-90">Rapor Sayısı</p>
            </div>
          </div>
          <p className="text-xs mt-4 opacity-75 text-center">* İstatistikler yakında eklenecek</p>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

