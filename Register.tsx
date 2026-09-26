//old



// src/pages/Registration.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CreateUser, RegisterResponse, CountryListRead } from "@/types";

const schema = z.object({
  surname: z.string().trim().min(2, "Surname must be at least 2 characters").max(100),
  othernames: z.string().trim().min(2, "Other names must be at least 2 characters").max(150),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  country_id: z.coerce.number().int().positive("Please select a country"),
});

type FormData = z.infer<typeof schema>;

const Registration = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
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
    defaultValues: { surname: "", othernames: "", email: "", password: "", country_id: 0 },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCountriesLoading(true);
        const res = await api.get<CountryListRead>("/countries");
        if (mounted) setCountries(res.data.countries || []);
      } catch (err) {
        if (!mounted) return;
        const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
        setServerError(typeof detail === "string" ? detail : "Unable to load countries.");
        setCountries([]);
      } finally {
        if (mounted) setCountriesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

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
      country_id: data.country_id,
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
          if (typeof field === "string" && v.msg) {
            setError(field as keyof FormData, { type: "server", message: v.msg });
          }
        });
        return;
      }

      setServerError(
        typeof detail === "string"
          ? detail
          : `Registration failed${status ? ` (${status})` : ""}. Please try again.`
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Create Account</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to verification...</div>
          </Alert>
        )}
        {serverError && <Alert variant="danger" className="text-center">{serverError}</Alert>}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="surname">
            <Form.Label>Surname</Form.Label>
            <Form.Control type="text" autoComplete="family-name"
              isInvalid={!!errors.surname} disabled={isSubmitting || successMessage !== null}
              {...register("surname")} />
            <Form.Control.Feedback type="invalid">{errors.surname?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="othernames">
            <Form.Label>Other Names</Form.Label>
            <Form.Control type="text" autoComplete="given-name"
              isInvalid={!!errors.othernames} disabled={isSubmitting || successMessage !== null}
              {...register("othernames")} />
            <Form.Control.Feedback type="invalid">{errors.othernames?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" autoComplete="email"
              isInvalid={!!errors.email} disabled={isSubmitting || successMessage !== null}
              {...register("email")} />
            <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" autoComplete="new-password"
              isInvalid={!!errors.password} disabled={isSubmitting || successMessage !== null}
              {...register("password")} />
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="country_id">
            <Form.Label>Country</Form.Label>
            <Form.Select isInvalid={!!errors.country_id}
              disabled={countriesLoading || isSubmitting || successMessage !== null}
              {...register("country_id")}>
              <option value={0}>{countriesLoading ? "Loading countries..." : "Select country"}</option>
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{errors.country_id?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100"
            disabled={isSubmitting || countriesLoading || successMessage !== null}>
            {isSubmitting ? "Creating..." : "Register"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </Container>
  );
};

export default Registration;
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
