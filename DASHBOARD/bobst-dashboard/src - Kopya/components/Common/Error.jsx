import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({ message = "Bir hata oluştu", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center p-4 text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Hata</h3>
      <p className="text-gray-600 mb-4">{message}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Tekrar Dene
        </button>
      )}
    </div>
  );
} 