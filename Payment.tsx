




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





// src/types/payment/read.ts

export interface PaymentMethodRead {
  id: number;
  country_id: number;
  name: string;
  slug?: string | null;
  payment_logo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CountryPaymentMethodsRead {
  country_id: number;
  country_name: string;
  payment_methods: PaymentMethodRead[];
}

export interface AllPaymentMethodsRead {
  total_countries: number;
  data: CountryPaymentMethodsRead[];
}

export interface AvailablePaymentMethodRead {
  id: number;
  name: string;
  slug?: string | null;
  payment_logo_url?: string | null;
}

export interface AvailablePaymentMethodsRead {
  total: number;
  methods: AvailablePaymentMethodRead[];
}




// src/pages/payment-methods/CreatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate, Link } from "react-router-dom";
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
} from "@/types";


// =============================================================
// VALIDATION
//
// `payment_logo` is a FileList from the file input. Zod can't
// easily validate File objects pre-transform, so we use `any()`
// and validate in onSubmit.
// =============================================================

const MAX_LOGO_BYTES = 2 * 1024 * 1024;   // 2 MiB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

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

  payment_logo: z.any().optional(),
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


  // Load countries
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

    // ---------------------------------------------------------
    // Client-side logo validation
    // ---------------------------------------------------------
    const logoFile: File | undefined =
      data.payment_logo instanceof FileList && data.payment_logo.length > 0
        ? data.payment_logo[0]
        : undefined;

    if (logoFile) {
      if (!ALLOWED_TYPES.includes(logoFile.type)) {
        setError("payment_logo", {
          type: "manual",
          message: "Logo must be PNG, JPEG, WEBP, or SVG",
        });
        return;
      }
      if (logoFile.size > MAX_LOGO_BYTES) {
        setError("payment_logo", {
          type: "manual",
          message: "Logo must be under 2 MiB",
        });
        return;
      }
    }

    // ---------------------------------------------------------
    // Build multipart payload
    // ---------------------------------------------------------
    const formData = new FormData();
    formData.append("country_id", String(data.country_id));
    formData.append("name", data.name.trim());
    if (logoFile) {
      formData.append("payment_logo", logoFile);
    }

    try {
      const res = await api.post<CreatePaymentMethodResponse>(
        "/payment-methods",
        formData
        // Note: do NOT set Content-Type manually — the browser must
        // set the multipart boundary itself.
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
        validFields: ["country_id", "name", "payment_logo"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (msg) setServerError(msg);
    }
  };


  return (
    <Container className="py-5" style={{ maxWidth: 520 }}>
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

          <Form.Group className="mb-3" controlId="name">
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

          <Form.Group className="mb-4" controlId="payment_logo">
            <Form.Label>
              Logo{" "}
              <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              isInvalid={!!errors.payment_logo}
              disabled={isSubmitting || successMessage !== null}
              {...register("payment_logo")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.payment_logo?.message as string | undefined}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              PNG, JPEG, WEBP, or SVG. Maximum 2 MiB.
            </Form.Text>
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
  UpdatePaymentMethodResponse,
} from "@/types";


const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters")
    .max(100, "Payment method name must not exceed 100 characters"),

  payment_logo: z.any().optional(),
});

type FormData = z.infer<typeof schema>;


const UpdatePaymentMethod = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
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
        setCurrentLogoUrl(res.data.payment_logo_url ?? null);
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
    const nameChanged = trimmed !== originalNameRef.current;

    const logoFile: File | undefined =
      data.payment_logo instanceof FileList && data.payment_logo.length > 0
        ? data.payment_logo[0]
        : undefined;

    // Nothing to send
    if (!nameChanged && !logoFile) {
      setServerError("No changes were made");
      return;
    }

    if (logoFile) {
      if (!ALLOWED_TYPES.includes(logoFile.type)) {
        setError("payment_logo", {
          type: "manual",
          message: "Logo must be PNG, JPEG, WEBP, or SVG",
        });
        return;
      }
      if (logoFile.size > MAX_LOGO_BYTES) {
        setError("payment_logo", {
          type: "manual",
          message: "Logo must be under 2 MiB",
        });
        return;
      }
    }

    const formData = new FormData();
    if (nameChanged) {
      formData.append("name", trimmed);
    }
    if (logoFile) {
      formData.append("payment_logo", logoFile);
    }

    try {
      const res = await api.patch<UpdatePaymentMethodResponse>(
        `/payment-methods/${slug}`,
        formData
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
        validFields: ["name", "payment_logo"],
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
    <Container className="py-5" style={{ maxWidth: 520 }}>
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
          <Form.Group className="mb-3" controlId="name">
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

          {currentLogoUrl && (
            <div className="mb-3">
              <div className="text-muted small mb-2">Current logo</div>
              <img
                src={currentLogoUrl}
                alt="Current payment logo"
                style={{
                  height: 48,
                  maxWidth: 160,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          )}

          <Form.Group className="mb-4" controlId="payment_logo">
            <Form.Label>
              {currentLogoUrl ? "Replace Logo" : "Logo"}{" "}
              <span className="text-muted small">(optional)</span>
            </Form.Label>
            <Form.Control
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              isInvalid={!!errors.payment_logo}
              disabled={isSubmitting || successMessage !== null}
              {...register("payment_logo")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.payment_logo?.message as string | undefined}
            </Form.Control.Feedback>
            <Form.Text className="text-muted">
              Leave blank to keep the current logo.
            </Form.Text>
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










// src/pages/payment-methods/CreatePaymentMethod.tsx


    
