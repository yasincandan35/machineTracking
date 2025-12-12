import axios from 'axios';

// Environment detection
const isProduction = window.location.hostname.endsWith('.bychome.xyz');

// Dashboard Backend API (DESKTOP-78GRV3R - Dashboard DB)
// Users, Preferences, MachineLists
const API_BASE_URL = isProduction
  ? 'https://yyc.bychome.xyz/api'
  : 'http://192.168.1.44:5199/api';

const dashboardApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
dashboardApi.interceptors.request.use(
  (config) => {
    console.log(`📡 Dashboard API: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
dashboardApi.interceptors.response.use(
  (response) => {
    console.log(`✅ Dashboard API Response:`, response.data);
    return response;
  },
  (error) => {
    console.error(`❌ Dashboard API Error:`, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default dashboardApi;

