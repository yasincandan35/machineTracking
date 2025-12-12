import React, { useEffect, useState } from 'react';
import { X, Delete } from 'lucide-react';

const buttons = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'backspace']
];

const NumericKeypad = ({ isVisible, onClose, onInput, currentValue = '', position = { x: 0, y: 0 } }) => {
  const [value, setValue] = useState(currentValue || '');

  useEffect(() => {
    if (isVisible) {
      setValue(currentValue || '');
    }
  }, [isVisible, currentValue]);

  if (!isVisible) return null;

  const handlePress = (key) => {
    if (key === 'backspace') {
      const next = value.slice(0, -1);
      setValue(next);
      onInput(next, false);
      return;
    }
    if (key === 'clear') {
      setValue('');
      onInput('', false);
      return;
    }
    if (key === 'enter') {
      onInput(value, true);
      return;
    }
    const next = value + key;
    setValue(next);
    onInput(next, false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 10000050
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute',
          top: `${position.y}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f2937',
          border: '2px solid #374151',
          borderRadius: 12,
          padding: 12,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.8)',
          zIndex: 10000060,
          transformOrigin: 'top center',
          animation: 'dropDown 300ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {buttons.flat().map((key, idx) => (
            <button
              key={idx}
              onClick={() => handlePress(key)}
              style={{
                backgroundColor: key === 'clear' ? '#6b7280' : '#374151',
                border: '1px solid #4b5563',
                color: '#f8fafc',
                borderRadius: 10,
                padding: '18px 0',
                fontSize: 20,
                fontWeight: 700,
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
                transition: 'transform 60ms ease, background-color 80ms ease'
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.96)';
                e.currentTarget.style.backgroundColor = key === 'clear' ? '#5b6470' : '#2f353f';
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = key === 'clear' ? '#6b7280' : '#374151';
              }}
              onPointerLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = key === 'clear' ? '#6b7280' : '#374151';
              }}
            >
              {key === 'backspace' ? <Delete size={22} /> : key === 'clear' ? 'C' : key}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#6b7280',
              border: '1px solid #4b5563',
              color: '#f8fafc',
              borderRadius: 10,
              padding: '14px 0',
              fontSize: 18,
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation',
              transition: 'transform 60ms ease, background-color 80ms ease'
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.backgroundColor = '#5b6470'; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#6b7280'; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#6b7280'; }}
          >
            <X size={18} />
          </button>
          <button
            onClick={() => handlePress('enter')}
            style={{
              backgroundColor: '#dc2626',
              border: '1px solid #b91c1c',
              color: '#ffffff',
              borderRadius: 10,
              padding: '14px 0',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'manipulation',
              transition: 'transform 60ms ease, background-color 80ms ease'
            }}
            onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.backgroundColor = '#b91c1c'; }}
            onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
            onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.backgroundColor = '#dc2626'; }}
          >
            Enter
          </button>
        </div>
        <style jsx>{`
          @keyframes dropDown {
            0% { opacity: 0; transform: translate(-50%, -14px); }
            100% { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default NumericKeypad;


