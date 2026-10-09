
// src/types/payment/read.ts

export interface PaymentMethodRead {
  id: number;
  country_id: number;
  name: string;
  slug?: string | null;
  created_at: string;
  updated_at: string;
}

/** Payment methods for a single country. */
export interface CountryPaymentMethodsRead {
  country_id: number;
  country_name: string;
  payment_methods: PaymentMethodRead[];
}

/** All payment methods, grouped by country. */
export interface AllPaymentMethodsRead {
  total_countries: number;
  data: CountryPaymentMethodsRead[];
}




// src/types/payment/create.ts

import type { PaymentMethodRead } from "./read";

export interface PaymentMethodCreate {
  country_id: number;
  name: string;
}

export interface CreatePaymentMethodResponse {
  message: string;
  payment_method: PaymentMethodRead;
}


// src/types/payment/update.ts

import type { PaymentMethodRead } from "./read";

export interface PaymentMethodUpdate {
  name?: string;
}

export interface UpdatePaymentMethodResponse {
  message: string;
  payment_method: PaymentMethodRead;
}




// src/types/payment/index.ts

export * from "./read";
export * from "./create";
export * from "./update";



// src/types/index.ts

export * from "./common";
export * from "./user";
export * from "./country";
export * from "./payment";
export * from "./firm";
export * from "./receipt";
export * from "./site";







// src/pages/payment-methods/CreatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { handleApiError } from "@/lib/handleApiError";
import type {
  CountryListRead,
  CountryRead,
  CreatePaymentMethodResponse,
  PaymentMethodCreate,
} from "@/types";


const schema = z.object({
  country_id: z.coerce
    .number()
    .int()
    .positive("Please select a country"),

  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters")
    .max(100, "Payment method name must not exceed 100 characters"),
});

type FormData = z.infer<typeof schema>;


const CreatePaymentMethod = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [countries, setCountries] = useState<CountryRead[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country_id: 0, name: "" },
  });

  // Load countries for the dropdown
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    api
      .get<CountryListRead>("/home/countries", {
        signal: controller.signal,
      })
      .then((res) => {
        if (mounted) setCountries(res.data.countries ?? []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, {
          navigate,
          redirectOnAuth: false,
          redirectOnForbidden: false,
        });
        if (msg) setServerError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted)
          setCountriesLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [navigate]);


  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: PaymentMethodCreate = {
      country_id: data.country_id,
      name: data.name.trim(),
    };

    try {
      const res = await api.post<CreatePaymentMethodResponse>(
        "/payment-methods",
        payload
      );
      setSuccessMessage(res.data.message);
      redirectRef.current = {
        path: `/payment-methods/${res.data.payment_method.slug}`,
        delayMs: 1500,
      };
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: ["country_id", "name"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (msg) setServerError(msg);
    }
  };


  return (
    <Container className="py-5" style={{ maxWidth: 480 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Add Payment Method</h1>

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

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="country_id">
            <Form.Label>Country</Form.Label>
            <Form.Select
              isInvalid={!!errors.country_id}
              disabled={
                countriesLoading ||
                isSubmitting ||
                successMessage !== null
              }
              {...register("country_id")}
            >
              <option value={0}>
                {countriesLoading ? "Loading countries..." : "Select country"}
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

          <Form.Group className="mb-4" controlId="name">
            <Form.Label>Payment Method Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. MOMO LIBERIA"
              isInvalid={!!errors.name}
              disabled={isSubmitting || successMessage !== null}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
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
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Creating...
              </>
            ) : (
              "Create Payment Method"
            )}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to="/payment-methods">← Back to Payment Methods</Link>
        </p>
      </div>
    </Container>
  );
};

export default CreatePaymentMethod;




// src/pages/payment-methods/UpdatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { handleApiError } from "@/lib/handleApiError";
import type {
  PaymentMethodRead,
  PaymentMethodUpdate,
  UpdatePaymentMethodResponse,
} from "@/types";


const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters")
    .max(100, "Payment method name must not exceed 100 characters"),
});

type FormData = z.infer<typeof schema>;


