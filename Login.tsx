


// src/pages/users/Login.tsx

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import axios from "axios";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { LoginResponse } from "@/types/user";


const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});


type FormData = z.infer<typeof schema>;


const Login = () => {
  const navigate = useNavigate();

  const {
    user,
    isLoading: authLoading,
  } = useAuth();

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
  });


  // -------------------------------------------------------------
  // Authentication loading
  // -------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">
          Loading...
        </p>
      </div>
    );
  }


  // -------------------------------------------------------------
  // Already logged in
  // -------------------------------------------------------------

  if (user) {
    navigate("/profile", {
      replace: true,
    });

    return null;
  }


  // -------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------

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
          },
        );


      setSuccessMessage(
        response.data.message ||
        "OTP sent to your email.",
      );


      // ---------------------------------------------------------
      // Move to OTP page
      // ---------------------------------------------------------

      window.setTimeout(() => {
        navigate(
          "/login/verify",
          {
            state: {
              email: response.data.email,
              login_token:
                response.data.login_token,
            },
          },
        );
      }, 1000);

    } catch (error: unknown) {

      // ---------------------------------------------------------
      // Axios / backend error
      // ---------------------------------------------------------

      if (axios.isAxiosError(error)) {

        const detail =
          error.response?.data?.detail;

        if (typeof detail === "string") {
          setServerError(detail);
          return;
        }

        // Pydantic/FastAPI validation errors
        if (Array.isArray(detail)) {
          setServerError(
            detail
              .map((item: unknown) => {
                if (
                  typeof item === "object" &&
                  item !== null &&
                  "msg" in item
                ) {
                  return String(
                    (item as { msg: unknown }).msg,
                  );
                }

                return "Invalid input";
              })
              .join(", "),
          );

          return;
        }

        setServerError(
          "Login failed. Please try again.",
        );

        return;
      }


      // ---------------------------------------------------------
      // Non-Axios error
      // ---------------------------------------------------------

      setServerError(
        "An unexpected error occurred.",
      );
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">

      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-2xl font-bold text-center mb-6">
          Welcome Back
        </h1>


        {/* -------------------------------------------------------
            SUCCESS
        ------------------------------------------------------- */}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">

            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to OTP verification...
            </p>

          </div>
        )}


        {/* -------------------------------------------------------
            ERROR
        ------------------------------------------------------- */}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}


        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >

          {/* Email */}

          <div>

            <label className="block text-sm font-medium mb-1">
              Email
            </label>

            <input
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

            <label className="block text-sm font-medium mb-1">
              Password
            </label>

            <input
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
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




// src/pages/users/VerifyLogin.tsx

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { VerifyLoginResponse } from "@/types/user";


const schema = z.object({
  otp_code: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(
      /^\d{6}$/,
      "OTP must contain numbers only",
    ),
});


type FormData = z.infer<typeof schema>;


const VerifyLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    login,
    isLoading: authLoading,
  } = useAuth();


  const {
    email,
    login_token,
  } = (location.state || {}) as {
    email?: string;
    login_token?: string;
  };


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
  });


  // -------------------------------------------------------------
  // Authentication loading
  // -------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">
          Loading...
        </p>
      </div>
    );
  }


  // -------------------------------------------------------------
  // Already logged in
  // -------------------------------------------------------------

  if (user) {
    navigate("/profile", {
      replace: true,
    });

    return null;
  }


  // -------------------------------------------------------------
  // Missing login state
  // -------------------------------------------------------------

  if (!email || !login_token) {
    navigate("/login", {
      replace: true,
    });

    return null;
  }


  // -------------------------------------------------------------
  // Submit OTP
  // -------------------------------------------------------------

  const onSubmit = async (data: FormData) => {

    setServerError(null);
    setSuccessMessage(null);


    try {

      const response =
        await api.post<VerifyLoginResponse>(
          "/login/verify",
          {
            email,
            account_token: login_token,
            otp_code: data.otp_code,
          },
        );


      const {
        status,
        message,
      } = response.data;


      // ---------------------------------------------------------
      // Disabled
      // ---------------------------------------------------------

      if (status === "disabled") {

        setServerError(message);

        window.setTimeout(() => {
          navigate(
            "/contact-admin",
            {
              replace: true,
              state: {
                email:
                  response.data.email ||
                  email,
              },
            },
          );
        }, 2000);

        return;
      }


      // ---------------------------------------------------------
      // Unverified
      // ---------------------------------------------------------

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
              },
            },
          );
        }, 2000);

        return;
      }


      // ---------------------------------------------------------
      // Successful login
      // ---------------------------------------------------------

      if (status === "success") {

        setSuccessMessage(
          message || "Login successful",
        );


        // Cookies have already been created
        // by the backend.

        await login();


        window.setTimeout(() => {
          navigate(
            "/profile",
            {
              replace: true,
            },
          );
        }, 1000);

        return;
      }


      // ---------------------------------------------------------
      // Unexpected backend status
      // ---------------------------------------------------------

      setServerError(
        "Unexpected login response.",
      );

    } catch (error: unknown) {

      // ---------------------------------------------------------
      // Axios / backend errors
      // ---------------------------------------------------------

      if (axios.isAxiosError(error)) {

        const responseDetail =
          error.response?.data?.detail;


        // -------------------------------------------------------
        // Pydantic validation errors
        // -------------------------------------------------------

        if (Array.isArray(responseDetail)) {

          setServerError(
            responseDetail
              .map((item: unknown) => {

                if (
                  typeof item === "object" &&
                  item !== null &&
                  "msg" in item
                ) {
                  return String(
                    (item as { msg: unknown }).msg,
                  );
                }

                return "Invalid input";
              })
              .join(", "),
          );

          return;
        }


        // -------------------------------------------------------
        // Normal HTTPException detail
        // -------------------------------------------------------

        if (typeof responseDetail === "string") {

          setServerError(
            responseDetail,
          );


          // Session is no longer valid.
          if (
            error.response?.status === 400
          ) {
            window.setTimeout(() => {
              navigate(
                "/login",
                {
                  replace: true,
                },
              );
            }, 2000);
          }


          // Already authenticated.
          if (
            error.response?.status === 403 &&
            responseDetail
              .toLowerCase()
              .includes("already logged")
          ) {
            window.setTimeout(() => {
              navigate(
                "/profile",
                {
                  replace: true,
                },
              );
            }, 2000);
          }


          return;
        }


        setServerError(
          "Verification failed. Please try again.",
        );

        return;
      }


      // ---------------------------------------------------------
      // Non-Axios error
      // ---------------------------------------------------------

      setServerError(
        "An unexpected error occurred.",
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
          We sent a 6-digit code to
          <br />
          <strong>{email}</strong>
        </p>


        {/* -------------------------------------------------------
            SUCCESS
        ------------------------------------------------------- */}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">

            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to profile...
            </p>

          </div>
        )}


        {/* -------------------------------------------------------
            ERROR
        ------------------------------------------------------- */}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">

            {serverError}

            <p className="text-sm mt-1">
              Please wait...
            </p>

          </div>
        )}


        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >

          <div>

            <input
              {...register("otp_code")}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="000000"
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting
              ? "Verifying..."
              : "Complete Login"}
          </button>

        </form>

      </div>

    </div>
  );
};


export default VerifyLogin;




