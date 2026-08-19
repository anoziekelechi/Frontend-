Type 'Resolver<{ sitename: string; aboutus?: string | undefined; intro?: string | undefined; mission?: string | undefined; vision?: string | undefined; logo_key?: any; banner_key?: any; }, any, { sitename: string; ... 5 more ...; banner_key?: any; }>' is not assignable to type 'Resolver<HomeSetupForm, any, HomeSetupForm>'.
  Types of parameters 'options' and 'options' are incompatible.
    Type 'ResolverOptions<HomeSetupForm>' is not assignable to type 'ResolverOptions<{ sitename: string; aboutus?: string | undefined; intro?: string | undefined; mission?: string | undefined; vision?: string | undefined; logo_key?: any; banner_key?: any; }>'.
      Type 'string | undefined' is not assignable to type 'string'.
        Type 'undefined' is not assignable to type 'string'.ts(2322)
(property

 Argument of type '(data: HomeSetupForm) => Promise<void>' is not assignable to parameter of type 'SubmitHandler<TFieldValues, Promise<void>>'.
  Types of parameters 'data' and 'data' are incompatible.
    Type 'TFieldValues' is not assignable to type 'HomeSetupForm'.
      Type 'FieldValues' is missing the following properties from type 'HomeSetupForm': sitename, intro, aboutus, mission, and 3 more.ts(2345)
const onSubmit: (data: HomeSetupForm) => Promise<void>



// src/pages/admin/SetupHome.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import type { HomeSetupForm, HomeSetupResponse } from "@/types/site";

const schema = z.object({
  sitename: z.string().min(1, "Site name is required").max(120),
  aboutus: z.string().max(2000).optional(),
  intro: z.string().max(1200).optional(),
  mission: z.string().max(1200).optional(),
  vision: z.string().max(1200).optional(),
  logo_key: z.any().optional(),
  banner_key: z.any().optional(),
});

type FormData = HomeSetupForm;

const SetupHome = () => {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: HomeSetupForm) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("sitename", data.sitename);

      if (data.aboutus) formData.append("aboutus", data.aboutus);
      if (data.intro) formData.append("intro", data.intro);
      if (data.mission) formData.append("mission", data.mission);
      if (data.vision) formData.append("vision", data.vision);

      if (data.logo_key?.[0]) {
        formData.append("logo_key", data.logo_key[0]);
      }
      if (data.banner_key?.[0]) {
        formData.append("banner_key", data.banner_key[0]);
      }

      const res = await api.post<HomeSetupResponse>("/setup", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/");
      }, 1800);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      setServerError(
        typeof detail === "string" ? detail : "Failed to save home settings"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Setup Home Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting to homepage...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Site Name *</label>
            <input
              {...register("sitename")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.sitename ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.sitename && (
              <p className="text-sm text-red-600 mt-1">{errors.sitename.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Intro</label>
            <textarea
              {...register("intro")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">About Us</label>
            <textarea
              {...register("aboutus")}
              rows={4}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mission</label>
            <textarea
              {...register("mission")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vision</label>
            <textarea
              {...register("vision")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Logo</label>
            <input
              type="file"
              accept="image/*"
              {...register("logo_key")}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Banner</label>
            <input
              type="file"
              accept="image/*"
              {...register("banner_key")}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Home Settings"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupHome;

// src/pages/admin/SetupHome.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";
import type { HomeSetupResponse } from "@/types/site";

const schema = z.object({
  sitename: z.string().min(1, "Site name is required").max(120),
  aboutus: z.string().max(2000).optional(),
  intro: z.string().max(1200).optional(),
  mission: z.string().max(1200).optional(),
  vision: z.string().max(1200).optional(),
  logo_key: z.any().optional(),
  banner_key: z.any().optional(),
});

type FormData = z.infer<typeof schema>;

export default function SetupHome() {
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("sitename", data.sitename);

      if (data.aboutus) formData.append("aboutus", data.aboutus);
      if (data.intro) formData.append("intro", data.intro);
      if (data.mission) formData.append("mission", data.mission);
      if (data.vision) formData.append("vision", data.vision);

      if (data.logo_key?.[0]) {
        formData.append("logo_key", data.logo_key[0]);
      }
      if (data.banner_key?.[0]) {
        formData.append("banner_key", data.banner_key[0]);
      }

      const res = await api.post<HomeSetupResponse>("/setup", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccessMessage(res.data.message);

      setTimeout(() => {
        navigate("/");
      }, 1800);
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      setServerError(detail || "Failed to save home settings");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Setup Home Settings
        </h1>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
            <p className="text-sm mt-1">Redirecting to homepage...</p>
          </div>
        )}

        {serverError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Site Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Site Name *</label>
            <input
              {...register("sitename")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.sitename ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.sitename && (
              <p className="text-sm text-red-600 mt-1">{errors.sitename.message}</p>
            )}
          </div>

          {/* Intro */}
          <div>
            <label className="block text-sm font-medium mb-1">Intro</label>
            <textarea
              {...register("intro")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          {/* About Us */}
          <div>
            <label className="block text-sm font-medium mb-1">About Us</label>
            <textarea
              {...register("aboutus")}
              rows={4}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          {/* Mission */}
          <div>
            <label className="block text-sm font-medium mb-1">Mission</label>
            <textarea
              {...register("mission")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          {/* Vision */}
          <div>
            <label className="block text-sm font-medium mb-1">Vision</label>
            <textarea
              {...register("vision")}
              rows={3}
              className="w-full px-4 py-3 border rounded-lg border-gray-300"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium mb-1">Logo</label>
            <input
              type="file"
              accept="image/*"
              {...register("logo_key")}
              className="w-full"
            />
          </div>

          {/* Banner Upload */}
          <div>
            <label className="block text-sm font-medium mb-1">Banner</label>
            <input
              type="file"
              accept="image/*"
              {...register("banner_key")}
              className="w-full"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !!successMessage}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Home Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}




// src/routes/AdminRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but not admin
  if (!user.is_admin) {
    return <Navigate to="/" replace />;
  }

  // User is admin
  return <>{children}</>;
}




// src/routes/AppRoutes.tsx (example)
import { Routes, Route } from "react-router-dom";
import SetupHome from "@/pages/admin/SetupHome";
import { AdminRoute } from "@/routes/AdminRoute";

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      {/* ... other public routes */}

      {/* Admin only routes */}
      <Route
        path="/admin/setup-home"
        element={
          <AdminRoute>
            <SetupHome />
          </AdminRoute>
        }
      />

      {/* Other admin routes */}
      <Route
        path="/add_country"
        element={
          <AdminRoute>
            <CreateCountry />
          </AdminRoute>
        }
      />
    </Routes>
  );
}




// protected page
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

export default function SetupHome() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  // ... rest of your form
}

//contact-admin 


// src/features/users/ContactAdmin.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "react-router-dom";
import api from "@/api/client";
import type { ContactAdminResponse } from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message is too long"),
});

type FormData = z.infer<typeof schema>;

const ContactAdmin = () => {
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

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<ContactAdminResponse>("/contact-admin", data);
      setSuccessMessage(res.data.message || "Message sent to admin");
      reset();
    } catch (err: any) {
      setServerError(
        err.response?.data?.detail || "Failed to send message"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">Contact Admin</h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Your account appears to be suspended. Send a message to request
          reactivation.
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="your@email.com"
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              {...register("message")}
              rows={5}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.message ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="Explain why your account should be reactivated..."
            />
            {errors.message && (
              <p className="text-sm text-red-600 mt-1">{errors.message.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Send Message"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm">
          <Link to="/login" className="text-blue-600 font-medium">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ContactAdmin;

//resendotp




// src/features/users/ResendOtp.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "react-router-dom";
import api from "@/api/client";
import type { ResendVerificationResponse } from "@/types/user";

const schema = z.object({
  email: z.string().email("Invalid email"),
  account_token: z.string().min(1, "Account token is required"),
});

type FormData = z.infer<typeof schema>;

const ResendOtp = () => {
  const location = useLocation();
  const state = (location.state || {}) as {
    email?: string;
    account_token?: string;
    login_token?: string;
  };

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: state.email || "",
      account_token: state.account_token || state.login_token || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post<ResendVerificationResponse>(
        "/resend-verification",
        data
      );
      setSuccessMessage(res.data.message || "Verification OTP sent");
    } catch (err: any) {
      setServerError(
        err.response?.data?.detail || "Failed to resend verification OTP"
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Resend Verification
        </h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Your account is not verified. Request a new verification code.
        </p>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-center">
            {successMessage}
          </div>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-center">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              {...register("email")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.email ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Account Token
            </label>
            <input
              type="text"
              {...register("account_token")}
              className={`w-full px-4 py-3 border rounded-lg ${
                errors.account_token ? "border-red-500" : "border-gray-300"
              }`}
              placeholder="From login response"
            />
            {errors.account_token && (
              <p className="text-sm text-red-600 mt-1">
                {errors.account_token.message}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Required by backend to prevent abuse. Use the token from login if
              available.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50"
          >
            {isSubmitting ? "Sending..." : "Resend Verification OTP"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm">
          <Link to="/login" className="text-blue-600 font-medium">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResendOtp;


{ path: "profile", element: <Profile /> },
{ path: "contact-admin", element: <ContactAdmin /> },
{ path: "resend-verification", element: <ResendOtp /> },
