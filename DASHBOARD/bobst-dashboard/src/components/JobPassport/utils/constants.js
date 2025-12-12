/**
 * Job Passport Constants
 * Makina konfigürasyonları ve print scale değerleri
 */

export const MACHINE_CONFIG = {
  'lemanic1': { name: 'Lemanic 1', units: 10 },
  'lemanic2': { name: 'Lemanic 2', units: 12 },
  'lemanic3': { name: 'Lemanic 3', units: 8 }
};

export const PRINT_SCALES = {
  a4: {
    'lemanic1': 0.55,   // 10 ünite
    'lemanic2': 0.45,  // 12 ünite
    'lemanic3': 0.65   // 8 ünite
  },
  a3: {
    'lemanic1': 0.75,   // 10 ünite (azaltıldı: 1.5 → 1.3)
    'lemanic2': 0.65,  // 12 ünite (azaltıldı: 1.35 → 1.15)
    'lemanic3': 0.95   // 8 ünite (azaltıldı: 1.85 → 1.55)
  }
};

// Environment detection
const isProduction = window.location.hostname === 'track.bychome.xyz';

export const BACKEND_URL = isProduction 
  ? 'https://yyc.bychome.xyz' 
  : 'http://192.168.1.44:3000';



