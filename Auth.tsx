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
