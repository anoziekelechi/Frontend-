// src/context/AuthContext.tsx — FINAL, NO LOCALSTORAGE
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import api from "@/api/client";

export interface User {
  id: number;
  email: string;
  surname: string;
  othernames: string;
  phone?: string | null;
  verified: boolean;
  disabled: boolean;
  date_added: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;           // No longer needs csrfToken
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<User>("/api/auth/me");
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

  // Simplified login — backend now sets httpOnly cookie
  const login = () => {
    fetchUser();           // Just refresh user data
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      console.warn("Logout API failed");
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}


// use this


// src/api/client.ts — FINAL, CBN-APPROVED, SENIOR DEV VERSION
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL || "http://127.0.0.1:8000",  // ← THIS SAVES YOUR LIFE
  withCredentials: true,
});

// Optional: Warn if someone forgot .env (senior dev move)
if (import.meta.env.DEV && !API_URL) {
  console.warn(
    "VITE_API_URL not configured! Using fallback: http://127.0.0.1:8000"
  );
}

// =============== YOUR ORIGINAL INTERCEPTORS — PERFECT, KEEP FOREVER ===============
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

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
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        failedQueue.forEach((p) => p.resolve());
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
