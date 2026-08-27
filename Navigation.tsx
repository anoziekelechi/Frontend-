
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



