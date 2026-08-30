

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

import {
  z,
} from "zod";

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
  VerifyLoginResponse,
} from "@/types/user";


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
   * Already authenticated.
   */
  if (user) {
    navigate("/profile", {
      replace: true,
    });

    return null;
  }


  /*
   * Verification page requires
   * both values returned by login.
   */
  if (!email || !login_token) {
    navigate("/login", {
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


      /*
       * Disabled account.
       *
       * Your backend intentionally
       * allows the OTP verification
       * to complete but does not issue
       * authentication cookies.
       */
      if (status === "disabled") {

        setServerError(message);

        window.setTimeout(() => {

          navigate("/contact-admin", {
            replace: true,

            state: {
              email:
                response.data.email ||
                email,
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

                login_token,
              },
            }
          );

        }, 2000);

        return;
      }


      /*
       * Successful authentication.
       *
       * Backend has already set:
       *
       * access_token
       * refresh_token
       * csrf_token
       *
       * as cookies.
       */
      if (status === "success") {

        setSuccessMessage(
          message ||
            "Login successful."
        );


        /*
         * Refresh AuthContext so the
         * application loads the newly
         * authenticated user.
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
       * Defensive fallback if backend
       * ever returns an unknown status.
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


        /*
         * FastAPI/Pydantic validation.
         */
        if (
          status === 422 &&
          Array.isArray(detail)
        ) {

          const firstError =
            detail[0];

          const message =
            firstError?.msg;


          setServerError(
            typeof message === "string"
              ? message
              : "Invalid verification data."
          );

          return;
        }


        /*
         * Already authenticated.
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
         * Invalid OTP.
         */
        if (status === 401) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "OTP expired or invalid."
          );

          return;
        }


        /*
         * Expired/invalid login token.
         */
        if (status === 400) {

          setServerError(
            typeof detail === "string"
              ? detail
              : "Session expired or invalid."
          );


          window.setTimeout(() => {

            navigate("/login", {
              replace: true,
            });

          }, 2000);

          return;
        }


        /*
         * Any other HTTPException.
         */
        if (typeof detail === "string") {

          setServerError(detail);
          return;
        }


        setServerError(
          "Login verification failed."
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
      <div className="bg-white p-4 rounded shadow-sm text-center">

        <h1 className="h3 mb-2">
          Enter Login Code
        </h1>


        <p className="text-muted mb-4">
          We sent a 6-digit code to
          <br />
          <strong>{email}</strong>
        </p>


        {successMessage && (
          <Alert variant="success">
            {successMessage}

            <div className="small mt-1">
              Redirecting to profile...
            </div>
          </Alert>
        )}


        {serverError && (
          <Alert variant="danger">
            {serverError}

            <div className="small mt-1">
              Please follow the instructions above.
            </div>
          </Alert>
        )}


        <Form
          onSubmit={handleSubmit(onSubmit)}
        >

          <Form.Group
            className="mb-4"
            controlId="otp_code"
          >

            <Form.Label>
              Login Code
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
              successMessage !== null
            }
          >
            {isSubmitting
              ? "Verifying..."
              : "Complete Login"}
          </Button>

        </Form>


        <div className="mt-4">

          <Button
            variant="link"
            onClick={() =>
              navigate("/login", {
                replace: true,
              })
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



