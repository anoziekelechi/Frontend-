
// src/pages/RequestPasswordReset.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import type {
  RequestPasswordReset,
  RequestPasswordResetResponse,
} from "@/types";

const schema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

const RequestPasswordReset = () => {
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const submittedEmail = data.email.trim().toLowerCase();
    const payload: RequestPasswordReset = { email: submittedEmail };

    try {
      const res = await api.post<RequestPasswordResetResponse>(
        "/auth/password/reset-request",
        payload
      );

      reset();
      setSuccessMessage(res.data.message);

      redirectRef.current = {
        path: "/password/reset/verify",
        state: {
          email: submittedEmail,
          reset_token: res.data.reset_token,
          otp_attempts_used: res.data.otp_attempts_used,
          otp_expires_in_seconds: res.data.otp_expires_in_seconds,
        },
        delayMs: 1500,
      };
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        setServerError("An unexpected error occurred.");
        return;
      }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];
          if (field === "email" && v.msg) {
            setError("email", { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 403 && typeof detail === "string") {
        setServerError(detail);
        return;
      }

      if (status === 429) {
        setServerError(
          typeof detail === "string"
            ? detail
            : "Too many requests. Please try again later."
        );
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
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-2">Reset Password</h1>
        <p className="text-muted text-center mb-4">
          Enter your email and we'll send a verification code.
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to verification...</div>
          </Alert>
        )}
        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="email">
            <Form.Label>Email</Form.Label>
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

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || successMessage !== null}
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
            ) : (
              "Send Reset Code"
            )}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </Container>
  );
};

export default RequestPasswordReset;




// src/pages/ResetPasswordVerify.tsx

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type { ConfirmPasswordReset, MessageResponse } from "@/types";

const schema = z
  .object({
    otp_code: z
      .string()
      .length(6, "OTP must be exactly 6 digits")
      .regex(/^\d{6}$/, "OTP must contain numbers only"),
    new_password: z
      .string()
      .min(6, "New password must be at least 6 characters"),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
type FormData = z.infer<typeof schema>;

const ResetPasswordVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, reset_token, otp_attempts_used, otp_expires_in_seconds } =
    (location.state || {}) as {
      email?: string;
      reset_token?: string;
      otp_attempts_used?: number;
      otp_expires_in_seconds?: number;
    };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { otp_code: "", new_password: "", confirm_password: "" },
  });

  const session = useOtpSession({
    email: email ?? "",
    accountToken: reset_token ?? "",
    otpType: "password_reset",
    initialAttemptsUsed: otp_attempts_used ?? 1,
    initialSecondsLeft: otp_expires_in_seconds,
  });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);

  if (!email || !reset_token) {
    return <Navigate to="/password/reset" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: ConfirmPasswordReset = {
      email,
      reset_token,
      otp_code: data.otp_code,
      new_password: data.new_password,
    };

    try {
      const res = await api.post<MessageResponse>(
        "/auth/password/reset",
        payload
      );
      reset();
      setSuccessMessage(res.data.message);
      redirectRef.current = { path: "/login", delayMs: 2000 };
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        setServerError("An unexpected error occurred.");
        return;
      }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];
          if ((field === "otp_code" || field === "new_password") && v.msg) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 400) {
        const msg = typeof detail === "string" ? detail : "";
        if (
          msg.toLowerCase().includes("session") ||
          msg.toLowerCase().includes("expired")
        ) {
          setServerError(msg || "Session expired. Please start over.");
          redirectRef.current = { path: "/password/reset", delayMs: 2000 };
        } else {
          setError("new_password", {
            type: "server",
            message: msg || "New password must be different.",
          });
        }
        return;
      }

      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : "OTP expired or invalid."
        );
        reset((prev) => ({ ...prev, otp_code: "" }));
        return;
      }

      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : "Account suspended."
        );
        redirectRef.current = { path: "/contact-admin", delayMs: 2000 };
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
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Reset Password</h1>
        <p className="text-muted mb-3">
          Enter the 6-digit code sent to
          <br />
          <strong>{email}</strong>
        </p>

        <OtpCountdown
          secondsLeft={session.secondsLeft}
          isExpired={session.isExpired}
        />

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting to login...</div>
          </Alert>
        )}
        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3 text-start" controlId="otp_code">
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
              disabled={
                session.isExpired ||
                session.isExhausted ||
                successMessage !== null
              }
              {...register("otp_code")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.otp_code?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3 text-start" controlId="new_password">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.new_password}
              disabled={session.isExpired || successMessage !== null}
              {...register("new_password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.new_password?.message}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">At least 6 characters.</Form.Text>
          </Form.Group>

          <Form.Group className="mb-4 text-start" controlId="confirm_password">
            <Form.Label>Confirm New Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.confirm_password}
              disabled={session.isExpired || successMessage !== null}
              {...register("confirm_password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.confirm_password?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={
              isSubmitting ||
              session.isExpired ||
              session.isExhausted ||
              successMessage !== null
            }
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
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </Form>

        <div className="mt-4">
          <OtpResendPanel
            attemptsUsed={session.attemptsUsed}
            attemptsLimit={session.attemptsLimit}
            isExhausted={session.isExhausted}
            isResending={session.isResending}
            resendMessage={session.resendMessage}
            resendError={session.resendError}
            retryAfterSeconds={session.retryAfterSeconds}
            onResend={session.resend}
            disabled={successMessage !== null}
          />
        </div>
      </div>
    </Container>
  );
};

export default ResetPasswordVerify;
