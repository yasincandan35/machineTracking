import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ 
  title = "Veri Bulunamadı", 
  message = "Henüz veri yok", 
  icon: Icon = Inbox 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <Icon className="w-16 h-16 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  );
} 