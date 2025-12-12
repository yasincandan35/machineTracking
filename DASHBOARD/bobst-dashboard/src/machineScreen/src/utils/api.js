import axios from 'axios';

// Vite'de import.meta.env kullanılır, process.env değil
// API URL - DashboardBackend (port 5199)
const getAPIBaseURL = () => {
  const isProduction = window.location.hostname === 'track.bychome.xyz';
  if (isProduction) {
    return 'https://yyc.bychome.xyz';
  }
  return window.location.origin || 'http://192.168.1.44:5199';
};

const API_URL = getAPIBaseURL();

const api = axios.create({
  baseURL: API_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    return Promise.reject(error);
  }
);

export default api; 