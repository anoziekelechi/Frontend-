//chatgpt 



import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

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

interface PaymentMethodRead {
  id?: number;
  name: string;
  slug: string;
  payment_logo_key?: string | null;
  payment_logo_url?: string | null;
}

interface CreatePaymentMethodResponse {
  message?: string;
  payment_method?: PaymentMethodRead;
}

const CreatePaymentMethod = () => {
  const navigate = useNavigate();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = async (data: PaymentMethodFormValues): Promise<void> => {
    setServerError(null);
    setSuccessMessage(null);

    const formData = new FormData();

    // The backend schema performs authoritative normalization.
    formData.append("name", data.name);

    const logoFile = data.payment_logo?.[0];

    if (logoFile) {
      formData.append("payment_logo", logoFile);
    }

    try {
      const response = await api.post<CreatePaymentMethodResponse>(
        "/payment-methods",
        formData,
      );

      const createdMethod = response.data.payment_method;

      if (createdMethod?.slug) {
        navigate(`/payment-methods/${createdMethod.slug}`);
        return;
      }

      setSuccessMessage(
        response.data.message ?? "Payment method created successfully.",
      );
    } catch (error: unknown) {
      const message = handleApiError<PaymentMethodFormValues>(error, {
        navigate,
        setError,
        validFields: ["name", "payment_logo"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });

      if (message) {
        setServerError(message);
      }
    }
  };

  return (
    <Card className="mx-auto my-4" style={{ maxWidth: "640px" }}>
      <Card.Body>
        <Card.Title className="mb-4">
          Create Payment Method
        </Card.Title>

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
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="paymentMethodName">
            <Form.Label>Payment method name</Form.Label>

            <Form.Control
              type="text"
              placeholder="e.g. Mobile Money"
              autoComplete="off"
              isInvalid={Boolean(errors.name)}
              {...register("name")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="paymentMethodLogo">
            <Form.Label>Payment logo (optional)</Form.Label>

            <Form.Control
              type="file"
              accept="image/png,image/jpeg"
              isInvalid={Boolean(errors.payment_logo)}
              {...register("payment_logo")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.payment_logo?.message}
            </Form.Control.Feedback>

            <Form.Text className="text-muted">
              Accepted formats: PNG or JPEG. Maximum size: 2 MiB.
            </Form.Text>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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







import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

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

interface PaymentMethodRead {
  id?: number;
  name: string;
  slug: string;
  payment_logo_key?: string | null;
  payment_logo_url?: string | null;
}

interface UpdatePaymentMethodResponse {
  message?: string;
  payment_method?: PaymentMethodRead;
}

const normalizePaymentName = (value: string): string =>
  value.trim().replace(/\s+/g, " ").toUpperCase();

const UpdatePaymentMethod = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);

  const originalNameRef = useRef("");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    let cancelled = false;

    const loadPaymentMethod = async (): Promise<void> => {
      if (!slug) {
        setServerError("Payment method slug is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setServerError(null);

      try {
        const response = await api.get<PaymentMethodRead>(
          `/payment-methods/${slug}`,
        );

        if (cancelled) {
          return;
        }

        const method = response.data;

        originalNameRef.current = method.name;
        setCurrentLogoUrl(method.payment_logo_url ?? null);

        reset({
          name: method.name,
        });
      } catch (error: unknown) {
        if (!cancelled) {
          const message = handleApiError<PaymentMethodFormValues>(error, {
            navigate,
          });

          if (message) {
            setServerError(message);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPaymentMethod();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate, reset]);

  const onSubmit = async (data: PaymentMethodFormValues): Promise<void> => {
    if (!slug) {
      setServerError("Payment method slug is missing.");
      return;
    }

    setServerError(null);

    const normalizedName = normalizePaymentName(data.name);
    const originalNormalizedName = normalizePaymentName(
      originalNameRef.current,
    );

    const nameChanged = normalizedName !== originalNormalizedName;
    const logoFile = data.payment_logo?.[0];

    // Do not send an empty PATCH request.
    if (!nameChanged && !logoFile) {
      setServerError("No changes were made.");
      return;
    }

    const formData = new FormData();

    if (nameChanged) {
      formData.append("name", normalizedName);
    }

    if (logoFile) {
      formData.append("payment_logo", logoFile);
    }

    try {
      const response = await api.patch<UpdatePaymentMethodResponse>(
        `/payment-methods/${slug}`,
        formData,
      );

      const updatedMethod = response.data.payment_method;

      if (updatedMethod?.slug) {
        navigate(`/payment-methods/${updatedMethod.slug}`, {
          replace: true,
        });
        return;
      }

      navigate("/payment-methods");
    } catch (error: unknown) {
      const message = handleApiError<PaymentMethodFormValues>(error, {
        navigate,
        setError,
        validFields: ["name", "payment_logo"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });

      if (message) {
        setServerError(message);
      }
    }
  };

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

  return (
    <Card className="mx-auto my-4" style={{ maxWidth: "640px" }}>
      <Card.Body>
        <Card.Title className="mb-4">
          Update Payment Method
        </Card.Title>

        {serverError && (
          <Alert
            variant="danger"
            dismissible
            onClose={() => setServerError(null)}
          >
            {serverError}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Form.Group className="mb-3" controlId="paymentMethodName">
            <Form.Label>Payment method name</Form.Label>

            <Form.Control
              type="text"
              autoComplete="off"
              isInvalid={Boolean(errors.name)}
              {...register("name")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
            </Form.Control.Feedback>
          </Form.Group>

          {currentLogoUrl && (
            <Form.Group className="mb-3">
              <Form.Label>Current logo</Form.Label>

              <div className="mb-2">
                <img
                  src={currentLogoUrl}
                  alt="Current payment method logo"
                  style={{
                    maxWidth: "180px",
                    maxHeight: "120px",
                    objectFit: "contain",
                  }}
                />
              </div>
            </Form.Group>
          )}

          <Form.Group className="mb-3" controlId="paymentMethodLogo">
            <Form.Label>Replace logo (optional)</Form.Label>

            <Form.Control
              type="file"
              accept="image/png,image/jpeg"
              isInvalid={Boolean(errors.payment_logo)}
              {...register("payment_logo")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.payment_logo?.message}
            </Form.Control.Feedback>

            <Form.Text className="text-muted">
              Accepted formats: PNG or JPEG. Maximum size: 2 MiB.
              Leave empty to keep the current logo.
            </Form.Text>
          </Form.Group>

          <div className="d-flex gap-2">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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

