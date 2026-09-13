
// src/components/profile/ChangePasswordCard.tsx

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type { UpdatePassword, MessageResponse } from "@/types/user";


// =============================================================
// VALIDATION
//
// Only mirrors *client-visible* rules:
//   - current_password required
//   - new_password min length (matches backend Field min_length=6)
//
// Does NOT duplicate the backend's same-password check.
// The backend is authoritative and will return the correct error.
// =============================================================

const schema = z.object({
  current_password: z
    .string()
    .min(1, "Current password is required"),

  new_password: z
    .string()
    .min(6, "New password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const ChangePasswordCard = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    },
  });


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    const payload: UpdatePassword = {
      current_password: data.current_password,
      new_password: data.new_password,
    };

    try {
      const response = await api.post<MessageResponse>(
        "/me/password",
        payload
      );

      reset();

      setSuccessMessage(
        response.data.message ||
          "Password updated successfully. Redirecting to login..."
      );

      // -------------------------------------------------------
      // Backend revoked ALL refresh tokens — the current session
      // is dead. Force a clean logout and redirect.
      // -------------------------------------------------------
      window.setTimeout(async () => {
        try {
          await logout();
        } catch {
          // Cookies already invalidated server-side; ignore.
        }
        navigate("/login", {
          replace: true,
          state: { passwordChanged: true },
        });
      }, 2500);

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // -------------------------------------------------------
      // 422 — Pydantic validation (field-level)
      // -------------------------------------------------------
      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;

          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];

          if (
            (field === "current_password" ||
              field === "new_password") &&
            v.msg
          ) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      // -------------------------------------------------------
      // 401 — wrong current password → attach to that field
      // -------------------------------------------------------
      if (status === 401 && typeof detail === "string") {
        setError("current_password", {
          type: "server",
          message: detail,
        });
        return;
      }

      // -------------------------------------------------------
      // 400 — same password → attach to new_password field
      // -------------------------------------------------------
      if (status === 400 && typeof detail === "string") {
        setError("new_password", {
          type: "server",
          message: detail,
        });
        return;
      }

      // -------------------------------------------------------
      // Everything else: trust backend `detail`.
      // -------------------------------------------------------
      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed${
              status ? ` (${status})` : ""
            }. Please try again.`
      );
    }
  };


  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h5" className="mb-1">
          Change Password
        </Card.Title>

        <p className="text-muted small mb-3">
          For your security, all active sessions will be signed out
          after a password change.
        </p>

        {successMessage && (
          <Alert variant="success" className="py-2">
            {successMessage}
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="py-2">
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

          <Form.Group className="mb-4" controlId="new_password">
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
        </Form>
      </Card.Body>
    </Card>
  );
};

export default ChangePasswordCard;
