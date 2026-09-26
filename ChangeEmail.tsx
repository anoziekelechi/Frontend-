
// src/pages/user/RequestEmailChange.tsx

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
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import OtpCountdown from "@/components/auth/OtpCountdown";
import OtpResendPanel from "@/components/auth/OtpResendPanel";
import { useOtpSession } from "@/hooks/useOtpSession";
import type {
  RequestEmailChangeRequest,
  RequestEmailChangeResponse,
} from "@/types";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain numbers only"),
  new_email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),
});
type FormData = z.infer<typeof schema>;

const RequestEmailChange = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const {
    email_approval_token,
    otp_attempts_used,
    otp_expires_in_seconds,
  } = (location.state || {}) as {
    email_approval_token?: string;
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
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { otp_code: "", new_email: "" },
  });

  const session = useOtpSession({
    email: user?.email ?? "",
    accountToken: email_approval_token ?? "",
    otpType: "email_change_approval",
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
  }, [successMessage, navigate]);

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!email_approval_token)
    return <Navigate to="/profile/change-email" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const newEmail = data.new_email.trim().toLowerCase();
    const payload: RequestEmailChangeRequest = {
      email_approval_token,
      otp_code: data.otp_code,
      new_email: newEmail,
    };

    try {
      const res = await api.post<RequestEmailChangeResponse>(
        "/auth/me/email/request",
        payload
      );
      reset();
      setSuccessMessage(res.data.message);
      redirectRef.current = {
        path: "/profile/change-email/verify",
        state: {
          new_email: newEmail,
          email_change_token: res.data.email_change_token,
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
          if ((field === "otp_code" || field === "new_email") && v.msg) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 400) {
        const msg = typeof detail === "string" ? detail : "";
        if (msg.toLowerCase().includes("session") || msg.toLowerCase().includes("approval")) {
          setServerError(msg || "Approval session expired.");
          redirectRef.current = {
            path: "/profile/change-email",
            delayMs: 2000,
          };
        } else {
          setError("new_email", {
            type: "server",
            message: msg || "Invalid new email.",
          });
        }
        return;
      }

      if (status === 401) {
        setError("otp_code", {
          type: "server",
          message:
            typeof detail === "string" ? detail : "OTP expired or invalid.",
        });
        reset((prev) => ({ ...prev, otp_code: "" }));
        return;
      }

      if (status === 409 && typeof detail === "string") {
        setError("new_email", { type: "server", message: detail });
        return;
      }

      if (status === 403) {
        setServerError(
          typeof detail === "string" ? detail : "Account state changed."
        );
        redirectRef.current = { path: "/profile", delayMs: 2000 };
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
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-1">Enter Approval Code</h1>
        <p className="text-muted small mb-3">
          We sent a code to your current email <strong>{user.email}</strong>.
        </p>

        <OtpCountdown
          secondsLeft={session.secondsLeft}
          isExpired={session.isExpired}
        />

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">
              Redirecting to new-email verification...
            </div>
          </Alert>
        )}
        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="otp_code">
            <Form.Label>Approval Code</Form.Label>
            <Form.Control
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="text-center fs-4"
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

          <Form.Group className="mb-4" controlId="new_email">
            <Form.Label>New Email Address</Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="new@example.com"
              isInvalid={!!errors.new_email}
              disabled={session.isExpired || successMessage !== null}
              {...register("new_email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.new_email?.message}
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
                Verifying...
              </>
            ) : (
              "Verify & Send Code to New Email"
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

export default RequestEmailChange;








// src/pages/user/VerifyEmailChange.tsx

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
import type { VerifyEmailChange, ReadUser } from "@/types";

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
  const { user, setUser, isLoading: authLoading } = useAuth();

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
    email: new_email ?? "",
    accountToken: email_change_token ?? "",
    otpType: "email_change",
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

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!new_email || !email_change_token)
    return <Navigate to="/profile/change-email" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: VerifyEmailChange = {
      email_change_token,
      otp_code: data.otp_code,
    };

    try {
      const res = await api.post<ReadUser>("/auth/me/email/verify", payload);
      setUser(res.data);
      setSuccessMessage("Email updated successfully");
      redirectRef.current = { path: "/profile", delayMs: 1500 };
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
            : "Session expired. Please start over."
        );
        redirectRef.current = {
          path: "/profile/change-email",
          delayMs: 2000,
        };
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
            <div className="small mt-1">Redirecting to profile...</div>
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




// src/pages/user/ApproveEmailChange.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { ApproveEmailChangeRequest, ApproveEmailChangeResponse } from "@/types";

const schema = z.object({
  current_password: z.string().min(1, "Current password is required"),
});
type FormData = z.infer<typeof schema>;

const ApproveEmailChange = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; state?: Record<string, unknown>; delayMs: number } | null>(null);

  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
    setError, reset,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { current_password: "" } });

  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(() => {
      navigate(p.path, { replace: true, state: p.state });
    }, p.delayMs);
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
  if (!user) return <Navigate to="/login" replace />;

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: ApproveEmailChangeRequest = { current_password: data.current_password };

    try {
      const res = await api.post<ApproveEmailChangeResponse>("/auth/me/email/approve", payload);
      reset();
      setSuccessMessage(res.data.message);
      redirectRef.current = {
        path: "/profile/change-email/request",
        state: {
          email_approval_token: res.data.email_approval_token,
          otp_attempts_used: res.data.otp_attempts_used,
          otp_expires_in_seconds: res.data.otp_expires_in_seconds,
        },
        delayMs: 1500,
      };
    } catch (err) {
      if (!axios.isAxiosError(err)) { setServerError("An unexpected error occurred."); return; }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];
          if (field === "current_password" && v.msg) {
            setError("current_password", { type: "server", message: v.msg });
          }
        });
        return;
      }

      if (status === 401 && typeof detail === "string") {
        setError("current_password", { type: "server", message: detail });
        return;
      }

      setServerError(typeof detail === "string" ? detail
        : `Request failed${status ? ` (${status})` : ""}. Please try again.`);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 560 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 mb-1">Change Email</h1>
        <p className="text-muted small mb-4">
          Current email: <strong>{user.email}</strong>
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to next step...</div>
          </Alert>
        )}
        {serverError && <Alert variant="danger" className="text-center">{serverError}</Alert>}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="current_password">
            <Form.Label>Confirm Your Password</Form.Label>
            <Form.Control type="password" autoComplete="current-password"
              isInvalid={!!errors.current_password}
              disabled={isSubmitting || successMessage !== null}
              {...register("current_password")} />
            <Form.Control.Feedback type="invalid">{errors.current_password?.message}</Form.Control.Feedback>
            <Form.Text className="text-muted">For your security, confirm your password to begin.</Form.Text>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button type="submit" variant="primary"
              disabled={isSubmitting || successMessage !== null}>
              {isSubmitting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Sending...
                </>
              ) : "Continue"}
            </Button>
            <Button type="button" variant="outline-secondary"
              disabled={isSubmitting || successMessage !== null}
              onClick={() => navigate("/profile")}>
              Cancel
            </Button>
          </div>
        </Form>
      </div>
    </Container>
  );
};

export default ApproveEmailChange;






