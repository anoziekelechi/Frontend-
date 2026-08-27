
// src/lib/handleApiError.ts
import axios from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";

export type ApiErrorCode =
  | "account_suspended"
  | "account_unverified"
  | "no_permission"
  | "wrong_permission"
  | "no_country_scope"
  | "wrong_country_scope"
  | "not_admin";

interface HandleApiErrorOptions<T extends FieldValues> {
  navigate: NavigateFunction;
  setError?: UseFormSetError<T>;
  validFields?: readonly string[];
  messages?: Partial<Record<400 | 401 | 403 | 404 | 409 | 422 | "default", string>>;
  redirectOnAuth?: boolean;
  redirectOnForbidden?: boolean;
  redirectDelay?: number;
  errorCodeRedirects?: Partial<Record<ApiErrorCode, string>>;
}

const DEFAULT_ERROR_CODE_REDIRECTS: Partial<Record<ApiErrorCode, string>> = {
  account_suspended: "/account-suspended",
  account_unverified: "/verify-email",
};

export function handleApiError<T extends FieldValues>(
  err: unknown,
  opts: HandleApiErrorOptions<T>
): string | null {
  const {
    navigate,
    setError,
    validFields,
    messages = {},
    redirectOnAuth = true,
    redirectOnForbidden = true,
    redirectDelay = 2000,
    errorCodeRedirects = {},
  } = opts;

  if (axios.isCancel(err)) return null;

  if (!axios.isAxiosError(err)) {
    return messages.default || "Something went wrong";
  }

  const status = err.response?.status;
  const detail = err.response?.data?.detail;
  const errorCode = err.response?.headers?.["x-error-code"] as ApiErrorCode | undefined;

  switch (status) {
    case 400:
      // e.g. update_country: "At least one field must be provided for update",
      // "No changes detected - all supplied values are identical to the current ones"
      return typeof detail === "string" ? detail : messages[400] || "Invalid request";

    case 401: {
      const msg = typeof detail === "string" ? detail : messages[401] || "Authentication required";
      if (redirectOnAuth) {
        setTimeout(() => navigate("/login", { replace: true }), redirectDelay);
      }
      return msg;
    }

    case 403: {
      const msg =
        typeof detail === "string"
          ? detail
          : messages[403] || "Sorry we couldn't locate the page you are requesting for";

      const overrides = { ...DEFAULT_ERROR_CODE_REDIRECTS, ...errorCodeRedirects };
      const target = errorCode ? overrides[errorCode] : undefined;

      if (target) {
        setTimeout(() => navigate(target, { replace: true }), redirectDelay);
      } else if (redirectOnForbidden) {
        setTimeout(() => navigate("/", { replace: true }), redirectDelay);
      }

      return msg;
    }

    case 404:
      return typeof detail === "string" ? detail : messages[404] || "Not found";

    case 409:
      return typeof detail === "string" ? detail : messages[409] || "Conflict";

    case 422: {
      if (Array.isArray(detail) && setError && validFields) {
        let matched = false;

        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const e = item as { loc?: unknown; msg?: unknown };
          if (!Array.isArray(e.loc)) return;

          const field = e.loc[e.loc.length - 1];
          const message = typeof e.msg === "string" ? e.msg : "Invalid value";

          if (typeof field === "string" && validFields.includes(field)) {
            setError(field as Path<T>, { type: "server", message });
            matched = true;
          }
        });

        if (matched) return "";
      }

      return typeof detail === "string" ? detail : messages[422] || "Invalid data submitted";
    }

    default:
      return typeof detail === "string" ? detail : messages.default || "Something went wrong";
  }
                     }







// src/pages/countries/CountriesList.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryListRead, CountryRead } from "@/types/country";

