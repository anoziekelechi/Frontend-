
      


// src/pages/Profile.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Image from "react-bootstrap/Image";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type { UserProfile } from "@/types";


// =============================================================
// HELPERS
// =============================================================

/**
 * Resolve a display name, preferring the server-computed
 * full_name and falling back to a client-side join.
 */
const resolveDisplayName = (u: UserProfile): string => {
  if (u.full_name && u.full_name.trim()) return u.full_name;
  const joined = [u.surname, u.othernames].filter(Boolean).join(" ").trim();
  return joined || "—";
};


// =============================================================
// COMPONENT
// =============================================================

const Profile = () => {
  const { logout, logoutMessage } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);


  // ===========================================================
  // LOAD PROFILE
  // ===========================================================
  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get<UserProfile>("/userprofile");
        if (mounted) setUser(res.data);

      } catch (err: unknown) {
        if (!mounted) return;

        if (!axios.isAxiosError(err)) {
          setError("An unexpected error occurred.");
          return;
        }

        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === "string"
            ? detail
            : `Failed to load profile${
                status ? ` (${status})` : ""
              }.`
        );

        // Route based on HTTP status only — never on message text.
        if (status === 401) {
          window.setTimeout(() => {
            if (mounted) navigate("/login", { replace: true });
          }, 2000);
        } else if (status === 403) {
          window.setTimeout(() => {
            if (mounted) navigate("/contact-admin", { replace: true });
          }, 2000);
        }

      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [navigate]);


  // ===========================================================
  // DELETE ACCOUNT
  // ===========================================================
  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete your account? This cannot be undone."
      )
    ) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await api.delete<{ message?: string }>("/profile");

      setMessage(
        res.data.message || "Account deleted successfully."
      );

      window.setTimeout(() => {
        logout();
      }, 1500);

    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        setError("An unexpected error occurred.");
        return;
      }

      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : `Failed to delete account${
              status ? ` (${status})` : ""
            }.`
      );

      if (status === 401) {
        window.setTimeout(
          () => navigate("/login", { replace: true }),
          2000
        );
      }
    } finally {
      setDeleting(false);
    }
  };


  // ===========================================================
  // LOADING
  // ===========================================================
  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3 text-muted">Loading profile...</p>
      </Container>
    );
  }


  // ===========================================================
  // ERROR, NO USER
  // ===========================================================
  if (error && !user) {
    return (
      <Container className="py-5" style={{ maxWidth: 480 }}>
        <Alert variant="danger" className="text-center">
          {error}
          <div className="small mt-2 text-muted">Redirecting...</div>
        </Alert>
      </Container>
    );
  }

  if (!user) return null;

  const displayName = resolveDisplayName(user);
  const hasAvatar = typeof user.avatar === "string" && user.avatar.trim().length > 0;


  // ===========================================================
  // UI
  // ===========================================================
  return (
    <Container className="py-5" style={{ maxWidth: 640 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-4">My Profile</h1>

        {logoutMessage && (
          <Alert variant="success" className="text-center">
            {logoutMessage}
          </Alert>
        )}

        {message && (
          <Alert variant="success" className="text-center">
            {message}
          </Alert>
        )}

        {error && (
          <Alert variant="danger" className="text-center">
            {error}
          </Alert>
        )}

        {/* =====================================================
            AVATAR
            — show backend avatar if present, else initials
        ===================================================== */}
        <div className="d-flex justify-content-center mb-4">
          {hasAvatar ? (
            <Image
              src={user.avatar!}
              alt={`${displayName} avatar`}
              roundedCircle
              width={112}
              height={112}
              className="border shadow-sm"
              style={{ objectFit: "cover" }}
              onError={(e) => {
                // If the URL is broken, fall back to initials by
                // clearing the src state via error event styling.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div
              className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary"
              style={{ width: 112, height: 112, fontSize: "2rem" }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* =====================================================
            DETAILS
        ===================================================== */}
        <ListGroup>
          {/* Full Name */}
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Full Name</div>
              <div className="fw-medium">{displayName}</div>
            </div>
            <Link
              to="/profile/change-name"
              className="btn btn-sm btn-outline-primary"
            >
              Edit
            </Link>
          </ListGroup.Item>

          {/* Email */}
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Email</div>
              <div className="fw-medium">{user.email}</div>
            </div>
            <Link
              to="/profile/change-email"
              className="btn btn-sm btn-outline-primary"
            >
              Edit
            </Link>
          </ListGroup.Item>

          {/* Password */}
          <ListGroup.Item className="d-flex justify-content-between align-items-center">
            <div>
              <div className="text-muted small">Password</div>
              <div className="fw-medium">••••••••</div>
            </div>
            <Link
              to="/profile/change-password"
              className="btn btn-sm btn-outline-primary"
            >
              Edit
            </Link>
          </ListGroup.Item>

          {/* Country (optional) */}
          {user.country && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Country</strong>
              <span>{user.country}</span>
            </ListGroup.Item>
          )}

          {/* Verified */}
          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Verified</strong>
            <span>{user.verified ? "Yes" : "No"}</span>
          </ListGroup.Item>

          {/* Status */}
          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Status</strong>
            <span>{user.disabled ? "Disabled" : "Active"}</span>
          </ListGroup.Item>

          {/* Admin (only when true) */}
          {user.is_admin === true && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Admin</strong>
              <span>Yes</span>
            </ListGroup.Item>
          )}

          {/* Group (only when present) */}
          {user.name && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Group</strong>
              <span>{user.name}</span>
            </ListGroup.Item>
          )}

          {/* Permission (only when present) */}
          {user.permission && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Permission</strong>
              <span>{user.permission}</span>
            </ListGroup.Item>
          )}

          {/* Member Since */}
          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Member Since</strong>
            <span>
              {new Date(user.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          </ListGroup.Item>
        </ListGroup>

        {/* =====================================================
            ACTIONS
        ===================================================== */}
        <Button
          variant="outline-danger"
          className="w-100 mt-4"
          onClick={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </Button>

        <Button variant="danger" className="w-100 mt-3" onClick={logout}>
          Logout
        </Button>
      </div>
    </Container>
  );
};

export default Profile;



  
  
  
      
      
