


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
    return current_user



// src/pages/Profile.tsx — FINAL (uses global user)
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const Profile = () => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading profile...</p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
              {new Date(user.date_added || user.created_at || "").toLocaleDateString(
                "en-GB",
                {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }
              )}
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
