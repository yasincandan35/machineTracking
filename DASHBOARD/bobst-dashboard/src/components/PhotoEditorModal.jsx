import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Type, PenTool, Save, RotateCcw, Palette } from 'lucide-react';

const PhotoEditorModal = ({ 
  isOpen, 
  onClose, 
  photo, 
  onSave,
  currentLanguage = 'tr'
}) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush'); // 'brush' or 'text'
  const [brushColor, setBrushColor] = useState('#f87171');
  const [textColor, setTextColor] = useState('#fbbf24');
  const [brushSize, setBrushSize] = useState(3);
  const [texts, setTexts] = useState([]); // { id, text, x, y, color, isDragging }
  const [editingTextId, setEditingTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Renk paleti
  const colors = [
    '#f87171', '#fb923c', '#fbbf24', '#84cc16', '#22c55e',
    '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#ffffff', '#000000', '#6b7280', '#ef4444', '#f59e0b'
  ];

  // Canvas ve image initialization
  useEffect(() => {
    if (!isOpen || !photo) return;

    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const loadImage = () => {
      const ctx = canvas.getContext('2d');
      
      // Set canvas size to match image
      const maxWidth = window.innerWidth;
      const maxHeight = window.innerHeight - 200; // Space for toolbar
      
      let imgWidth = img.naturalWidth || img.width || 800;
      let imgHeight = img.naturalHeight || img.height || 600;
      
      // Calculate scale to fit screen
      const scaleX = maxWidth / imgWidth;
      const scaleY = maxHeight / imgHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      
      // Draw image
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      setScale(newScale);
    };

    if (img.complete && img.naturalWidth > 0) {
      loadImage();
    } else {
      img.onload = loadImage;
    }
  }, [isOpen, photo]);

  // Drawing functions
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e) => {
    if (tool !== 'brush') return;
    e.preventDefault();
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }, [tool, getCanvasCoordinates]);

  const draw = useCallback((e) => {
    if (!isDrawing || tool !== 'brush' || !canvasRef.current) return;
    e.preventDefault();
    
    requestAnimationFrame(() => {
      const coords = getCanvasCoordinates(e);
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }, [isDrawing, tool, brushColor, brushSize, getCanvasCoordinates]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Text functions
  const addText = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Prevent duplicate addition
    if (editingTextId !== null) return;
    
    const newText = {
      id: Date.now() + Math.random(), // More unique ID
      text: 'Metin',
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: textColor,
      isDragging: false
    };
    
    setTexts(prev => {
      // Check if text already exists at this position
      const exists = prev.some(t => Math.abs(t.x - newText.x) < 10 && Math.abs(t.y - newText.y) < 10);
      if (exists) return prev;
      return [...prev, newText];
    });
    setEditingTextId(newText.id);
  }, [textColor, editingTextId]);

  const handleTextDragStart = useCallback((textId, e) => {
    const text = texts.find(t => t.id === textId);
    if (!text) return;
    
    const coords = getCanvasCoordinates(e);
    setDragOffset({
      x: coords.x - text.x,
      y: coords.y - text.y
    });
    setDraggingTextId(textId);
  }, [texts, getCanvasCoordinates]);

  const handleTextDrag = useCallback((e) => {
    if (!draggingTextId) return;
    e.preventDefault();
    
    requestAnimationFrame(() => {
      const coords = getCanvasCoordinates(e);
      setTexts(prev => prev.map(t => 
        t.id === draggingTextId ? { 
          ...t, 
          x: coords.x - dragOffset.x, 
          y: coords.y - dragOffset.y 
        } : t
      ));
    });
  }, [draggingTextId, dragOffset, getCanvasCoordinates]);

  const handleTextDragEnd = useCallback(() => {
    setDraggingTextId(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const updateText = useCallback((textId, newText) => {
    setTexts(prev => prev.map(t => 
      t.id === textId ? { ...t, text: newText } : t
    ));
  }, []);

  const deleteText = useCallback((textId) => {
    setTexts(prev => prev.filter(t => t.id !== textId));
    setEditingTextId(null);
  }, []);

  // Initialize canvas with image only once
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!img.complete) return;
    
    // Only redraw image if canvas is empty or on initial load
    if (canvas.width === 0 || canvas.height === 0) {
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }, [photo, isOpen]); // Only on photo change or modal open

  // Save function - render texts on canvas before saving
  const handleSave = useCallback(() => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Redraw everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Draw all texts on canvas
    texts.forEach(text => {
      ctx.fillStyle = text.color;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.text, text.x, text.y);
    });
    
    // Get final image
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    onClose();
  }, [onSave, onClose, texts]);

  // Undo function (simplified - just clear canvas and redraw)
  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Redraw texts
    texts.forEach(text => {
      ctx.fillStyle = text.color;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.text, text.x, text.y);
    });
  }, [texts]);

  if (!isOpen || !photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handleUndo}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTool('brush')}
            className={`p-2 rounded-lg ${tool === 'brush' ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'} text-white`}
          >
            <PenTool className="w-5 h-5" />
          </button>
          <button
            onClick={() => setTool('text')}
            className={`p-2 rounded-lg ${tool === 'text' ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'} text-white`}
          >
            <Type className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Color palette bar */}
      <div className="flex items-center gap-2 p-2 bg-black/50 backdrop-blur-sm border-b border-white/10 overflow-x-auto">
        <div className="flex items-center gap-1 px-2">
          <Palette className="w-4 h-4 text-white" />
          <span className="text-xs text-white/70 whitespace-nowrap">
            {tool === 'brush' ? 'Fırça' : 'Metin'}
          </span>
        </div>
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => tool === 'brush' ? setBrushColor(color) : setTextColor(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              (tool === 'brush' ? brushColor : textColor) === color
                ? 'border-white scale-110'
                : 'border-white/30 hover:border-white/50'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        {tool === 'brush' && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/20">
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-white/70 w-8">{brushSize}px</span>
          </div>
        )}
      </div>

      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
        onTouchStart={(e) => {
          if (tool === 'brush') {
            startDrawing(e);
          } else if (draggingTextId) {
            handleTextDrag(e);
          }
        }}
        onTouchMove={(e) => {
          if (tool === 'brush') {
            draw(e);
          } else if (draggingTextId) {
            handleTextDrag(e);
          }
        }}
        onTouchEnd={(e) => {
          if (tool === 'brush') {
            stopDrawing();
          } else {
            handleTextDragEnd();
          }
        }}
        onMouseMove={(e) => {
          if (tool === 'brush') {
            draw(e);
          } else if (draggingTextId) {
            handleTextDrag(e);
          }
        }}
        onMouseUp={(e) => {
          if (tool === 'brush') {
            stopDrawing();
          } else {
            handleTextDragEnd();
          }
        }}
      >
        <div className="relative" style={{ transform: `scale(${scale})` }}>
          <img
            ref={imageRef}
            src={photo.preview || photo.annotated}
            alt="Edit"
            className="max-w-full max-h-full"
            style={{ display: 'none' }}
          />
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              if (tool === 'brush') {
                startDrawing(e);
              }
            }}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="max-w-full max-h-full cursor-crosshair touch-none"
            style={{ 
              imageRendering: 'pixelated',
              touchAction: 'none',
              pointerEvents: tool === 'brush' ? 'auto' : 'none'
            }}
          />
          
          {/* Text editing overlay */}
          {tool === 'text' && texts.map(text => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const canvasScaleX = canvas.width / rect.width;
            const canvasScaleY = canvas.height / rect.height;
            
            return (
              <div
                key={text.id}
                className="absolute"
                style={{
                  left: `${(text.x / canvasScaleX) * scale}px`,
                  top: `${(text.y / canvasScaleY) * scale}px`,
                  transform: 'translate(-50%, -50%)',
                  cursor: draggingTextId === text.id ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (editingTextId === text.id) return;
                  handleTextDragStart(text.id, e);
                }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (editingTextId === text.id) return;
                  handleTextDragStart(text.id, e);
                }}
              >
                {editingTextId === text.id ? (
                  <input
                    type="text"
                    value={text.text}
                    onChange={(e) => updateText(text.id, e.target.value)}
                    onBlur={() => setEditingTextId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setEditingTextId(null);
                      }
                    }}
                    className="bg-black/50 border-2 border-white text-white text-xl font-bold px-2 py-1 rounded backdrop-blur-sm"
                    style={{ color: text.color }}
                    autoFocus
                  />
                ) : (
                  <div
                    className="px-2 py-1 rounded cursor-grab active:cursor-grabbing select-none"
                    style={{ color: text.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTextId(text.id);
                    }}
                  >
                    <span className="text-xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{text.text}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteText(text.id);
                      }}
                      className="ml-2 text-red-400 hover:text-red-300 bg-black/50 rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom toolbar - Add text button */}
      {tool === 'text' && (
        <div className="p-4 bg-black/50 backdrop-blur-sm border-t border-white/10">
          <button
            onClick={addText}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <Type className="w-5 h-5" />
            Metin Ekle
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotoEditorModal;

