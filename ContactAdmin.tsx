export interface ContactAdminMessage {
  email: string;
  message: string;
}

export interface ContactAdminResponse {
  message: string;
}



// src/pages/ContactAdmin.tsx

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import type {
  ContactAdminMessage,
  ContactAdminResponse,
} from "@/types/user";


// =============================================================
// CONSTANTS (must mirror backend Field constraints)
// =============================================================

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),

  message: z
    .string()
    .trim()
    .min(
      MESSAGE_MIN,
      `Message must be at least ${MESSAGE_MIN} characters`
    )
    .max(
      MESSAGE_MAX,
      `Message must not exceed ${MESSAGE_MAX} characters`
    ),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const ContactAdmin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Optional prefill — set by Login.tsx / VerifyLogin.tsx on redirect
  const { email: prefillEmail } = (location.state || {}) as {
    email?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  // Redirect target + delay; used by the effect below
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);


  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: prefillEmail ?? "",
      message: "",
    },
  });

  const messageValue = watch("message") ?? "";


  // ===========================================================
  // CANCELABLE REDIRECT
  // ===========================================================
  useEffect(() => {
    const payload = redirectRef.current;
    if (!payload) return;

    const id = window.setTimeout(() => {
      navigate(payload.path, { replace: true });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ===========================================================
  // RETRY-AFTER COUNTDOWN
  // ===========================================================
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;

    const id = window.setInterval(() => {
      setRetryAfter((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [retryAfter]);


  // ===========================================================
  // SUBMIT
  // ===========================================================
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    setRetryAfter(null);
    redirectRef.current = null;

    const payload: ContactAdminMessage = {
      email: data.email.trim().toLowerCase(),
      message: data.message.trim(),
    };

    try {
      const response = await api.post<ContactAdminResponse>(
        "/contact-admin",
        payload
      );

      setSuccessMessage(
        response.data?.message ||
          "Your message has been sent to our support team."
      );

      // Redirect home after a short delay so the user can read the message.
      redirectRef.current = {
        path: "/",
        delayMs: 4000,
      };

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const statusCode = error.response?.status;
      const detail = error.response?.data?.detail;

      // -------------------------------------------------------
      // 422 — Pydantic validation
      // -------------------------------------------------------
      if (statusCode === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;

          const validationError = item as {
            loc?: unknown[];
            msg?: string;
          };

          const field =
            validationError.loc?.[validationError.loc.length - 1];

          if (
            (field === "email" || field === "message") &&
            validationError.msg
          ) {
            setError(field, {
              type: "server",
              message: validationError.msg,
            });
          }
        });
        return;
      }

      // -------------------------------------------------------
      // 429 — rate limit
      // -------------------------------------------------------
      if (statusCode === 429) {
        const header = error.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        setRetryAfter(seconds);

        setServerError(
          typeof detail === "string"
            ? detail
            : seconds
              ? `Too many requests. Please wait ${seconds}s before trying again.`
              : "Too many requests. Please try again in 1 hour."
        );
        return;
      }

      // -------------------------------------------------------
      // Any other HTTPException
      // -------------------------------------------------------
      if (typeof detail === "string") {
        setServerError(detail);
        return;
      }

      setServerError("Unable to send your message. Please try again.");
    }
  };


  // ===========================================================
  // SUBMIT BUTTON STATE
  // ===========================================================
  const submitDisabled =
    isSubmitting ||
    successMessage !== null ||
    (retryAfter !== null && retryAfter > 0);


  // ===========================================================
  // UI
  // ===========================================================
  return (
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <div className="bg-white p-4 rounded shadow-sm">

        <h1 className="h3 text-center mb-2">
          Contact Support
        </h1>

        <p className="text-muted text-center mb-4">
          If you're having trouble accessing your account, send us a
          message and our support team will review it.
        </p>


        {/* =====================================================
            SUCCESS
        ===================================================== */}
        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">
              Redirecting to home...
            </div>
          </Alert>
        )}


        {/* =====================================================
            SERVER ERROR
        ===================================================== */}
        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}

            {retryAfter !== null && retryAfter > 0 && (
              <div className="small mt-1">
                You can try again in {retryAfter}s.
              </div>
            )}
          </Alert>
        )}


        {/* =====================================================
            FORM
        ===================================================== */}
        <Form onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* ---------------------------------------------------
              EMAIL
          --------------------------------------------------- */}
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Your Email</Form.Label>

            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              isInvalid={!!errors.email}
              disabled={isSubmitting || successMessage !== null}
              {...register("email")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>


          {/* ---------------------------------------------------
              MESSAGE
          --------------------------------------------------- */}
          <Form.Group className="mb-4" controlId="message">
            <Form.Label>Message</Form.Label>

            <Form.Control
              as="textarea"
              rows={6}
              placeholder="Describe your issue..."
              isInvalid={!!errors.message}
              disabled={isSubmitting || successMessage !== null}
              maxLength={MESSAGE_MAX}
              {...register("message")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.message?.message}
            </Form.Control.Feedback>

            <div className="d-flex justify-content-between">
              <Form.Text className="text-muted">
                At least {MESSAGE_MIN} characters.
              </Form.Text>

              <Form.Text
                className={
                  messageValue.length >= MESSAGE_MAX
                    ? "text-danger"
                    : "text-muted"
                }
              >
                {messageValue.length} / {MESSAGE_MAX}
              </Form.Text>
            </div>
          </Form.Group>


          {/* ---------------------------------------------------
              SUBMIT
          --------------------------------------------------- */}
          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={submitDisabled}
          >
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Sending...
              </>
            ) : retryAfter !== null && retryAfter > 0 ? (
              `Try again in ${retryAfter}s`
            ) : (
              "Send Message"
            )}
          </Button>

        </Form>


        {/* =====================================================
            BACK TO HOME
        ===================================================== */}
        <p className="text-center mt-4 mb-0 small">
          <Link to="/">Back to home</Link>
        </p>

      </div>
    </Container>
  );
};

export default ContactAdmin;
