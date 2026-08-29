


import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { LoginResponse } from "@/types/user";

const schema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),

  password: z
    .string()
    .min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const Login = () => {
  const navigate = useNavigate();

  const { user, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  /*
   * Wait for AuthContext to determine whether
   * the user is already authenticated.
   */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  /*
   * Authenticated users should not see login.
   */
  if (user) {
    navigate("/profile", { replace: true });
    return null;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response =
        await api.post<LoginResponse>(
          "/login",
          {
            email: data.email.trim(),
            password: data.password,
          }
        );

      setSuccessMessage(
        response.data.message ||
          "OTP sent to your email."
      );

      /*
       * Pass only the temporary login information
       * needed by the OTP verification page.
       */
      window.setTimeout(() => {
        navigate("/login/verify", {
          replace: true,
          state: {
            email: response.data.email,
            login_token: response.data.login_token,
          },
        });
      }, 1000);

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail;

        const message =
          typeof detail === "string"
            ? detail
            : "Login failed.";

        /*
         * Already authenticated.
         */
        if (status === 403) {
          setServerError(message);

          window.setTimeout(() => {
            navigate("/profile", {
              replace: true,
            });
          }, 1500);

          return;
        }

        /*
         * Invalid email/password.
         */
        if (status === 401) {
          setServerError(message);
          return;
        }

        /*
         * Too many login attempts.
         */
        if (status === 429) {
          setServerError(message);
          return;
        }

        /*
         * Any other HTTPException returned by FastAPI.
         */
        setServerError(message);
        return;
      }

      /*
       * Non-Axios error.
       */
      setServerError(
        "An unexpected error occurred."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-2xl font-bold text-center mb-6">
          Welcome Back
        </h1>

        {/* Success */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to OTP verification...
            </p>
          </div>
        )}

        {/* Error */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}

            {serverError
              .toLowerCase()
              .includes("already logged") && (
              <p className="text-sm mt-1">
                Redirecting to profile...
              </p>
            )}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />

            {errors.email && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.password
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />

            {errors.password && (
              <p className="text-sm text-red-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              successMessage !== null
            }
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "Checking..."
              : "Continue"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          No account?{" "}
          <Link
            to="/register"
            className="text-blue-600 font-medium"
          >
            Register
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Login;





import { useState } from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type {
  VerifyLoginResponse,
} from "@/types/user";

const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(
      /^\d{6}$/,
      "OTP must contain numbers only"
    ),
});

type FormData = z.infer<typeof schema>;

interface LoginVerificationState {
  email?: string;
  login_token?: string;
}

const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    login,
    isLoading: authLoading,
  } = useAuth();

  const state =
    (location.state || {}) as LoginVerificationState;

  const email = state.email;
  const loginToken = state.login_token;

  const [serverError, setServerError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      otp_code: "",
    },
  });

  /*
   * Wait for AuthContext.
   */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  /*
   * Already authenticated.
   */
  if (user) {
    navigate("/profile", {
      replace: true,
    });

    return null;
  }

  /*
   * User cannot directly visit this page without
   * first completing /login.
   */
  if (!email || !loginToken) {
    navigate("/login", {
      replace: true,
    });

    return null;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response =
        await api.post<VerifyLoginResponse>(
          "/login/verify",
          {
            email,
            account_token: loginToken,
            otp_code: data.otp_code,
          }
        );

      const {
        status,
        message,
      } = response.data;

      /*
       * Disabled account.
       *
       * Your backend intentionally allows the user
       * to complete OTP verification before checking
       * the account status.
       */
      if (status === "disabled") {
        setServerError(message);

        window.setTimeout(() => {
          navigate("/contact-admin", {
            replace: true,
            state: {
              email:
                response.data.email || email,
            },
          });
        }, 2000);

        return;
      }

      /*
       * Unverified account.
       */
      if (status === "unverified") {
        setServerError(message);

        window.setTimeout(() => {
          navigate(
            "/resend-verification",
            {
              replace: true,
              state: {
                email:
                  response.data.email ||
                  email,

                login_token: loginToken,
              },
            }
          );
        }, 2000);

        return;
      }

      /*
       * Successful login.
       *
       * Backend has already created:
       * - access_token cookie
       * - refresh_token cookie
       * - csrf_token cookie
       */
      if (status === "success") {
        setSuccessMessage(
          message || "Login successful."
        );

        /*
         * Refresh AuthContext so the application
         * knows that the user is now authenticated.
         */
        await login();

        window.setTimeout(() => {
          navigate("/profile", {
            replace: true,
          });
        }, 1000);

        return;
      }

      /*
       * Defensive fallback.
       */
      setServerError(
        "Unexpected login response."
      );

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const status =
          error.response?.status;

        const detail =
          error.response?.data?.detail;

        const message =
          typeof detail === "string"
            ? detail
            : "Verification failed.";

        /*
         * Already logged in.
         */
        if (status === 403) {
          setServerError(message);

          window.setTimeout(() => {
            navigate("/profile", {
              replace: true,
            });
          }, 1500);

          return;
        }

        /*
         * Invalid OTP.
         */
        if (status === 401) {
          setServerError(message);
          return;
        }

        /*
         * Login session expired.
         */
        if (status === 400) {
          setServerError(message);

          window.setTimeout(() => {
            navigate("/login", {
              replace: true,
            });
          }, 2000);

          return;
        }

        /*
         * Any other FastAPI HTTPException.
         */
        setServerError(message);
        return;
      }

      setServerError(
        "An unexpected error occurred."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">

        <h1 className="text-2xl font-bold mb-2">
          Enter Login Code
        </h1>

        <p className="text-gray-600 mb-6">
          We sent a 6-digit verification code to
          <br />

          <strong>{email}</strong>
        </p>

        {/* Success */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to profile...
            </p>
          </div>
        )}

        {/* Error */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {serverError}

            <p className="text-sm mt-1">
              Redirecting...
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >

          <div>
            <label
              htmlFor="otp_code"
              className="sr-only"
            >
              Verification code
            </label>

            <input
              id="otp_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
              {...register("otp_code")}
              className={`w-full px-4 py-4 text-center text-3xl tracking-widest font-mono border rounded-lg ${
                errors.otp_code
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />

            {errors.otp_code && (
              <p className="text-sm text-red-600 mt-2">
                {errors.otp_code.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              successMessage !== null
            }
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "Verifying..."
              : "Complete Login"}
          </button>

        </form>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() =>
            navigate("/login", {
              replace: true,
            })
          }
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to login
        </button>

      </div>
    </div>
  );
};

export default VerifyLogin;



