# WhatsApp (now unique)
if data.whatsapp is not None and data.whatsapp != country.whatsapp:
    existing_whatsapp = (
        await db.execute(
            select(Country).where(Country.whatsapp == data.whatsapp)
        )
    ).scalars().first()
    if existing_whatsapp and existing_whatsapp.id != country_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"WhatsApp number '{data.whatsapp}' is already assigned to '{existing_whatsapp.name}'",
        )
    country.whatsapp = data.whatsapp
    updated_fields.append("whatsapp")

# Support email (now unique)
if data.email_support is not None and data.email_support != country.email_support:
    existing_email = (
        await db.execute(
            select(Country).where(Country.email_support == data.email_support)
        )
    ).scalars().first()
    if existing_email and existing_email.id != country_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Support email '{data.email_support}' is already assigned to '{existing_email.name}'",
        )
    country.email_support = data.email_support
    updated_fields.append("email_support")


export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  email: string;
  login_token: string;
}

export interface VerifyLoginResponse {
  status: "success" | "disabled" | "unverified";
  message: string;
  email?: string;
}


export interface CreateUser {
  surname: string;
  othernames: string;
  email: string;
  password: string;
  country_id: number;
}

export interface RegisterResponse {
  message: string;
  email: string;
  reg_token: string;
}

export interface VerifyOtpRequest {
  email: string;
  account_token: string;
  otp_code: string;
}



// src/pages/users/Registration.tsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CreateUser, RegisterResponse } from "@/types/user";
import type { CountryListRead } from "@/types/country";

const schema = z.object({
  surname: z.string().min(2, "Surname is required"),
  othernames: z.string().min(2, "Other names are required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  country_id: z.coerce.number().min(1, "Country is required"),
});

type FormData = CreateUser;

const Registration = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countries, setCountries] = useState<{ id: number; name: string }[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    api
      .get<CountryListRead>("/countries")
      .then((res) => setCountries(res.data.countries || []))
      .catch(() => setCountries([]));
  }, []);

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }

  if (user) {
    navigate("/profile", { replace: true });
    return null;
  }

  const onSubmit = async (data: CreateUser) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<RegisterResponse>("/register", data);
      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/register/verify", {
          state: {
            email: res.data.email,
            reg_token: res.data.reg_token,
          },
        });
      }, 1500);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 403) {
        setServerError(detail || "Logged in user cannot create account");
        setTimeout(() => navigate("/profile", { replace: true }), 2000);
        return;
      }

      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((e: any) => {
          const field = e.loc?.[e.loc.length - 1];
          if (typeof field === "string") {
            setError(field as keyof FormData, { message: e.msg });
          }
        });
      } else {
        setServerError(detail || "Registration failed");
      }
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

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="surname">
            <Form.Label>Surname</Form.Label>
            <Form.Control
              type="text"
              isInvalid={!!errors.surname}
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
              isInvalid={!!errors.othernames}
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
              isInvalid={!!errors.email}
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
              isInvalid={!!errors.password}
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
              {...register("country_id")}
              defaultValue=""
            >
              <option value="" disabled>
                Select country
              </option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Creating..." : "Register"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>
      </div>
    </Container>
  );
};

export default Registration;



// src/pages/users/VerifyRegistration.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import type { User } from "@/types/user";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numbers only"),
});

type FormData = z.infer<typeof schema>;

const VerifyRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { email, reg_token } = (location.state || {}) as {
    email?: string;
    reg_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (!email || !reg_token) {
    navigate("/register", { replace: true });
    return null;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      await api.post<User>("/register/verify", {
        email,
        account_token: reg_token,
        otp_code: data.otp_code,
      });

      setSuccessMessage(
        "Your account has been verified successfully. You can now log in."
      );
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "Invalid or expired OTP";

      if (status === 409) {
        setServerError(detail);
        setTimeout(() => navigate("/profile", { replace: true }), 2000);
        return;
      }

      setServerError(detail);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Verify Your Email</h1>
        <p className="text-muted mb-4">
          We sent a 6-digit code to
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

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-4" controlId="otp_code">
            <Form.Control
              type="text"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="text-center fs-3 letter-spacing-2"
              isInvalid={!!errors.otp_code}
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
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Verifying..." : "Verify Account"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default VerifyRegistration;






// src/pages/users/Login.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { LoginRequest, LoginResponse } from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = LoginRequest;

const Login = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }

  if (user) {
    navigate("/profile", { replace: true });
    return null;
  }

  const onSubmit = async (data: LoginRequest) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<LoginResponse>("/login", data);
      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/login/verify", {
          state: {
            email: res.data.email,
            login_token: res.data.login_token,
          },
        });
      }, 1200);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 403) {
        setServerError(detail || "Already logged in");
        setTimeout(() => navigate("/profile", { replace: true }), 2000);
        return;
      }

      if (status === 401) {
        setServerError(detail || "Invalid credentials");
        return;
      }

      if (status === 429) {
        setServerError(detail || "Too many login attempts");
        return;
      }

      setServerError(detail || "Login failed");
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Welcome Back</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting to OTP page...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              isInvalid={!!errors.email}
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
              isInvalid={!!errors.password}
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
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </Container>
  );
};

