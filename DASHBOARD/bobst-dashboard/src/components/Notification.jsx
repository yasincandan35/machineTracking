import React, { useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { getTranslation } from '../utils/translations';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const NotificationContainer = () => {
  const { notifications, removeNotification } = useNotification();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
};

const NotificationItem = ({ notification, onClose, isDarkMode }) => {
  const { type, title, message, duration } = notification;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBackgroundColor = () => {
    if (isDarkMode) {
      switch (type) {
        case 'success':
          return 'bg-green-900/90 border-green-700';
        case 'error':
          return 'bg-red-900/90 border-red-700';
        case 'warning':
          return 'bg-yellow-900/90 border-yellow-700';
        case 'info':
        default:
          return 'bg-blue-900/90 border-blue-700';
      }
    } else {
      switch (type) {
        case 'success':
          return 'bg-green-50 border-green-200';
        case 'error':
          return 'bg-red-50 border-red-200';
        case 'warning':
          return 'bg-yellow-50 border-yellow-200';
        case 'info':
        default:
          return 'bg-blue-50 border-blue-200';
      }
    }
  };

  const getTextColor = () => {
    if (isDarkMode) {
      switch (type) {
        case 'success':
          return 'text-green-100';
        case 'error':
          return 'text-red-100';
        case 'warning':
          return 'text-yellow-100';
        case 'info':
        default:
          return 'text-blue-100';
      }
    } else {
      switch (type) {
        case 'success':
          return 'text-green-800';
        case 'error':
          return 'text-red-800';
        case 'warning':
          return 'text-yellow-800';
        case 'info':
        default:
          return 'text-blue-800';
      }
    }
  };

  return (
    <div className={`
      relative p-4 rounded-lg border shadow-lg backdrop-blur-sm
      transform transition-all duration-300 ease-in-out
      animate-slide-in-right
      ${getBackgroundColor()}
      ${getTextColor()}
    `}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-semibold mb-1">
              {title}
            </h4>
          )}
          <p className="text-sm">
            {message}
          </p>
        </div>
        
        <button
          onClick={onClose}
          className={`
            flex-shrink-0 ml-2 p-1 rounded-full transition-colors
            ${isDarkMode 
              ? 'hover:bg-white/10 text-gray-300 hover:text-white' 
              : 'hover:bg-black/10 text-gray-500 hover:text-gray-700'
            }
          `}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Progress bar for duration */}
      {duration > 0 && (
        <div className={`
          absolute bottom-0 left-0 h-1 rounded-b-lg
          ${type === 'success' ? 'bg-green-400' : 
            type === 'error' ? 'bg-red-400' :
            type === 'warning' ? 'bg-yellow-400' : 'bg-blue-400'}
          animate-progress
        `} 
        style={{
          animationDuration: `${duration}ms`
        }} />
      )}
    </div>
  );
};

export default NotificationContainer;
