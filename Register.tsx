


import { useState } from "react";
import {
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import { z } from "zod";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import axios from "axios";

import api from "@/api/client";

import type {
  RegisterResponse,
} from "@/types/user/register";

const schema = z.object({
  surname: z
    .string()
    .trim()
    .min(1, "Surname is required")
    .max(100, "Surname is too long"),

  othernames: z
    .string()
    .trim()
    .min(1, "Other names are required")
    .max(150, "Other names are too long"),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),

  password: z
    .string()
    .min(
      8,
      "Password must be at least 8 characters"
    ),

  country_id: z.coerce
    .number()
    .int()
    .positive("Please select a country"),
});

type FormData = z.infer<typeof schema>;

const Register = () => {
  const navigate = useNavigate();

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

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response =
        await api.post<RegisterResponse>(
          "/register",
          {
            surname: data.surname.trim(),
            othernames: data.othernames.trim(),
            email: data.email.trim(),
            password: data.password,
            country_id: data.country_id,
          }
        );

      setSuccessMessage(
        response.data.message ||
          "OTP sent to your email."
      );

      window.setTimeout(() => {
        navigate("/register/verify", {
          replace: true,
          state: {
            email: response.data.email,
            reg_token: response.data.reg_token,
          },
        });
      }, 1000);

    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const detail =
          error.response?.data?.detail;

        setServerError(
          typeof detail === "string"
            ? detail
            : "Registration failed."
        );

        return;
      }

      setServerError(
        "An unexpected error occurred."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">

        <h1 className="text-2xl font-bold text-center mb-6">
          Create Account
        </h1>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to verification...
            </p>
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >

          {/* Surname */}
          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium mb-1"
            >
              Surname
            </label>

            <input
              id="surname"
              type="text"
              autoComplete="family-name"
              {...register("surname")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.surname
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />

            {errors.surname && (
              <p className="text-sm text-red-600 mt-1">
                {errors.surname.message}
              </p>
            )}
          </div>

          {/* Other names */}
          <div>
            <label
              htmlFor="othernames"
              className="block text-sm font-medium mb-1"
            >
              Other Names
            </label>

            <input
              id="othernames"
              type="text"
              autoComplete="given-name"
              {...register("othernames")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.othernames
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />

            {errors.othernames && (
              <p className="text-sm text-red-600 mt-1">
                {errors.othernames.message}
              </p>
            )}
          </div>

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
              autoComplete="new-password"
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

          {/* Country */}
          <div>
            <label
              htmlFor="country_id"
              className="block text-sm font-medium mb-1"
            >
              Country
            </label>

            <select
              id="country_id"
              {...register("country_id")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.country_id
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            >
              <option value="">
                Select country
              </option>

              {/* Populate this from your country API */}
            </select>

            {errors.country_id && (
              <p className="text-sm text-red-600 mt-1">
                {errors.country_id.message}
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
              ? "Creating account..."
              : "Create Account"}
          </button>

        </form>

        <p className="text-center mt-6 text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-blue-600 font-medium"
          >
            Login
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Register;



//verify registration 

import { useState } from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import { z } from "zod";

import axios from "axios";

import api from "@/api/client";

import type {
  VerifyRegistrationResponse,
} from "@/types/user/register";

const schema = z.object({
  otp_code: z
    .string()
    .length(
      6,
      "OTP must be exactly 6 digits"
    )
    .regex(
      /^\d{6}$/,
      "OTP must contain numbers only"
    ),
});

type FormData = z.infer<typeof schema>;

interface RegistrationVerificationState {
  email?: string;
  reg_token?: string;
}

const VerifyRegistration = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const state =
    (location.state || {}) as RegistrationVerificationState;

  const email = state.email;
  const regToken = state.reg_token;

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

  /*
   * Prevent direct access without registration flow.
   */
  if (!email || !regToken) {
    navigate("/register", {
      replace: true,
    });

    return null;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response =
        await api.post<VerifyRegistrationResponse>(
          "/register/verify",
          {
            email,
            account_token: regToken,
            otp_code: data.otp_code,
          }
        );

      setSuccessMessage(
        "Account verified successfully."
      );

      /*
       * Account has now been verified.
       * Send the user to login rather than
       * automatically creating authentication
       * cookies.
       */
      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            email:
              response.data.email || email,
          },
        });
      }, 1200);

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
         * Invalid OTP.
         */
        if (status === 401) {
          setServerError(message);
          return;
        }

        /*
         * Session expired or invalid.
         */
        if (status === 400) {
          setServerError(message);

          window.setTimeout(() => {
            navigate("/register", {
              replace: true,
            });
          }, 2000);

          return;
        }

        /*
         * Already verified.
         */
        if (status === 409) {
          setServerError(message);

          window.setTimeout(() => {
            navigate("/login", {
              replace: true,
            });
          }, 2000);

          return;
        }

        /*
         * Any other backend error.
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
          Verify Your Account
        </h1>

        <p className="text-gray-600 mb-6">
          We sent a 6-digit verification code to
          <br />
          <strong>{email}</strong>
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {successMessage}

            <p className="text-sm mt-1">
              Redirecting to login...
            </p>
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {serverError}
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting
              ? "Verifying..."
              : "Verify Account"}
          </button>

        </form>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() =>
            navigate("/register", {
              replace: true,
            })
          }
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to registration
        </button>

      </div>
    </div>
  );
};

export default VerifyRegistration;

          
