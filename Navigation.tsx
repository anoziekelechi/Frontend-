// src/base/Navigation.tsx — FINAL (no null checks needed)
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

const Navigation = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { settings, isLoading: siteLoading } = useSite();

  if (authLoading || siteLoading) {
    return (
      <Navbar expand="sm" className="bg-body-tertiary mt-2">
        <Container fluid>
          <Navbar.Brand>Loading...</Navbar.Brand>
        </Container>
      </Navbar>
    );
  }

  return (
    <Navbar collapseOnSelect expand="sm" className="bg-body-tertiary mt-2 shadow-sm">
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
          {settings.logo_key && (
            <img
              src={settings.logo_key}
              alt={settings.sitename}
              height="36"
              className="d-inline-block"
            />
          )}
          <span className="fw-bold">{settings.sitename}</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="responsive-navbar-nav" />

        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">
              Home
            </Nav.Link>
            <Nav.Link as={Link} to="/products">
              Products
            </Nav.Link>
            <Nav.Link as={Link} to="/categories">
              Categories
            </Nav.Link>
            <Nav.Link as={Link} to="/Cart">
              Cart
            </Nav.Link>
          </Nav>

          <Nav className="align-items-center">
            {user ? (
              <>
                <Nav.Link as={Link} to="/profile">
                  Profile
                </Nav.Link>

                {user.is_admin && (
                  <Nav.Link as={Link} to="/countries">
                    Countries
                  </Nav.Link>
                )}

                <Navbar.Text className="mx-3">
                  Hello, {user.surname}
                </Navbar.Text>

                <Nav.Link
                  as="button"
                  onClick={logout}
                  className="btn btn-outline-danger btn-sm ms-2"
                >
                  Logout
                </Nav.Link>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/register">
                  Register
                </Nav.Link>
                <Nav.Link as={Link} to="/login">
                  Login
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;

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
  sitename: "E commerce App",
  intro: "",
  aboutus: "",
  mission: "",
  vision: "",
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
      const response = await api.get<SiteSettings>("/site-settings");
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
// src/base/Navigation.tsx — FINAL VERSION
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

const Navigation = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { settings, isLoading: siteLoading } = useSite();

  if (authLoading || siteLoading) {
    return (
      <Navbar expand="sm" className="bg-body-tertiary mt-2">
        <Container fluid>
          <Navbar.Brand>Loading...</Navbar.Brand>
        </Container>
      </Navbar>
    );
  }

  return (
    <Navbar collapseOnSelect expand="sm" className="bg-body-tertiary mt-2 shadow-sm">
      <Container fluid>
        {/* Brand */}
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2">
          {settings.logo_key && (
            <img
              src={settings.logo_key}
              alt={settings.sitename}
              height="36"
              className="d-inline-block"
            />
          )}
          <span className="fw-bold">{settings.sitename}</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="responsive-navbar-nav" />

        <Navbar.Collapse id="responsive-navbar-nav">
          {/* Left links */}
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">
              Home
            </Nav.Link>
            <Nav.Link as={Link} to="/products">
              Products
            </Nav.Link>
            <Nav.Link as={Link} to="/categories">
              Categories
            </Nav.Link>
            <Nav.Link as={Link} to="/Cart">
              Cart
            </Nav.Link>
          </Nav>

          {/* Right side - Auth */}
          <Nav className="align-items-center">
            {user ? (
              <>
                <Nav.Link as={Link} to="/profile">
                  Profile
                </Nav.Link>

                {user.is_admin && (
                  <Nav.Link as={Link} to="/countries">
                    Countries
                  </Nav.Link>
                )}

                <Navbar.Text className="mx-3">
                  Hello, {user.surname}
                </Navbar.Text>

                <Nav.Link
                  as="button"
                  onClick={logout}
                  className="btn btn-outline-danger btn-sm ms-2"
                >
                  Logout
                </Nav.Link>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/register">
                  Register
                </Nav.Link>
                <Nav.Link as={Link} to="/login">
                  Login
                </Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