const UpdatePaymentMethod = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const originalNameRef = useRef<string>("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });


  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    let mounted = true;

    api
      .get<PaymentMethodRead>(`/payment-methods/${slug}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!mounted) return;
        originalNameRef.current = res.data.name;
        reset({ name: res.data.name });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, { navigate });
        if (msg) setServerError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug, navigate, reset]);


  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const trimmed = data.name.trim();

    if (trimmed === originalNameRef.current) {
      setServerError("No changes were made");
      return;
    }

    const payload: PaymentMethodUpdate = { name: trimmed };

    try {
      const res = await api.patch<UpdatePaymentMethodResponse>(
        `/payment-methods/${slug}`,
        payload
      );
      setSuccessMessage(res.data.message);
      redirectRef.current = {
        path: `/payment-methods/${res.data.payment_method.slug}`,
        delayMs: 1500,
      };
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: ["name"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
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
        <h1 className="h3 text-center mb-4">Update Payment Method</h1>

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

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="name">
            <Form.Label>Payment Method Name</Form.Label>
            <Form.Control
              type="text"
              isInvalid={!!errors.name}
              disabled={isSubmitting || successMessage !== null}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={
              isSubmitting ||
              !isDirty ||
              successMessage !== null
            }
          >
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Updating...
              </>
            ) : (
              "Update Payment Method"
            )}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to={`/payment-methods/${slug}`}>
            ← Back to Payment Method
          </Link>
        </p>
      </div>
    </Container>
  );
};

export default UpdatePaymentMethod;




// src/lib/handleApiError.ts

import axios from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { NavigateFunction } from "react-router-dom";


// =============================================================================
// ERROR CODES
//
// These mirror the `X-Error-Code` headers the backend sets on 403
// responses. Keep this list in sync with `has_permission` and the
// `X-Error-Code` headers you raise in the service layer.
// =============================================================================

export type ApiErrorCode =
  | "account_suspended"
  | "account_unverified"
  | "firm_suspended"
  | "no_permission"
  | "wrong_permission"
  | "no_country_scope"
  | "wrong_country_scope"
  | "not_admin";


// =============================================================================
// DEFAULT REDIRECT MAP
//
// Where to send the user for each error code when the route does not
// override the target. Every path here must be a public or
// authenticated route — never a route that would immediately bounce
// the user again.
// =============================================================================

const DEFAULT_ERROR_CODE_REDIRECTS: Partial<Record<ApiErrorCode, string>> = {
  account_suspended:   "/contact-admin",
  account_unverified:  "/register/verify",
  firm_suspended:      "/contact-admin",
  wrong_permission:    "/",
  no_permission:       "/",
  no_country_scope:    "/",
  wrong_country_scope: "/",
  not_admin:           "/",
};


// =============================================================================
// OPTIONS
// =============================================================================

interface HandleApiErrorOptions<T extends FieldValues> {
  /** Router navigate function — used for scheduled redirects. */
  navigate: NavigateFunction;

  /**
   * React Hook Form setError — used to map 422 validation errors
   * onto specific form fields.
   */
  setError?: UseFormSetError<T>;

  /**
   * Whitelist of field names for this form. Only fields in this list
   * receive per-field errors from a 422 response. Everything else is
   * ignored. This prevents unrelated fields from being highlighted.
   */
  validFields?: readonly string[];

  /**
   * Optional custom messages, keyed by status code.
   * Use sparingly — most messages should come from the backend.
   */
  messages?: Partial<
    Record<400 | 401 | 403 | 404 | 409 | 422 | "default", string>
  >;

  /** Whether to redirect to /login on 401. Default: true. */
  redirectOnAuth?: boolean;

  /** Whether to redirect on 403 when no error code is present. Default: true. */
  redirectOnForbidden?: boolean;

  /** Milliseconds to wait before redirecting. Default: 2000. */
  redirectDelay?: number;

  /**
   * Override or extend the default error-code redirect map.
   * Merged on top of DEFAULT_ERROR_CODE_REDIRECTS — passing a key
   * replaces the default, other keys remain.
   */
  errorCodeRedirects?: Partial<Record<ApiErrorCode, string>>;
}


// =============================================================================
// HANDLER
// =============================================================================

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

  // ---------------------------------------------------------------
  // Cancelled request — silently ignore, no UI update
  // ---------------------------------------------------------------
  if (axios.isCancel(err)) {
    return null;
  }

  // ---------------------------------------------------------------
  // Non-Axios error — frontend bug, network abort, etc.
  // No backend detail exists. Diagnostic message.
  // ---------------------------------------------------------------
  if (!axios.isAxiosError(err)) {
    return messages.default || "An unexpected error occurred.";
  }

  const status = err.response?.status;
  const detail = err.response?.data?.detail;
  const errorCode = err.response?.headers?.["x-error-code"] as
    | ApiErrorCode
    | undefined;

  // ---------------------------------------------------------------
  // Helper — trust backend `detail`; only fall back when it's
  // genuinely missing (backend contract bug on our side).
  // ---------------------------------------------------------------
  const diag = (fallback?: string): string =>
    typeof detail === "string"
      ? detail
      : fallback || messages.default || `Request failed (${status ?? "unknown"}).`;

  // ---------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------
  switch (status) {
    case 400:
      // Rejected request with a specific reason ("No changes were
      // made", "Session expired", "Already disabled", etc.)
      return diag();

    case 401: {
      // Invalid credentials or expired session
      const msg = diag();
      if (redirectOnAuth) {
        window.setTimeout(
          () => navigate("/login", { replace: true }),
          redirectDelay
        );
      }
      return msg;
    }

    case 403: {
      // Permission denied. Backend may set `X-Error-Code` to route
      // the user to a specific recovery page.
      const msg = diag();

      const overrides = {
        ...DEFAULT_ERROR_CODE_REDIRECTS,
        ...errorCodeRedirects,
      };

      const target = errorCode ? overrides[errorCode] : undefined;

      if (target) {
        window.setTimeout(
          () => navigate(target, { replace: true }),
          redirectDelay
        );
      } else if (redirectOnForbidden) {
        window.setTimeout(
          () => navigate("/", { replace: true }),
          redirectDelay
        );
      }

      return msg;
    }

    case 404:
      return diag();

    case 409:
      // Uniqueness conflict (email already registered, name taken,
      // registration number in use, etc.)
      return diag();

    case 422: {
      // FastAPI validation error — `detail` is an array of
      // { loc: [...], msg: str, type: str } objects.
      if (Array.isArray(detail) && setError && validFields) {
        let matched = false;

        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;

          const e = item as { loc?: unknown; msg?: unknown };
          if (!Array.isArray(e.loc)) return;

          const field = e.loc[e.loc.length - 1];
          const message =
            typeof e.msg === "string" ? e.msg : "Invalid value";

          if (
            typeof field === "string" &&
            validFields.includes(field)
          ) {
            setError(field as Path<T>, { type: "server", message });
            matched = true;
          }
        });

        if (matched) {
          // Field errors are rendered inline; return empty string so
          // callers that do `if (msg) setServerError(msg)` don't set
          // a redundant banner.
          return "";
        }
      }

      // No field mapping — show as a top-level banner
      return diag();
    }

    case 429:
      // Rate limited. Backend may set `Retry-After`.
      return diag();

    case 500:
    case 502:
    case 503:
    case 504:
      // Backend error. `detail` should still be present if the
      // service raised HTTPException; otherwise it's a genuine 500.
      return diag();

    default:
      return diag();
  }
      }





// src/pages/payment-methods/PaymentMethodsList.tsx

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import Accordion from "react-bootstrap/Accordion";
import ListGroup from "react-bootstrap/ListGroup";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { AllPaymentMethodsRead } from "@/types";

const PaymentMethodsList = () => {
  const navigate = useNavigate();

  const [data, setData] = useState<AllPaymentMethodsRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    api
      .get<AllPaymentMethodsRead>("/payment-methods", {
        signal: controller.signal,
      })
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, { navigate });
        if (msg) setError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [navigate]);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" />
        <p className="mt-3 text-muted">Loading payment methods...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5" style={{ maxWidth: 720 }}>
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  const groups = data?.data ?? [];

  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Payment Methods</h1>
        <Link to="/payment-methods/new" className="btn btn-primary">
          + Add Payment Method
        </Link>
      </div>

      {groups.length === 0 ? (
        <p className="text-center text-muted py-5">
          No payment methods yet.
        </p>
      ) : (
        <Accordion>
          {groups.map((group, index) => (
            <Accordion.Item key={group.country_id} eventKey={String(index)}>
              <Accordion.Header>
                <div className="d-flex justify-content-between w-100 pe-3">
                  <span>{group.country_name}</span>
                  <span className="text-muted small">
                    {group.payment_methods.length}{" "}
                    {group.payment_methods.length === 1
                      ? "method"
                      : "methods"}
                  </span>
                </div>
              </Accordion.Header>

              <Accordion.Body className="p-0">
                {group.payment_methods.length === 0 ? (
                  <p className="text-muted m-3 small">
                    No payment methods for this country.
                  </p>
                ) : (
                  <ListGroup variant="flush">
                    {group.payment_methods.map((method) => (
                      <ListGroup.Item
                        key={method.id}
                        action
                        as={Link}
                        to={`/payment-methods/${method.slug}`}
                        className="text-info d-flex justify-content-between"
                      >
                        <span>{method.name}</span>
                        <span className="text-muted small">
                          {method.slug}
                        </span>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Container>
  );
};

export default PaymentMethodsList;





// src/pages/payment-methods/PaymentMethodDetail.tsx

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import DeletePaymentMethodModal from "@/components/payment-methods/DeletePaymentMethodModal";
import type {
  DeletePaymentMethodResponse,
  PaymentMethodRead,
} from "@/types";


const PaymentMethodDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [method, setMethod] = useState<PaymentMethodRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    let mounted = true;

    api
      .get<PaymentMethodRead>(`/payment-methods/${slug}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (mounted) setMethod(res.data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, { navigate });
        if (msg) setError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug, navigate]);


  const openDeleteModal = () => {
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!method) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await api.delete<DeletePaymentMethodResponse>(
        `/payment-methods/${slug}`
      );
      setShowDeleteModal(false);
      setMessage(res.data.message);
      window.setTimeout(() => navigate("/payment-methods"), 1800);
    } catch (err) {
      const msg = handleApiError(err, {
        navigate,
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (msg) setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }

  if (error && !method) {
    return (
      <Container className="py-5" style={{ maxWidth: 720 }}>
        <Alert variant="danger">{error}</Alert>
        <Link to="/payment-methods">← Back to Payment Methods</Link>
      </Container>
    );
  }

  if (!method) return null;


  return (
    <Container className="py-4" style={{ maxWidth: 720 }}>
      {message && (
        <Alert variant="success" className="mb-4">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="d-flex justify-content-between align-items-start mb-4">
        <h1 className="h3 mb-0">{method.name}</h1>
        <div className="d-flex gap-2">
          <Button
            as={Link as any}
            to={`/payment-methods/${method.slug}/edit`}
            variant="warning"
          >
            Update
          </Button>
          <Button variant="danger" onClick={openDeleteModal}>
            Delete
          </Button>
        </div>
      </div>

      <ListGroup>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Country ID</strong>
          <span>{method.country_id}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Slug</strong>
          <span>{method.slug ?? "—"}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Created</strong>
          <span>{new Date(method.created_at).toLocaleString()}</span>
        </ListGroup.Item>
        <ListGroup.Item className="d-flex justify-content-between">
          <strong>Updated</strong>
          <span>{new Date(method.updated_at).toLocaleString()}</span>
        </ListGroup.Item>
      </ListGroup>

      <Link to="/payment-methods" className="d-inline-block mt-4">
        ← Back to Payment Methods
      </Link>

      <DeletePaymentMethodModal
        method={showDeleteModal ? method : null}
        deleting={deleting}
        serverError={deleteError}
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </Container>
  );
};

export default PaymentMethodDetail;





// no change  but verify

// src/pages/payment-methods/UpdatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useNavigate, Navigate, Link } from "react-router-dom";
import axios from "axios";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { handleApiError } from "@/lib/handleApiError";
import type {
  PaymentMethodRead,
  PaymentMethodUpdate,
  UpdatePaymentMethodResponse,
} from "@/types";


const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters")
    .max(100, "Payment method name must not exceed 100 characters"),
});

type FormData = z.infer<typeof schema>;


const UpdatePaymentMethod = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const originalNameRef = useRef<string>("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });


  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();
    let mounted = true;

    api
      .get<PaymentMethodRead>(`/payment-methods/${slug}`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (!mounted) return;
        originalNameRef.current = res.data.name;
        reset({ name: res.data.name });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, { navigate });
        if (msg) setServerError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug, navigate, reset]);


  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const trimmed = data.name.trim();

    if (trimmed === originalNameRef.current) {
      setServerError("No changes were made");
      return;
    }

    const payload: PaymentMethodUpdate = { name: trimmed };

    try {
      const res = await api.patch<UpdatePaymentMethodResponse>(
        `/payment-methods/${slug}`,
        payload
      );
      setSuccessMessage(res.data.message);
      redirectRef.current = {
        path: `/payment-methods/${res.data.payment_method.slug}`,
        delayMs: 1500,
      };
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: ["name"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
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
        <h1 className="h3 text-center mb-4">Update Payment Method</h1>

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

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-4" controlId="name">
            <Form.Label>Payment Method Name</Form.Label>
            <Form.Control
              type="text"
              isInvalid={!!errors.name}
              disabled={isSubmitting || successMessage !== null}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={
              isSubmitting ||
              !isDirty ||
              successMessage !== null
            }
          >
            {isSubmitting ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Updating...
              </>
            ) : (
              "Update Payment Method"
            )}
          </Button>
        </Form>

        <p className="text-center mt-4 mb-0 small">
          <Link to={`/payment-methods/${slug}`}>
            ← Back to Payment Method
          </Link>
        </p>
      </div>
    </Container>
  );
};

export default UpdatePaymentMethod;









