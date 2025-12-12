import React, { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';

export default function ReportGenerator({ onGenerate }) {
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      alert('Lütfen başlangıç ve bitiş tarihlerini seçin');
      return;
    }
    
    onGenerate({
      type: reportType,
      startDate,
      endDate
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Rapor Oluştur
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Rapor Türü</label>
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="daily">Günlük Rapor</option>
            <option value="weekly">Haftalık Rapor</option>
            <option value="monthly">Aylık Rapor</option>
            <option value="custom">Özel Rapor</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Başlangıç Tarihi</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Bitiş Tarihi</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
        
        <button 
          onClick={handleGenerate}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          Rapor Oluştur
        </button>
      </div>
    </div>
  );
} 