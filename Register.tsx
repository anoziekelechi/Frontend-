

          import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

import type {
  CreateUser,
  RegisterResponse,
} from "@/types/user";

import type {
  CountryListRead,
} from "@/types/country";


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

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),

  country_id: z.coerce
    .number()
    .int()
    .positive("Please select a country"),
});


type FormData = z.infer<typeof schema>;


const Registration = () => {
  const navigate = useNavigate();

  const {
    user,
    isLoading: authLoading,
  } = useAuth();

  const [countries, setCountries] = useState<
    { id: number; name: string }[]
  >([]);

  const [countriesLoading, setCountriesLoading] =
    useState(true);

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


  /*
   * Load countries.
   */
  useEffect(() => {
    let mounted = true;

    const loadCountries = async () => {
      try {
        setCountriesLoading(true);

        const response =
          await api.get<CountryListRead>(
            "/countries"
          );

        if (mounted) {
          setCountries(
            response.data.countries || []
          );
        }

      } catch {
        if (mounted) {
          setCountries([]);
          setServerError(
            "Unable to load countries. Please try again."
          );
        }

      } finally {
        if (mounted) {
          setCountriesLoading(false);
        }
      }
    };

    loadCountries();

    return () => {
      mounted = false;
    };
  }, []);


  /*
   * Authentication loading.
   */
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">
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


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const payload: CreateUser = {
        surname: data.surname.trim(),
        othernames: data.othernames.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        country_id: data.country_id,
      };

      const response =
        await api.post<RegisterResponse>(
          "/register",
          payload
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
      }, 1200);

    } catch (error: unknown) {

      /*
       * Axios/FastAPI error.
       */
      if (axios.isAxiosError(error)) {

        const status =
          error.response?.status;

        const detail =
          error.response?.data?.detail;


        /*
         * FastAPI/Pydantic validation errors.
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
              typeof field === "string" &&
              validationError.msg
            ) {
              setError(
                field as keyof FormData,
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
         * Normal HTTPException.
         */
        if (typeof detail === "string") {
          setServerError(detail);
          return;
        }


        setServerError(
          "Registration failed. Please try again."
        );

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
    <Container
      className="py-5"
      style={{ maxWidth: 480 }}
    >
      <div className="bg-white p-4 rounded shadow-sm">

        <h1 className="h3 text-center mb-4">
          Create Account
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
          </Alert>
        )}


        <Form
          onSubmit={handleSubmit(onSubmit)}
        >

          <Form.Group
            className="mb-3"
            controlId="surname"
          >
            <Form.Label>
              Surname
            </Form.Label>

            <Form.Control
              type="text"
              autoComplete="family-name"
              isInvalid={!!errors.surname}
              {...register("surname")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.surname?.message}
            </Form.Control.Feedback>
          </Form.Group>


          <Form.Group
            className="mb-3"
            controlId="othernames"
          >
            <Form.Label>
              Other Names
            </Form.Label>

            <Form.Control
              type="text"
              autoComplete="given-name"
              isInvalid={!!errors.othernames}
              {...register("othernames")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.othernames?.message}
            </Form.Control.Feedback>
          </Form.Group>


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
              isInvalid={!!errors.email}
              {...register("email")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.email?.message}
            </Form.Control.Feedback>
          </Form.Group>


          <Form.Group
            className="mb-3"
            controlId="password"
          >
            <Form.Label>
              Password
            </Form.Label>

            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.password}
              {...register("password")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.password?.message}
            </Form.Control.Feedback>
          </Form.Group>


          <Form.Group
            className="mb-4"
            controlId="country_id"
          >
            <Form.Label>
              Country
            </Form.Label>

            <Form.Select
              isInvalid={!!errors.country_id}
              disabled={countriesLoading}
              {...register("country_id")}
            >
              <option value={0}>
                {countriesLoading
                  ? "Loading countries..."
                  : "Select country"}
              </option>

              {countries.map((country) => (
                <option
                  key={country.id}
                  value={country.id}
                >
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
            disabled={
              isSubmitting ||
              countriesLoading ||
              successMessage !== null
            }
          >
            {isSubmitting
              ? "Creating..."
              : "Register"}
          </Button>

        </Form>


        <p className="text-center mt-4 mb-0 small">
          Already have an account?{" "}

          <Link to="/login">
            Login
          </Link>
        </p>

      </div>
    </Container>
  );
};


export default Registration;









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


const RegisterVerify = () => {
  const navigate = useNavigate();
  const location = useLocation();


  const {
    email,
    reg_token,
  } = (location.state || {}) as {
    email?: string;
    reg_token?: string;
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
   * User arrived here without
   * registration session data.
   */
  if (!email || !reg_token) {
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
        await api.post(
          "/register/verify",
          {
            email,
            account_token: reg_token,
            otp_code: data.otp_code,
          }
        );


      /*
       * Registration verification
       * normally returns ReadUser.
       *
       * We don't need the returned user
       * here because registration has
       * not created an authentication
       * session.
       */
      setSuccessMessage(
        response.data?.message ||
          "Account verified successfully."
      );


      window.setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            email,
          },
        });
      }, 1500);


    } catch (error: unknown) {

      if (axios.isAxiosError(error)) {

        const detail =
          error.response?.data?.detail;


        /*
         * FastAPI validation error.
         */
        if (
          error.response?.status === 422 &&
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
         * HTTPException detail.
         */
        if (typeof detail === "string") {
          setServerError(detail);
          return;
        }


        setServerError(
          "Verification failed. Please try again."
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
          Verify Your Account
        </h1>

        <p className="text-muted mb-4">
          We sent a 6-digit verification code to
          <br />
          <strong>{email}</strong>
        </p>


        {successMessage && (
          <Alert variant="success">
            {successMessage}

            <div className="small mt-1">
              Redirecting to login...
            </div>
          </Alert>
        )}


        {serverError && (
          <Alert variant="danger">
            {serverError}
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
              Verification Code
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
              : "Verify Account"}
          </Button>

        </Form>


        <div className="mt-4 small">
          <Button
            variant="link"
            onClick={() =>
              navigate("/register")
            }
          >
            Back to registration
          </Button>
        </div>

      </div>
    </Container>
  );
};


export default RegisterVerify;












