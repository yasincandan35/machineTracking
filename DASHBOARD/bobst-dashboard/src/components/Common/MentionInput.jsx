import React, { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import { api } from '../../utils/api';

/**
 * MentionInput - @ ile kullanıcı etiketleme özelliği olan textarea
 */
const MentionInput = ({ 
  value = '', 
  onChange, 
  placeholder = '',
  className = '',
  rows = 4,
  disabled = false
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const textareaRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // Kullanıcıları yükle
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users');
        setSuggestions(response.data || []);
      } catch (error) {
        console.error('Kullanıcılar yüklenemedi:', error);
      }
    };
    
    fetchUsers();
  }, []);
  
  // @ tespiti ve filtreleme
  useEffect(() => {
    const lastAtIndex = value.lastIndexOf('@', cursorPosition);
    
    if (lastAtIndex !== -1 && lastAtIndex < cursorPosition) {
      const textAfterAt = value.substring(lastAtIndex + 1, cursorPosition);
      
      // @ ile cursor arasında boşluk veya yeni satır varsa iptal
      if (textAfterAt.includes(' ') || textAfterAt.includes('\n')) {
        setShowSuggestions(false);
        return;
      }
      
      // Kullanıcıları filtrele
      const filtered = suggestions.filter(user => 
        user.username.toLowerCase().includes(textAfterAt.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(textAfterAt.toLowerCase()))
      );
      
      if (filtered.length > 0) {
        setFilteredSuggestions(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [value, cursorPosition, suggestions]);
  
  // Mention ekleme
  const insertMention = (user) => {
    const lastAtIndex = value.lastIndexOf('@', cursorPosition);
    const beforeMention = value.substring(0, lastAtIndex);
    const afterMention = value.substring(cursorPosition);
    const mentionText = `@${user.username}`;
    const newValue = beforeMention + mentionText + ' ' + afterMention;
    const newCursorPos = lastAtIndex + mentionText.length + 1;
    
    onChange({ target: { value: newValue } });
    setShowSuggestions(false);
    
    // Cursor pozisyonunu ayarla
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };
  
  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
        
      case 'Enter':
        if (showSuggestions && filteredSuggestions.length > 0) {
          e.preventDefault();
          insertMention(filteredSuggestions[selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
        
      default:
        break;
    }
  };
  
  // Cursor pozisyonunu güncelle ve dropdown pozisyonunu hesapla
  const handleSelectionChange = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
      
      // Cursor pozisyonunu hesapla (yaklaşık)
      const textarea = textareaRef.current;
      const textBeforeCursor = value.substring(0, textarea.selectionStart);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines.length;
      const lineHeight = 24; // Yaklaşık satır yüksekliği
      
      // Dropdown pozisyonunu ayarla
      setDropdownPosition({
        top: currentLine * lineHeight + 30,
        left: 10
      });
    }
  };
  
  // Textarea değişimi
  const handleTextChange = (e) => {
    onChange(e);
    handleSelectionChange();
  };
  
  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleSelectionChange}
        onClick={handleSelectionChange}
        placeholder={placeholder}
        className={className}
        rows={rows}
        disabled={disabled}
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            minWidth: '250px',
            maxWidth: '350px'
          }}
        >
          {filteredSuggestions.map((user, index) => (
            <div
              key={user.id}
              onClick={() => insertMention(user)}
              className={`px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors ${
                index === selectedIndex 
                  ? 'bg-blue-100 dark:bg-blue-800' 
                  : ''
              }`}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">
                  {user.username}
                </div>
                {user.email && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionInput;
