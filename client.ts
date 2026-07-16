
// src/api/client.ts — FINAL, FIXED & CLEAN
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL || "http://127.0.0.1:8000",
  withCredentials: true,
});

if (import.meta.env.DEV && !API_URL) {
  console.warn(
    "VITE_API_URL not configured! Using fallback: http://127.0.0.1:8000"
  );
}

// =============== TOKEN REFRESH QUEUE ===============
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;     // ← Made optional
  reject: (reason?: any) => void;
}> = [];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("csrf_token");
  if (token) {
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        failedQueue.forEach((p) => p.resolve());     // ← Now works
        failedQueue = [];
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach((p) => p.reject(refreshError));
        failedQueue = [];
        localStorage.removeItem("csrf_token");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
