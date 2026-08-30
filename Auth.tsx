
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL || "http://localhost:8000",
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
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

api.interceptors.request.use((config) => {
  // Read CSRF token from cookie (Double Submit Cookie Pattern)
  const csrfToken = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="))
    ?.split("=")[1];

  if (csrfToken) {
    config.headers["X-CSRF-Token"] = csrfToken;
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
        await fetch("/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        failedQueue.forEach((p) => p.resolve());
        failedQueue = [];
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach((p) => p.reject(refreshError));
        failedQueue = [];
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

// src/context/AuthContext.tsx — FINAL, NO LOCALSTORAGE
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import api from "@/api/client";
import type { User } from "@/types/user";   // Import from types folder

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;           // No csrfToken needed
  logout: () => void;
  logoutMessage:string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<User>("/auth/profile");
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    fetchUser();           // Backend sets httpOnly cookie
  };
// new

  const logout = async () => {
    try {
      const res =await api.post<{ message:string}>("/auth/logout");
      setLogoutMessage(res.data.message);
      setUser(null);

      setTimeout(() => {
        setLogoutMessage(null);
        window.location.href = "/";
      }, 1500)
    } catch {
      console.warn("Logout failed");
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, logoutMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
