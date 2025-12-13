import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useColor } from '../contexts/ColorContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import { getTranslation } from '../utils/translations';
import { cardDimensions } from '../utils/cardMappings';

// Modüler bileşenler
import Sidebar from '../components/Sidebar';
import DashboardHeader from '../components/DashboardHeader';
import GridSystem from '../components/GridSystem';
import CardSettingsModal from '../components/Modals/CardSettingsModal';
import { useDashboardData } from '../hooks/useDashboardData';
import MachineOverviewCard from '../components/Cards/MachineOverviewCard';
import FluidBackground from '../components/FluidBackground';

import OEEGauge from '../components/Cards/OEEGauge';

// Diğer sayfalar
import DatabaseAdmin from './DatabaseAdmin';
import AdminPanel from './AdminPanel';
import SettingsPage from './SettingsPage';
import ProfilePage from './ProfilePage';
import FeedbackPage from './FeedbackPage';
import ProjectTimelinePage from './ProjectTimelinePage';
import ShiftManagement from './ShiftManagement';
import ReportsPage from './ReportsPage';
import JobPassportPage from './JobPassportPage';
import AnalysisPage from './AnalysisPage';
import TemperatureHumidityPage from './TemperatureHumidityPage';
import MaintenancePage from './MaintenancePage';
import PeriodicSummariesPage from './PeriodicSummariesPage';
import { usePushNotification } from '../contexts/PushNotificationContext';
import { Bell, X, AlertCircle } from 'lucide-react';

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab = searchParams.get('tab') || 'home';

  const [darkMode, setDarkMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [currentTab, setCurrentTab] = useState(urlTab);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [lastLocalChange, setLastLocalChange] = useState(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [visibleCards, setVisibleCards] = useState([
    'productionSummaryInfo',
    'speedInfo',
    'wastageInfo',
    'machineStateInfo',
    'dieCounterInfo',
    'dieSpeedInfo',
    'paperConsumptionInfo',
    'ethylConsumptionInfo',
    'stopDurationInfo',
    'oeeGauge',
    'stoppageChart'
  ]);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState('tr');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedLayout, setSavedLayout] = useState(null);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const [homeSubTab, setHomeSubTab] = useState('dashboard'); // 'dashboard' | 'periodicSummaries'

  const { user } = useAuth();
  const { colorSettings } = useColor();
  const { theme, isLiquidGlass, isFluid, changeTheme } = useTheme();
  const { permission, fcmToken, isSupported, requestPermissionAndRegister } = usePushNotification();
  const userId = user?.id;
  const allowedSections = user?.roleSettings?.allowedSections;
  const defaultTab = useMemo(() => {
    if (!allowedSections || allowedSections.length === 0) {
      return 'home';
    }
    if (allowedSections.includes('home')) {
      return 'home';
    }
    return allowedSections[0];
  }, [allowedSections]);

  const handleTabChange = (newTab) => {
    if (allowedSections && allowedSections.length > 0 && !allowedSections.includes(newTab)) {
      return;
    }
    setCurrentTab(newTab);
    setSearchParams({ tab: newTab });
  };

  // Machine rolündeki kullanıcıları otomatik olarak machine-screen'e yönlendir
  useEffect(() => {
    if (user?.role === 'machine') {
      navigate('/machine-screen', { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    if (!allowedSections || allowedSections.length === 0 || allowedSections.includes(urlTab)) {
      setCurrentTab(urlTab);
    } else {
      const fallback = defaultTab;
      setCurrentTab(fallback);
      setSearchParams({ tab: fallback });
    }
  }, [urlTab, allowedSections, defaultTab, setSearchParams]);

  useEffect(() => {
    if (allowedSections && allowedSections.length > 0 && !allowedSections.includes(currentTab)) {
      const fallback = defaultTab;
      setCurrentTab(fallback);
      setSearchParams({ tab: fallback });
    }
  }, [allowedSections, currentTab, defaultTab, setSearchParams]);

  useEffect(() => {
    if (user?.theme) {
      localStorage.removeItem('dashboard-theme');

      if (user.theme !== theme && user.theme !== 'liquid-glass') {
        changeTheme(user.theme);
      } else if (user.theme === 'liquid-glass' && theme !== 'liquid-glass') {
        changeTheme(user.theme);
      }
    }
  }, [user?.theme]);

  useEffect(() => {
    setDarkMode(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (user?.languageSelection) {
      setCurrentLanguage(user.languageSelection);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (user.theme && user.theme !== theme) {
      if (lastLocalChange && Date.now() - lastLocalChange < 10000) {
        return;
      }
      changeTheme(user.theme);
    }

    if (user.languageSelection && user.languageSelection !== currentLanguage) {
      if (lastLocalChange && Date.now() - lastLocalChange < 10000) {
        return;
      }
      setCurrentLanguage(user.languageSelection);
    }
  }, [user]);

  const handleLanguageChange = (newLanguage) => {
    setCurrentLanguage(newLanguage);
    setLastLocalChange(Date.now());
    localStorage.setItem('dashboard-language', newLanguage);
    
    // Dispatch custom event for TemperatureHumiditySystem to listen
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: newLanguage } }));

    if (userId && !isLoadingPreferences && user && user.languageSelection !== newLanguage) {
      api.put(`/users/${userId}/language`, { language: newLanguage })
        .catch(err => {
          console.warn('Dil kaydedilemedi:', err.message);
        });
    }
  };

  const handleThemeChange = (newTheme) => {
    setLastLocalChange(Date.now());

    if (userId && user) {
      api.put(`/users/${userId}/theme`, { theme: newTheme })
        .catch(err => {
          console.warn('Tema kaydedilemedi:', err.message);
        });
    }
  };

  const handleLiquidGlassVariantChange = (variant) => {
    if (userId && user) {
      // Variant'ı localStorage'a kaydet (ThemeContext zaten yapıyor ama emin olmak için)
      localStorage.setItem('liquid-glass-variant', variant);
      // Backend'e kaydetmek için user objesini güncelle (eğer backend'de variant desteği varsa)
      // Şimdilik sadece localStorage'a kaydediyoruz
    }
  };

  const {
    liveData,
    range,
    setRange,
    rangeData,
    machineList: hookMachineList,
    selectedMachine: hookSelectedMachine,
    setSelectedMachine: hookSetSelectedMachine
  } = useDashboardData(userId, currentLanguage, currentTab);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (userId && hookSelectedMachine?.id !== undefined) {
      fetchPreferences();
      api.post(`/preferences/last-machine`, {
        userId: userId,
        machineId: hookSelectedMachine.id
      }).catch(err => console.warn('Son makine kaydedilemedi:', err));
    }
  }, [userId, hookSelectedMachine?.id]);

  const fetchPreferences = () => {
    if (!hasLoadedPreferences) {
      setIsLoadingPreferences(true);
    }
    if (!userId || hookSelectedMachine?.id === undefined) {
      console.warn('Preferences yüklenemedi - userId veya machineId yok:', { userId, machineId: hookSelectedMachine?.id });
      setIsLoadingPreferences(false);
      return;
    }

    api.get(`/preferences?userId=${userId}&machineId=${hookSelectedMachine.id}`)
      .then(res => {
        const hasVisibleCards = res.data.visibleCards !== null && res.data.visibleCards !== undefined;

        let cards = [];
        try {
          cards = res.data.visibleCards
            ? (typeof res.data.visibleCards === 'string'
              ? JSON.parse(res.data.visibleCards)
              : res.data.visibleCards)
            : [];
        } catch (err) {
          console.error('VisibleCards parse hatası:', err);
          cards = [];
        }

        cards = Array.isArray(cards) ? cards : [];

        if (!hasVisibleCards) {
          const defaultCards = [
            'jobCard',
            'productionSummaryInfo',
            'speedInfo',
            'wastageInfo',
            'machineStateInfo',
            'dieCounterInfo',
            'dieSpeedInfo',
            'paperConsumptionInfo',
            'ethylConsumptionInfo',
            'stopDurationInfo',
            'oeeGauge',
            'stoppageChart'
          ];
          setVisibleCards(defaultCards);

          api.post('/preferences', {
            userId: userId,
            machineId: hookSelectedMachine.id,
            visibleCards: JSON.stringify(defaultCards)
          }).catch(err => console.warn('Default kartlar kaydedilemedi:', err));
        } else {
          setVisibleCards(cards);
        }

        if (res.data.layout) {
          try {
            const layoutData = typeof res.data.layout === 'string'
              ? JSON.parse(res.data.layout)
              : res.data.layout;
            setSavedLayout(layoutData);
          } catch (err) {
            console.error('Layout parse hatası:', err);
          }
        }

        setHasLoadedPreferences(true);
        setIsLoadingPreferences(false);
      })
      .catch(err => {
        console.error('Tercihler yüklenemedi:', err);
        setHasLoadedPreferences(true);
        setIsLoadingPreferences(false);
      });
  };

  const headerOffsetClass = isSidebarHovered ? 'lg:-ml-60' : 'lg:-ml-20';
  const contentOffsetClass = isSidebarHovered ? 'lg:ml-60' : 'lg:ml-20';
  const sidebarWidth = isSidebarHovered ? '15rem' : '4.5rem';

  return (
    <div
      className={`min-h-screen ${
        isLiquidGlass
          ? 'liquid-glass text-white'
          : darkMode
            ? 'dark text-white'
            : 'text-black'
      } ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}
      style={{
        backgroundColor: isLiquidGlass || isFluid
          ? 'transparent'
          : darkMode
            ? '#0f172a'
            : colorSettings.background
      }}
    >
      {isFluid && hookSelectedMachine?.id === -1 && <FluidBackground />}
      <Sidebar
        current={currentTab}
        onChange={handleTabChange}
        isHovered={isSidebarHovered}
        setIsHovered={setIsSidebarHovered}
        backgroundColor={isLiquidGlass ? 'transparent' : (darkMode ? undefined : colorSettings.sidebar)}
        isLiquidGlass={isLiquidGlass}
        currentLanguage={currentLanguage}
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuClose={() => {
          setIsMobileMenuOpen(false);
        }}
      />

      <div
        className={`transition-all duration-300 ${contentOffsetClass} main-content-mobile`}
        style={{
          color: darkMode ? undefined : colorSettings.text
        }}
      >
        <div className={`transition-all duration-300 ${headerOffsetClass}`}>
          <DashboardHeader
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            currentTime={currentTime}
            currentLanguage={currentLanguage}
            setCurrentLanguage={handleLanguageChange}
            onThemeChange={handleThemeChange}
            onLiquidGlassVariantChange={handleLiquidGlassVariantChange}
            selectedMachine={hookSelectedMachine}
            setSelectedMachine={hookSetSelectedMachine}
            machineList={hookMachineList}
            onMobileMenuToggle={setIsMobileMenuOpen}
            isMobileMenuOpen={isMobileMenuOpen}
            setShowCardModal={setShowCardModal}
            colorSettings={colorSettings}
            isSidebarHovered={isSidebarHovered}
            sidebarWidth={sidebarWidth}
          />
        </div>

        {/* Bildirim İzni Banner */}
        {isSupported && user && (permission === 'default' || (permission === 'granted' && !fcmToken)) && (
          <div 
            className={`mx-4 mt-4 mb-4 p-4 rounded-lg shadow-lg flex items-center justify-between ${
              isFluid 
                ? 'bg-yellow-900/80 backdrop-blur-sm border border-yellow-500/50 text-yellow-100' 
                : darkMode 
                  ? 'bg-yellow-900/90 text-yellow-100 border border-yellow-700' 
                  : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
            }`}
            style={{
              zIndex: 40
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <Bell className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm sm:text-base">
                  {permission === 'default' 
                    ? 'Bildirimler için izin verin' 
                    : 'Bildirim token\'ı kaydediliyor...'}
                </p>
                <p className="text-xs sm:text-sm mt-1 opacity-90">
                  {permission === 'default'
                    ? 'Arıza bildirimleri ve bakım hatırlatmaları için bildirim izni gerekiyor.'
                    : 'Bildirimler aktif ediliyor, lütfen bekleyin...'}
                </p>
              </div>
            </div>
            {permission === 'default' && (
              <button
                onClick={requestPermissionAndRegister}
                className={`px-4 py-2 rounded-md font-medium text-sm sm:text-base transition-colors flex-shrink-0 ${
                  isFluid
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : darkMode
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                }`}
              >
                İzin Ver
              </button>
            )}
          </div>
        )}

        {/* İzin Reddedilmişse Bilgilendirme */}
        {isSupported && user && permission === 'denied' && !fcmToken && (
          <div 
            className={`mx-4 mt-4 mb-4 p-4 rounded-lg shadow-lg flex items-center justify-between ${
              isFluid 
                ? 'bg-red-900/80 backdrop-blur-sm border border-red-500/50 text-red-100' 
                : darkMode 
                  ? 'bg-red-900/90 text-red-100 border border-red-700' 
                  : 'bg-red-50 border border-red-200 text-red-800'
            }`}
            style={{
              zIndex: 40
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm sm:text-base">
                  Bildirim izni reddedilmiş
                </p>
                <p className="text-xs sm:text-sm mt-1 opacity-90">
                  Bildirim almak için tarayıcı ayarlarından bildirim iznini açmanız gerekiyor.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'home' && (
          <>
            {/* Home sayfası içi tab'lar */}
            <div className="px-4 sm:px-6 pt-4">
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setHomeSubTab('dashboard')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    homeSubTab === 'dashboard'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {currentLanguage === 'tr' ? 'Dashboard' : 'Dashboard'}
                </button>
                <button
                  onClick={() => setHomeSubTab('periodicSummaries')}
                  className={`px-4 py-2 font-medium text-sm transition-colors ${
                    homeSubTab === 'periodicSummaries'
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {currentLanguage === 'tr' ? 'Periyodik Özetler' : 'Periodic Summaries'}
                </button>
              </div>
            </div>

            {homeSubTab === 'periodicSummaries' ? (
              <PeriodicSummariesPage
                darkMode={darkMode}
                currentLanguage={currentLanguage}
                selectedMachine={hookSelectedMachine}
                colorSettings={colorSettings}
              />
            ) : (
              <>
                {!hasLoadedPreferences && isLoadingPreferences ? (
                  <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Ayarlar yükleniyor...</p>
                    </div>
                  </div>
                ) : hookSelectedMachine?.id === -1 ? (
              <div className="h-[calc(100vh-7.5rem)] pr-3 pl-0 pb-3 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 h-full pb-3">
                  {(hookMachineList || [])
                    .filter(m => m.id !== -1)
                    .map(machine => (
                      <div
                        key={machine.id}
                        className="h-full"
                      >
                        <MachineOverviewCard
                          machine={machine}
                          style={darkMode ? {} : { backgroundColor: colorSettings.infoCard }}
                          currentLanguage={currentLanguage}
                          isDark={darkMode}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <>
                <GridSystem
                  visibleCards={visibleCards}
                  liveData={liveData}
                  currentLanguage={currentLanguage}
                  darkMode={darkMode}
                  colorSettings={colorSettings}
                  isLiquidGlass={isLiquidGlass}
                  savedLayout={savedLayout}
                  selectedMachine={hookSelectedMachine}
                  onLayoutChange={(layout) => {
                    const fixedLayout = layout.map(item => {
                      const dimensions = cardDimensions[item.i] || { w: item.w, h: item.h };
                      return {
                        ...item,
                        w: dimensions.w,
                        h: dimensions.h,
                        static: false,
                        isDraggable: true
                      };
                    });

                    setSavedLayout(fixedLayout);

                    if (userId && hookSelectedMachine?.id !== undefined) {
                      setTimeout(() => {
                        api.post('/preferences', {
                          userId: userId,
                          machineId: hookSelectedMachine.id,
                          layout: JSON.stringify(fixedLayout)
                        }).catch(err => console.warn('Layout kaydedilemedi:', err));
                      }, 500);
                    }
                  }}
                />
              </>
            )}
              </>
            )}
          </>
        )}

        {currentTab === 'analysis' && <AnalysisPage currentLanguage={currentLanguage} selectedMachine={hookSelectedMachine} colorSettings={colorSettings} liveData={liveData} />}
        {currentTab === 'reports' && <ReportsPage darkMode={darkMode} currentLanguage={currentLanguage} selectedMachine={hookSelectedMachine} />}
        {currentTab === 'temperatureHumidity' && <TemperatureHumidityPage />}
        {currentTab === 'maintenance' && <MaintenancePage currentLanguage={currentLanguage} darkMode={darkMode} />}
        {currentTab === 'database' && <DatabaseAdmin />}
        {currentTab === 'admin' && <AdminPanel />}
        {currentTab === 'shifts' && <ShiftManagement darkMode={darkMode} selectedMachine={hookSelectedMachine} currentLanguage={currentLanguage} />}
        {currentTab === 'settings' && <SettingsPage currentLanguage={currentLanguage} />}
        {currentTab === 'profile' && <ProfilePage currentLanguage={currentLanguage} />}
        {currentTab === 'feedback' && <FeedbackPage currentLanguage={currentLanguage} />}
        {currentTab === 'projectTimeline' && <ProjectTimelinePage currentLanguage={currentLanguage} />}
        {currentTab === 'jobPassport' && <JobPassportPage />}

        {showCardModal && userId && hookSelectedMachine?.id !== undefined && (
          <CardSettingsModal
            userId={userId}
            machineId={hookSelectedMachine.id}
            currentVisibleCards={visibleCards}
            onClose={() => setShowCardModal(false)}
            onSave={(cards) => {
              setVisibleCards(cards);
              setShowCardModal(false);
            }}
            currentLanguage={currentLanguage}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;