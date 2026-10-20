// src/pages/payments/CreatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { CreatePaymentMethodResponse } from "@/types";


// =============================================================
// CONSTANTS
// =============================================================

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];


// =============================================================
// VALIDATION
// =============================================================

const paymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters.")
    .max(100, "Payment method name cannot exceed 100 characters."),

  payment_logo: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        files[0].size <= MAX_LOGO_BYTES,
      "Logo must not exceed 2 MiB.",
    )
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        ALLOWED_TYPES.includes(files[0].type),
      "Logo must be a PNG or JPEG image.",
    ),
});

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;


// =============================================================
// COMPONENT
// =============================================================

const CreatePaymentMethod = () => {
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: { name: "" },
  });


  // ===========================================================
  // Cancelable redirect
  // ===========================================================
  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs,
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ===========================================================
  // Submit
  // ===========================================================
  const onSubmit = async (
    data: PaymentMethodFormValues,
  ): Promise<void> => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const formData = new FormData();
    formData.append("name", data.name.trim());

    const logoFile = data.payment_logo?.[0];
    if (logoFile) {
      formData.append("payment_logo", logoFile);
    }

    try {
      const response = await api.post<CreatePaymentMethodResponse>(
        "/payment-methods",
        formData,
      );

      setSuccessMessage(
        response.data.message ?? "Payment method created successfully.",
      );

      redirectRef.current = {
        path: "/payment-methods",
        delayMs: 1200,
      };
    } catch (error: unknown) {
      const message = handleApiError<PaymentMethodFormValues>(error, {
        navigate,
        setError,
        validFields: ["name", "payment_logo"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });

      if (message) setServerError(message);
    }
  };


  // ===========================================================
  // UI
  // ===========================================================
  return (
    <Card className="mx-auto my-4" style={{ maxWidth: 720 }}>
      <Card.Body>
        <Card.Title className="mb-4">Create Payment Method</Card.Title>

        {serverError && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setServerError(null)}
          >
            {serverError}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting...</div>
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ===============================================
              NAME
          =============================================== */}
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3" controlId="paymentMethodName">
                <Form.Label className="fw-semibold">
                  Payment Method Name
                </Form.Label>

                <Form.Control
                  type="text"
                  placeholder="e.g. Mobile Money"
                  autoComplete="off"
                  isInvalid={Boolean(errors.name)}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("name")}
                />

                <Form.Control.Feedback type="invalid">
                  {errors.name?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* ===============================================
              LOGO
          =============================================== */}
          <Row>
            <Col md={12}>
              <Form.Group className="mb-4" controlId="paymentMethodLogo">
                <Form.Label className="fw-semibold">
                  Logo{" "}
                  <span className="text-muted small fw-normal">
                    (optional)
                  </span>
                </Form.Label>

                <Form.Control
                  type="file"
                  accept="image/png,image/jpeg"
                  isInvalid={Boolean(errors.payment_logo)}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("payment_logo")}
                />

                <Form.Control.Feedback type="invalid">
                  {errors.payment_logo?.message as string | undefined}
                </Form.Control.Feedback>

                <Form.Text className="text-muted">
                  PNG or JPEG, maximum 2 MiB.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          {/* ===============================================
              ACTIONS
          =============================================== */}
          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || successMessage !== null}
            >
              {isSubmitting ? (
                <>
                  <Spinner
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Creating...
                </>
              ) : (
                "Create Payment Method"
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting || successMessage !== null}
              onClick={() => navigate("/payment-methods")}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CreatePaymentMethod;




// src/pages/payments/UpdatePaymentMethod.tsx

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";

import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type {
  PaymentMethodRead,
  UpdatePaymentMethodResponse,
} from "@/types";


// =============================================================
// CONSTANTS
// =============================================================

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];


// =============================================================
// VALIDATION
// =============================================================

const paymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Payment method name must be at least 2 characters.")
    .max(100, "Payment method name cannot exceed 100 characters."),

  payment_logo: z
    .custom<FileList>()
    .optional()
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        files[0].size <= MAX_LOGO_BYTES,
      "Logo must not exceed 2 MiB.",
    )
    .refine(
      (files) =>
        !files ||
        files.length === 0 ||
        ALLOWED_TYPES.includes(files[0].type),
      "Logo must be a PNG or JPEG image.",
    ),
});

type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;


// =============================================================
// HELPERS
// =============================================================

const normalizePaymentName = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toUpperCase();


// =============================================================
// COMPONENT
// =============================================================

