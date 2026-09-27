
// src/pages/Login.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { humanizeSeconds } from "@/lib/time";
import type {
  LoginResponse,
  ResendVerificationRequest,
  ResendVerificationResponse,
} from "@/types";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const { passwordChanged, emailChanged, email: suggestedEmail } =
    (location.state || {}) as {
      passwordChanged?: boolean;
      emailChanged?: boolean;
      email?: string;
    };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: suggestedEmail ?? "", password: "" },
  });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const id = window.setInterval(() => {
      setRetryAfter((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryAfter]);

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }
  if (user) return <Navigate to="/profile" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    setRetryAfter(null);
    redirectRef.current = null;

    const submittedEmail = data.email.trim().toLowerCase();

    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email: submittedEmail,
        password: data.password,
      });

      const body = response.data;

      if (body.status === "disabled") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/contact-admin",
          state: { email: body.email ?? submittedEmail },
          delayMs: 2000,
        };
        return;
      }

      if (body.status === "unverified") {
        const verifiedEmail = body.email ?? submittedEmail;
        setServerError(body.message);

        try {
          const resendPayload: ResendVerificationRequest = { email: verifiedEmail };
          const resendRes = await api.post<ResendVerificationResponse>(
            "/auth/resend-verification", resendPayload
          );

          redirectRef.current = {
            path: "/register/verify",
            state: {
              email: resendRes.data.email,
              reg_token: resendRes.data.reg_token,
              otp_attempts_used: resendRes.data.otp_attempts_used,
              otp_expires_in_seconds: resendRes.data.otp_expires_in_seconds,
            },
            delayMs: 2000,
          };
          return;
        } catch (resendErr) {
          if (axios.isAxiosError(resendErr)) {
            const rDetail = resendErr.response?.data?.detail;
            if (typeof rDetail === "string") setServerError(rDetail);
          }
          redirectRef.current = { path: "/register", delayMs: 2500 };
          return;
        }
      }

      if (body.status === "otp_required") {
        setSuccessMessage(body.message);
        redirectRef.current = {
          path: "/login/verify",
          state: {
            email: body.email,
            login_token: body.login_token,
            otp_attempts_used: body.otp_attempts_used,
            otp_expires_in_seconds: body.otp_expires_in_seconds,
          },
          delayMs: 1200,
        };
        return;
      }

      // Malformed 200 — no detail to trust
      setServerError("Unexpected response from server.");
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
          if ((field === "email" || field === "password") && v.msg) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 429) {
        const header = err.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        setRetryAfter(seconds);
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        return;
      }

      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: "/profile", delayMs: 2000 };
        return;
      }

      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed (${status ?? "unknown"}).`
      );
    }
  };

  const submitDisabled =
    isSubmitting ||
    successMessage !== null ||
    (retryAfter !== null && retryAfter > 0);

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Welcome Back</h1>

        {passwordChanged && (
          <Alert variant="success" className="text-center">
            Password changed successfully. Please log in with your new password.
          </Alert>
        )}
        {emailChanged && (
          <Alert variant="success" className="text-center">
            Email address updated. Please log in again.
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to verification...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
            {retryAfter !== null && retryAfter > 0 && (
              <div className="small mt-1">
                You can try again in {humanizeSeconds(retryAfter)}.
              </div>
            )}
            {redirectRef.current?.path === "/register/verify" && (
              <div className="small mt-1">Sending a fresh verification code...</div>
            )}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" autoComplete="email" placeholder="Enter your email"
              isInvalid={!!errors.email} disabled={isSubmitting || successMessage !== null}
              {...register("email")} />
            <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" autoComplete="current-password" placeholder="Enter your password"
              isInvalid={!!errors.password} disabled={isSubmitting || successMessage !== null}
              {...register("password")} />
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={submitDisabled}>
            {isSubmitting ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Checking...
              </>
            ) : retryAfter !== null && retryAfter > 0 ? (
              `Try again in ${humanizeSeconds(retryAfter)}`
            ) : "Continue"}
          </Button>
        </Form>

        <div className="d-flex justify-content-between mt-4 small">
          <Link to="/register">Register</Link>
          <Link to="/password/reset">Forgot password?</Link>
        </div>
      </div>
    </Container>
  );
};

export default Login;



// src/pages/VerifyLogin.tsx

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
import type { VerifyLoginResponse, VerifyOtpRequest } from "@/types";

const schema = z.object({
  otp_code: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "Numbers only"),
});
type FormData = z.infer<typeof schema>;

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, isLoading: authLoading } = useAuth();

  const { email, login_token, otp_attempts_used, otp_expires_in_seconds } =
    (location.state || {}) as {
      email?: string;
      login_token?: string;
      otp_attempts_used?: number;
      otp_expires_in_seconds?: number;
    };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
    setError, reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { otp_code: "" },
  });

  const session = useOtpSession({
    email: email ?? "",
    accountToken: login_token ?? "",
    otpType: "login",
    initialAttemptsUsed: otp_attempts_used ?? 1,
    initialSecondsLeft: otp_expires_in_seconds,
  });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }
  if (user) return <Navigate to="/profile" replace />;
  if (!email || !login_token) return <Navigate to="/login" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: VerifyOtpRequest = {
      email, account_token: login_token, otp_code: data.otp_code,
    };

    try {
      const res = await api.post<VerifyLoginResponse>("/auth/login_verify", payload);
      const body = res.data;

      if (body.status === "disabled") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/contact-admin",
          state: { email: body.email ?? email },
          delayMs: 2000,
        };
        return;
      }

      if (body.status === "unverified") {
        setServerError(body.message);
        try { await api.post("/auth/resend-verification", { email }); } catch { /* ignore */ }
        redirectRef.current = { path: "/register", delayMs: 2000 };
        return;
      }

      if (body.status === "success") {
        setSuccessMessage(body.message);
        await login();
        redirectRef.current = { path: "/profile", delayMs: 1000 };
        return;
      }

      setServerError("Unexpected response from server.");
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
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: "/login", delayMs: 2000 };
        return;
      }

      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        reset({ otp_code: "" });
        return;
      }

      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: "/profile", delayMs: 2000 };
        return;
      }

      if (status === 429) {
        const header = err.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        setServerError(
          typeof detail === "string"
            ? detail
            : seconds
              ? `Request failed (${status}).`
              : `Request failed (${status}).`
        );
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
        <h1 className="h3 mb-2">Verify Login</h1>
        <p className="text-muted mb-3">
          We sent a 6-digit code to<br /><strong>{email}</strong>
        </p>

        <OtpCountdown secondsLeft={session.secondsLeft} isExpired={session.isExpired} />

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting to your profile...</div>
          </Alert>
        )}
        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="otp_code">
            <Form.Label>Verification Code</Form.Label>
            <Form.Control type="text" inputMode="numeric" autoComplete="one-time-code"
              autoFocus maxLength={6} placeholder="000000" className="text-center fs-3"
              isInvalid={!!errors.otp_code}
              disabled={session.isExpired || session.isExhausted || successMessage !== null}
              {...register("otp_code")} />
            <Form.Control.Feedback type="invalid">{errors.otp_code?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100"
            disabled={isSubmitting || session.isExpired || session.isExhausted || successMessage !== null}>
            {isSubmitting ? "Verifying..." : "Verify & Login"}
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

export default VerifyLogin;

