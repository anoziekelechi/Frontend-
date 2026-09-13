




// src/pages/user/ChangeName.tsx

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

import type { UpdateNames, UpdateNamesResponse } from "@/types";


// =============================================================
// HELPERS
// =============================================================

/**
 * Return a payload containing only the string fields that differ
 * from the previous values (trimmed before comparison).
 *
 * Used to avoid sending a no-op PATCH to the backend, which
 * rejects empty/unchanged payloads with 400 "No changes were made".
 */
function changedStringFields<T extends Record<string, string | undefined>>(
  next: T,
  prev: Partial<T>
): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(next) as (keyof T)[]).forEach((key) => {
    const a = next[key];
    const b = prev[key];
    if (typeof a === "string") {
      const trimmed = a.trim();
      if (trimmed !== (b ?? "").trim()) {
        out[key] = trimmed as T[keyof T];
      }
    }
  });
  return out;
}


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  surname: z
    .string()
    .trim()
    .min(2, "Surname must be at least 2 characters")
    .max(100, "Surname must not exceed 100 characters"),

  othernames: z
    .string()
    .trim()
    .min(2, "Other names must be at least 2 characters")
    .max(150, "Other names must not exceed 150 characters"),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const ChangeName = () => {
  const navigate = useNavigate();
  const { user, setUser, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      surname: user?.surname ?? "",
      othernames: user?.othernames ?? "",
    },
  });


  // ---------------------------------------------------------
  // Cancelable redirect after success
  // ---------------------------------------------------------
  useEffect(() => {
    const payload = redirectRef.current;
    if (!payload) return;

    const id = window.setTimeout(() => {
      navigate(payload.path, { replace: true });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ---------------------------------------------------------
  // Auth guards
  // ---------------------------------------------------------
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


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload = changedStringFields(data, {
      surname: user.surname,
      othernames: user.othernames,
    }) as UpdateNames;

    if (Object.keys(payload).length === 0) {
      setServerError("No changes were made");
      return;
    }

    try {
      const response = await api.patch<UpdateNamesResponse>(
        "/me/names",
        payload
      );

      setUser(response.data.user);
      reset({
        surname: response.data.user.surname,
        othernames: response.data.user.othernames,
      });

      setSuccessMessage(response.data.message);
      redirectRef.current = { path: "/profile", delayMs: 1500 };

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
          if ((field === "surname" || field === "othernames") && v.msg) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      // Everything else: trust backend detail
      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed${status ? ` (${status})` : ""}. Please try again.`
      );
    }
  };


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-4">Change Name</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to profile...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="surname">
            <Form.Label>Surname</Form.Label>
            <Form.Control
              type="text"
              autoComplete="family-name"
              isInvalid={!!errors.surname}
              disabled={isSubmitting || successMessage !== null}
              {...register("surname")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.surname?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="othernames">
            <Form.Label>Other Names</Form.Label>
            <Form.Control
              type="text"
              autoComplete="given-name"
              isInvalid={!!errors.othernames}
              disabled={isSubmitting || successMessage !== null}
              {...register("othernames")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.othernames?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isDirty || successMessage !== null}
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
                  Saving...
                </>
              ) : (
                "Save Changes"
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

export default ChangeName;
