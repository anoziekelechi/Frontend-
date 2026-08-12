
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

        setError(detail);

        // 401 → not authenticated / invalid or expired session
        if (status === 401) {
          setTimeout(() => {
            navigate("/login", { replace: true });
          }, 2000);
          return;
        }

        // 403 → disabled or not verified
        if (status === 403) {
          const lower = String(detail).toLowerCase();

          if (lower.includes("disabled") || lower.includes("suspended")) {
            setTimeout(() => {
              navigate("/contact-admin", { replace: true });
            }, 2000);
            return;
          }

          if (lower.includes("not verified") || lower.includes("verify")) {
            setTimeout(() => {
              navigate("/resend-verification", { replace: true });
            }, 2000);
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
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
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">My Profile</h1>

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
            
    const { logout,logoutMessage } = useAuth();
    {logoutMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
    {logoutMessage}
        </div>
    )}
   
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




// AuthContext



// src/context/AuthContext.tsx — FINAL, NO LOCALSTORAGE
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import api from "@/api/client";
import type { User } from "@/types/user";   // Import from types folder

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;           // No csrfToken needed
  logout: () => void;
  logoutMessage:string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get<User>("/auth/profile");
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = () => {
    fetchUser();           // Backend sets httpOnly cookie
  };
// new
const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const logout = async () => {
    try {
      const res =await api.post<{ message:string}>("/auth/logout");
      setLogoutMessage(res.data.message);
      setUser(null);

      setTimeout(()=>{
        setLogoutMessage(null);
        window.location.href = "/"
      },1500)
    } catch {
      console.warn("Logout failed");
    } finally {
      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, logoutMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}



//main.tsx

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SiteProvider>
      <RouterProvider router={router} />
      </SiteProvider>
    </AuthProvider>
  </StrictMode>,
)

  
  
  
      
      
