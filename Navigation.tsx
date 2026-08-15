#modified 

  # api/users/logics.py

async def get_current_user(
    request: Request,
    db: AsyncSession,
) -> ReadUser:
    """
    Get current authenticated user from cookie.
    
    Loads permission ONCE here so all downstream
    has_permission() calls are pure in-memory - no extra DB queries.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)

    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended. Please contact admin.",
        )

    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please verify your email.",
        )

    # ✅ Load permission ONCE - only 1 extra query for non-admins with a group
    # Admins skip this entirely (no query needed)
    permission: str | None = None
    if not user.is_admin and user.group_id is not None:
        from api.users.models import Group
        group = await db.get(Group, user.group_id)
        if group:
            permission = group.permission

    # ✅ Build ReadUser and inject permission
    read_user = ReadUser.model_validate(user)
    read_user.permission = permission
    return read_user





# api/users/logics.py

async def has_permission(
    user: ReadUser,
    required_perm: str,
) -> None:
    """
    Pure in-memory permission check.
    No DB queries - permission already loaded in get_current_user.
    
    Hierarchy:
        1. Admin → all permissions ✅
        2. User with matching permission → allowed ✅
        3. Everyone else → 403 ❌
    
    Args:
        user: ReadUser with .permission already set
        required_perm: Required permission string
    
    Raises:
        HTTPException: 403 if permission denied
    """
    # Admins bypass all permission checks
    if user.is_admin:
        return

    # No permission or wrong permission
    if user.permission != required_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied - requires '{required_perm}' permission",
        )






          # api/users/logics.py

from typing import Callable
from fastapi import Depends


def require_permission(required_perm: str) -> Callable:
    """
    Dependency factory for permission-based route protection.
    
    Usage:
        # Option A: Just protect the route
        @router.post("/countries",
            dependencies=[Depends(require_permission(Permissions.MANAGE_COUNTRIES))]
        )
        async def create_country(...):
            ...
        
        # Option B: Protect + get the user
        @router.post("/countries")
        async def create_country(
            current_user: ReadUser = Depends(
                require_permission(Permissions.MANAGE_COUNTRIES)
            ),
        ):
            ...
    """
    async def checker(
        user: ReadUser = Depends(get_authenticated_user),
    ) -> ReadUser:
        await has_permission(user, required_perm)
        return user

    return checker

// src/base/AccountNavigation.tsx
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import Navbar from "react-bootstrap/Navbar";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

function AccountNavigation() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Navbar bg="light" data-bs-theme="light">
        <Container>
          <Navbar.Brand>Loading...</Navbar.Brand>
        </Container>
      </Navbar>
    );
  }

  return (
    <Navbar bg="light" data-bs-theme="light">
      <Container>
        <Navbar.Brand as={Link} to="/">
          E commerce App
        </Navbar.Brand>

        <Nav className="me-auto">
          {/* Everyone */}
          <Nav.Link as={Link} to="/">
            Home
          </Nav.Link>
          <Nav.Link as={Link} to="/support">
            Support
          </Nav.Link>

          {user ? (
            <>
              <Nav.Link as={Link} to="/profile">
                Profile
              </Nav.Link>
              <Nav.Link as={Link} to="/cart">
                Cart
              </Nav.Link>
              <Nav.Link as="button" onClick={logout}>
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
      </Container>
    </Navbar>
  );
}

export default AccountNavigation;



// src/base/Navigation.tsx
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

