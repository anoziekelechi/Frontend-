// src/pages/users/UpdateName.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import axios from "axios";

import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { UpdateNames, UpdateNamesResponse } from "@/types";


const schema = z.object({
  surname: z
    .string()
    .trim()
    .min(2, "Surname must be at least 2 characters")
    .max(100),
  othernames: z
    .string()
    .trim()
    .min(2, "Other names must be at least 2 characters")
    .max(150),
});
type FormData = z.infer<typeof schema>;


function changedStringFields<T extends Record<string, string | undefined>>(
  next: T,
  prev: Partial<T>
): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(next) as (keyof T)[]).forEach((key) => {
    const a = next[key];
    const b = prev[key];
    if (typeof a === "string") {
      const trimmed = a.trim();
      if (trimmed !== (b ?? "").trim()) out[key] = trimmed as T[keyof T];
    }
  });
  return out;
}


const UpdateName = () => {
  const navigate = useNavigate();
  const { user, setUser, isLoading: authLoading } = useAuth();

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      surname: user?.surname ?? "",
      othernames: user?.othernames ?? "",
    },
  });

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
        <p className="text-muted mt-2">Loading...</p>
      </Container>
    );
  }
  if (!user) return <Navigate to="/login" replace />;


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const payload = changedStringFields(data, {
      surname: user.surname,
      othernames: user.othernames,
    }) as UpdateNames;

    if (Object.keys(payload).length === 0) {
      setServerError("No changes were made");
      return;
    }

    try {
      const res = await api.patch<UpdateNamesResponse>(
        "/auth/update/names",
        payload
      );
      setUser(res.data.user);
      reset({
        surname: res.data.user.surname,
        othernames: res.data.user.othernames,
      });
      setSuccessMessage(res.data.message);
      redirectRef.current = { path: "/profile", delayMs: 1500 };
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        setServerError("An unexpected error occurred.");
        return;
      }
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 422 && Array.isArray(detail)) {
        detail.forEach((item: unknown) => {
          if (typeof item !== "object" || item === null) return;
          const v = item as { loc?: unknown[]; msg?: string };
          const field = v.loc?.[v.loc.length - 1];
          if ((field === "surname" || field === "othernames") && v.msg) {
            setError(field, { type: "server", message: v.msg });
          }
        });
        return;
      }

      setServerError(
        typeof detail === "string"
          ? detail
          : `Request failed (${status ?? "unknown"}).`
      );
    }
  };


  return (
    <Container className="py-5">
      <Card className="mx-auto" style={{ maxWidth: 720 }}>
        <Card.Body>
          <Card.Title className="mb-4">Change Name</Card.Title>

          {successMessage && (
            <Alert variant="success">
              {successMessage}
              <div className="small mt-1">Redirecting to profile...</div>
            </Alert>
          )}
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
            <Row>
              <Col md={6}>
                <Form.Group className="mb-4" controlId="surname">
                  <Form.Label className="fw-semibold">Surname</Form.Label>
                  <Form.Control
                    type="text"
                    autoComplete="family-name"
                    isInvalid={!!errors.surname}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("surname")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.surname?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-4" controlId="othernames">
                  <Form.Label className="fw-semibold">
                    Other Names
                  </Form.Label>
                  <Form.Control
                    type="text"
                    autoComplete="given-name"
                    isInvalid={!!errors.othernames}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("othernames")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.othernames?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex gap-2">
              <Button
                type="submit"
                variant="primary"
                disabled={
                  isSubmitting || !isDirty || successMessage !== null
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
                onClick={() => navigate("/profile")}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default UpdateName;





// src/pages/admin/SetupHome.tsx

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";

import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import Alert from "react-bootstrap/Alert";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import { handleApiError } from "@/lib/handleApiError";
import type { SetupHomeResponse } from "@/types";


const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const BANNER_MAX_BYTES = 8 * 1024 * 1024;


const schema = z.object({
  sitename: z
    .string()
    .max(120, "Site name must not exceed 120 characters")
    .optional(),

  intro: z
    .string()
    .max(1200, "Intro must not exceed 1200 characters")
    .optional(),

  logo_key: z
    .any()
    .optional()
    .refine(
      (files) => {
        if (!files || !(files instanceof FileList) || files.length === 0) return true;
        const file = files[0] as File;
        if (!["image/jpeg", "image/png"].includes(file.type)) return false;
        if (file.size > LOGO_MAX_BYTES) return false;
        return true;
      },
      { message: "Logo must be JPG/PNG and under 5 MiB" }
    ),

  banner_key: z
    .any()
    .optional()
    .refine(
      (files) => {
        if (!files || !(files instanceof FileList) || files.length === 0) return true;
        const file = files[0] as File;
        if (!["image/jpeg", "image/png"].includes(file.type)) return false;
        if (file.size > BANNER_MAX_BYTES) return false;
        return true;
      },
      { message: "Banner must be JPG/PNG and under 8 MiB" }
    ),
});

type FormData = z.infer<typeof schema>;


const SetupHome = () => {
  const navigate = useNavigate();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const redirectRef = useRef<{ path: string; delayMs: number } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sitename: "", intro: "" },
  });


  useEffect(() => {
    const p = redirectRef.current;
    if (!p) return;
    const id = window.setTimeout(
      () => navigate(p.path, { replace: true }),
      p.delayMs
    );
    return () => window.clearTimeout(id);
  }, [successMessage, navigate]);


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);
    redirectRef.current = null;

    const formData = new FormData();

    if (data.sitename !== undefined && data.sitename.trim() !== "") {
      formData.append("sitename", data.sitename.trim());
    }

    if (data.intro !== undefined) {
      formData.append("intro", data.intro.trim());
    }

    const logoFile = (data.logo_key as FileList | undefined)?.[0];
    if (logoFile) formData.append("logo_key", logoFile);

    const bannerFile = (data.banner_key as FileList | undefined)?.[0];
    if (bannerFile) formData.append("banner_key", bannerFile);

    try {
      const res = await api.post<SetupHomeResponse>(
        "/home/setup",
        formData
      );

      setSuccessMessage(res.data.message);
      redirectRef.current = { path: "/", delayMs: 1500 };
    } catch (err) {
      const msg = handleApiError<FormData>(err, {
        navigate,
        setError,
        validFields: ["sitename", "intro", "logo_key", "banner_key"],
        redirectOnAuth: false,
        redirectOnForbidden: false,
      });
      if (msg) setServerError(msg);
    }
  };


  return (
    <Container className="py-5">
      <Card className="mx-auto" style={{ maxWidth: 720 }}>
        <Card.Body>
          <Card.Title className="mb-4">Home Settings</Card.Title>

          {successMessage && (
            <Alert variant="success">
              {successMessage}
              <div className="small mt-1">Redirecting to homepage...</div>
            </Alert>
          )}

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
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="sitename">
                  <Form.Label className="fw-semibold">
                    Site Name
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter site name"
                    isInvalid={!!errors.sitename}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("sitename")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.sitename?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="intro">
                  <Form.Label className="fw-semibold">Intro</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    placeholder="Enter homepage introduction"
                    isInvalid={!!errors.intro}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("intro")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.intro?.message}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="logo_key">
                  <Form.Label className="fw-semibold">Logo</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/png"
                    isInvalid={!!errors.logo_key}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("logo_key")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.logo_key?.message as string | undefined}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    JPG or PNG. Maximum 5 MiB.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="banner_key">
                  <Form.Label className="fw-semibold">Banner</Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/jpeg,image/png"
                    isInvalid={!!errors.banner_key}
                    disabled={isSubmitting || successMessage !== null}
                    {...register("banner_key")}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.banner_key?.message as string | undefined}
                  </Form.Control.Feedback>
                  <Form.Text className="text-muted">
                    JPG or PNG. Maximum 8 MiB.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Button
              type="submit"
              variant="primary"
              className="w-100"
              disabled={isSubmitting || successMessage !== null}
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
                  Saving...
                </>
              ) : (
                "Save Home Settings"
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default SetupHome;

