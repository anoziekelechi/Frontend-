// src/context/SiteContext.tsx — FINAL (FIXED)
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import api from "@/api/client";
import type { SiteSettings } from "@/types/site";

interface SiteContextType {
  settings: SiteSettings;
  isLoading: boolean;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

const FALLBACK_SETTINGS: SiteSettings = {
  id: 0,
  sitename: "E commerce",
  intro: "",
  logo_key: "",
  banner_key: "",
};

export function SiteProvider({ children }: { children: ReactNode }) {
  // ✅ Must be SiteSettings (NOT SiteSettings | null)
  const [settings, setSettings] = useState<SiteSettings>(FALLBACK_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<SiteSettings>("/home/homesetting");
      setSettings(response.data);
    } catch (err) {
      console.warn("Failed to fetch site settings, using fallback");
      setSettings(FALLBACK_SETTINGS);
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





import { Link } from "react-router-dom";

const Footer = () => {
const currentyear = new Date().getFullYear();
    return (
    <>

    <div className="text-center text-white d-flex flex-row justify-content-center flex-wrap">
        <Link to="/contactus" className='p-2 flex-fill text-decoration-none'>ContactUs</Link>
        <Link to="/aboutus" className='p-2 flex-fill text-decoration-none'>About Us</Link>
        <Link to="/privacypolicy" className='p-2 flex-fill text-decoration-none'>Privacy Policy</Link>
        <Link to="/terms/conditions" className='p-2 flex-fill text-decoration-none'>Terms & Condition</Link>
    </div>
        <p className="mt-4 text-dark text-center">
        &copy; {currentyear}. All right reserved <Link to="/" className="text-decoration-none text-info">Sitename</Link>
        </p>

    </>
      
    );
};
export default Footer;
