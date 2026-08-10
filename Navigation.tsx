
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
