import axios from "axios";

// .env üzerinden alınır, yoksa localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5199";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Her istek öncesi token varsa header'a ekle
axiosInstance.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization; // token yoksa header'ı kaldır
  }

  return config;
});

// Response interceptor - 401 durumunda logout
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz, localStorage'ı temizle
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
