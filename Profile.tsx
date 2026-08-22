
      



// src/pages/Profile.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Image from "react-bootstrap/Image";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/types/user";

const Profile = () => {
  const { logout, logoutMessage } = useAuth();
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

        if (status === 401) {
          setTimeout(() => {
            navigate("/login", { replace: true });
          }, 2000);
          return;
        }

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
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
        <p className="mt-3 text-muted">Loading profile...</p>
      </Container>
    );
  }

  if (error) {
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

  return (
    <Container className="py-5" style={{ maxWidth: 640 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-4">My Profile</h1>

        {logoutMessage && (
          <Alert variant="success" className="text-center">
            {logoutMessage}
          </Alert>
        )}

        <div className="d-flex justify-content-center mb-4">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={`${user.surname} avatar`}
              roundedCircle
              width={112}
              height={112}
              className="border shadow-sm object-fit-cover"
            />
          ) : (
            <div
              className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary"
              style={{ width: 112, height: 112, fontSize: "2rem" }}
            >
              {user.surname?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <ListGroup>
          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Email</strong>
            <span>{user.email}</span>
          </ListGroup.Item>

          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Surname</strong>
            <span>{user.surname}</span>
          </ListGroup.Item>

          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Other Names</strong>
            <span>{user.othernames}</span>
          </ListGroup.Item>

          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Verified</strong>
            <span>{user.verified ? "Yes" : "No"}</span>
          </ListGroup.Item>

          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Status</strong>
            <span>{user.disabled ? "Disabled" : "Active"}</span>
          </ListGroup.Item>

          {user.is_admin === true && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Admin</strong>
              <span>Yes</span>
            </ListGroup.Item>
          )}

          {user.name && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Group</strong>
              <span>{user.name}</span>
            </ListGroup.Item>
          )}

          {user.permission && (
            <ListGroup.Item className="d-flex justify-content-between">
              <strong>Permission</strong>
              <span>{user.permission}</span>
            </ListGroup.Item>
          )}

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

          <ListGroup.Item className="d-flex justify-content-between">
            <strong>Last Updated On</strong>
            <span>
              {new Date(user.updated_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          </ListGroup.Item>
        </ListGroup>

        <Button
          variant="danger"
          className="w-100 mt-4"
          onClick={logout}
        >
          Logout
        </Button>
      </div>
    </Container>
  );
};

export default Profile;


  
  
  
      
      
