// src/api/client.ts

import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";

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

// ============================================================
// CSRF TOKEN
// ============================================================

function getCsrfTokenFromCookie(): string | null {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrf_token="));

  if (!cookie) {
    return null;
  }

  const value = cookie.slice("csrf_token=".length);
  return decodeURIComponent(value);
}

// ============================================================
// AXIOS REQUEST CONFIG
// ============================================================

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ============================================================
// REQUEST INTERCEPTOR
// ============================================================
//
// CSRF header is automatically attached to state-changing
// requests.
//
// EXCEPTION:
// /auth/refresh is intentionally NOT CSRF protected.
//

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  const url = config.url || "";

  const isStateChangingMethod = ["post", "put", "patch", "delete"].includes(
    method
  );

  const isRefreshRequest = url.includes("/auth/refresh");

  if (isStateChangingMethod && !isRefreshRequest) {
    const csrfToken = getCsrfTokenFromCookie();

    if (csrfToken) {
      config.headers.set("X-CSRF-Token", csrfToken);
    }
  }

  return config;
});

// ============================================================
// RESPONSE INTERCEPTOR
// ============================================================
//
// When an access token expires:
//
// Request → 401 → POST /auth/refresh → New cookies → Retry
//
// Concurrent 401 requests are queued so only ONE refresh
// request is sent at a time.
//

let isRefreshing = false;

let failedQueue: Array<{
  resolve: () => void;
  reject: (reason?: unknown) => void;
}> = [];

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as
      | RetryableRequestConfig
      | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || "";
    const isRefreshRequest = url.includes("/auth/refresh");
    const isLogoutRequest = url.includes("/auth/logout");

    // ========================================================
    // ONLY REFRESH NORMAL AUTHENTICATED REQUESTS
    // ========================================================

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isLogoutRequest
    ) {
      // ------------------------------------------------------
      // Another request is already refreshing
      // ------------------------------------------------------
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Make sure the retried request gets a fresh CSRF
            if (originalRequest.headers) {
              originalRequest.headers.delete("X-CSRF-Token");
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // ------------------------------------------------------
      // Start refresh
      // ------------------------------------------------------
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // /auth/refresh does NOT require CSRF.
        // Browser automatically sends the HttpOnly refresh_token cookie.
        await api.post("/auth/refresh");

        // Refresh succeeded → release queued requests
        failedQueue.forEach(({ resolve }) => resolve());
        failedQueue = [];

        // Important: remove the old CSRF header so the request
        // interceptor will attach the NEW csrf_token cookie.
        if (originalRequest.headers) {
          originalRequest.headers.delete("X-CSRF-Token");
        }

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed → reject queued requests
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];

        // Session is no longer valid
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






// src/context/AuthContext.tsx

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import type { ReactNode } from "react";

import api from "@/api/client";
import type { User } from "@/types/user";

// ============================================================
// AUTH CONTEXT TYPE
// ============================================================

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  logoutMessage: string | null;
}

// ============================================================
// CONTEXT
// ============================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================
// PROVIDER
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  // ==========================================================
  // FETCH CURRENT USER
  // ==========================================================

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

  // ==========================================================
  // INITIAL AUTH CHECK
  // ==========================================================

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // ==========================================================
  // LOGIN
  // ==========================================================
  //
  // Your login page should first call:
  //
  //   await api.post("/auth/login", credentials);
  //
  // The backend sets the HttpOnly cookies.
  //
  // Then call:
  //
  //   await login();
  //
  // to fetch the authenticated user.
  //

  const login = async (): Promise<void> => {
    await fetchUser();
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const logout = async (): Promise<void> => {
    try {
      const response = await api.post<{ message: string }>("/auth/logout");

      // Clear frontend authentication state immediately
      setUser(null);
      setLogoutMessage(response.data.message);

      // Give the user a moment to see the message
      window.setTimeout(() => {
        setLogoutMessage(null);
        window.location.href = "/";
      }, 1500);
    } catch {
      console.warn("Logout failed");

      // Even if the server request fails, don't leave the
      // application showing the user as authenticated
      setUser(null);
      window.location.href = "/";
    }
  };

  // ==========================================================
  // PROVIDER
  // ==========================================================

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        logoutMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// USE AUTH
// ============================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
