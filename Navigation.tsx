
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';

function CollapsibleExample() {
  return (
    <Navbar collapseOnSelect expand="lg" className="bg-body-tertiary">
      <Container>
        <Navbar.Brand href="#home">React-Bootstrap</Navbar.Brand>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link href="#features">Features</Nav.Link>
            <Nav.Link href="#pricing">Pricing</Nav.Link>
            <NavDropdown title="admin" id="collapsible-nav-dropdown">
              <NavDropdown.Item href="#action/3.1">Action</NavDropdown.Item>
              <NavDropdown.Item href="#action/3.2">
                Another action
              </NavDropdown.Item>
              <NavDropdown.Item href="#action/3.3">Something</NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item href="#action/3.4">
                another link
  
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
          <Nav>
            <Nav.Link href="#deets">More deets</Nav.Link>
            <Nav.Link eventKey={2} href="#memes">
              Dank memes
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CollapsibleExample;


// src/base/Navigation.tsx
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

const ADMIN_LINKS = [
  { to: "/add_permission", label: "Add Permission" },
  { to: "/revoke_permission", label: "Revoke Permission" },
  { to: "/disabled_user", label: "Disabled Users" },
  { to: "/add_country", label: "Add Country" },
  { to: "/add_home", label: "Setup Home" },
];

const MAX_VISIBLE_ADMIN_LINKS = 10;

const Navigation = () => {
  const { user, isLoading: authLoading } = useAuth();
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

  const visibleAdminLinks = ADMIN_LINKS.slice(0, MAX_VISIBLE_ADMIN_LINKS);
  const showViewMore = ADMIN_LINKS.length > MAX_VISIBLE_ADMIN_LINKS;

  // Mirrors backend has_permission(): admins bypass every permission check.
  const canAccess = (requiredPermission: string): boolean =>
    !!user?.is_admin || user?.permission === requiredPermission;

  return (
    <Navbar
      collapseOnSelect
      expand="sm"
      className="bg-body-tertiary mt-2 shadow-sm"
    >
      <Container fluid>
        <Navbar.Brand
          as={Link}
          to="/"
          className="d-flex align-items-center gap-2"
        >
          {settings.logo_key && (
            <img
              src={settings.logo_key}
              alt="logo"
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

            {/* Everyone */}
            <Nav.Link as={Link} to="/categories">
              Categories
            </Nav.Link>

            <Nav.Link as={Link} to="/countries">
              Countries
            </Nav.Link>

            {/* Admin */}
            {user?.is_admin && (
              <>
                {visibleAdminLinks.map((link) => (
                  <Nav.Link key={link.to} as={Link} to={link.to}>
                    {link.label}
                  </Nav.Link>
                ))}
                {showViewMore && (
                  <Nav.Link as={Link} to="/dashboard">
                    View more routes
                  </Nav.Link>
                )}
              </>
            )}

            {/* manage_countries (admins included) */}
            {canAccess("manage_countries") && (
              <>
                <Nav.Link as={Link} to="/add_office">
                  Add Office
                </Nav.Link>
                <Nav.Link as={Link} to="/edit_office">
                  Edit Office
                </Nav.Link>
                <Nav.Link as={Link} to="/delete_office">
                  Delete Office
                </Nav.Link>
              </>
            )}

            {/* manage_products (admins included) */}
            {canAccess("manage_products") && (
              <>
                <Nav.Link as={Link} to="/add_products">
                  Add Products
                </Nav.Link>
                <Nav.Link as={Link} to="/edit_products">
                  Edit Products
                </Nav.Link>
              </>
            )}

            {/* manage_logistics (admins included) */}
            {canAccess("manage_logistics") && (
              <>
                <Nav.Link as={Link} to="/add_shipment">
                  Add Shipment
                </Nav.Link>
                <Nav.Link as={Link} to="/track_shipment">
                  Track Shipment
                </Nav.Link>
                <Nav.Link as={Link} to="/logistics_dashboard">
                  Logistics Dashboard
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





// src/routes/AdminRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import { useAuth } from "@/context/AuthContext";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!user.is_admin) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default AdminRoute;






import { createBrowserRouter } from "react-router-dom";
import Layout from "./base/Layout";
import Home from "./pages/Home";
import Login from "./pages/users/Login";
import Profile from "./pages/Profile";
import Categories from "./pages/categories/Categories";
import CountriesList from "./pages/countries/CountriesList";
import CreateCountry from "./pages/countries/CreateCountry";
import CountryDetail from "./pages/countries/CountryDetail";
import UpdateCountry from "./pages/countries/UpdateCountry";
import SetupHome from "./pages/admin/SetupHome";
import AddPermission from "./pages/admin/AddPermission";
import RevokePermission from "./pages/admin/RevokePermission";
import DisabledUsers from "./pages/admin/DisabledUsers";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminRoute from "./routes/AdminRoute";
import NotFound from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Public
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/categories", element: <Categories /> }, // visible to everyone
      { path: "/countries", element: <CountriesList /> },
      { path: "/countries/:country_id", element: <CountryDetail /> },
      { path: "/profile", element: <Profile /> },

      // Admin only
      {
        path: "/add_country",
        element: (
          <AdminRoute>
            <CreateCountry />
          </AdminRoute>
        ),
      },
      {
        path: "/countries/:country_id/edit",
        element: (
          <AdminRoute>
            <UpdateCountry />
          </AdminRoute>
        ),
      },
      {
        path: "/add_home",
        element: (
          <AdminRoute>
            <SetupHome />
          </AdminRoute>
        ),
      },
      {
        path: "/add_permission",
        element: (
          <AdminRoute>
            <AddPermission />
          </AdminRoute>
        ),
      },
      {
        path: "/revoke_permission",
        element: (
          <AdminRoute>
            <RevokePermission />
          </AdminRoute>
        ),
      },
      {
        path: "/disabled_user",
        element: (
          <AdminRoute>
            <DisabledUsers />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);




// src/routes/PermissionRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import Container from "react-bootstrap/Container";
import { useAuth } from "@/context/AuthContext";

interface PermissionRouteProps {
  permission: string;
  children: React.ReactNode;
}

const PermissionRoute = ({ permission, children }: PermissionRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Admin can access everything (optional — remove if you don't want this)
  const allowed = user.is_admin || user.permission === permission;

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default PermissionRoute;






//grok

import { createBrowserRouter } from "react-router-dom";
import Layout from "./base/Layout";
import Home from "./pages/Home";
import Login from "./pages/users/Login";
import Profile from "./pages/Profile";
import CountriesList from "./pages/countries/CountriesList";
import CreateCountry from "./pages/countries/CreateCountry";
import CountryDetail from "./pages/countries/CountryDetail";
import UpdateCountry from "./pages/countries/UpdateCountry";
import SetupHome from "./pages/admin/SetupHome";
import AdminRoute from "./routes/AdminRoute";
import PermissionRoute from "./routes/PermissionRoute";
import NotFound from "./pages/NotFound";
// import AddOffice, EditOffice, AddProducts, etc. when ready

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      // Public
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/categories", element: <Categories /> },
      { path: "/countries", element: <CountriesList /> },
      { path: "/countries/:country_id", element: <CountryDetail /> },
      { path: "/profile", element: <Profile /> },

      // Admin only
      {
        path: "/add_country",
        element: (
          <AdminRoute>
            <CreateCountry />
          </AdminRoute>
        ),
      },
      {
        path: "/countries/:country_id/edit",
        element: (
          <AdminRoute>
            <UpdateCountry />
          </AdminRoute>
        ),
      },
      {
        path: "/add_home",
        element: (
          <AdminRoute>
            <SetupHome />
          </AdminRoute>
        ),
      },
      {
        path: "/add_permission",
        element: (
          <AdminRoute>
            <AddPermission />
          </AdminRoute>
        ),
      },
      {
        path: "/dashboard",
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },

      // Permission: manage_countries
      {
        path: "/add_office",
        element: (
          <PermissionRoute permission="manage_countries">
            <AddOffice />
          </PermissionRoute>
        ),
      },
      {
        path: "/edit_office",
        element: (
          <PermissionRoute permission="manage_countries">
            <EditOffice />
          </PermissionRoute>
        ),
      },
      {
        path: "/delete_office",
        element: (
          <PermissionRoute permission="manage_countries">
            <DeleteOffice />
          </PermissionRoute>
        ),
      },

      // Permission: manage_products
      {
        path: "/add_products",
        element: (
          <PermissionRoute permission="manage_products">
            <AddProducts />
          </PermissionRoute>
        ),
      },
      {
        path: "/edit_products",
        element: (
          <PermissionRoute permission="manage_products">
            <EditProducts />
          </PermissionRoute>
        ),
      },

      // Permission: manage_logistics
      {
        path: "/add_shipment",
        element: (
          <PermissionRoute permission="manage_logistics">
            <AddShipment />
          </PermissionRoute>
        ),
      },
      {
        path: "/track_shipment",
        element: (
          <PermissionRoute permission="manage_logistics">
            <TrackShipment />
          </PermissionRoute>
        ),
      },

      { path: "*", element: <NotFound /> },
    ],
  },
]);



