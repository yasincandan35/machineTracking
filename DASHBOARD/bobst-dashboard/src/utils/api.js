import axios from "axios";

// Environment detection - sadece .bychome.xyz domain'lerinde production
const isProduction = window.location.hostname.endsWith('.bychome.xyz');

// 🎯 DashboardBackend - Users, Preferences, Auth, Machines
const DASHBOARD_API_URL = isProduction 
  ? "https://yyc.bychome.xyz/api" 
  : "http://192.168.1.44:5199/api";

// 📊 SensorAPI - Grafik verileri (range data, sensors/period)
// Artık tüm API'ler tek backend'den geliyor (DashboardBackend - port 5199)
const SENSOR_API_URL = isProduction
  ? "https://yyc.bychome.xyz"
  : "http://192.168.1.44:5199";

// 🆕 DashboardAPI - Kullanıcı, Makina Listesi, Auth
export const dashboardApi = axios.create({
  baseURL: DASHBOARD_API_URL,
  timeout: 10000, // 10 saniye timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// DashboardAPI interceptor - Token ekle
dashboardApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// DashboardAPI response interceptor - 401 durumunda logout
dashboardApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz veya süresi dolmuş
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

const resolveMachineTableName = (machineInput) => {
  if (!machineInput) {
    return undefined;
  }

  if (typeof machineInput === "string") {
    // IP adreslerini (eski kullanım) filtrele
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(machineInput)) {
      return undefined;
    }
    return machineInput;
  }
  
  if (typeof machineInput === "object") {
    if (machineInput.tableName) {
      return machineInput.tableName;
    }

    if (machineInput.machine?.tableName) {
      return machineInput.machine.tableName;
    }
  }

  return undefined;
};

const mergeConfigWithMachine = (config, machineTableName) => {
  if (!machineTableName) {
    return config || {};
  }

  const mergedConfig = { ...(config || {}) };
  const existingParams = { ...(mergedConfig.params || {}) };

  if (!existingParams.machine) {
    existingParams.machine = machineTableName;
  }

  mergedConfig.params = existingParams;
  return mergedConfig;
};

export const createMachineApi = (machineInput) => {
  const machineTableName = resolveMachineTableName(machineInput);

  return {
    get: (url, config) => dashboardApi.get(url, mergeConfigWithMachine(config, machineTableName)),
    delete: (url, config) => dashboardApi.delete(url, mergeConfigWithMachine(config, machineTableName)),
    head: (url, config) => dashboardApi.head(url, mergeConfigWithMachine(config, machineTableName)),
    options: (url, config) => dashboardApi.options(url, mergeConfigWithMachine(config, machineTableName)),
    post: (url, data, config) => dashboardApi.post(url, data, mergeConfigWithMachine(config, machineTableName)),
    put: (url, data, config) => dashboardApi.put(url, data, mergeConfigWithMachine(config, machineTableName)),
    patch: (url, data, config) => dashboardApi.patch(url, data, mergeConfigWithMachine(config, machineTableName)),
  };
};

// 📊 SensorAPI - Grafik verileri
export const sensorApi = axios.create({
  baseURL: SENSOR_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

sensorApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token") || localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// SensorAPI response interceptor - 401 durumunda logout
sensorApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz veya süresi dolmuş
      console.warn("🔒 Token süresi doldu, oturum kapatılıyor...");
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// 🔄 Geriye uyumluluk için - varsayılan olarak DashboardAPI
export const api = dashboardApi;

// 🌐 Helper: IP için PLC URL'i döndür
export const getPLCUrlForIP = (ipAddress) => {
  if (isProduction) {
    return "https://livedata.bychome.xyz";
  }
  return `http://${ipAddress}:8080`;
};