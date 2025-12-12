/**
 * Vizkozite ve Solvent ayarlama fonksiyonları
 */

// Vizkozite ayarlama
export const adjustVizkozite = (jobData, unitIndex, direction) => {
  if (!jobData || !jobData.vizkozite) return null;
  
  const currentValue = jobData.vizkozite[unitIndex] || '3,1 sn / 20 C';
  
  // Format: "13,5 sn / 20 C", "3,1 sn / 20 C" veya "13.5 sn / 20 C"
  const regex = /(\d+[.,]?\d*)\s*sn\s*\/\s*(\d+)\s*C/i;
  const match = currentValue.match(regex);
  
  if (match) {
    let seconds = parseFloat(match[1].replace(',', '.'));
    const temperature = match[2];
    
    if (direction === 'up') {
      seconds = Math.round((seconds + 0.1) * 10) / 10;
    } else {
      seconds = Math.max(0, Math.round((seconds - 0.1) * 10) / 10);
    }
    
    // Türkçe format: virgül kullan
    const secondsStr = seconds.toString().replace('.', ',');
    const newValue = `${secondsStr} sn / ${temperature} C`;
    
    const newJobData = { ...jobData };
    if (!newJobData.vizkozite) {
      newJobData.vizkozite = [];
    }
    newJobData.vizkozite[unitIndex] = newValue;
    return newJobData;
  }
  
  return null;
};

// Solvent ayarlama
export const adjustSolvent = (jobData, unitIndex, direction) => {
  if (!jobData || !jobData.solvent_orani) return null;
  
  const currentValue = jobData.solvent_orani[unitIndex];
  
  // WATER:EAL format kontrolü
  const waterRegex = /WATER\s*:?\s*(\d+)\s*%?\s*[;:,]?\s*(?:EAL\s*(\d+)\s*%?)?/i;
  const waterMatch = currentValue.match(waterRegex);
  
  if (waterMatch || /WATER\s*:?\s*100\s*%?/i.test(currentValue)) {
    // WATER formatı
    let water = waterMatch ? parseInt(waterMatch[1]) : 100;
    let eal = waterMatch && waterMatch[2] ? parseInt(waterMatch[2]) : 0;
    
    if (direction === 'up') {
      water = Math.min(100, water + 10);
      eal = Math.max(0, 100 - water);
    } else {
      water = Math.max(0, water - 10);
      eal = Math.min(100, 100 - water);
    }
    
    const newValue = `WATER ${water} : EAL ${eal}%`;
    const newJobData = { ...jobData };
    newJobData.solvent_orani[unitIndex] = newValue;
    return newJobData;
  }
  
  // EAL:EAC format kontrolü
  const ealRegex = /EAL\s*(\d+)\s*[;,]\s*EAC\s*(\d+)/i;
  const ealMatch = currentValue.match(ealRegex);
  
  if (ealMatch) {
    let eal = parseInt(ealMatch[1]);
    let eac = parseInt(ealMatch[2]);
    
    if (direction === 'up') {
      eal = Math.min(100, eal + 10);
      eac = Math.max(0, eac - 10);
    } else {
      eal = Math.max(0, eal - 10);
      eac = Math.min(100, eac + 10);
    }
    
    const newValue = `EAL ${eal}; EAC ${eac}`;
    const newJobData = { ...jobData };
    newJobData.solvent_orani[unitIndex] = newValue;
    return newJobData;
  }
  
  return null;
};

// VARNISH için saniye (sn) ayarlama
export const adjustVizkoziteSeconds = (jobData, unitIndex, direction) => {
  if (!jobData || !jobData.vizkozite) return null;
  
  const currentValue = jobData.vizkozite[unitIndex] || '25 sn / 20 C';
  const regex = /(\d+[.,]?\d*)\s*sn\s*\/\s*(\d+)\s*C/i;
  const match = currentValue.match(regex);
  
  if (match) {
    let seconds = parseFloat(match[1].replace(',', '.'));
    const temperature = match[2];
    
    if (direction === 'up') {
      seconds = Math.round((seconds + 0.5) * 10) / 10;
    } else {
      seconds = Math.max(0, Math.round((seconds - 0.5) * 10) / 10);
    }
    
    const secondsStr = seconds.toString().replace('.', ',');
    const newValue = `${secondsStr} sn / ${temperature} C`;
    
    const newJobData = { ...jobData };
    if (!newJobData.vizkozite) {
      newJobData.vizkozite = [];
    }
    newJobData.vizkozite[unitIndex] = newValue;
    return newJobData;
  }
  
  return null;
};

// VARNISH için derece (C) ayarlama
export const adjustVizkoziteTemperature = (jobData, unitIndex, direction) => {
  if (!jobData || !jobData.vizkozite) return null;
  
  const currentValue = jobData.vizkozite[unitIndex] || '25 sn / 20 C';
  const regex = /(\d+[.,]?\d*)\s*sn\s*\/\s*(\d+)\s*C/i;
  const match = currentValue.match(regex);
  
  if (match) {
    const seconds = match[1];
    let temperature = parseInt(match[2]);
    
    if (direction === 'up') {
      temperature = Math.min(50, temperature + 1);
    } else {
      temperature = Math.max(15, temperature - 1);
    }
    
    const newValue = `${seconds} sn / ${temperature} C`;
    
    const newJobData = { ...jobData };
    if (!newJobData.vizkozite) {
      newJobData.vizkozite = [];
    }
    newJobData.vizkozite[unitIndex] = newValue;
    return newJobData;
  }
  
  return null;
};

