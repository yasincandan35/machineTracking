/**
 * Renk helper fonksiyonları
 */

// Renk açma helper (metalik için)
export const lightenColor = (hex, percent) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent / 100));
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent / 100));
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent / 100));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Renk çubuğu oluşturma
export const createColorBar = (colorName, customColorData = null) => {
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 35;
  const ctx = canvas.getContext('2d');

  // Custom color varsa kullan
  if (customColorData && customColorData.color) {
    if (customColorData.isMetallic) {
      // Metalik efekt
      const gradient = ctx.createLinearGradient(0, 0, 180, 35);
      const baseColor = customColorData.color;
      gradient.addColorStop(0, baseColor);
      gradient.addColorStop(0.25, lightenColor(baseColor, 40));
      gradient.addColorStop(0.5, lightenColor(baseColor, 60));
      gradient.addColorStop(0.75, lightenColor(baseColor, 40));
      gradient.addColorStop(1, baseColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 180, 35);
      
      // Metalik parıltı
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(25, 7, 70, 4);
      ctx.fillRect(110, 22, 45, 4);
    } else {
      // Düz renk
      ctx.fillStyle = customColorData.color;
      ctx.fillRect(0, 0, 180, 35);
    }
    return canvas.toDataURL();
  }

  if (!colorName || colorName === '-') return null;

  const colorMap = {
    'black': '#2c2c2c', 'green': '#00b300', 'grey': '#808080', 'gray': '#808080',
    'yellow': '#FFFF00', 'cyan': '#0008e6', 'magenta': '#FF00FF', 'red': '#dc2626',
    'blue': '#2563eb', 'white': '#f5f5f5', 'orange': '#f97316', 'purple': '#9333ea',
    'pink': '#ec4899', 'brown': '#a16207', 'gold': null, 'silver': null, 'bronze': null, 'bronz': null
  };

  // Renk ismini normalize et ve eşleştir (includes ile)
  const colorNameLower = colorName.toLowerCase();
  let baseColor = null;
  
  for (const [key, value] of Object.entries(colorMap)) {
    if (colorNameLower.includes(key)) {
      baseColor = value;
      break;
    }
  }

  if (colorNameLower.includes('gold')) {
    const gradient = ctx.createLinearGradient(0, 0, 180, 35);
    gradient.addColorStop(0, '#B8860B');
    gradient.addColorStop(0.2, '#FFD700');
    gradient.addColorStop(0.4, '#FFF4A3');
    gradient.addColorStop(0.6, '#FFD700');
    gradient.addColorStop(0.8, '#B8860B');
    gradient.addColorStop(1, '#8B6914');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 180, 35);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(25, 7, 70, 4);
    ctx.fillRect(110, 22, 45, 4);
  } else if (colorNameLower.includes('silver')) {
    const gradient = ctx.createLinearGradient(0, 0, 180, 35);
    gradient.addColorStop(0, '#A8A8A8');
    gradient.addColorStop(0.25, '#E8E8E8');
    gradient.addColorStop(0.5, '#FFFFFF');
    gradient.addColorStop(0.75, '#E8E8E8');
    gradient.addColorStop(1, '#A8A8A8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 180, 35);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(35, 8, 60, 3);
    ctx.fillRect(100, 24, 50, 3);
  } else if (colorNameLower.includes('bronze') || colorNameLower.includes('bronz')) {
    const gradient = ctx.createLinearGradient(0, 0, 180, 35);
    gradient.addColorStop(0, '#6C4A2A');
    gradient.addColorStop(0.25, '#CD7F32');
    gradient.addColorStop(0.5, '#E8A87C');
    gradient.addColorStop(0.75, '#CD7F32');
    gradient.addColorStop(1, '#6C4A2A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 180, 35);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(30, 10, 65, 3);
    ctx.fillRect(105, 22, 45, 3);
  } else if (baseColor) {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 180, 35);
  } else {
    // Tanımsız renk - gri
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 180, 35);
  }

  return canvas.toDataURL();
};

