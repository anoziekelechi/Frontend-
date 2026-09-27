// src/pages/users/ConfirmPasswordChange.tsx

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
import { useAuth } from "@/context/AuthContext";
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type { ConfirmPasswordChange, MessageResponse } from "@/types";

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

const ConfirmPasswordChange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading: authLoading } = useAuth();

  const {
    email,
    change_password_token,
    otp_attempts_used,
    otp_expires_in_seconds,
  } = (location.state || {}) as {
    email?: string;
    change_password_token?: string;
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
    defaultValues: {
      otp_code: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const session = useOtpSession({
    email: email ?? "",
    accountToken: change_password_token ?? "",
    otpType: "change_password",
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
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!email || !change_password_token) {
    return <Navigate to="/profile/change-password" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: ConfirmPasswordChange = {
      change_password_token,
      otp_code: data.otp_code,
      new_password: data.new_password,
    };

    try {
      const res = await api.post<MessageResponse>(
        "/auth/password/confirm",
        payload
      );

      reset();
      setSuccessMessage(res.data.message);

      // Password change revoked all refresh tokens server-side.
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
            state: { passwordChanged: true, email },
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

      // 422 — field-level
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

      // 400 — session expired (navigate) OR same-password (field error).
      // We branch on STATUS + whether the detail mentions "session",
      // but the copy always comes from the backend.
      if (status === 400) {
        const msg = typeof detail === "string" ? detail : "";
        const looksLikeSession =
          msg.toLowerCase().includes("session") ||
          msg.toLowerCase().includes("expired");

        if (looksLikeSession) {
          setServerError(
            typeof detail === "string"
              ? detail
              : `Request failed (${status}).`
          );
          redirectRef.current = {
            delayMs: 2000,
            run: () =>
              navigate("/profile/change-password", { replace: true }),
          };
        } else {
          setError("new_password", {
            type: "server",
            message:
              typeof detail === "string"
                ? detail
                : `Request failed (${status}).`,
          });
        }
        return;
      }

      // 401 — OTP invalid
      if (status === 401) {
        setServerError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status}).`
        );
        reset((prev) => ({ ...prev, otp_code: "" }));
        return;
      }

      // 403 — account state changed
      if (status === 403) {
        setServerError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status}).`
        );
        redirectRef.current = {
          delayMs: 2000,
          run: () => navigate("/profile", { replace: true }),
        };
        return;
      }

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
        <h1 className="h3 mb-2">Confirm Password Change</h1>
        <p className="text-muted mb-3">
          Enter the code sent to
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
                Updating...
              </>
            ) : (
              "Update Password"
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

export default ConfirmPasswordChange;
