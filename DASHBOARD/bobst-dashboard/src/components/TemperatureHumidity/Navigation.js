import React from 'react';

const Navigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'analysis', label: 'Veri Analizi', icon: '📊' },
    { id: 'settings', label: 'Ayarlar', icon: '⚙️' }
  ];

  return (
    <nav className="top-navigation">
      <div className="nav-brand">
        <span className="brand-icon">🌡️</span>
        <span className="brand-text">Sıcaklık & Nem İzleme</span>
      </div>
      <div className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-text">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;