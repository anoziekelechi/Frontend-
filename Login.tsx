


// src/pages/Login.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type { LoginResponse } from "@/types/user";


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const Login = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect payload used by effect
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
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
        state: payload.state,
      });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);


  // ---------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }


  // ---------------------------------------------------------
  // Already logged in
  // ---------------------------------------------------------
  if (user) {
    return <Navigate to="/profile" replace />;
  }


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const submittedEmail = data.email.trim().toLowerCase();

    try {
      const response = await api.post<LoginResponse>("/login", {
        email: submittedEmail,
        password: data.password,
      });

      const body = response.data;

      // ---------------------------------------------------
      // DISABLED ACCOUNT (200 + status)
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
      // UNVERIFIED ACCOUNT (200 + status)
      // ---------------------------------------------------
      if (body.status === "unverified") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/resend-verification",
          state: { email: body.email ?? submittedEmail },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // OTP REQUIRED (normal path)
      // ---------------------------------------------------
      if (body.status === "otp_required") {
        setSuccessMessage(body.message);
        redirectRef.current = {
          path: "/login/verify",
          state: {
            email: body.email,
            login_token: body.login_token,
          },
          delayMs: 1200,
        };
        return;
      }

      // ---------------------------------------------------
      // Unexpected status
      // ---------------------------------------------------
      setServerError("Unexpected response from server.");

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

          if (
            (field === "email" || field === "password") &&
            v.msg
          ) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      // 403 — already logged in
      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : "Already logged in."
        );
        redirectRef.current = {
          path: "/profile",
          delayMs: 2000,
        };
        return;
      }

      // Everything else: trust backend detail
      setServerError(
        typeof detail === "string"
          ? detail
          : `Login failed${
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
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Welcome Back</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">
              Redirecting to verification...
            </div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
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
            disabled={isSubmitting || successMessage !== null}
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
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
import ResendOtp from "@/components/auth/ResendOtp";

import type { VerifyLoginResponse, VerifyOtpRequest } from "@/types";


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

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, login, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);

  const { email, login_token } = (location.state || {}) as {
    email?: string;
    login_token?: string;
  };

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
        state: payload.state,
      });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);


  // ---------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }


  // ---------------------------------------------------------
  // Already logged in
  // ---------------------------------------------------------
  if (user) {
    return <Navigate to="/profile" replace />;
  }


  // ---------------------------------------------------------
  // Missing session
  // ---------------------------------------------------------
  if (!email || !login_token) {
    return <Navigate to="/login" replace />;
  }


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
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
      const response = await api.post<VerifyLoginResponse>(
        "/login/verify",
        payload
      );

      const body = response.data;

      // ---------------------------------------------------
      // DISABLED (200 + status)
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
      // UNVERIFIED (200 + status)
      // ---------------------------------------------------
      if (body.status === "unverified") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/resend-verification",
          state: { email: body.email ?? email },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // SUCCESS
      // ---------------------------------------------------
      if (body.status === "success") {
        setSuccessMessage(body.message);

        // Refresh AuthContext now that cookies are set
        await login();

        redirectRef.current = {
          path: "/profile",
          delayMs: 1000,
        };
        return;
      }

      // ---------------------------------------------------
      // Unexpected status
      // ---------------------------------------------------
      setServerError("Unexpected response from server.");

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
            : "Session expired or invalid. Please log in again."
        );
        redirectRef.current = {
          path: "/login",
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
      // 403 — already logged in
      // ---------------------------------------------------
      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : "Already logged in."
        );
        redirectRef.current = {
          path: "/profile",
          delayMs: 2000,
        };
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
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-2">Verify Login</h1>

        <p className="text-muted text-center mb-4">
          We sent a 6-digit verification code to:
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">
              Redirecting to your profile...
            </div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

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
              disabled={successMessage !== null}
              {...register("otp_code")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.otp_code?.message}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              Enter the 6-digit code sent to your email.
            </Form.Text>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || successMessage !== null}
          >
            {isSubmitting ? "Verifying..." : "Verify & Login"}
          </Button>
        </Form>

        <div className="mt-4 d-flex flex-column gap-3">
          <ResendOtp
            email={email}
            accountToken={login_token}
            otpType="login"
            buttonLabel="Resend login code"
            disabled={successMessage !== null}
            onSessionExpired={() =>
              navigate("/login", { replace: true })
            }
          />

          <Button
            variant="link"
            className="p-0 text-decoration-none"
            disabled={isSubmitting || successMessage !== null}
            onClick={() => navigate("/login", { replace: true })}
          >
            Back to Login
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default VerifyLogin;


// src/pages/VerifyLogin.tsx error

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
import ResendOtp from "@/components/ResendOtp";

import type { VerifyLoginResponse } from "@/types/user";


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

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, login, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{
    path: string;
    state?: Record<string, unknown>;
    delayMs: number;
  } | null>(null);

  const { email, login_token } = (location.state || {}) as {
    email?: string;
    login_token?: string;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
        state: payload.state,
      });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate]);


  // ---------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }


  // ---------------------------------------------------------
  // Already logged in
  // ---------------------------------------------------------
  if (user) {
    return <Navigate to="/profile" replace />;
  }


  // ---------------------------------------------------------
  // Missing session
  // ---------------------------------------------------------
  if (!email || !login_token) {
    return <Navigate to="/login" replace />;
  }


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    try {
      const response = await api.post<VerifyLoginResponse>(
        "/login/verify",
        {
          email,
          account_token: login_token,
          otp_code: data.otp_code,
        }
      );

      const body = response.data;

      // ---------------------------------------------------
      // DISABLED (200 + status)
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
      // UNVERIFIED (200 + status)
      // ---------------------------------------------------
      if (body.status === "unverified") {
        setServerError(body.message);
        redirectRef.current = {
          path: "/resend-verification",
          state: { email: body.email ?? email },
          delayMs: 2000,
        };
        return;
      }

      // ---------------------------------------------------
      // SUCCESS
      // ---------------------------------------------------
      if (body.status === "success") {
        setSuccessMessage(body.message);

        // Refresh AuthContext now that cookies are set
        await login();

        redirectRef.current = {
          path: "/profile",
          delayMs: 1000,
        };
        return;
      }

      // ---------------------------------------------------
      // Unexpected status
      // ---------------------------------------------------
      setServerError("Unexpected response from server.");

    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        setServerError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // 422 — validation
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
          typeof detail === "string"
            ? detail
            : "Session expired or invalid. Please log in again."
        );
        redirectRef.current = {
          path: "/login",
          delayMs: 2000,
        };
        return;
      }

      // 401 — OTP invalid
      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : "OTP expired or invalid."
        );
        reset({ otp_code: "" });
        return;
      }

      // 403 — already logged in
      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : "Already logged in."
        );
        redirectRef.current = {
          path: "/profile",
          delayMs: 2000,
        };
        return;
      }

      // 429 — rate limit
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
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-2">Verify Login</h1>

        <p className="text-muted text-center mb-4">
          We sent a 6-digit verification code to:
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">


