

// src/components/profile/UpdateNamesCard.tsx

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type { ReadUser, UpdateNames } from "@/types/user";


// Response envelope from PATCH /me/names
interface UpdateNamesResponse {
  message: string;
  user: ReadUser;
}


// =============================================================
// VALIDATION — mirrors backend Field constraints only
// (no same-password-style duplication of business rules)
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

const UpdateNamesCard = () => {
  const { user, setUser } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    // Build only the fields the user actually changed.
    // Backend rejects no-op updates, so we filter here too.
    const payload: UpdateNames = {};

    if (data.surname.trim() !== (user?.surname ?? "").trim()) {
      payload.surname = data.surname.trim();
    }
    if (data.othernames.trim() !== (user?.othernames ?? "").trim()) {
      payload.othernames = data.othernames.trim();
    }

    if (Object.keys(payload).length === 0) {
      // Pure client-side shortcut — no request needed.
      setServerError("No changes were made");
      return;
    }

    try {
      const response = await api.patch<UpdateNamesResponse>(
        "/me/names",
        payload
      );

      // Update AuthContext from the returned user
      if (setUser) {
        setUser(response.data.user);
      }

      reset({
        surname: response.data.user.surname,
        othernames: response.data.user.othernames,
      });

      // Trust the backend's message.
      setSuccessMessage(response.data.message);

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // -------------------------------------------------------
      // 422 — Pydantic validation (field-level errors)
      // -------------------------------------------------------
      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;

          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];

          if (
            (field === "surname" || field === "othernames") &&
            v.msg
          ) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      // -------------------------------------------------------
      // All other errors: trust backend `detail`.
      // Fall back only when detail is absent (proxy/HTML, etc).
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
        <Card.Title as="h5" className="mb-3">
          Personal Information
        </Card.Title>

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
          <Form.Group className="mb-3" controlId="surname">
            <Form.Label>Surname</Form.Label>
            <Form.Control
              type="text"
              autoComplete="family-name"
              isInvalid={!!errors.surname}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting || !isDirty}
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
              disabled={isSubmitting || !isDirty}
              onClick={() =>
                reset({
                  surname: user?.surname ?? "",
                  othernames: user?.othernames ?? "",
                })
              }
            >
              Reset
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default UpdateNamesCard;







