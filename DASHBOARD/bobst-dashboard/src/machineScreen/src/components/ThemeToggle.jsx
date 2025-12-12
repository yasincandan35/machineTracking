import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle ${isDarkMode ? 'dark' : 'light'}`}
      title={isDarkMode ? 'Light Mode\'a Geç' : 'Dark Mode\'a Geç'}
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          {isDarkMode ? (
            <Moon size={16} />
          ) : (
            <Sun size={16} />
          )}
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