export default Login;





// src/pages/users/VerifyLogin.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { VerifyLoginResponse } from "@/types/user";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numbers only"),
});

type FormData = z.infer<typeof schema>;

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, isLoading: authLoading } = useAuth();

  const { email, login_token } = (location.state || {}) as {
    email?: string;
    login_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">Loading...</p>
      </Container>
    );
  }

  if (user) {
    navigate("/profile", { replace: true });
    return null;
  }

  if (!email || !login_token) {
    navigate("/login", { replace: true });
    return null;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<VerifyLoginResponse>("/login/verify", {
        email,
        account_token: login_token,
        otp_code: data.otp_code,
      });

      const { status, message } = res.data;

      if (status === "disabled") {
        setServerError(message);
        setTimeout(() => {
          navigate("/contact-admin", {
            replace: true,
            state: { email: res.data.email || email },
          });
        }, 2000);
        return;
      }

      if (status === "unverified") {
        setServerError(message);
        setTimeout(() => {
          navigate("/resend-verification", {
            replace: true,
            state: { email: res.data.email || email, login_token },
          });
        }, 2000);
        return;
      }

      if (status === "success") {
        setSuccessMessage(message);
        login();
        setTimeout(() => navigate("/profile", { replace: true }), 1500);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 403) {
        setServerError(detail || "Already logged in. Please logout first.");
        setTimeout(() => navigate("/profile", { replace: true }), 2000);
        return;
      }

      if (status === 401 || status === 400) {
        setServerError(detail || "Invalid credentials");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
        return;
      }

      setServerError(detail || "Verification failed");
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm text-center">
        <h1 className="h3 mb-2">Enter Login Code</h1>
        <p className="text-muted mb-4">
          We sent a 6-digit code to
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting to profile...</div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger">
            {serverError}
            <div className="small mt-1">Redirecting...</div>
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-4" controlId="otp_code">
            <Form.Control
              type="text"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="text-center fs-3"
              isInvalid={!!errors.otp_code}
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
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Verifying..." : "Complete Login"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default VerifyLogin;




// src/pages/users/ContactAdmin.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import type { ContactAdminMessage, ContactAdminResponse } from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message is too long"),
});

type FormData = ContactAdminMessage;

const ContactAdmin = () => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ContactAdminMessage) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<ContactAdminResponse>("/contact-admin", data);
      setSuccessMessage(res.data.message || "Message sent to admin");
      reset();
    } catch (err: any) {
      setServerError(
        err.response?.data?.detail || "Failed to send message"
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-2">Contact Admin</h1>
        <p className="text-center text-muted small mb-4">
          Your account appears to be suspended. Send a message to request
          reactivation.
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="your@email.com"
              isInvalid={!!errors.email}
              {...register("email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="message">
            <Form.Label>Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={5}
              placeholder="Explain why your account should be reactivated..."
              isInvalid={!!errors.message}
              {...register("message")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.message?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Send Message"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </Container>
  );
};

export default ContactAdmin;





// src/pages/users/ResendOtp.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import type {
  ResendVerificationRequest,
  ResendVerificationResponse,
} from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  account_token: z.string().min(1, "Account token is required"),
});

type FormData = ResendVerificationRequest;

const ResendOtp = () => {
  const location = useLocation();
  const state = (location.state || {}) as {
    email?: string;
    account_token?: string;
    login_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: state.email || "",
      account_token: state.account_token || state.login_token || "",
    },
  });

  const onSubmit = async (data: ResendVerificationRequest) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<ResendVerificationResponse>(
        "/resend-verification",
        data
      );
      setSuccessMessage(res.data.message || "Verification OTP sent");
    } catch (err: any) {
      setServerError(
        err.response?.data?.detail || "Failed to resend verification OTP"
      );
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-2">Resend Verification</h1>
        <p className="text-center text-muted small mb-4">
          Your account is not verified. Request a new verification code.
        </p>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              isInvalid={!!errors.email}
              {...register("email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="account_token">
            <Form.Label>Account Token</Form.Label>
            <Form.Control
              type="text"
              placeholder="From login response"
              isInvalid={!!errors.account_token}
              {...register("account_token")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.account_token?.message}
            </Form.Control.Feedback>
            <Form.Text muted>
              Required by backend to prevent abuse. Use the token from login if
              available.
            </Form.Text>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Resend Verification OTP"}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </Container>
  );
};

export default ResendOtp;



          
