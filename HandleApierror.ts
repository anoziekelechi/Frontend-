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
