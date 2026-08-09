
// src/context/SiteContext.tsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import api from "@/api/client";
import type { SiteSettings } from "@/types/site";

interface SiteContextType {
  settings: SiteSettings | null;
  isLoading: boolean;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<SiteSettings>("/site-settings");
      setSettings(response.data);
    } catch (err) {
      console.warn("Failed to fetch site settings");
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SiteContext.Provider value={{ settings, isLoading }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return context;
}
