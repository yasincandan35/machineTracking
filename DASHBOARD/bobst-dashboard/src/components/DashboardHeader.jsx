import React, { useState, useEffect } from 'react';
import { AlertTriangle, Menu, X } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import MachineSelect from './MachineSelect';
import ThemeSelector from './ThemeSelector';
import { getTranslation } from '../utils/translations';
import { useTheme } from '../contexts/ThemeContext';

export default function DashboardHeader({
  darkMode,
  setDarkMode,
  currentTime,
  currentLanguage,
  setCurrentLanguage,
  onThemeChange,
  onLiquidGlassVariantChange,
  selectedMachine,
  setSelectedMachine,
  machineList,
  setShowCardModal,
  colorSettings,
  onMobileMenuToggle,
  isMobileMenuOpen,
  sidebarWidth = '4.5rem'
}) {
  const { theme, isLiquidGlass, isFluid, liquidGlassVariant } = useTheme();
  const isLiquidGlassSilver = isLiquidGlass && liquidGlassVariant === 'silver';
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  return (
    <div 
      className={`
        py-2 pr-2 mb-3 relative header-mobile
        ${isFluid ? '' : 'shadow-bottom'}
        ${isFluid ? '' : isLiquidGlass ? 'glass-card' : 'bg-white dark:bg-gray-800'}
        ${isLiquidGlassSilver ? 'text-black' : ''}
      `}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: isFluid ? 45 : 40,
        paddingLeft: isDesktop ? sidebarWidth : '0',
        transition: 'padding-left 0.3s ease',
        ...(isFluid && {
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
        })
      }}
    >
      <div className="flex justify-between items-center overflow-x-auto hide-scrollbar" style={{ paddingLeft: 0, paddingRight: '1rem' }}>
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Mobile hamburger menu - sadece mobile'da görünür */}
          <button
            onClick={() => {
              if (onMobileMenuToggle) onMobileMenuToggle(!isMobileMenuOpen);
            }}
            className="sm:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          
          <h1
            className="text-3xl font-bold text-red-600 header-title-mobile ml-0 md:ml-6"
            style={{
              color: isLiquidGlassSilver ? 'black' : (isFluid ? 'white' : darkMode ? undefined : colorSettings.text)
            }}
          >
            EGEM DASHBOARD
          </h1>
          <div className={`flex items-center gap-2 px-3 py-1 rounded animate-pulse header-construction-mobile ${
            isLiquidGlassSilver
              ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
              : isFluid 
                ? 'bg-yellow-900/50 text-yellow-300 backdrop-blur-sm border border-yellow-500/30' 
                : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
          }`}>
            <AlertTriangle size={16} />
            <p className="text-sm">{getTranslation('siteUnderConstruction', currentLanguage)}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-shrink-0">
          <MachineSelect 
            value={selectedMachine?.id !== undefined ? selectedMachine.id.toString() : ""}
            onChange={(value) => {
              console.log('🔍 Makine seçildi:', value, 'Mevcut selectedMachine:', selectedMachine);
              const machine = machineList.find(m => m.id.toString() === value);
              if (machine) {
                console.log('✅ Makine bulundu:', machine);
                setSelectedMachine(machine);
              } else {
                console.warn('⚠️ Makine bulunamadı:', value, 'Mevcut makineler:', machineList);
              }
            }}
            items={machineList
              .filter((machine, index, self) => 
                index === self.findIndex(m => m.id === machine.id)
              )
              .map(machine => ({
                value: machine.id.toString(),
                label: machine.name
              }))}
          />
          
          <LanguageSelector 
            currentLanguage={currentLanguage} 
            onLanguageChange={setCurrentLanguage} 
          />
          
          <ThemeSelector 
            currentLanguage={currentLanguage} 
            setDarkMode={setDarkMode} 
            onThemeChange={onThemeChange}
            onLiquidGlassVariantChange={onLiquidGlassVariantChange}
          />
          
          <div className="text-sm font-mono" style={{ color: isLiquidGlassSilver ? 'black' : (isFluid ? 'white' : darkMode ? undefined : colorSettings.text) }}>
            {currentTime}
          </div>
          
          <button
            onClick={() => setShowCardModal(true)}
            className={`px-4 py-2 text-white transition-colors ${
              isFluid
                ? 'bg-white/10 backdrop-blur-md border border-white/30 rounded-lg hover:bg-white/20'
                : isLiquidGlass 
                  ? 'glass-button bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg'
                  : 'bg-blue-600 rounded-lg hover:bg-blue-700'
            }`}
          >
            {getTranslation('cardSettings', currentLanguage)}
          </button>
        </div>
      </div>
    </div>
  );
}
