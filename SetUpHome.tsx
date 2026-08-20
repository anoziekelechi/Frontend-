// src/pages/admin/SetupHome.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import type { HomeSetupResponse } from "@/types/site";

const schema = z.object({
  sitename: z.string().min(1, "Site name is required").max(120),
  intro: z.string().max(1200).optional(),
  logo_key: z.any().optional(),
  banner_key: z.any().optional(),
});

type FormData = z.infer<typeof schema>;

const SetupHome = () => {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("sitename", data.sitename);

      if (data.intro) formData.append("intro", data.intro);

      if (data.logo_key?.[0]) {
        formData.append("logo_key", data.logo_key[0]);
      }
      if (data.banner_key?.[0]) {
        formData.append("banner_key", data.banner_key[0]);
      }

      const res = await api.post<HomeSetupResponse>("/home/setup", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/");
      }, 1800);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      setServerError(
        typeof detail === "string" ? detail : "Failed to save home settings"
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 640 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Setup Home Settings</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to homepage...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="sitename">
            <Form.Label>Site Name *</Form.Label>
            <Form.Control
              type="text"
              isInvalid={!!errors.sitename}
              {...register("sitename")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.sitename?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="intro">
            <Form.Label>Intro</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              {...register("intro")}
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="logo_key">
            <Form.Label>Logo</Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              {...register("logo_key")}
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="banner_key">
            <Form.Label>Banner</Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              {...register("banner_key")}
            />
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Saving..." : "Save Home Settings"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default SetupHome;

// src/routes/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin
  if (!user.is_admin) {
    return <Navigate to="/" replace />;
  }

  // User is admin
  return <>{children}</>;
}




// src/routes/AppRoutes.tsx (example)
import { Routes, Route } from "react-router-dom";
import SetupHome from "@/pages/admin/SetupHome";
import { AdminRoute } from "@/routes/AdminRoute";

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      {/* ... other public routes */}

      {/* Admin only routes */}
      <Route
        path="/admin/setup-home"
        element={
          <AdminRoute>
            <SetupHome />
          </AdminRoute>
        }
      />

      {/* Other admin routes */}
      <Route
        path="/add_country"
        element={
          <AdminRoute>
            <CreateCountry />
          </AdminRoute>
        }
      />
    </Routes>
  );
}




// protected page
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function SetupHome() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  // ... rest of 


{ path: "profile", element: <Profile /> },
{ path: "contact-admin", element: <ContactAdmin /> },
{ path: "resend-verification", element: <ResendOtp /> },
