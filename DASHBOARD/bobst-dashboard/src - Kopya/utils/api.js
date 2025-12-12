import axios from "axios";

// .env üzerinden alınır, yoksa localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5199";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Her istek öncesi token varsa header'a ekle
api.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("token") || localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization; // token yoksa header'ı kaldır
  }

  return config;
});
