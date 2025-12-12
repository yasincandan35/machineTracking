import React from 'react';
import { Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { createPortal } from 'react-dom';

const languages = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

export default function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const { isLiquidGlass, isFluid } = useTheme();
  const [buttonRect, setButtonRect] = React.useState(null);
  const buttonRef = React.useRef(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isOpen]);
  
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        className={`flex items-center gap-2 px-3 py-2 transition-colors duration-200 ${
          isFluid
            ? 'bg-black/40 backdrop-blur-md border border-white/30 rounded-lg text-white hover:bg-black/50'
            : isLiquidGlass 
              ? 'glass-button'
              : 'rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">
          {languages.find(lang => lang.code === currentLanguage)?.flag} {languages.find(lang => lang.code === currentLanguage)?.name}
        </span>
      </button>
      
      {isOpen && buttonRect && createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`fixed w-48 ${
              isFluid
                ? 'bg-black/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg'
                : isLiquidGlass 
                  ? 'glass-card'
                  : 'bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700'
            }`}
            style={{ 
              zIndex: 9999,
              top: `${buttonRect.bottom + 8}px`,
              right: `${window.innerWidth - buttonRect.right}px`
            }}
          >
            {languages.map((language) => (
              <button
                key={language.code}
                className={`w-full text-left px-4 py-3 transition-colors duration-200 flex items-center gap-3 ${
                  isFluid
                    ? (currentLanguage === language.code 
                      ? 'bg-white/20 text-cyan-400' 
                      : 'text-white hover:bg-white/20')
                    : (currentLanguage === language.code 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700')
                }`}
                onClick={() => {
                  onLanguageChange(language.code);
                  setIsOpen(false);
                }}
              >
                <span className="text-lg">{language.flag}</span>
                <span className="font-medium">{language.name}</span>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
} 