import React, { useState } from 'react';
import { Download, FileText, Calendar } from 'lucide-react';
import { getTranslation } from '../../utils/translations';

export default function ReportGenerator({ onGenerate, currentLanguage = 'tr' }) {
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      alert(getTranslation('selectStartEndDate', currentLanguage));
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
        {getTranslation('generateReport', currentLanguage)}
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">{getTranslation('reportType', currentLanguage)}</label>
          <select 
            value={reportType} 
            onChange={(e) => setReportType(e.target.value)}
            className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
          >
            <option value="daily">{getTranslation('dailyReport', currentLanguage)}</option>
            <option value="weekly">{getTranslation('weeklyReport', currentLanguage)}</option>
            <option value="monthly">{getTranslation('monthlyReport', currentLanguage)}</option>
            <option value="custom">{getTranslation('customReport', currentLanguage)}</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">{getTranslation('startDate', currentLanguage)}</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">{getTranslation('endDate', currentLanguage)}</label>
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
          {getTranslation('generateReport', currentLanguage)}
        </button>
      </div>
    </div>
  );
} 