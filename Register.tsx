

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

import type { CreateUser, RegisterResponse } from "@/types/user";
import type { CountryListRead } from "@/types/country";


// =============================================================
// VALIDATION — mirrors backend constraints only
// =============================================================

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

  country_id: z.coerce.number().int().positive("Please select a country"),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const Registration = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect payload set before success message; consumed by effect
  const redirectRef = useRef<{ email: string; reg_token: string } | null>(null);

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
      country_id: 0,
    },
  });


  // ---------------------------------------------------------
  // Load countries
  // ---------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    const loadCountries = async () => {
      try {
        setCountriesLoading(true);

        const response = await api.get<CountryListRead>("/countries");

        if (mounted) {
          setCountries(response.data.countries || []);
        }
      } catch (error: unknown) {
        if (!mounted) return;

        setCountries([]);

        // Trust backend detail if available
        if (axios.isAxiosError(error)) {
          const detail = error.response?.data?.detail;
          setServerError(
            typeof detail === "string"
              ? detail
              : "Unable to load countries. Please try again."
          );
        } else {
          setServerError("Unable to load countries. Please try again.");
        }
      } finally {
        if (mounted) setCountriesLoading(false);
      }
    };

    loadCountries();
    return () => {
      mounted = false;
    };
  }, []);


  // ---------------------------------------------------------
  // Cancelable redirect on success
  // ---------------------------------------------------------
  useEffect(() => {
    if (!successMessage) return;

    const payload = redirectRef.current;
    if (!payload) return;

    const id = window.setTimeout(() => {
      navigate("/register/verify", {
        replace: true,
        state: payload,
      });
    }, 1200);

    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ---------------------------------------------------------
  // Auth loading
  // ---------------------------------------------------------
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }


  // ---------------------------------------------------------
  // Already authenticated
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

    try {
      const payload: CreateUser = {
        surname: data.surname.trim(),
        othernames: data.othernames.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        country_id: data.country_id,
      };

      const response = await api.post<RegisterResponse>("/register", payload);

      redirectRef.current = {
        email: response.data.email,
        reg_token: response.data.reg_token,
      };

      // Trust backend message
      setSuccessMessage(response.data.message);

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

          if (typeof field === "string" && v.msg) {
            setError(field as keyof FormData, {
              type: "server",
              message: v.msg,
            });
          }
        });
        return;
      }

      // Everything else: trust backend detail
      setServerError(
        typeof detail === "string"
          ? detail
          : `Registration failed${
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
        <h1 className="h3 text-center mb-4">Create Account</h1>

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
          <Form.Group className="mb-3" controlId="surname">
            <Form.Label>Surname</Form.Label>
            <Form.Control
              type="text"
              autoComplete="family-name"
              isInvalid={!!errors.surname}
              disabled={isSubmitting || successMessage !== null}
              {...register("surname")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.surname?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="othernames">
            <Form.Label>Other Names</Form.Label>
            <Form.Control
              type="text"
              autoComplete="given-name"
              isInvalid={!!errors.othernames}
              disabled={isSubmitting || successMessage !== null}
              {...register("othernames")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.othernames?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              autoComplete="email"
              isInvalid={!!errors.email}
              disabled={isSubmitting || successMessage !== null}
              {...register("email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Password</Form.Label>
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
          </Form.Group>

          <Form.Group className="mb-4" controlId="country_id">
            <Form.Label>Country</Form.Label>
            <Form.Select
              isInvalid={!!errors.country_id}
              disabled={countriesLoading || isSubmitting || successMessage !== null}
              {...register("country_id")}
            >
              <option value={0}>
                {countriesLoading ? "Loading countries..." : "Select country"}
              </option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">
              {errors.country_id?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || countriesLoading || successMessage !== null}
          >
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
import ResendOtp from "@/components/ResendOtp";

import type { VerifyRegistrationResponse } from "@/types/user";


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

const RegisterVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, reg_token } = (location.state || {}) as {
    email?: string;
    reg_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect payload used by effect
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

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
        state: { email },
      });
    }, payload.delayMs);

    return () => window.clearTimeout(id);
  }, [successMessage, serverError, navigate, email]);


  // ---------------------------------------------------------
  // Missing session
  // ---------------------------------------------------------
  if (!email || !reg_token) {
    return <Navigate to="/register" replace />;
  }


  // ---------------------------------------------------------
  // Submit
  // ---------------------------------------------------------
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    try {
      const response = await api.post<VerifyRegistrationResponse>(
        "/register/verify",
        {
          email,
          account_token: reg_token,
          otp_code: data.otp_code,
        }
      );

      setSuccessMessage(response.data.message);

      redirectRef.current = {
        path: "/login",
        delayMs: 1500,
      };

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
            : "Session expired or invalid. Please register again."
        );
        redirectRef.current = {
          path: "/register",
          delayMs: 2000,
        };
        return;
      }

      // 401 — OTP invalid; stay on page and clear input
      if (status === 401) {
        setServerError(
          typeof detail === "string" ? detail : "OTP expired or invalid."
        );
        reset({ otp_code: "" });
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
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify Your Account</h1>

        <p className="text-muted mb-4">
          We sent a 6-digit verification code to
          <br />
          <strong>{email}</strong>
        </p>

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
              disabled={successMessage !== null}
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
            disabled={isSubmitting || successMessage !== null}
          >
            {isSubmitting ? "Verifying..." : "Verify Account"}
          </Button>
        </Form>

        <div className="mt-4 d-flex flex-column gap-3">
          <ResendOtp
            email={email}
            accountToken={reg_token}
            otpType="registration"
            buttonLabel="Resend verification code"
            disabled={successMessage !== null}
            onSessionExpired={() =>
              navigate("/register", { replace: true })
            }
          />

          <Button
            variant="link"
            className="p-0 text-decoration-none"
            disabled={isSubmitting || successMessage !== null}
            onClick={() => navigate("/register", { replace: true })}
          >
            Back to registration
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default RegisterVerify;








