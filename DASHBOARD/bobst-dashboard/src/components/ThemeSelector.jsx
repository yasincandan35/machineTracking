import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { getTranslation } from '../utils/translations';
import { createPortal } from 'react-dom';

const ThemeSelector = ({ currentLanguage = 'tr', setDarkMode, onThemeChange, onLiquidGlassVariantChange }) => {
  const { user } = useAuth();
  const { 
    theme, 
    changeTheme, 
    themes, 
    isLiquidGlass,
    isFluid,
    liquidGlassVariants, 
    changeLiquidGlassVariant, 
    liquidGlassVariant,
  } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showLiquidVariants, setShowLiquidVariants] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [isHoveringSubmenu, setIsHoveringSubmenu] = useState(false);
  const [buttonRect, setButtonRect] = useState(null);
  const [variantButtonRect, setVariantButtonRect] = useState(null);
  const buttonRef = useRef(null);
  const variantButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isOpen]);

  useEffect(() => {
    if (showLiquidVariants && variantButtonRef.current) {
      const rect = variantButtonRef.current.getBoundingClientRect();
      setVariantButtonRect(rect);
    }
  }, [showLiquidVariants]);

  return (
    <div className="relative">
      {/* Theme Toggle Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-2 rounded-lg transition-all duration-200
          ${isFluid
            ? 'bg-black/40 backdrop-blur-md border border-white/30 hover:bg-black/50'
            : isLiquidGlass 
              ? 'glass-button'
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }
        `}
        title={getTranslation('changeTheme', currentLanguage)}
      >
        <span className="text-lg">
          {themes.find(t => t.id === theme)?.icon || '☀️'}
        </span>
      </button>

      {/* Theme Dropdown */}
      {isOpen && buttonRect && createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          <div className={`
            fixed py-2 w-48
            ${isFluid
              ? 'bg-black/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg'
              : isLiquidGlass 
                ? 'glass-card'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg'
            }
          `}
          style={{ 
            zIndex: 9999,
            top: `${buttonRect.bottom + 8}px`,
            right: `${window.innerWidth - buttonRect.right}px`
          }}
          >
            {themes.map((themeOption) => (
              <div key={themeOption.id} className="relative">
                <button
                  ref={themeOption.id === 'liquid-glass' ? variantButtonRef : null}
                onClick={() => {
                  changeTheme(themeOption.id);
                  if (setDarkMode) {
                    setDarkMode(themeOption.id === 'dark');
                  }
                  // Backend'e kaydet
                  if (user?.id && onThemeChange) {
                    onThemeChange(themeOption.id);
                  }
                  setIsOpen(false);
                }}
                onMouseEnter={() => {
                  if (hoverTimeout) clearTimeout(hoverTimeout);
                  if (themeOption.id === 'liquid-glass') setShowLiquidVariants(true);
                }}
                onMouseLeave={() => {
                  if (!isHoveringSubmenu) {
                    const timeout = setTimeout(() => {
                      if (themeOption.id === 'liquid-glass') setShowLiquidVariants(false);
                    }, 1000);
                    setHoverTimeout(timeout);
                  }
                }}
                className={`
                  w-full px-4 py-2 text-left flex items-center gap-3 transition-colors
                  ${isFluid
                    ? (theme === themeOption.id 
                      ? 'bg-white/20 text-cyan-400' 
                      : 'text-white hover:bg-white/20')
                    : theme === themeOption.id 
                      ? (isLiquidGlass ? 'bg-white/20' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400')
                      : (isLiquidGlass ? 'hover:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700')
                  }
                `}
              >
                <span className="text-lg">{themeOption.icon}</span>
                <span className="font-medium">{getTranslation(themeOption.nameKey, currentLanguage)}</span>
                {theme === themeOption.id && (
                  <span className="ml-auto text-sm">✓</span>
                )}
                {themeOption.id === 'liquid-glass' && (
                  <span className="ml-auto text-xs">▶</span>
                )}
              </button>


              {/* Liquid Glass Variants Submenu */}
              {themeOption.id === 'liquid-glass' && showLiquidVariants && variantButtonRect && createPortal(
                <div 
                  className={`fixed py-2 w-48 ${
                    isFluid
                      ? 'bg-black/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg'
                      : isLiquidGlass 
                        ? 'glass-card' 
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg'
                  }`}
                  style={{ 
                    zIndex: 10000,
                    top: `${variantButtonRect.top}px`,
                    left: `${variantButtonRect.right + 8}px`
                  }}
                  onMouseEnter={() => {
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    setShowLiquidVariants(true);
                    setIsHoveringSubmenu(true);
                  }}
                  onMouseLeave={() => {
                    setIsHoveringSubmenu(false);
                    const timeout = setTimeout(() => {
                      if (!isHoveringSubmenu) setShowLiquidVariants(false);
                    }, 1000);
                    setHoverTimeout(timeout);
                  }}
                >
                  {liquidGlassVariants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => {
                        // Önce liquid-glass temasını aktif et
                        if (theme !== 'liquid-glass') {
                          changeTheme('liquid-glass');
                          // Backend'e kaydet
                          if (user?.id && onThemeChange) {
                            onThemeChange('liquid-glass');
                          }
                        }
                        // Sonra varyantı değiştir
                        changeLiquidGlassVariant(variant.id);
                        // Variant değişikliğini bildir
                        if (onLiquidGlassVariantChange) {
                          onLiquidGlassVariantChange(variant.id);
                        }
                        setShowLiquidVariants(false);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full px-3 py-2 text-left flex items-center gap-2 transition-colors text-sm
                        ${isFluid
                          ? (liquidGlassVariant === variant.id 
                            ? 'bg-white/30 text-cyan-400' 
                            : 'text-white hover:bg-white/15')
                          : liquidGlassVariant === variant.id 
                            ? (isLiquidGlass ? 'bg-white/30' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400')
                            : (isLiquidGlass ? 'hover:bg-white/15' : 'hover:bg-gray-50 dark:hover:bg-gray-700')
                        }
                      `}
                    >
                      <span className="text-base">{variant.icon}</span>
                      <span className="font-medium">{variant.name}</span>
                      {liquidGlassVariant === variant.id && (
                        <span className="ml-auto text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>,
                document.body
              )}
            </div>
          ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default ThemeSelector;
