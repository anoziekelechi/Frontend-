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


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;


// =============================================================
// TYPES
// =============================================================

/**
 * Shape of the router state this page may receive.
 *
 *   from            — set by route guards when a user tried to
 *                     reach a protected page unauthenticated
 *   passwordChanged — set by ConfirmPasswordChange on success
 *   emailChanged    — set by VerifyEmailChange on success
 *   email           — prefill hint (e.g. the user's new email)
 */
interface LoginLocationState {
  from?: { pathname?: string };
  passwordChanged?: boolean;
  emailChanged?: boolean;
  email?: string;
}


// =============================================================
// COMPONENT
// =============================================================

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  // ------------------------------------------------------------------
  // Router state (from guard, or post-mutation success)
  // ------------------------------------------------------------------
  const {
    from,
    passwordChanged,
    emailChanged,
    email: suggestedEmail,
  } = (location.state || {}) as LoginLocationState;

  // Path the user was trying to reach before being bounced here.
  // Fall back to /profile when no `from` is present.
  const redirectTarget = from?.pathname ?? "/profile";


  // ------------------------------------------------------------------
  // Local state
  // ------------------------------------------------------------------
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);


  // ------------------------------------------------------------------
  // Form
  // ------------------------------------------------------------------
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: suggestedEmail ?? "", password: "" },
  });


  // ------------------------------------------------------------------
  // Cancelable redirect
  // ------------------------------------------------------------------
  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);


  // ------------------------------------------------------------------
  // Retry-After countdown
  // ------------------------------------------------------------------
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return;
    const id = window.setInterval(() => {
      setRetryAfter((s) => (s === null || s <= 1 ? null : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [retryAfter]);


  // ------------------------------------------------------------------
  // Auth loading
  // ------------------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }

  // Already authenticated → send to wherever they were headed
  if (user) return <Navigate to={redirectTarget} replace />;


  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
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

      // ---------------------------------------------------
      // DISABLED
      // ---------------------------------------------------
      if (body.status === "disabled") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/contact-admin",
          state: { email: body.email ?? submittedEmail },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // UNVERIFIED — auto-resend verification, route to verify
      // ---------------------------------------------------
      if (body.status === "unverified") {
        const verifiedEmail = body.email ?? submittedEmail;
        setServerError(body.message);

        try {
          const resendPayload: ResendVerificationRequest = {
            email: verifiedEmail,
          };
          const resendRes = await api.post<ResendVerificationResponse>(
            "/auth/resend/verification",
            resendPayload
          );

          redirectRef.current = {
            path: "/register/verify",
            state: {
              email: resendRes.data.email,
              reg_token: resendRes.data.reg_token,
              otp_attempts_used: resendRes.data.otp_attempts_used,
              otp_expires_in_seconds:
                resendRes.data.otp_expires_in_seconds,
              // Pass `from` through so the eventual post-verification
              // login lands where the user was originally headed.
              from: redirectTarget,
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

      // ---------------------------------------------------
      // OTP REQUIRED — normal path
      // ---------------------------------------------------
      if (body.status === "otp_required") {
        setSuccessMessage(body.message);
        redirectRef.current = {
          path: "/login/verify",
          state: {
            email: body.email,
            login_token: body.login_token,
            otp_attempts_used: body.otp_attempts_used,
            otp_expires_in_seconds: body.otp_expires_in_seconds,
            // Pass `from` through to the verify step so the post-
            // verification redirect honours the original intent.
            from: redirectTarget,
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

      // 422 — Pydantic validation
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

      // 429 — rate limit
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

      // 403 — already logged in
      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: redirectTarget, delayMs: 2000 };
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


  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Welcome Back</h1>

        {passwordChanged && (
          <Alert variant="success" className="text-center">
            Password changed successfully. Please log in with your new
            password.
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
              <div className="small mt-1">
                Sending a fresh verification code...
              </div>
            )}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              isInvalid={!!errors.email}
              disabled={isSubmitting || successMessage !== null}
              {...register("email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              isInvalid={!!errors.password}
              disabled={isSubmitting || successMessage !== null}
              {...register("password")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.password?.message}
            </Form.Control.Feedback>
          </Form.Group>

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
                Checking...
              </>
            ) : retryAfter !== null && retryAfter > 0 ? (
              `Try again in ${humanizeSeconds(retryAfter)}`
            ) : (
              "Continue"
            )}
          </Button>
        </Form>

        <div className="d-flex justify-content-between mt-4 small">
          <Link to="/register">Register</Link>
          <Link to="/password/reset/request">Forgot password?</Link>
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


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "Numbers only"),
});
type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, isLoading: authLoading } = useAuth();

  // ------------------------------------------------------------------
  // Router state from Login.tsx
  //
  // `from` carries the original destination the user was heading to
  // before the guard bounced them to /login.
  // ------------------------------------------------------------------
  const {
    email,
    login_token,
    otp_attempts_used,
    otp_expires_in_seconds,
    from,
  } = (location.state || {}) as {
    email?: string;
    login_token?: string;
    otp_attempts_used?: number;
    otp_expires_in_seconds?: number;
    from?: string;
  };

  // Where to land after successful verification.
  // Falls back to /profile when no `from` was passed.
  const postLoginTarget = from ?? "/profile";


  // ------------------------------------------------------------------
  // Local state
  // ------------------------------------------------------------------
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);


  // ------------------------------------------------------------------
  // Form
  // ------------------------------------------------------------------
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


  // ------------------------------------------------------------------
  // OTP session (countdown + resend)
  // ------------------------------------------------------------------
  const session = useOtpSession({
    email: email ?? "",
    accountToken: login_token ?? "",
    otpType: "login",
    initialAttemptsUsed: otp_attempts_used ?? 1,
    initialSecondsLeft: otp_expires_in_seconds,
  });


  // ------------------------------------------------------------------
  // Cancelable redirect
  // ------------------------------------------------------------------
  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);


  // ------------------------------------------------------------------
  // Guards
  // ------------------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }
  if (user) return <Navigate to={postLoginTarget} replace />;
  if (!email || !login_token) return <Navigate to="/login" replace />;


  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: VerifyOtpRequest = {
      email,
      account_token: login_token,
      otp_code: data.otp_code,
    };

    try {
      const res = await api.post<VerifyLoginResponse>(
        "/auth/login/verify",
        payload
      );
      const body = res.data;

      // ---------------------------------------------------
      // DISABLED — account state changed mid-flow
      // ---------------------------------------------------
      if (body.status === "disabled") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/contact-admin",
          state: { email: body.email ?? email },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // UNVERIFIED — auto-resend, route to register verification
      // ---------------------------------------------------
      if (body.status === "unverified") {
        setServerError(body.message);

        try {
          await api.post("/auth/resend/verification", { email });
        } catch {
          // ignore — the message is still shown to the user
        }

        redirectRef.current = {
          path: "/register/verify",
          state: {
            email,
            // Preserve the original intent through the verification
            // step. When that flow completes, it returns to /login,
            // and eventually the user should land at `from`.
            from: postLoginTarget,
          },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // SUCCESS — refresh auth context, then redirect
      // ---------------------------------------------------
      if (body.status === "success") {
        setSuccessMessage(body.message);

        // Backend has already set the auth cookies. `login()`
        // re-fetches the authenticated user into context.
        await login();

        redirectRef.current = {
          path: postLoginTarget,
          delayMs: 1000,
        };
        return;
      }

      // Unexpected status
      setServerError("Unexpected response from server.");

    } catch (err) {
      if (!axios.isAxiosError(err)) {
        setServerError("An unexpected error occurred.");
        return;
      }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

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

      // 400 — session expired
      if (status === 400) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: "/login", delayMs: 2000 };
        return;
      }

      // 401 — OTP invalid; stay on page
      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        reset({ otp_code: "" });
        return;
      }

      // 403 — already logged in
      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: postLoginTarget, delayMs: 2000 };
        return;
      }

      // 429 — rate limited
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


  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify Login</h1>
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
            <div className="small mt-1">Redirecting...</div>
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
            resendCooldown={session.resendCooldown}
            isExpired={session.isExpired}
            onResend={session.resend}
            disabled={successMessage !== null}
          />
        </div>
      </div>
    </Container>
  );
};

export default VerifyLogin;



