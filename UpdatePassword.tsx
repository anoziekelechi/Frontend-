
// src/pages/user/ChangePassword.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type { UpdatePassword, UpdatePasswordResponse } from "@/types";


const schema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),

    new_password: z
      .string()
      .min(6, "New password must be at least 6 characters"),

    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  // Client-side only — backend never sees this field.
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormData = z.infer<typeof schema>;


const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{ run: () => void; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
  });


  useEffect(() => {
    const payload = redirectRef.current;
    if (!payload) return;

    const id = window.setTimeout(() => {
      payload.run();
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: UpdatePassword = {
      current_password: data.current_password,
      new_password: data.new_password,
    };

    try {
      const response = await api.post<UpdatePasswordResponse>(
        "/me/password",
        payload
      );

      reset();
      setSuccessMessage(response.data.message);

      // Backend revoked all refresh tokens — the current session is
      // dead. Log out cleanly, then redirect to login.
      redirectRef.current = {
        delayMs: 2500,
        run: async () => {
          try {
            await logout();
          } catch {
            // Ignore — cookies are invalid server-side anyway
          }
          navigate("/login", {
            replace: true,
            state: { passwordChanged: true },
          });
        },
      };

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // 422 — Pydantic validation
      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];
          if (
            (field === "current_password" || field === "new_password") &&
            v.msg
          ) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      // 401 — wrong current password
      if (status === 401 && typeof detail === "string") {
        setError("current_password", { type: "server", message: detail });
        return;
      }

      // 400 — same password
      if (status === 400 && typeof detail === "string") {
        setError("new_password", { type: "server", message: detail });
        return;
      }

      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed${status ? ` (${status})` : ""}. Please try again.`
      );
    }
  };


  return (
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-1">Change Password</h1>
        <p className="text-muted small mb-4">
          For your security, all active sessions will be signed out after
          a password change.
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to login...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="current_password">
            <Form.Label>Current Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              isInvalid={!!errors.current_password}
              disabled={isSubmitting || successMessage !== null}
              {...register("current_password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.current_password?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="new_password">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.new_password}
              disabled={isSubmitting || successMessage !== null}
              {...register("new_password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.new_password?.message}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              At least 6 characters.
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4" controlId="confirm_password">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.confirm_password}
              disabled={isSubmitting || successMessage !== null}
              {...register("confirm_password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.confirm_password?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || successMessage !== null}
            >
              {isSubmitting ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    className="me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>

            <Button
              type="button"
              variant="outline-secondary"
              disabled={isSubmitting || successMessage !== null}
              onClick={() => navigate("/profile")}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </Container>
  );
};

export default ChangePassword;
