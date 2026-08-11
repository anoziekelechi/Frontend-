async def get_current_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Get current authenticated user from cookie.

    Used as a dependency in routes.
    """
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required!"
        )

    try:
        payload = decode_access_token(token)
    except Exception:
        # Covers expired signatures, malformed tokens, bad signatures, etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session"
        )

    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if user.disabled:
        # Session was valid at login but account has since been disabled.
        # Treat as an invalid session, not a distinct permission error.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    if not user.verified:
        # Same reasoning: login already gates on verified status, so this
        # only triggers if verification was revoked after the token issued.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not verified"
        )

    return ReadUser.model_validate(user)


async def get_authenticated_user(
    request: Request,
    db: DBDep,
) -> ReadUser:
    """
    Dependency: Get current authenticated user.

    Usage:
        @router.get("/profile")
        async def profile(user: ReadUser = Depends(get_authenticated_user)):
            ...
    """
    return await get_current_user(request=request, db=db)


#tsx

    // src/pages/Profile.tsx — FINAL
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types/user";

const Profile = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let redirectTimeout: ReturnType<typeof setTimeout> | undefined;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get<User>("/profile");
        setUser(res.data);
      } catch (err: any) {
        const status = err.response?.status;
        const detail =
          err.response?.data?.detail || "Failed to load profile";

        // 401 → session missing/invalid (includes accounts disabled or
        // unverified after the token was issued) → show backend message,
        // then redirect to login
        if (status === 401) {
          setError(detail);
          redirectTimeout = setTimeout(() => {
            navigate("/login", { replace: true });
          }, 2000);
          return;
        }

        setError(detail);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <p className="text-red-600 font-medium text-lg mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Profile</h1>

        {/* Avatar */}
        <div className="flex justify-center mb-8">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={`${user.surname} avatar`}
              className="w-28 h-28 rounded-full object-cover border-4 border-gray-200 shadow"
            />
          ) : (
            <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500">
              {user.surname?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="space-y-5 text-lg">
          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Email</span>
            <span>{user.email}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Surname</span>
            <span>{user.surname}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Other Names</span>
            <span>{user.othernames}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Phone</span>
            <span>{user.phone || "Not set"}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Verified</span>
            <span>{user.verified ? "Yes" : "No"}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Admin</span>
            <span>{user.is_admin ? "Yes" : "No"}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Status</span>
            <span>{user.disabled ? "Disabled" : "Active"}</span>
          </div>

          <div className="flex justify-between border-b pb-3">
            <span className="font-medium text-gray-600">Member Since</span>
            <span>
              {new Date(user.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-10 w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;



    
    
