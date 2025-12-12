import React from 'react';
import { Construction } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <div className="inline-block p-4 bg-blue-100 dark:bg-blue-900 rounded-full mb-6">
            <Construction className="w-16 h-16 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Sitemizde çalışma vardır
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Geçici bir süre servis dışıdır
        </p>
        
        <div className="mt-12">
          <p className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-200">
            YYC
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;