const UpdatePaymentMethod = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  const originalNameRef = useRef("");
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: { name: "" },
  });


  // ===========================================================
  // Load existing method
  // ===========================================================
  useEffect(() => {
    if (!slug) {
      setServerError("Payment method slug is missing.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setServerError(null);

      try {
        const response = await api.get<PaymentMethodRead>(
          `/payment-methods/${slug}`,
          { signal: controller.signal },
        );

        if (!mounted) return;

        const method = response.data;
        originalNameRef.current = method.name;
        setCurrentLogoUrl(method.payment_logo_url ?? null);
        reset({ name: method.name });
      } catch (error: unknown) {
        if (axios.isCancel(error)) return;
        if (!mounted) return;

        const message = handleApiError<PaymentMethodFormValues>(error, {
          navigate,
        });
        if (message) setServerError(message);
      } finally {
        if (mounted && !controller.signal.aborted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug, navigate, reset]);


  // ===========================================================
  // Cancelable redirect
  // ===========================================================
  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs,
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  // ===========================================================
  // Submit
  // ===========================================================
  const onSubmit = async (
    data: PaymentMethodFormValues,
  ): Promise<void> => {
    if (!slug) {
      setServerError("Payment method slug is missing.");
      return;
    }

    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const normalizedName = normalizePaymentName(data.name);
    const originalNormalizedName = normalizePaymentName(
      originalNameRef.current,
    );

    const nameChanged = normalizedName !== originalNormalizedName;
    const logoFile = data.payment_logo?.[0];

    if (!nameChanged && !logoFile) {
      setServerError("No changes were made.");
      return;
    }

    const formData = new FormData();
    if (nameChanged) formData.append("name", normalizedName);
    if (logoFile) formData.append("payment_logo", logoFile);

    try {
      const response = await api.patch<UpdatePaymentMethodResponse>(
        `/payment-methods/${slug}`,
        formData,
      );

      setSuccessMessage(
        response.data.message ?? "Payment method updated successfully.",
      );

      redirectRef.current = {
        path: "/payment-methods",
        delayMs: 1200,
      };
    } catch (error: unknown) {
      const message = handleApiError<PaymentMethodFormValues>(error, {
        navigate,
        setError,
        validFields: ["name", "payment_logo"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (message) setServerError(message);
    }
  };


  // ===========================================================
  // Loading
  // ===========================================================
  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">
            Loading payment method...
          </span>
        </Spinner>
      </div>
    );
  }


  // ===========================================================
  // UI
  // ===========================================================
  return (
    <Card className="mx-auto my-4" style={{ maxWidth: 720 }}>
      <Card.Body>
        <Card.Title className="mb-4">Update Payment Method</Card.Title>

        {serverError && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setServerError(null)}
          >
            {serverError}
          </Alert>
        )}

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            <div className="small mt-1">Redirecting...</div>
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* ===============================================
              NAME
          =============================================== */}
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3" controlId="paymentMethodName">
                <Form.Label className="fw-semibold">
                  Payment Method Name
                </Form.Label>

                <Form.Control
                  type="text"
                  autoComplete="off"
                  isInvalid={Boolean(errors.name)}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("name")}
                />

                <Form.Control.Feedback type="invalid">
                  {errors.name?.message}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          {/* ===============================================
              CURRENT LOGO
          =============================================== */}
          {currentLogoUrl && (
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    Current Logo
                  </Form.Label>

                  <div>
                    <img
                      src={currentLogoUrl}
                      alt="Current payment method logo"
                      style={{
                        maxWidth: 180,
                        maxHeight: 120,
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
          )}

          {/* ===============================================
              REPLACE LOGO
          =============================================== */}
          <Row>
            <Col md={12}>
              <Form.Group className="mb-4" controlId="paymentMethodLogo">
                <Form.Label className="fw-semibold">
                  {currentLogoUrl ? "Replace Logo" : "Logo"}{" "}
                  <span className="text-muted small fw-normal">
                    (optional)
                  </span>
                </Form.Label>

                <Form.Control
                  type="file"
                  accept="image/png,image/jpeg"
                  isInvalid={Boolean(errors.payment_logo)}
                  disabled={isSubmitting || successMessage !== null}
                  {...register("payment_logo")}
                />

                <Form.Control.Feedback type="invalid">
                  {errors.payment_logo?.message as string | undefined}
                </Form.Control.Feedback>

                <Form.Text className="text-muted">
                  PNG or JPEG, maximum 2 MiB. Leave empty to keep the
                  current logo.
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>

          {/* ===============================================
              ACTIONS
          =============================================== */}
          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || successMessage !== null}
            >
              {isSubmitting ? (
                <>
                  <Spinner
                    animation="border"
                    size="sm"
                    className="me-2"
                  />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting || successMessage !== null}
              onClick={() => navigate(`/payment-methods/${slug}`)}
            >
              Cancel
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default UpdatePaymentMethod;
