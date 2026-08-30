
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
