

// src/pages/RegisterVerify.tsx

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import ResendOtp from "@/components/auth/ResendOtp";

import type {
  VerifyOtpRequest,
  VerifyRegistrationResponse,
} from "@/types";


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain numbers only"),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const RegisterVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, reg_token } = (location.state || {}) as {
    email?: string;
    reg_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect payload used by effect
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { otp_code: "" },
  });


  // ---------------------------------------------------------
  // Cancelable redirect
  // ---------------------------------------------------------
  useEffect(() => {
    const payload = redirectRef.current;
    if (!payload) return;

    const id = window.setTimeout(() => {
      navigate(payload.path, {
        replace: true,
        state: { email },
      });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate, email]);


  // ---------------------------------------------------------
  // Missing session
  // ---------------------------------------------------------
  if (!email || !reg_token) {
    return <Navigate to="/register" replace />;
  }


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    // Typed payload — TypeScript will now yell if the backend
    // contract changes (e.g. account_token renamed).
    const payload: VerifyOtpRequest = {
      email,
      account_token: reg_token,
      otp_code: data.otp_code,
    };

    try {
      const response = await api.post<VerifyRegistrationResponse>(
        "/register/verify",
        payload
      );

      setSuccessMessage(response.data.message);

      redirectRef.current = {
        path: "/login",
        delayMs: 1500,
      };

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // ---------------------------------------------------
      // 422 — Pydantic validation
      // ---------------------------------------------------
      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;

          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];

          if (field === "otp_code" && v.msg) {
            setError("otp_code", { type: "server", message: v.msg });
          }
        });
        return;
      }

      // ---------------------------------------------------
      // 400 — session expired / invalid
      // ---------------------------------------------------
      if (status === 400) {
        setServerError(
          typeof detail === "string"
            ? detail
            : "Session expired or invalid. Please register again."
        );
        redirectRef.current = {
          path: "/register",
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // 401 — OTP invalid; stay on page, clear input
      // ---------------------------------------------------
      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : "OTP expired or invalid."
        );
        reset({ otp_code: "" });
        return;
      }

      // ---------------------------------------------------
      // 429 — rate limit
      // ---------------------------------------------------
      if (status === 429) {
        const header = error.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        setServerError(
          typeof detail === "string"
            ? detail
            : seconds
              ? `Too many attempts. Try again in ${seconds}s.`
              : "Too many attempts. Please wait and try again."
        );
        return;
      }

      // ---------------------------------------------------
      // Everything else: trust backend detail
      // ---------------------------------------------------
      setServerError(
        typeof detail === "string"
          ? detail
          : `Verification failed${
              status ? ` (${status})` : ""
            }. Please try again.`
      );
    }
  };


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify Your Account</h1>

        <p className="text-muted mb-4">
          We sent a 6-digit verification code to
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting to login...</div>
          </Alert>
        )}

        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="otp_code">
            <Form.Label>Verification Code</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="text-center fs-3"
              isInvalid={!!errors.otp_code}
              disabled={successMessage !== null}
              {...register("otp_code")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.otp_code?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || successMessage !== null}
          >
            {isSubmitting ? "Verifying..." : "Verify Account"}
          </Button>
        </Form>

        <div className="mt-4 d-flex flex-column gap-3">
          <ResendOtp
            email={email}
            accountToken={reg_token}
            otpType="registration"
            buttonLabel="Resend verification code"
            disabled={successMessage !== null}
            onSessionExpired={() =>
              navigate("/register", { replace: true })
            }
          />

          <Button
            variant="link"
            className="p-0 text-decoration-none"
            disabled={isSubmitting || successMessage !== null}
            onClick={() => navigate("/register", { replace: true })}
          >
            Back to registration
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default RegisterVerify;