const CountriesList = () => {
  const { user } = useAuth();
  const [countries, setCountries] = useState<CountryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<CountryListRead>("/home/countries", { signal: controller.signal })
      .then((res) => setCountries(res.data.countries ?? []))
      .catch((err) => {
        if (err.name === "CanceledError") return;
        setError(err.response?.data?.detail || "Failed to load countries");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
        <p className="mt-3 text-muted">Loading countries...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="h3 mb-0">Available Countries</h6>
        {user?.is_admin && (
          <Link to="/add_country" className="btn btn-primary">
            + Add Country
          </Link>
        )}
      </div>

      {countries.length === 0 ? (
        <p className="text-center text-muted py-5">No available country now</p>
      ) : (
        <ListGroup>
          {countries.map((country) => (
            <ListGroup.Item
              key={country.id}
              action
              as={Link}
              to={`/countries/${country.slug}`}
              className="text-center text-info"
            >
              {country.name}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
    </Container>
  );
};

export default CountriesList;





// src/pages/countries/CreateCountry.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { CountryCreate, CreateCountryResponse } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required"),
  currency_code: z.string().length(3, "Currency code must be 3 characters").transform((v) => v.toUpperCase()),
  whatsapp: z.string().optional().or(z.literal("")),
  email_support: z.string().email("Invalid support email").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const CreateCountry = () => {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    setSuccessMessage(null);

    const payload: CountryCreate = {
      name: data.name,
      currency_code: data.currency_code,
      whatsapp: data.whatsapp || undefined,
      email_support: data.email_support || undefined,
    };

    try {
      const res = await api.post<CreateCountryResponse>("/add_country", payload);
      setSuccessMessage(res.data.message);
      setTimeout(() => navigate("/countries"), 1800);
    } catch (err: unknown) {
      const msg = handleApiError<FormValues>(err, {
        navigate,
        setError,
        validFields: Object.keys(schema.shape),
      });
      if (msg === null) return;
      if (msg) setServerError(msg);
    }
  };

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <h6 className="h3 text-center mb-4 fw-bolder text-info">Create Country Form</h6>
      <div className="bg-white p-4 rounded shadow-sm">
        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">Redirecting...</div>
          </Alert>
        )}
        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="countryName">
            <Form.Label>Country Name</Form.Label>
            <Form.Control type="text" isInvalid={!!errors.name} {...register("name")} />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="currencyCode">
            <Form.Label>Currency Code</Form.Label>
            <Form.Control
              type="text"
              maxLength={3}
              className="text-uppercase"
              isInvalid={!!errors.currency_code}
              {...register("currency_code")}
            />
            <Form.Control.Feedback type="invalid">{errors.currency_code?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="whatsapp">
            <Form.Label>WhatsApp</Form.Label>
            <Form.Control type="text" placeholder="Optional" isInvalid={!!errors.whatsapp} {...register("whatsapp")} />
            <Form.Control.Feedback type="invalid">{errors.whatsapp?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="emailSupport">
            <Form.Label>Support Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Optional"
              isInvalid={!!errors.email_support}
              {...register("email_support")}
            />
            <Form.Control.Feedback type="invalid">{errors.email_support?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={isSubmitting || !!successMessage}>
            {isSubmitting ? "Creating..." : "Create Country"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default CreateCountry;



// src/pages/countries/UpdateCountry.tsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useNavigate } from "react-router-dom";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { CountryRead } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required").optional(),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .transform((v) => v.toUpperCase())
    .optional(),
  whatsapp: z.string().optional().or(z.literal("")),
  email_support: z.string().email("Invalid support email").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

const UpdateCountry = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();

    api
      .get<CountryRead>(`/home/${slug}`, { signal: controller.signal })
      .then((res) => {
        reset({
          name: res.data.name,
          currency_code: res.data.currency_code,
          whatsapp: res.data.whatsapp != null ? String(res.data.whatsapp) : "",
          email_support: res.data.email_support || "",
        });
      })
      .catch((err: unknown) => {
        const msg = handleApiError(err, {
          navigate,
          messages: { default: "Failed to load country" },
        });
        if (msg === null) return;
        if (msg) setServerError(msg);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug, reset, navigate]);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    setSuccessMessage(null);

    const payload = {
      name: data.name,
      currency_code: data.currency_code,
      whatsapp: data.whatsapp || undefined,
      email_support: data.email_support || undefined,
    };

    try {
      await api.put(`/home/${slug}`, payload);
      setSuccessMessage("Country updated successfully");
      setTimeout(() => navigate(`/countries/${slug}`), 1500);
    } catch (err: unknown) {
      const msg = handleApiError<FormValues>(err, {
        navigate,
        setError,
        validFields: Object.keys(schema.shape),
        messages: { default: "Failed to update country" },
      });
      if (msg === null) return;
      if (msg) setServerError(msg);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Update Country</h1>

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
          <Form.Group className="mb-3" controlId="name">
            <Form.Label>Country Name</Form.Label>
            <Form.Control type="text" isInvalid={!!errors.name} {...register("name")} />
            <Form.Control.Feedback type="invalid">{errors.name?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="currency_code">
            <Form.Label>Currency Code</Form.Label>
            <Form.Control
              type="text"
              maxLength={3}
              className="text-uppercase"
              isInvalid={!!errors.currency_code}
              {...register("currency_code")}
            />
            <Form.Control.Feedback type="invalid">{errors.currency_code?.message}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="whatsapp">
            <Form.Label>WhatsApp</Form.Label>
            <Form.Control type="text" placeholder="Optional" {...register("whatsapp")} />
          </Form.Group>

          <Form.Group className="mb-4" controlId="email_support">
            <Form.Label>Support Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Optional"
              isInvalid={!!errors.email_support}
              {...register("email_support")}
            />
            <Form.Control.Feedback type="invalid">{errors.email_support?.message}</Form.Control.Feedback>
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={isSubmitting || !!successMessage}>
            {isSubmitting ? "Updating..." : "Update Country"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default UpdateCountry;







// src/pages/countries/CountryDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { CountryRead } from "@/types/country";

const CountryDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [country, setCountry] = useState<CountryRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();

    api
      .get<CountryRead>(`/home/${slug}`, { signal: controller.signal })
      .then((res) => setCountry(res.data))
      .catch((err: unknown) => {
        const msg = handleApiError(err, {
          navigate,
          messages: { default: "Country not found" },
        });
        if (msg === null) return;
        if (msg) setError(msg);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [slug, navigate]);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this country?")) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await api.delete<{ message?: string }>(`/home/${slug}`);
      setMessage(res.data.message || "Country deleted successfully");
      setTimeout(() => navigate("/countries"), 1500);
    } catch (err: unknown) {
      setIsDeleting(false);
      const msg = handleApiError(err, {
        navigate,
        messages: { default: "Failed to delete country" },
      });
      if (msg === null) return;
      if (msg) setError(msg);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
        <Link to="/countries">← Back to Countries</Link>
      </Container>
    );
  }

  if (!country) return null;

  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      {message && (
        <Alert variant="success" className="mb-4">
          {message}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-start mb-4">
        <h1 className="h3 mb-0">{country.name}</h1>

        <div className="d-flex gap-2">
          <Button as={Link} to={`/countries/${country.slug}/edit`} variant="warning">
            Update
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <ListGroup>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Currency Code</strong>
          <span>{country.currency_code}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>WhatsApp</strong>
          <span>{country.whatsapp ?? "Not set"}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Support Email</strong>
          <span>{country.email_support || "Not set"}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Created At</strong>
          <span>{new Date(country.created_at).toLocaleString()}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Updated At</strong>
          <span>
            {new Date(country.updated_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: "UTC",
              timeZoneName: "short",
            })}
          </span>
        </ListGroup.Item>
      </ListGroup>

      <Link to="/countries" className="d-inline-block mt-4">
        ← Back to Countries
      </Link>
    </Container>
  );
};

export default CountryDetail;





    



