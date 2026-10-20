// src/pages/users/Register.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link, Navigate } from "react-router-dom";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { handleApiError } from "@/lib/handleApiError";
import type { CreateUser, RegisterResponse } from "@/types";


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

  email: z.string().trim().email("Please enter a valid email address"),

  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;


const Register = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{
    email: string;
    reg_token: string;
    otp_attempts_used: number;
    otp_expires_in_seconds: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      surname: "",
      othernames: "",
      email: "",
      password: "",
    },
  });


  useEffect(() => {
    const p = redirectRef.current;
    if (!successMessage || !p) return;
    const id = window.setTimeout(() => {
      navigate("/register/verify", { replace: true, state: p });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


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
    redirectRef.current = null;

    const payload: CreateUser = {
      surname: data.surname.trim(),
      othernames: data.othernames.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    };

    try {
      const res = await api.post<RegisterResponse>("/auth/register", payload);

      redirectRef.current = {
        email: res.data.email,
        reg_token: res.data.reg_token,
        otp_attempts_used: res.data.otp_attempts_used,
        otp_expires_in_seconds: res.data.otp_expires_in_seconds,
      };

      setSuccessMessage(res.data.message);
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: ["surname", "othernames", "email", "password"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (msg) setServerError(msg);
    }
  };


  return (
    <Container className="py-5">
      <Card className="mx-auto" style={{ maxWidth: 720 }}>
        <Card.Body>
          <Card.Title className="text-center mb-4">
            Create Account
          </Card.Title>

          {successMessage && (
            <Alert variant="success">
              {successMessage}
              <div className="small mt-1">
                Redirecting to verification...
              </div>
            </Alert>
          )}

          {serverError && (
            <Alert
              variant="danger"
              dismissible
              onClose={() => setServerError(null)}
            >
              {serverError}
            </Alert>
          )}

          <Form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* ============== SURNAME / OTHERNAMES ============== */}
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="surname">
                  <Form.Label className="fw-semibold">Surname</Form.Label>
                  <Form.Control
                    type="text"
                    autoComplete="family-name"
                    placeholder="Doe"
                    isInvalid={!!errors.surname}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("surname")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.surname?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="othernames">
                  <Form.Label className="fw-semibold">
                    Other Names
                  </Form.Label>
                  <Form.Control
                    type="text"
                    autoComplete="given-name"
                    placeholder="Jane"
                    isInvalid={!!errors.othernames}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("othernames")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.othernames?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            {/* ============== EMAIL ============== */}
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="email">
                  <Form.Label className="fw-semibold">Email</Form.Label>
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
              </Col>
            </Row>

            {/* ============== PASSWORD ============== */}
            <Row>
              <Col md={12}>
                <Form.Group className="mb-4" controlId="password">
                  <Form.Label className="fw-semibold">Password</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="new-password"
                    isInvalid={!!errors.password}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("password")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    At least 6 characters.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {/* ============== ACTIONS ============== */}
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
                  Creating...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </Form>

          <p className="text-center mt-4 mb-0 small">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Register;



// src/pages/users/RegisterVerify.tsx

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
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
    .regex(/^\d{6}$/, "Numbers only"),
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
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        redirectRef.current = { path: "/register", delayMs: 2000 };
        return;
      }

      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        reset({ otp_code: "" });
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
    <Container className="py-5">
      <Card className="mx-auto text-center" style={{ maxWidth: 520 }}>
        <Card.Body>
          <Card.Title className="mb-2">Verify Your Account</Card.Title>
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
              <Form.Label className="fw-semibold">
                Verification Code
              </Form.Label>
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
              resendCooldown={session.resendCooldown}
              isExpired={session.isExpired}
              onResend={session.resend}
              disabled={successMessage !== null}
            />
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default RegisterVerify;


// src/pages/Login.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
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


interface LoginLocationState {
  from?: { pathname?: string };
  passwordChanged?: boolean;
  emailChanged?: boolean;
  email?: string;
}


const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const {
    from,
    passwordChanged,
    emailChanged,
    email: suggestedEmail,
  } = (location.state || {}) as LoginLocationState;

  const redirectTarget = from?.pathname ?? "/profile";

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

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
  if (user) return <Navigate to={redirectTarget} replace />;


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

      if (body.status === "otp_required") {
        setSuccessMessage(body.message);
        redirectRef.current = {
          path: "/login/verify",
          state: {
            email: body.email,
            login_token: body.login_token,
            otp_attempts_used: body.otp_attempts_used,
            otp_expires_in_seconds: body.otp_expires_in_seconds,
            from: redirectTarget,
          },
          delayMs: 1200,
        };
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


  return (
    <Container className="py-5">
      <Card className="mx-auto" style={{ maxWidth: 520 }}>
        <Card.Body>
          <Card.Title className="text-center mb-4">
            Welcome Back
          </Card.Title>

          {passwordChanged && (
            <Alert variant="success">
              Password changed successfully. Please log in with your
              new password.
            </Alert>
          )}

          {emailChanged && (
            <Alert variant="success">
              Email address updated. Please log in again.
            </Alert>
          )}

          {successMessage && (
            <Alert variant="success">
              {successMessage}
              <div className="small mt-1">
                Redirecting to verification...
              </div>
            </Alert>
          )}

          {serverError && (
            <Alert
              variant="danger"
              dismissible
              onClose={() => setServerError(null)}
            >
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
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="email">
                  <Form.Label className="fw-semibold">Email</Form.Label>
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
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-4" controlId="password">
                  <Form.Label className="fw-semibold">Password</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="current-password"
                    isInvalid={!!errors.password}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("password")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

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
        </Card.Body>
      </Card>
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
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type { VerifyLoginResponse, VerifyOtpRequest } from "@/types";


const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "Numbers only"),
});
type FormData = z.infer<typeof schema>;


const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, isLoading: authLoading } = useAuth();

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

  const postLoginTarget = from ?? "/profile";

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
  if (user) return <Navigate to={postLoginTarget} replace />;
  if (!email || !login_token) return <Navigate to="/login" replace />;


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
        try {
          await api.post("/auth/resend/verification", { email });
        } catch {
          /* ignore */
        }
        redirectRef.current = {
          path: "/register/verify",
          state: { email, from: postLoginTarget },
          delayMs: 2000,
        };
        return;
      }

      if (body.status === "success") {
        setSuccessMessage(body.message);
        await login();
        redirectRef.current = { path: postLoginTarget, delayMs: 1000 };
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
        redirectRef.current = { path: postLoginTarget, delayMs: 2000 };
        return;
      }

      if (status === 429) {
        const header = err.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds =
          Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
    <Container className="py-5">
      <Card className="mx-auto text-center" style={{ maxWidth: 520 }}>
        <Card.Body>
          <Card.Title className="mb-2">Verify Login</Card.Title>
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
              <Form.Label className="fw-semibold">
                Verification Code
              </Form.Label>
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
        </Card.Body>
      </Card>
    </Container>
  );
};

export default VerifyLogin;


