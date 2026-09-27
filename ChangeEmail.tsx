// src/pages/users/VerifyEmailChange.tsx

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
import { useAuth } from "@/context/AuthContext";
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type { VerifyEmailChange, VerifyEmailChangeResponse } from "@/types";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain numbers only"),
});
type FormData = z.infer<typeof schema>;

const VerifyEmailChange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();

  const {
    new_email,
    email_change_token,
    otp_attempts_used,
    otp_expires_in_seconds,
  } = (location.state || {}) as {
    new_email?: string;
    email_change_token?: string;
    otp_attempts_used?: number;
    otp_expires_in_seconds?: number;
  };

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
    defaultValues: { otp_code: "" },
  });

  const session = useOtpSession({
    email: new_email ?? "",
    accountToken: email_change_token ?? "",
    otpType: "email_change",
    initialAttemptsUsed: otp_attempts_used ?? 1,
    initialSecondsLeft: otp_expires_in_seconds,
  });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => p.run(), p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!new_email || !email_change_token) {
    return <Navigate to="/profile/change-email" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: VerifyEmailChange = {
      email_change_token,
      otp_code: data.otp_code,
    };

    try {
      const res = await api.post<VerifyEmailChangeResponse>(
        "/auth/me/email/verify",
        payload
      );

      // Trust the backend message — no hardcoded copy.
      setSuccessMessage(res.data.message);

      // Email change revoked all refresh tokens server-side.
      redirectRef.current = {
        delayMs: 2000,
        run: async () => {
          try {
            await logout();
          } catch {
            // Cookies already invalid server-side.
          }
          navigate("/login", {
            replace: true,
            state: { emailChanged: true, email: new_email },
          });
        },
      };
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        setServerError("An unexpected error occurred.");
        return;
      }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // 422 — Pydantic validation (field-level)
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

      // 400 — session expired; backend detail drives the redirect hint.
      // We only branch on status (to trigger navigation), not on the
      // message text — copy always comes from the backend.
      if (status === 400) {
        setServerError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status}).`
        );
        redirectRef.current = {
          delayMs: 2000,
          run: () => navigate("/profile/change-email", { replace: true }),
        };
        return;
      }

      // 401 — wrong/expired OTP; stay on page
      if (status === 401) {
        setServerError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status}).`
        );
        reset({ otp_code: "" });
        return;
      }

      // Everything else — trust backend detail.
      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed (${status ?? "unknown"}).`
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify New Email</h1>
        <p className="text-muted mb-3">
          We sent a 6-digit code to
          <br />
          <strong>{new_email}</strong>
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
          <Form.Group className="mb-4" controlId="otp_code">
            <Form.Label>Verification Code</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
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
            {isSubmitting ? "Verifying..." : "Verify & Update Email"}
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

export default VerifyEmailChange;
