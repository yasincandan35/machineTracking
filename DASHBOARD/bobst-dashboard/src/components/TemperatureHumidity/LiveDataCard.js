import React from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const LiveDataCard = ({ device, data }) => {
  const isOnline = data && (new Date() - new Date(data.timestamp)) < 30000; // 30 saniye içinde

  return (
    <div className="live-data-card">
      <div className="status" style={{ 
        backgroundColor: isOnline ? '#28a745' : '#dc3545' 
      }}></div>
      
      <h3>{device.name}</h3>
      <p style={{ marginBottom: '16px', opacity: 0.8 }}>
        📍 {device.location}
      </p>
      
      <div className="row">
        <div className="col-6">
          <div className="value">
            {data ? `${data.temperature}°C` : '--'}
          </div>
          <div className="unit">Sıcaklık</div>
        </div>
        <div className="col-6">
          <div className="value">
            {data ? `${data.humidity}%` : '--'}
          </div>
          <div className="unit">Nem</div>
        </div>
      </div>
      
      <div style={{ 
        marginTop: '16px', 
        fontSize: '12px', 
        opacity: 0.7 
      }}>
        {data ? (
          <>
            <div>🕒 {format(new Date(data.timestamp), 'HH:mm:ss', { locale: tr })}</div>
            <div>📅 {format(new Date(data.timestamp), 'dd.MM.yyyy', { locale: tr })}</div>
          </>
        ) : (
          <div>❌ Veri yok</div>
        )}
      </div>
    </div>
  );
};

export default LiveDataCard;
