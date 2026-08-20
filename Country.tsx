


// src/pages/countries/CountryDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import ListGroup from "react-bootstrap/ListGroup";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import api from "@/api/client";
import type { CountryRead } from "@/types/country";

const CountryDetail = () => {
  const { country_id } = useParams<{ country_id: string }>();
  const navigate = useNavigate();

  const [country, setCountry] = useState<CountryRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!country_id) return;

    api
      .get<CountryRead>(`/${country_id}`)
      .then((res) => setCountry(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Country not found")
      )
      .finally(() => setLoading(false));
  }, [country_id]);

  // Custom function — not a React default
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this country?")) return;

    try {
      const res = await api.delete<{ message?: string }>(`/${country_id}`);
      setMessage(res.data.message || "Country deleted successfully");
      setTimeout(() => navigate("/countries"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete country");
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
          <Button
            as={Link as any}
            to={`/countries/${country.id}/edit`}
            variant="warning"
          >
            Update
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
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
          <span>{new Date(country.updated_at).toLocaleString()}</span>
        </ListGroup.Item>
      </ListGroup>

      <Link to="/countries" className="d-inline-block mt-4">
        ← Back to Countries
      </Link>
    </Container>
  );
};

export default CountryDetail;





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
import type { CountryRead, CountryUpdate } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required").optional(),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .transform((v) => v.toUpperCase())
    .optional(),
  whatsapp: z.string().optional().or(z.literal("")),
  email_support: z
    .string()
    .email("Invalid support email")
    .optional()
    .or(z.literal("")),
});

type FormData = CountryUpdate;

const UpdateCountry = () => {
  const { country_id } = useParams<{ country_id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  useEffect(() => {
    if (!country_id) return;

    api
      .get<CountryRead>(`/${country_id}`)
      .then((res) => {
        reset({
          name: res.data.name,
          currency_code: res.data.currency_code,
          whatsapp: res.data.whatsapp != null ? String(res.data.whatsapp) : "",
          email_support: res.data.email_support || "",
        });
      })
      .catch((err) =>
        setServerError(err.response?.data?.detail || "Failed to load country")
      )
      .finally(() => setLoading(false));
  }, [country_id, reset]);

  const onSubmit = async (data: CountryUpdate) => {
    setServerError(null);

    try {
      const payload: CountryUpdate = {
        name: data.name,
        currency_code: data.currency_code,
        whatsapp: data.whatsapp || undefined,
        email_support: data.email_support || undefined,
      };

      await api.put(`/${country_id}`, payload);
      setSuccessMessage("Country updated successfully");
      setTimeout(() => navigate(`/countries/${country_id}`), 1500);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setServerError(
        typeof detail === "string" ? detail : "Failed to update country"
      );
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
            <Form.Control
              type="text"
              isInvalid={!!errors.name}
              {...register("name")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.name?.message}
            </Form.Control.Feedback>
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
            <Form.Control.Feedback type="invalid">
              {errors.currency_code?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="whatsapp">
            <Form.Label>WhatsApp</Form.Label>
            <Form.Control
              type="text"
              placeholder="Optional"
              isInvalid={!!errors.whatsapp}
              {...register("whatsapp")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.whatsapp?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-4" controlId="email_support">
            <Form.Label>Support Email</Form.Label>
            <Form.Control
              type="email"
              placeholder="Optional"
              isInvalid={!!errors.email_support}
              {...register("email_support")}
            />
            <Form.Control.Feedback type="invalid">
              {errors.email_support?.message}
            </Form.Control.Feedback>
          </Form.Group>

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={isSubmitting || !!successMessage}
          >
            {isSubmitting ? "Updating..." : "Update Country"}
          </Button>
        </Form>
      </div>
    </Container>
  );
};

export default UpdateCountry;

