

import { useState } from "react";

import {
  useForm,
} from "react-hook-form";

import {
  zodResolver,
} from "@hookform/resolvers/zod";

import {
  z,
} from "zod";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";

import {
  useAuth,
} from "@/context/AuthContext";

import type {
  LoginResponse,
} from "@/types/user";


const schema = z.object({
  email: z
    .string()
    .trim()
    .email(
      "Please enter a valid email address"
    ),

  password: z
    .string()
    .min(
      1,
      "Password is required"
    ),
});


type FormData = z.infer<typeof schema>;


const Login = () => {
  const navigate = useNavigate();

  const {
    user,
    isLoading: authLoading,
  } = useAuth();


  const [
    serverError,
    setServerError,
  ] = useState<string | null>(null);


  const [
    successMessage,
    setSuccessMessage,
  ] = useState<string | null>(null);


  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });


  /*
   * Wait for authentication state.
   */
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">
          Loading...
        </p>
      </Container>
    );
  }


  /*
   * Already logged in.
   */
  if (user) {
    navigate("/profile", {
      replace: true,
    });

    return null;
  }


  const onSubmit = async (
    data: FormData
  ) => {

    setServerError(null);
    setSuccessMessage(null);


    try {

      const response =
        await api.post<LoginResponse>(
          "/login",
          {
            email: data.email
              .trim()
              .toLowerCase(),

            password: data.password,
          }
        );


      setSuccessMessage(
        response.data.message ||
          "OTP sent to your email."
      );


      window.setTimeout(() => {

        navigate("/login/verify", {
          replace: true,

          state: {
            email: response.data.email,

            login_token:
              response.data.login_token,
          },
        });

      }, 1200);


    } catch (error: unknown) {

      if (axios.isAxiosError(error)) {

        const status =
          error.response?.status;

        const detail =
          error.response?.data?.detail;


        /*
         * FastAPI validation errors.
         */
        if (
          status === 422 &&
          Array.isArray(detail)
        ) {

          detail.forEach((item: unknown) => {

            if (
              typeof item !== "object" ||
              item === null
            ) {
              return;
            }

            const validationError =
              item as {
                loc?: unknown[];
                msg?: string;
              };


            const field =
              validationError.loc?.[
                validationError.loc.length - 1
              ];


            if (
              (field === "email" ||
                field === "password") &&
              validationError.msg
            ) {

              setError(
                field,
                {
                  type: "server",
                  message:
                    validationError.msg,
                }
              );
            }

          });

          return;
        }


        /*
         * Already logged in.
         */
        if (status === 403) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Already logged in."
          );


          window.setTimeout(() => {
            navigate("/profile", {
              replace: true,
            });
          }, 2000);

          return;
        }


        /*
         * Invalid credentials.
         */
        if (status === 401) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Invalid credentials."
          );

          return;
        }


        /*
         * Rate limit.
         */
        if (status === 429) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Too many login attempts. Please try again later."
          );

          return;
        }


        /*
         * Other HTTPException.
         */
        if (typeof detail === "string") {
          setServerError(detail);
          return;
        }


        setServerError(
          "Login failed. Please try again."
        );

        return;
      }


      setServerError(
        "An unexpected error occurred."
      );
    }
  };


  return (
    <Container
      className="py-5"
      style={{ maxWidth: 480 }}
    >
      <div className="bg-white p-4 rounded shadow-sm">

        <h1 className="h3 text-center mb-4">
          Welcome Back
        </h1>


        {successMessage && (
          <Alert
            variant="success"
            className="text-center"
          >
            {successMessage}

            <div className="small mt-1">
              Redirecting to verification...
            </div>
          </Alert>
        )}


        {serverError && (
          <Alert
            variant="danger"
            className="text-center"
          >
            {serverError}

            {serverError
              .toLowerCase()
              .includes("already logged") && (
              <div className="small mt-1">
                Redirecting to profile...
              </div>
            )}
          </Alert>
        )}


        <Form
          onSubmit={handleSubmit(onSubmit)}
        >

          <Form.Group
            className="mb-3"
            controlId="email"
          >

            <Form.Label>
              Email
            </Form.Label>

            <Form.Control
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              isInvalid={!!errors.email}
              {...register("email")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>

          </Form.Group>


          <Form.Group
            className="mb-4"
            controlId="password"
          >

            <Form.Label>
              Password
            </Form.Label>

            <Form.Control
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
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
            disabled={
              isSubmitting ||
              successMessage !== null
            }
          >
            {isSubmitting
              ? "Checking..."
              : "Continue"}
          </Button>

        </Form>


        <p className="text-center mt-4 mb-0">
          Don't have an account?{" "}

          <Link to="/register">
            Register
          </Link>
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
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

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

  const {
    user,
    login,
    isLoading: authLoading,
  } = useAuth();

  const [serverError, setServerError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);


  // ===========================================================
  // GET LOGIN DATA FROM ROUTER STATE
  // ===========================================================

  const {
    email,
    login_token,
  } = (location.state || {}) as {
    email?: string;
    login_token?: string;
  };


  // ===========================================================
  // FORM
  // ===========================================================

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


  // ===========================================================
  // AUTH LOADING
  // ===========================================================

  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <p className="text-muted">
          Loading...
        </p>
      </Container>
    );
  }


  // ===========================================================
  // ALREADY LOGGED IN
  // ===========================================================

  if (user) {
    navigate(
      "/profile",
      { replace: true }
    );

    return null;
  }


  // ===========================================================
  // MISSING LOGIN SESSION
  // ===========================================================

  if (!email || !login_token) {
    navigate(
      "/login",
      { replace: true }
    );

    return null;
  }


  // ===========================================================
  // SUBMIT OTP
  // ===========================================================

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {

      // -------------------------------------------------------
      // Send OTP to backend
      // -------------------------------------------------------

      const response =
        await api.post<VerifyLoginResponse>(
          "/login/verify",
          {
            email,
            account_token: login_token,
            otp_code: data.otp_code,
          }
        );


      const {
        status,
        message,
      } = response.data;


      // =======================================================
      // DISABLED ACCOUNT
      // =======================================================
      //
      // Backend does NOT create authentication cookies.
      //
      // Redirect user to contact-admin.
      // =======================================================

      if (status === "disabled") {

        setServerError(message);

        window.setTimeout(() => {
          navigate(
            "/contact-admin",
            {
              replace: true,
              state: {
                email:
                  response.data.email ??
                  email,
              },
            }
          );
        }, 2000);

        return;
      }


      // =======================================================
      // UNVERIFIED ACCOUNT
      // =======================================================
      //
      // Backend does NOT create authentication cookies.
      //
      // Redirect user to verification page.
      // =======================================================

      if (status === "unverified") {

        setServerError(message);

        window.setTimeout(() => {
          navigate(
            "/resend-verification",
            {
              replace: true,
              state: {
                email:
                  response.data.email ??
                  email,

                login_token,
              },
            }
          );
        }, 2000);

        return;
      }


      // =======================================================
      // SUCCESS
      // =======================================================
      //
      // At this point:
      //
      // - OTP was valid
      // - account is verified
      // - account is active
      // - backend created access_token
      // - backend created refresh_token
      // - backend created CSRF token
      //
      // Cookies are already stored by the browser.
      // =======================================================

      if (status === "success") {

        setSuccessMessage(
          message ||
          "Login successful"
        );


        // Refresh AuthContext so it fetches the
        // authenticated user using the new cookie.

        await login();


        window.setTimeout(() => {
          navigate(
            "/profile",
            { replace: true }
          );
        }, 1000);

        return;
      }


      // =======================================================
      // UNEXPECTED SUCCESS RESPONSE
      // =======================================================

      setServerError(
        "Unexpected response from server."
      );

    } catch (error: unknown) {

      // =======================================================
      // AXIOS ERROR
      // =======================================================

      if (axios.isAxiosError(error)) {

        const statusCode =
          error.response?.status;

        const detail =
          error.response?.data?.detail;


        // -----------------------------------------------------
        // Pydantic / FastAPI validation errors
        // -----------------------------------------------------

        if (
          statusCode === 422 &&
          Array.isArray(detail)
        ) {

          const messages = detail
            .map((item: unknown) => {

              if (
                typeof item === "object" &&
                item !== null &&
                "msg" in item
              ) {
                return String(
                  (item as { msg: unknown }).msg
                );
              }

              return null;
            })
            .filter(
              (message): message is string =>
                message !== null
            );


          setServerError(
            messages.length > 0
              ? messages.join(", ")
              : "Invalid input."
          );

          return;
        }


        // -----------------------------------------------------
        // Session expired / invalid
        // -----------------------------------------------------

        if (statusCode === 400) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Session expired or invalid."
          );


          window.setTimeout(() => {
            navigate(
              "/login",
              { replace: true }
            );
          }, 2000);

          return;
        }


        // -----------------------------------------------------
        // Invalid / expired OTP
        // -----------------------------------------------------
        //
        // IMPORTANT:
        // Stay on this page so user can enter another OTP.
        // -----------------------------------------------------

        if (statusCode === 401) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "OTP expired or invalid."
          );

          return;
        }


        // -----------------------------------------------------
        // Already logged in
        // -----------------------------------------------------

        if (statusCode === 403) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Already logged in."
          );


          window.setTimeout(() => {
            navigate(
              "/profile",
              { replace: true }
            );
          }, 2000);

          return;
        }


        // -----------------------------------------------------
        // Any other backend error
        // -----------------------------------------------------

        setServerError(
          typeof detail === "string"
            ? detail
            : "Verification failed."
        );

        return;
      }


      // =======================================================
      // NON-AXIOS ERROR
      // =======================================================

      setServerError(
        "An unexpected error occurred."
      );
    }
  };


  // ===========================================================
  // UI
  // ===========================================================

  return (
    <Container
      className="py-5"
      style={{ maxWidth: 480 }}
    >
      <div className="bg-white p-4 rounded shadow-sm">

        {/* =====================================================
            TITLE
        ===================================================== */}

        <h1 className="h3 text-center mb-2">
          Verify Login
        </h1>


        {/* =====================================================
            EMAIL INFORMATION
        ===================================================== */}

        <p className="text-muted text-center mb-4">
          We sent a 6-digit verification code to:
          <br />

          <strong>
            {email}
          </strong>
        </p>


        {/* =====================================================
            SUCCESS
        ===================================================== */}

        {successMessage && (
          <Alert
            variant="success"
            className="text-center"
          >
            {successMessage}

            <div className="small mt-1">
              Redirecting to your profile...
            </div>
          </Alert>
        )}


        {/* =====================================================
            SERVER ERROR
        ===================================================== */}

        {serverError && (
          <Alert
            variant="danger"
            className="text-center"
          >
            {serverError}

            {serverError
              .toLowerCase()
              .includes("suspended") && (
              <div className="small mt-1">
                Redirecting to contact admin...
              </div>
            )}

            {serverError
              .toLowerCase()
              .includes("not verified") && (
              <div className="small mt-1">
                Redirecting to verification...
              </div>
            )}
          </Alert>
        )}


        {/* =====================================================
            FORM
        ===================================================== */}

        <Form
          onSubmit={handleSubmit(onSubmit)}
        >

          {/* ===================================================
              OTP
          =================================================== */}

          <Form.Group
            className="mb-4"
            controlId="otp_code"
          >

            <Form.Label>
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
              isInvalid={
                !!errors.otp_code
              }
              {...register("otp_code")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.otp_code?.message}
            </Form.Control.Feedback>

            <Form.Text className="text-muted">
              Enter the 6-digit code sent to your email.
            </Form.Text>

          </Form.Group>


          {/* ===================================================
              SUBMIT
          =================================================== */}

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={
              isSubmitting ||
              successMessage !== null
            }
          >
            {isSubmitting
              ? "Verifying..."
              : "Verify & Login"}
          </Button>

        </Form>


        {/* =====================================================
            BACK TO LOGIN
        ===================================================== */}

        <div className="text-center mt-4">

          <Button
            variant="link"
            className="text-decoration-none"
            disabled={
              isSubmitting ||
              successMessage !== null
            }
            onClick={() =>
              navigate(
                "/login",
                { replace: true }
              )
            }
          >
            Back to Login
          </Button>

        </div>

      </div>
    </Container>
  );
};


export default VerifyLogin;


