import React from 'react';

const Header = () => {
  return (
    <header style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px',
      textAlign: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>
        🌡️ Sıcaklık - Nem Takip Sistemi
      </h1>
      <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '16px' }}>
        Gerçek Zamanlı Sensör Verileri ve Analiz
      </p>
    </header>
  );
};

export default Header;
