import React from 'react';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' }
];

export default function LanguageSelector({ currentLanguage, onLanguageChange }) {
  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
        onClick={() => document.getElementById('language-dropdown').classList.toggle('hidden')}
      >
        <Globe className="w-4 h-4" />
        <span className="text-sm font-medium">
          {languages.find(lang => lang.code === currentLanguage)?.flag} {languages.find(lang => lang.code === currentLanguage)?.name}
        </span>
      </button>
      
      <div
        id="language-dropdown"
        className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hidden z-50"
      >
        {languages.map((language) => (
          <button
            key={language.code}
            className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-3 ${
              currentLanguage === language.code ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : ''
            }`}
            onClick={() => {
              onLanguageChange(language.code);
              document.getElementById('language-dropdown').classList.add('hidden');
            }}
          >
            <span className="text-lg">{language.flag}</span>
            <span className="font-medium">{language.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
} 