
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
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type { VerifyOtpRequest, VerifyRegistrationResponse } from "@/types";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain numbers only"),
});
type FormData = z.infer<typeof schema>;

const RegisterVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, reg_token, otp_attempts_used, otp_expires_in_seconds } =
    (location.state || {}) as {
      email?: string;
      reg_token?: string;
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
    defaultValues: { otp_code: "" },
  });

  const session = useOtpSession({
    email: email ?? "",
    accountToken: reg_token ?? "",
    otpType: "registration",
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

  if (!email || !reg_token) return <Navigate to="/register" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: VerifyOtpRequest = {
      email,
      account_token: reg_token,
      otp_code: data.otp_code,
    };

    try {
      const res = await api.post<VerifyRegistrationResponse>(
        "/auth/register/verify",
        payload
      );
      setSuccessMessage(res.data.message);
      redirectRef.current = { path: "/login", delayMs: 1500 };
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
          if (field === "otp_code" && v.msg) {
            setError("otp_code", { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 400) {
        setServerError(
          typeof detail === "string"
            ? detail
            : "Session expired. Please register again."
        );
        redirectRef.current = { path: "/register", delayMs: 2000 };
        return;
      }

      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : "OTP expired or invalid."
        );
        reset({ otp_code: "" });
        return;
      }

      setServerError(
        typeof detail === "string"
          ? detail
          : `Verification failed${status ? ` (${status})` : ""}. Please try again.`
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify Your Account</h1>
        <p className="text-muted mb-3">
          We sent a 6-digit code to
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
            {isSubmitting ? "Verifying..." : "Verify Account"}
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

export default RegisterVerify;
