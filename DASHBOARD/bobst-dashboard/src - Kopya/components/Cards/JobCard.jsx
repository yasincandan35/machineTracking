import React from 'react';
import { Clipboard, Target, Clock, Package } from 'lucide-react';

export default function JobCard({ jobData, style }) {
  if (!jobData) {
    return (
      <div 
        className="relative rounded shadow p-4 bg-white dark:bg-gray-800 dark:text-gray-100 w-full h-full hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer flex flex-col justify-center"
        style={style}
      >
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
          <Clipboard size={60} />
        </div>
        <div className="pr-16">
          <h2 className="text-xl font-semibold">JOB</h2>
          <p className="text-base text-gray-500">İş emri bulunamadı</p>
          <p className="text-2xl font-bold mt-2">-</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative rounded shadow p-4 bg-white dark:bg-gray-800 dark:text-gray-100 min-h-[140px] hover:shadow-lg hover:scale-[1.01] transition-all duration-300 ease-in-out cursor-pointer"
      style={style}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500">
        <Clipboard size={60} />
      </div>
      <div className="pr-16">
        <h2 className="text-xl font-semibold">JOB</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-blue-500" />
            <span className="text-sm">Sipariş: {jobData.orderNumber || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Package size={16} className="text-green-500" />
            <span className="text-sm">Miktar: {jobData.totalQuantity ? parseInt(jobData.totalQuantity).toLocaleString() : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-orange-500" />
            <span className="text-sm">Kalan: {jobData.remainingWork ? parseInt(jobData.remainingWork).toLocaleString() : 'N/A'}</span>
          </div>
        </div>
        <p className="text-lg font-bold mt-3 text-blue-600">
          {jobData.estimatedTime ? `${jobData.estimatedTime} dk` : 'Süre belirtilmemiş'}
        </p>
      </div>
    </div>
  );
} 