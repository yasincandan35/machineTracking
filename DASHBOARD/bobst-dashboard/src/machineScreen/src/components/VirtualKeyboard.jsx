import React, { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';

const VirtualKeyboard = ({ isVisible, onClose, onInput, currentValue = '', placeholder = '', mode = 'full', position = { x: 0, y: 0 }, onSwitchMode }) => {
  const [inputValue, setInputValue] = useState(currentValue);
  const [cursorPosition, setCursorPosition] = useState(currentValue.length);
  const [isCapsLock, setIsCapsLock] = useState(false);

  useEffect(() => {
    setInputValue(currentValue);
    setCursorPosition(currentValue.length);
  }, [currentValue]);

  // Klavye açıldığında input'u temizle
  useEffect(() => {
    if (isVisible) {
      setInputValue('');
      setCursorPosition(0);
    }
  }, [isVisible]);

  const fullRows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'ğ', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ş', 'i'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'ö', 'ç'],
    ['caps', 'space', 'backspace', '123', 'enter', 'close']
  ];

  const numberRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['.', ',', '?', '!', "'"],
    ['space', 'backspace', 'abc', 'enter', 'close']
  ];


  const rows = mode === 'number' ? numberRows : fullRows;

  const specialChars = {
    'ğ': 'Ğ', 'ü': 'Ü', 'ş': 'Ş', 'ı': 'I', 'ö': 'Ö', 'ç': 'Ç'
  };

  const handleKeyPress = (key) => {
    if (key === 'space') {
      insertAtCursor(' ');
    } else if (key === 'backspace') {
      if (cursorPosition > 0) {
        const newValue = inputValue.slice(0, cursorPosition - 1) + inputValue.slice(cursorPosition);
        setInputValue(newValue);
        setCursorPosition(cursorPosition - 1);
        // Textbox'a da gönder
        onInput(newValue, false);
      }
    } else if (key === 'enter') {
      onInput(inputValue, true);
    } else if (key === 'close') {
      onClose();
    } else if (key === 'caps') {
      setIsCapsLock(prev => !prev);
      onInput(inputValue, false);
    } else if (key === '123') {
      // Sayı moduna geç
      onInput(inputValue, false);
      onSwitchMode && onSwitchMode('number');
    } else if (key === 'abc') {
      // Harf moduna geç
      onInput(inputValue, false);
      onSwitchMode && onSwitchMode('full');
    } else {
      insertAtCursor(key);
    }
  };

  const insertAtCursor = (char) => {
    const isLetter = typeof char === 'string' && char.length === 1;
    const upperMap = { 'q':'Q','w':'W','e':'E','r':'R','t':'T','y':'Y','u':'U','i':'I','o':'O','p':'P','ğ':'Ğ','ü':'Ü','a':'A','s':'S','d':'D','f':'F','g':'G','h':'H','j':'J','k':'K','l':'L','ş':'Ş','z':'Z','x':'X','c':'C','v':'V','b':'B','n':'N','m':'M','ö':'Ö','ç':'Ç' };
    const charToInsert = isCapsLock && isLetter ? (upperMap[char] || char.toUpperCase()) : char;
    const newValue = inputValue.slice(0, cursorPosition) + charToInsert + inputValue.slice(cursorPosition);
    setInputValue(newValue);
    setCursorPosition(cursorPosition + (charToInsert?.length || 1));
    // Textbox'a da gönder
    onInput(newValue, false);
  };

  const getKeyDisplay = (key) => {
    if (key === 'space') return 'Space';
    if (key === 'backspace') return <Delete size={20} />;
    if (key === 'enter') return 'Enter';
    if (key === 'close') return <X size={20} />;
    if (key === 'caps') return 'Caps';
    if (key === '123') return '123';
    if (key === 'abc') return 'ABC';
    
    return key;
  };

  const getKeyStyle = (key) => {
    const baseStyle = {
      padding: mode === 'number' ? '12px 16px' : '12px 16px',
      margin: '2px',
      backgroundColor: '#374151',
      border: '1px solid #4b5563',
      borderRadius: '8px',
      color: '#f9fafb',
      fontSize: mode === 'number' ? '16px' : '16px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: mode === 'number' ? '45px' : '50px',
      minHeight: mode === 'number' ? '35px' : '40px',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'manipulation',
      flex: mode === 'number' ? '1' : 'none'
    };

    if (key === 'space') {
      return { ...baseStyle, minWidth: '200px' };
    }
    if (key === 'backspace' || key === 'enter') {
      return { ...baseStyle, backgroundColor: '#dc2626', minWidth: mode === 'number' ? '50px' : '80px', flex: mode === 'number' ? '1' : 'none' };
    }
    if (key === 'close') {
      return { ...baseStyle, backgroundColor: '#6b7280', minWidth: '50px' };
    }
    if (key === '123' || key === 'abc') {
      return { 
        ...baseStyle, 
        backgroundColor: '#6b7280',
        minWidth: '60px'
      };
    }

    return baseStyle;
  };

  if (!isVisible) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        zIndex: 9999999,
        padding: '0',
        animation: 'fadeIn 0.3s ease'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '16px',
          width: mode === 'number' ? '600px' : '800px',
          maxWidth: '90vw',
          border: '2px solid #374151',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
          height: 'auto',
          boxSizing: 'border-box',
          position: 'fixed',
          bottom: '20px', // Ekranın altından 20px yukarıda
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000000,
          transformOrigin: 'bottom center',
          animation: 'dropDown 140ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Keyboard */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: mode === 'number' ? '6px' : '8px'
        }}>
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} style={{
              display: 'flex',
              justifyContent: mode === 'number' ? 'space-between' : 'center',
              gap: mode === 'number' ? '6px' : '6px',
              flexWrap: 'wrap'
            }}>
              {row.map((key, keyIndex) => (
                <button
                  key={keyIndex}
                  onClick={() => handleKeyPress(key)}
                  style={{
                    ...getKeyStyle(key),
                    backgroundColor: key === 'caps' && isCapsLock ? '#2563eb' : getKeyStyle(key).backgroundColor
                  }}
                  onMouseDown={(e) => {
                    e.target.style.transform = 'scale(0.95)';
                    e.target.style.backgroundColor = 
                      key === 'backspace' || key === 'enter' ? '#b91c1c' :
                      key === 'close' ? '#4b5563' :
                      key === 'caps' ? '#2563eb' :
                      '#1f2937';
                  }}
                  onMouseUp={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.backgroundColor = getKeyStyle(key).backgroundColor;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.backgroundColor = getKeyStyle(key).backgroundColor;
                  }}
                >
                  {getKeyDisplay(key)}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Control keys row removed for simpler 4-row layout */}
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes dropDown {
          0% { opacity: 0; transform: translate(-50%, -14px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

export default VirtualKeyboard;
