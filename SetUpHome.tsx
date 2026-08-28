

// src/pages/admin/SetupHome.tsx

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
import type { HomeSetupResponse } from "@/types/site";


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
    .instanceof(FileList)
    .optional(),

  banner_key: z
    .instanceof(FileList)
    .optional(),
});


type FormData = z.infer<typeof schema>;


const SetupHome = () => {
  const navigate = useNavigate();

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const [serverError, setServerError] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: zodResolver(schema),

    defaultValues: {
      sitename: "",
      intro: "",
    },
  });


  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();

      // -------------------------------------------------------------
      // Site name
      // -------------------------------------------------------------

      if (
        data.sitename !== undefined &&
        data.sitename.trim() !== ""
      ) {
        formData.append(
          "sitename",
          data.sitename.trim(),
        );
      }

      // -------------------------------------------------------------
      // Intro
      // -------------------------------------------------------------

      if (data.intro !== undefined) {
        formData.append(
          "intro",
          data.intro,
        );
      }

      // -------------------------------------------------------------
      // Logo
      // -------------------------------------------------------------

      const logoFile = data.logo_key?.[0];

      if (logoFile) {
        formData.append(
          "logo_key",
          logoFile,
        );
      }

      // -------------------------------------------------------------
      // Banner
      // -------------------------------------------------------------

      const bannerFile = data.banner_key?.[0];

      if (bannerFile) {
        formData.append(
          "banner_key",
          bannerFile,
        );
      }

      // -------------------------------------------------------------
      // Send PATCH
      // -------------------------------------------------------------

      const response =
        await api.patch<HomeSetupResponse>(
          "/home/setup",
          formData,
        );

      setSuccessMessage(
        response.data.message ?? "Home settings saved successfully.",
      );

      // Redirect after successful update.
      window.setTimeout(() => {
        navigate("/");
      }, 1500);

    } catch (error: any) {

      const detail = error.response?.data?.detail;

      if (typeof detail === "string") {
        setServerError(detail);
      } else {
        setServerError(
          "Failed to save home settings.",
        );
      }
    }
  };


  return (
    <Container
      className="py-5"
      style={{ maxWidth: 640 }}
    >
      <div className="bg-white p-4 rounded shadow-sm">

        <h1 className="h3 text-center mb-4">
          Home Settings
        </h1>


        {/* =========================================================
            SUCCESS
        ========================================================= */}

        {successMessage && (
          <Alert
            variant="success"
            className="text-center"
          >
            {successMessage}

            <div className="small mt-1">
              Redirecting to homepage...
            </div>
          </Alert>
        )}


        {/* =========================================================
            ERROR
        ========================================================= */}

        {serverError && (
          <Alert
            variant="danger"
            className="text-center"
          >
            {serverError}
          </Alert>
        )}


        <Form
          onSubmit={handleSubmit(onSubmit)}
        >

          {/* =======================================================
              SITE NAME
          ======================================================= */}

          <Form.Group
            className="mb-3"
            controlId="sitename"
          >
            <Form.Label>
              Site Name
            </Form.Label>

            <Form.Control
              type="text"
              placeholder="Enter site name"
              isInvalid={!!errors.sitename}
              {...register("sitename")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.sitename?.message}
            </Form.Control.Feedback>
          </Form.Group>


          {/* =======================================================
              INTRO
          ======================================================= */}

          <Form.Group
            className="mb-3"
            controlId="intro"
          >
            <Form.Label>
              Intro
            </Form.Label>

            <Form.Control
              as="textarea"
              rows={4}
              placeholder="Enter homepage introduction"
              isInvalid={!!errors.intro}
              {...register("intro")}
            />

            <Form.Control.Feedback type="invalid">
              {errors.intro?.message}
            </Form.Control.Feedback>
          </Form.Group>


          {/* =======================================================
              LOGO
          ======================================================= */}

          <Form.Group
            className="mb-3"
            controlId="logo_key"
          >
            <Form.Label>
              Logo
            </Form.Label>

            <Form.Control
              type="file"
              accept="image/jpeg,image/png"
              isInvalid={!!errors.logo_key}
              {...register("logo_key")}
            />

            <Form.Text className="text-muted">
              JPG, JPEG or PNG. Maximum 5 MiB.
            </Form.Text>

            <Form.Control.Feedback type="invalid">
              {errors.logo_key?.message}
            </Form.Control.Feedback>
          </Form.Group>


          {/* =======================================================
              BANNER
          ======================================================= */}

          <Form.Group
            className="mb-4"
            controlId="banner_key"
          >
            <Form.Label>
              Banner
            </Form.Label>

            <Form.Control
              type="file"
              accept="image/jpeg,image/png"
              isInvalid={!!errors.banner_key}
              {...register("banner_key")}
            />

            <Form.Text className="text-muted">
              JPG, JPEG or PNG. Maximum 8 MiB.
            </Form.Text>

            <Form.Control.Feedback type="invalid">
              {errors.banner_key?.message}
            </Form.Control.Feedback>
          </Form.Group>


          {/* =======================================================
              SUBMIT
          ======================================================= */}

          <Button
            type="submit"
            variant="primary"
            className="w-100"
            disabled={
              isSubmitting ||
              successMessage !== null
            }
          >
            {isSubmitting
              ? "Saving..."
              : "Save Home Settings"}
          </Button>

        </Form>

      </div>
    </Container>
  );
};


export default SetupHome;


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

  // ... rest of 


{ path: "profile", element: <Profile /> },
{ path: "contact-admin", element: <ContactAdmin /> },
{ path: "resend-verification", element: <ResendOtp /> },
