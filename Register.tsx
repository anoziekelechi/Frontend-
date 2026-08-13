


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



// src/pages/users/Login.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { LoginRequest, LoginResponse } from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// Form data matches LoginRequest
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading...</p>
      </div>
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
        setTimeout(() => {
          navigate("/profile", { replace: true });
        }, 2000);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome Back</h1>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting to OTP page...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
            {serverError.toLowerCase().includes("already logged") && (
              <p className="text-sm mt-1">Redirecting to profile...</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              {...register("password")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.password ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.password && (
              <p className="text-sm text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          No account?{" "}
          <Link to="/register" className="text-blue-600 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;







// src/pages/users/VerifyLogin.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Already logged in
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

      // Disabled account
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

      // Unverified account
      if (status === "unverified") {
        setServerError(message);
        setTimeout(() => {
          navigate("/resend-verification", {
            replace: true,
            state: {
              email: res.data.email || email,
              login_token,
            },
          });
        }, 2000);
        return;
      }

      // Success
      if (status === "success") {
        setSuccessMessage(message); // "Login successful"
        login(); // refresh auth context (cookies already set)

        setTimeout(() => {
          navigate("/profile", { replace: true });
        }, 1500);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      // Already logged in
      if (status === 403) {
        setServerError(detail || "Already logged in. Please logout first.");
        setTimeout(() => {
          navigate("/profile", { replace: true });
        }, 2000);
        return;
      }

      // Invalid credentials / invalid OTP
      if (status === 401) {
        setServerError(detail || "Invalid credentials");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
        return;
      }

      // Session expired
      if (status === 400) {
        setServerError(detail || "Session expired or invalid");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2000);
        return;
      }

      setServerError(detail || "Verification failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Enter Login Code</h1>
        <p className="text-gray-600 mb-6">
          We sent a 6-digit code to
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}
            <p className="text-sm mt-1">Redirecting to profile...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {serverError}
            <p className="text-sm mt-1">Redirecting...</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <input
              {...register("otp_code")}
              maxLength={6}
              autoFocus
              placeholder="000000"
              className={`w-full px-4 py-4 text-center text-3xl tracking-widest font-mono border rounded-lg ${
                errors.otp_code ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.otp_code && (
              <p className="text-sm text-red-600 mt-2">{errors.otp_code.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Verifying..." : "Complete Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyLogin;
