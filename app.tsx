import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";

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
            <Nav.Link as={Link} to="/categories">
              Categories
            </Nav.Link>

            {/* Admin only */}
            {user?.is_admin && (
              <>
                <Nav.Link as={Link} to="/add_permission">
                  Add Permission
                </Nav.Link>
                <Nav.Link as={Link} to="/revoke_permission">
                  Revoke Permission
                </Nav.Link>
                <Nav.Link as={Link} to="/disabled_user">
                  Disabled Users
                </Nav.Link>
                <Nav.Link as={Link} to="/add_country">
                  Add Country
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



//app.tsx


export const router = createBrowserRouter([

  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home />},
      { path: '/login', element: <Login />},
      { path: '/profile', element: <Profile />},
      { path: '/countries', element: <CountriesList />},
      { path: '/add_country', element: <CreateCountry />},
      { path: '/add_home', element: <SetupHome />},
      { path: '/countries/:country_id', element: <CountryDetail />},
      { path: '/countries/:country_id/edit', element: <UpdateCountry />},
      

      // 404 route must be the last
      {path: "*", element: <NotFound />},
    ],
  },
 

]);










