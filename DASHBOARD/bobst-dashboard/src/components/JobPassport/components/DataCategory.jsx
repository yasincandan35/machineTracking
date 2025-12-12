/**
 * DataCategory Component
 * Kart içindeki veri kategorilerini gösterir
 */

import React from 'react';

const DataCategory = ({ label, value, formatToner, isDark = false }) => {
  const displayValue = formatToner && value && value !== '-' 
    ? value.split(',').map(t => t.trim()).filter(t => t)
    : [value];

  const categoryStyle = {
    background: isDark ? 'rgba(55, 65, 81, 0.6)' : 'rgba(255, 255, 255, 0.6)',
    borderRadius: '8px',
    padding: '8px',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '600',
    color: isDark ? '#9ca3af' : '#555',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const valueStyle = {
    fontSize: value && value.length > 15 ? '11px' : '13px',
    color: isDark ? '#e5e7eb' : '#333',
    fontWeight: '500',
    wordWrap: 'break-word',
    overflowWrap: 'break-word',
    hyphens: 'auto',
    lineHeight: value && value.length > 15 ? '1.3' : '1.5'
  };

  return (
    <div className="data-category" style={categoryStyle}>
      <div className="category-label" style={labelStyle}>{label}</div>
      <div className="category-value" style={valueStyle}>
        {formatToner && displayValue.length > 1 ? (
          displayValue.map((v, i) => <div key={i}>{v}</div>)
        ) : (
          value
        )}
      </div>
    </div>
  );
};

export default DataCategory;

