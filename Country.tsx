
// src/pages/countries/CreateCountry.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "@/api/client";
import type { CreateCountryResponse } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required"),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .toUpperCase(),
  whatsapp: z.string().min(8, "WhatsApp number is required"),
});

type FormData = z.infer<typeof schema>;

export default function CreateCountry() {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<CreateCountryResponse>("/add_country", data);
      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/countries");
      }, 1800);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 409) {
        setServerError(detail);
      } else if (status === 422) {
        (detail || []).forEach((err: any) => {
          const field = err.loc?.[err.loc.length - 1];
          if (typeof field === "string") {
            setError(field as keyof FormData, { message: err.msg });
          }
        });
      } else {
        setServerError(detail || "Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Country</h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Country Name</label>
            <input
              {...register("name")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency Code</label>
            <input
              {...register("currency_code")}
              maxLength={3}
              className={`w-full px-4 py-3 border rounded-lg uppercase ${
                errors.currency_code ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.currency_code && (
              <p className="text-sm text-red-600 mt-1">
                {errors.currency_code.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input
              {...register("whatsapp")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.whatsapp ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.whatsapp && (
              <p className="text-sm text-red-600 mt-1">{errors.whatsapp.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Country"}
          </button>
        </form>
      </div>
    </div>
  );
}
// src/pages/countries/CountriesList.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryListRead } from "@/types/country";

const CountriesList = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CountryListRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CountryListRead>("/countries")
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load countries")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading countries...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  const countries = data?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Countries</h1>

        {user?.is_admin && (
          <Link
            to="/add_country"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
          >
            + Add Country
          </Link>
        )}
      </div>

      {countries.length === 0 ? (
        <h6 className="text-center text-gray-600 py-10">
          No available country now
        </h6>
      ) : (
        <div className="space-y-3">
          {countries.map((country) => (
            <Link
              key={country.id}
              to={`/countries/${country.id}`}
              className="block p-4 bg-white rounded-lg shadow hover:shadow-md border transition"
            >
              <span className="text-lg font-medium">{country.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountriesList;





export interface CountryCreate {
  name: string;
  currency_code: string;
  whatsapp?: string;
  email_support?: string;
}



export interface CountryUpdate {
  name?: string;
  currency_code?: string;
  whatsapp?: string;
  email_support?: string;
}






// src/pages/countries/CreateCountry.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import { useState } from "react";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CreateCountryResponse } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required"),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .toUpperCase(),
  whatsapp: z.string().min(8, "WhatsApp is required"),
  email_support: z.string().email("Invalid support email").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const CreateCountry = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (authLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        ...data,
        email_support: data.email_support || undefined,
      };

      const res = await api.post<CreateCountryResponse>("/add_country", payload);
      setSuccessMessage(res.data.message);

      setTimeout(() => navigate("/countries"), 1800);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 409) {
        setServerError(detail);
      } else if (status === 422) {
        (detail || []).forEach((err: any) => {
          const field = err.loc?.[err.loc.length - 1];
          if (typeof field === "string") {
            setError(field as keyof FormData, { message: err.msg });
          }
        });
      } else {
        setServerError(detail || "Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Country</h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Country Name</label>
            <input
              {...register("name")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency Code</label>
            <input
              {...register("currency_code")}
              maxLength={3}
              className={`w-full px-4 py-3 border rounded-lg uppercase ${
                errors.currency_code ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.currency_code && (
              <p className="text-sm text-red-600 mt-1">
                {errors.currency_code.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input
              {...register("whatsapp")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.whatsapp ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.whatsapp && (
              <p className="text-sm text-red-600 mt-1">{errors.whatsapp.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Support Email</label>
            <input
              type="email"
              {...register("email_support")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email_support ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="support@example.com"
            />
            {errors.email_support && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email_support.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Country"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateCountry;






// src/pages/countries/CountryDetail.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryRead } from "@/types/country";

const CountryDetail = () => {
  const { country_id } = useParams<{ country_id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this country?")) return;

    try {
      const res = await api.delete(`/${country_id}`);
      setMessage(res.data.message || "Country deleted successfully");
      setTimeout(() => navigate("/countries"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete country");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  if (!country) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {message && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {message}
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <h1 className="text-3xl font-bold">{country.name}</h1>

        {user?.is_admin && (
          <div className="flex gap-3">
            <Link
              to={`/countries/${country.id}/edit`}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
            >
              Update
            </Link>
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <p>
          <strong>Currency Code:</strong> {country.currency_code}
        </p>
        <p>
          <strong>WhatsApp:</strong> {country.whatsapp}
        </p>
        <p>
          <strong>Support Email:</strong>{" "}
          {country.email_support || "Not set"}
        </p>
        <p>
          <strong>Created At:</strong>{" "}
          {new Date(country.created_at).toLocaleString()}
        </p>
        <p>
          <strong>Updated At:</strong>{" "}
          {new Date(country.updated_at).toLocaleString()}
        </p>
      </div>

      <Link
        to="/countries"
        className="inline-block mt-6 text-blue-600 hover:underline"
      >
        ← Back to Countries
      </Link>
    </div>
  );
};

export default CountryDetail;







// src/pages/countries/UpdateCountry.tsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryRead } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required").optional(),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .toUpperCase()
    .optional(),
  whatsapp: z.string().min(8, "WhatsApp is required").optional(),
  email_support: z.string().email("Invalid support email").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const UpdateCountry = () => {
  const { country_id } = useParams<{ country_id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!country_id) return;

    api
      .get<CountryRead>(`/${country_id}`)
      .then((res) => {
        reset({
          name: res.data.name,
          currency_code: res.data.currency_code,
          whatsapp: res.data.whatsapp,
          email_support: res.data.email_support || "",
        });
      })
      .catch((err) =>
        setServerError(err.response?.data?.detail || "Failed to load country")
      )
      .finally(() => setLoading(false));
  }, [country_id, reset]);

  if (authLoading || loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError(null);

    try {
      const payload = {
        ...data,
        email_support: data.email_support || undefined,
      };

      await api.put(`/${country_id}`, payload);
      setSuccessMessage("Country updated successfully");
      setTimeout(() => navigate(`/countries/${country_id}`), 1500);
    } catch (err: any) {
      setServerError(err.response?.data?.detail || "Failed to update country");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Update Country</h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Country Name</label>
            <input
              {...register("name")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency Code</label>
            <input
              {...register("currency_code")}
              className={`w-full px-4 py-3 border rounded-lg uppercase ${
                errors.currency_code ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.currency_code && (
              <p className="text-sm text-red-600 mt-1">
                {errors.currency_code.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input
              {...register("whatsapp")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.whatsapp ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.whatsapp && (
              <p className="text-sm text-red-600 mt-1">{errors.whatsapp.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Support Email</label>
            <input
              type="email"
              {...register("email_support")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email_support ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.email_support && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email_support.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Updating..." : "Update Country"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default UpdateCountry;


// latest update without user

// src/pages/countries/CreateCountry.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Navigate } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryCreate, CreateCountryResponse } from "@/types/country";

const schema = z.object({
  name: z.string().min(2, "Country name is required"),
  currency_code: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .transform((v) => v.toUpperCase()),
  whatsapp: z.string().optional().or(z.literal("")),
  email_support: z
    .string()
    .email("Invalid support email")
    .optional()
    .or(z.literal("")),
});

type FormData = CountryCreate;

const CreateCountry = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any, // aligns Zod transform with CountryCreate
  });

  if (authLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (data: CountryCreate) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const payload: CountryCreate = {
        name: data.name,
        currency_code: data.currency_code,
        whatsapp: data.whatsapp || undefined,
        email_support: data.email_support || undefined,
      };

      const res = await api.post<CreateCountryResponse>("/add_country", payload);
      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/countries");
      }, 1800);
    } catch (error: any) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (status === 409) {
        setServerError(detail);
      } else if (status === 422 && Array.isArray(detail)) {
        detail.forEach((err: any) => {
          const field = err.loc?.[err.loc.length - 1];
          if (typeof field === "string") {
            setError(field as keyof FormData, { message: err.msg });
          }
        });
      } else {
        setServerError(
          typeof detail === "string" ? detail : "Something went wrong"
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Create Country</h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Country Name</label>
            <input
              {...register("name")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.name ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency Code</label>
            <input
              {...register("currency_code")}
              maxLength={3}
              className={`w-full px-4 py-3 border rounded-lg uppercase ${
                errors.currency_code ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.currency_code && (
              <p className="text-sm text-red-600 mt-1">
                {errors.currency_code.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input
              {...register("whatsapp")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.whatsapp ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Optional"
            />
            {errors.whatsapp && (
              <p className="text-sm text-red-600 mt-1">{errors.whatsapp.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Support Email</label>
            <input
              type="email"
              {...register("email_support")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email_support ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Optional"
            />
            {errors.email_support && (
              <p className="text-sm text-red-600 mt-1">
                {errors.email_support.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Country"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateCountry;



