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
    
    payload = decode_access_token(token)
    
    user = await get_user_by_id(db, payload.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    if user.disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    if not user.verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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



@router.get(
    "/profile",
    response_model=ReadUser,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_profile(
    current_user: ReadUser = Depends(get_authenticated_user),
) -> ReadUser:
    """Get authenticated user's profile."""


// src/pages/Profile.tsx — FULL FINAL VERSION
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types/user";

const Profile = () => {
  const { user: authUser, isLoading: authLoading, logout } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get<User>("/profile");
        setUser(res.data);
      } catch (err: any) {
        console.error(err);
        setError(
          err.response?.data?.detail || "Failed to load profile"
        );
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && authUser) {
      fetchProfile();
    } else if (!authLoading && !authUser) {
      setLoading(false);
    }
  }, [authUser, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading profile...</p>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Profile</h1>

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
              {new Date(
                user.date_added || user.created_at || ""
              ).toLocaleDateString("en-GB", {
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
