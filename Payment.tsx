


// src/hooks/usePaymentMethodsByCountry.ts

import { useEffect, useState } from "react";
import axios from "axios";

import api from "@/api/client";
import type { CountryPaymentMethodsRead } from "@/types";


interface UsePaymentMethodsByCountryResult {
  data: CountryPaymentMethodsRead | null;
  loading: boolean;
  error: string | null;
  /** HTTP status of the error, when available (401, 403, 404, …). */
  errorStatus: number | null;
}


/**
 * Fetch the payment methods for a country by country slug.
 *
 * Authenticated endpoint — the axios client sends the session
 * cookie automatically.
 *
 * @param countrySlug  Country slug (e.g. "liberia"). Pass null/undefined
 *                     to skip the fetch.
 */
export function usePaymentMethodsByCountry(
  countrySlug: string | null | undefined
): UsePaymentMethodsByCountryResult {
  const [data, setData] = useState<CountryPaymentMethodsRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  useEffect(() => {
    if (!countrySlug) {
      setData(null);
      setError(null);
      setErrorStatus(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let mounted = true;
    setLoading(true);
    setError(null);
    setErrorStatus(null);

    api
      .get<CountryPaymentMethodsRead>(
        `/payment-methods/country/${countrySlug}`,
        { signal: controller.signal }
      )
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;

        if (!axios.isAxiosError(err)) {
          setError("An unexpected error occurred.");
          return;
        }

        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        setErrorStatus(status ?? null);
        setError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status ?? "unknown"}).`
        );
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [countrySlug]);

  return { data, loading, error, errorStatus };
}
// src/pages/receipts/CreateReceipt.tsx

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
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { handleApiError } from "@/lib/handleApiError";
import type {
  BranchListRead,
  BranchRead,
  CountryListRead,
  CountryPaymentMethodsRead,
  CountryRead,
  CreateReceiptResponse,
  FirmListRead,
  FirmRead,
  PaymentMethodRead,
  ReceiptCreate,
} from "@/types";


// =============================================================
// VALIDATION
// =============================================================

const schema = z.object({
  firm_id: z.coerce
    .number()
    .int()
    .positive("Please select a firm"),

  branch_id: z.coerce
    .number()
    .int()
    .positive("Please select a branch"),

  payment_method_id: z.coerce
    .number()
    .int()
    .positive("Please select a payment method"),

  prepared_by: z
    .string()
    .trim()
    .min(2, "Prepared by is required")
    .max(200, "Prepared by must not exceed 200 characters"),

  customer_fullname: z
    .string()
    .trim()
    .min(2, "Customer name is required")
    .max(200, "Customer name must not exceed 200 characters"),

  customer_email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),

  customer_address: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(500, "Address must not exceed 500 characters"),

  customer_phone: z
    .string()
    .trim()
    .min(5, "Customer phone is required"),

  product_name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200),

  serial_number: z
    .string()
    .trim()
    .min(1, "Serial number is required")
    .max(100),

  quantity: z.coerce
    .number()
    .int()
    .positive("Quantity must be greater than zero"),

  unit_price: z.coerce
    .number()
    .positive("Unit price must be greater than zero"),

  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  shipping: z.coerce.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;


// =============================================================
// COMPONENT
// =============================================================

const CreateReceipt = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  // ---------------------------------------------------------
  // Firms
  // ---------------------------------------------------------
  const [firms, setFirms] = useState<FirmRead[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(true);

  // ---------------------------------------------------------
  // Branches for the selected firm
  // ---------------------------------------------------------
  const [branches, setBranches] = useState<BranchRead[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // ---------------------------------------------------------
  // Payment methods for the user's country
  // ---------------------------------------------------------
  const [methods, setMethods] = useState<PaymentMethodRead[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);

  // ---------------------------------------------------------
  // Feedback + redirect
  // ---------------------------------------------------------
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firm_id: 0,
      branch_id: 0,
      payment_method_id: 0,
      prepared_by: "",
      customer_fullname: "",
      customer_email: "",
      customer_address: "",
      customer_phone: "",
      product_name: "",
      serial_number: "",
      quantity: 1,
      unit_price: 0,
      discount: 0,
      tax: 0,
      shipping: 0,
    },
  });

  const selectedFirmId = watch("firm_id");


  // ===========================================================
  // 1. Load firms owned by the caller
  // ===========================================================
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    api
      .get<FirmListRead>("/firms/me/mine", { signal: controller.signal })
      .then((res) => {
        if (mounted) setFirms(res.data.firms ?? []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, {
          navigate,
          redirectOnAuth: false,
        });
        if (msg) setServerError(msg);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setFirmsLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [navigate]);


  // ===========================================================
  // 2. Resolve the user's country slug, then load payment methods
  //
  //    The receipt is issued in the user's own country, so we
  //    don't need a country picker — the country is implicit.
  //
  //    Two-step:
  //      a. If `user.country` already looks like a slug, use it.
  //      b. Otherwise, fetch /home/countries and match by country_id.
  // ===========================================================
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function loadPaymentMethods() {
      setMethodsLoading(true);
      setMethods([]);

      try {
        // --- resolve slug ---
        let countrySlug: string | null = null;

        // If the API already returns a slug on the user object,
        // use it directly.
        if (typeof user?.country === "string" && user.country.length > 0) {
          countrySlug = user.country;
        } else if (user?.country_id) {
          // Fall back to looking it up from the country list.
          const res = await api.get<CountryListRead>("/home/countries", {
            signal: controller.signal,
          });
          const match: CountryRead | undefined = res.data.countries.find(
            (c) => c.id === user.country_id
          );
          countrySlug = match?.slug ?? null;
        }

        if (!countrySlug) {
          // No country on the user — shouldn't happen for a verified
          // user with a receipt-issuing firm, but handle gracefully.
          if (mounted) {
            setMethodsLoading(false);
            setServerError(
              "Your account has no country assigned. Please contact support."
            );
          }
          return;
        }

        // --- fetch methods for that country ---
        const res = await api.get<CountryPaymentMethodsRead>(
          `/payment-methods/country/${countrySlug}`,
          { signal: controller.signal }
        );

        if (mounted) setMethods(res.data.payment_methods ?? []);
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (!mounted) return;

        const msg = handleApiError(err, {
          navigate,
          redirectOnAuth: false,
        });
        if (msg) setServerError(msg);
        setMethods([]);
      } finally {
        if (mounted && !controller.signal.aborted) setMethodsLoading(false);
      }
    }

    if (!authLoading && user) {
      loadPaymentMethods();
    }

    return () => {
      mounted = false;
      controller.abort();
    };
    // Re-run if the user identity changes (login, refresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, user?.country, user?.country_id, navigate]);


  // ===========================================================
  // 3. Load branches when a firm is selected
  // ===========================================================
  useEffect(() => {
    if (!selectedFirmId) {
      setBranches([]);
      return;
    }

    const firm = firms.find((f) => f.id === Number(selectedFirmId));
    if (!firm?.slug) {
      setBranches([]);
      return;
    }

    const controller = new AbortController();
    let mounted = true;
    setBranchesLoading(true);

    api
      .get<BranchListRead>(`/firms/${firm.slug}/branches`, {
        signal: controller.signal,
      })
      .then((res) => {
        if (mounted) setBranches(res.data.branches ?? []);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;
        const msg = handleApiError(err, {
          navigate,
          redirectOnAuth: false,
        });
        if (msg) setServerError(msg);
        setBranches([]);
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setBranchesLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [selectedFirmId, firms, navigate]);


  // ===========================================================
  // 4. Cancelable redirect after success
  // ===========================================================
  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ===========================================================
  // 5. Auth guards
  // ===========================================================
  if (authLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" />
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;


  // ===========================================================
  // 6. Submit
  // ===========================================================
  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload: ReceiptCreate = {
      firm_id: data.firm_id,
      branch_id: data.branch_id,
      payment_method_id: data.payment_method_id,
      prepared_by: data.prepared_by.trim(),
      customer_fullname: data.customer_fullname.trim(),
      customer_email: data.customer_email?.trim() || undefined,
      customer_address: data.customer_address.trim(),
      customer_phone: data.customer_phone.trim(),
      product_name: data.product_name.trim(),
      serial_number: data.serial_number.trim(),
      quantity: data.quantity,
      unit_price: String(data.unit_price),
      discount: String(data.discount ?? 0),
      tax: String(data.tax ?? 0),
      shipping: String(data.shipping ?? 0),
    };

    try {
      const res = await api.post<CreateReceiptResponse>(
        "/receipts",
        payload
      );

      setSuccessMessage(res.data.message);
      reset();

      // Redirect to the preview + auto-print page.
      redirectRef.current = {
        path: `/receipts/${res.data.receipt.slug}?print=1`,
        delayMs: 1200,
      };
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: [
          "firm_id",
          "branch_id",
          "payment_method_id",
          "prepared_by",
          "customer_fullname",
          "customer_email",
          "customer_address",
          "customer_phone",
          "product_name",
          "serial_number",
          "quantity",
          "unit_price",
          "discount",
          "tax",
          "shipping",
        ],
      });
      if (msg) setServerError(msg);
    }
  };


  // ===========================================================
  // 7. UI
  // ===========================================================
  return (
    <Container className="py-5" style={{ maxWidth: 800 }}>
      <div className="bg-white p-4 rounded shadow-sm">
        <h1 className="h3 text-center mb-4">Create Receipt</h1>

        {successMessage && (
          <Alert variant="success" className="text-center">
            {successMessage}
            <div className="small mt-1">
              Opening receipt preview...
            </div>
          </Alert>
        )}

        {serverError && (
          <Alert variant="danger" className="text-center">
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ================= FIRM, BRANCH, PAYMENT METHOD ================= */}
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="firm_id">
                <Form.Label>Firm</Form.Label>
                <Form.Select
                  isInvalid={!!errors.firm_id}
                  disabled={
                    firmsLoading ||
                    isSubmitting ||
                    successMessage !== null
                  }
                  {...register("firm_id")}
                >
                  <option value={0}>
                    {firmsLoading ? "Loading..." : "Select firm"}
                  </option>
                  {firms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.firm_id?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3" controlId="branch_id">
                <Form.Label>Branch</Form.Label>
                <Form.Select
                  isInvalid={!!errors.branch_id}
                  disabled={
                    !selectedFirmId ||
                    branchesLoading ||
                    isSubmitting ||
                    successMessage !== null
                  }
                  {...register("branch_id")}
                >
                  <option value={0}>
                    {branchesLoading
                      ? "Loading..."
                      : !selectedFirmId
                        ? "Select firm first"
                        : "Select branch"}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Branch {b.branch_no}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.branch_id?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group className="mb-3" controlId="payment_method_id">
                <Form.Label>Payment Method</Form.Label>
                <Form.Select
                  isInvalid={!!errors.payment_method_id}
                  disabled={
                    methodsLoading ||
                    isSubmitting ||
                    successMessage !== null
                  }
                  {...register("payment_method_id")}
                >
                  <option value={0}>
                    {methodsLoading
                      ? "Loading..."
                      : methods.length === 0
                        ? "No methods available"
                        : "Select method"}
                  </option>
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.payment_method_id?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* ================= PREPARED BY ================= */}
          <Form.Group className="mb-3" controlId="prepared_by">
            <Form.Label>Prepared By</Form.Label>
            <Form.Control
              type="text"
              placeholder="e.g. John Okonkwo"
              isInvalid={!!errors.prepared_by}
              disabled={isSubmitting || successMessage !== null}
              {...register("prepared_by")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.prepared_by?.message}
            </Form.Control.Feedback>
          </Form.Group>

          {/* ================= CUSTOMER ================= */}
          <h6 className="mt-4 mb-3 text-muted">Customer</h6>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="customer_fullname">
                <Form.Label>Full Name</Form.Label>
                <Form.Control
                  type="text"
                  isInvalid={!!errors.customer_fullname}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("customer_fullname")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.customer_fullname?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3" controlId="customer_phone">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  type="tel"
                  placeholder="+1234567890"
                  isInvalid={!!errors.customer_phone}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("customer_phone")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.customer_phone?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3" controlId="customer_email">
            <Form.Label>
              Email{" "}
              <span className="text-muted small">
                (optional — receipt emailed automatically)
              </span>
            </Form.Label>
            <Form.Control
              type="email"
              isInvalid={!!errors.customer_email}
              disabled={isSubmitting || successMessage !== null}
              {...register("customer_email")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.customer_email?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="customer_address">
            <Form.Label>Address</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              isInvalid={!!errors.customer_address}
              disabled={isSubmitting || successMessage !== null}
              {...register("customer_address")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.customer_address?.message}
            </Form.Control.Feedback>
          </Form.Group>

          {/* ================= PRODUCT ================= */}
          <h6 className="mt-4 mb-3 text-muted">Product</h6>
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3" controlId="product_name">
                <Form.Label>Product Name</Form.Label>
                <Form.Control
                  type="text"
                  isInvalid={!!errors.product_name}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("product_name")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.product_name?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="serial_number">
                <Form.Label>Serial Number</Form.Label>
                <Form.Control
                  type="text"
                  isInvalid={!!errors.serial_number}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("serial_number")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.serial_number?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="quantity">
                <Form.Label>Quantity</Form.Label>
                <Form.Control
                  type="number"
                  min={1}
                  isInvalid={!!errors.quantity}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("quantity")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.quantity?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="unit_price">
                <Form.Label>Unit Price</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  isInvalid={!!errors.unit_price}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("unit_price")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.unit_price?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* ================= ADJUSTMENTS ================= */}
          <h6 className="mt-4 mb-3 text-muted">Adjustments (optional)</h6>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="discount">
                <Form.Label>Discount</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  isInvalid={!!errors.discount}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("discount")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.discount?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="tax">
                <Form.Label>Tax</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  isInvalid={!!errors.tax}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("tax")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.tax?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3" controlId="shipping">
                <Form.Label>Shipping</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  isInvalid={!!errors.shipping}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("shipping")}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.shipping?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* ================= SUBMIT ================= */}
          <Button
            type="submit"
            variant="primary"
            className="w-100 mt-3"
            disabled={
              isSubmitting ||
              firmsLoading ||
              methodsLoading ||
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
              "Create Receipt"
            )}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default CreateReceipt;



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


    
