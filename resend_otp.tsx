
// src/components/auth/ResendOtp.tsx

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import axios, { AxiosError } from "axios";

import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import type {
  MessageResponse,
  OtpType,
  ResendOtpRequest,
} from "@/types";


// =============================================================
// TYPES
// =============================================================

interface ResendOtpProps {
  email: string;
  accountToken: string;
  otpType: OtpType;
  buttonLabel?: string;
  onSessionExpired?: () => void;
  disabled?: boolean;
  cooldownSeconds?: number;
  onSuccess?: (message: string) => void;
  onError?: (message: string, status?: number) => void;
}

interface FastApiValidationError {
  msg?: string;
  loc?: (string | number)[];
  type?: string;
}


// =============================================================
// BACKEND MESSAGE EXTRACTION
//
// The backend is the single source of truth for user-facing
// copy. This helper pulls the message out of the response
// WITHOUT rewriting it.
//
// Only falls back when the backend gave us nothing usable —
// which means the request never reached the application layer
// (network error, proxy failure, unhandled 5xx, etc.).
// =============================================================

function extractRetryAfter(error: AxiosError): number | null {
  const raw = error.response?.headers?.["retry-after"];
  if (raw === undefined || raw === null) return null;

  const asString = String(raw).trim();

  const seconds = Number(asString);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  const date = new Date(asString);
  if (!Number.isNaN(date.getTime())) {
    const diff = Math.ceil((date.getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : null;
  }

  return null;
}


/**
 * Pull the backend-provided message out of a FastAPI error
 * response, without rewriting it.
 *
 * - `detail` as string  → returned verbatim
 * - `detail` as array   → first item's `msg` returned verbatim
 * - otherwise           → null (frontend must supply a
 *                         transport-level fallback)
 */
function extractBackendMessage(error: AxiosError): string | null {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as FastApiValidationError | undefined;
    if (first?.msg) return first.msg;
  }

  return null;
}


// =============================================================
// COMPONENT
// =============================================================

const ResendOtp = ({
  email,
  accountToken,
  otpType,
  buttonLabel = "Resend code",
  onSessionExpired,
  disabled = false,
  cooldownSeconds = 30,
  onSuccess,
  onError,
}: ResendOtpProps) => {
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);


  // ---------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);


  // ---------------------------------------------------------
  // Cooldown ticker
  // ---------------------------------------------------------
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);


  // ---------------------------------------------------------
  // Reset on token / flow change
  // ---------------------------------------------------------
  useEffect(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setCooldown(0);
  }, [accountToken, otpType]);


  // ---------------------------------------------------------
  // Send
  // ---------------------------------------------------------
  const handleResend = useCallback(async () => {
    if (isSending || cooldown > 0 || disabled) return;

    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const payload: ResendOtpRequest = {
      email,
      account_token: accountToken,
      otp_type: otpType,
    };

    try {
      const response = await api.post<MessageResponse>(
        "/auth/resend-otp",
        payload,
        { signal: controller.signal },
      );

      if (!mountedRef.current) return;

      // Backend owns the success copy.
      // If it's missing, that's a backend contract violation —
      // log it, don't invent copy on the frontend.
      const message = response.data?.message;
      if (!message) {
        // eslint-disable-next-line no-console
        console.error(
          "Backend returned 2xx without a `message` field. " +
            "This violates the API contract.",
        );
        return;
      }

      setSuccessMessage(message);
      setCooldown(cooldownSeconds);
      onSuccess?.(message);

    } catch (error: unknown) {
      if (axios.isCancel(error)) return;
      if (!mountedRef.current) return;

      // ------------------------------------------------
      // Non-axios throw — bug in our code, or fetch
      // layer (interceptor) failed before the request
      // even left the browser.
      // ------------------------------------------------
      if (!axios.isAxiosError(error)) {
        const msg = "Network error. Please try again.";
        setErrorMessage(msg);
        onError?.(msg);
        return;
      }

      const status = error.response?.status;

      // ------------------------------------------------
      // No response at all — the request never reached
      // the backend. This is the ONE case the frontend
      // must own the copy, because the backend cannot.
      // ------------------------------------------------
      if (!error.response) {
        const msg = "Network error. Please try again.";
        setErrorMessage(msg);
        onError?.(msg);
        return;
      }

      // ------------------------------------------------
      // Backend spoke. Use its message verbatim.
      // ------------------------------------------------
      const backendMessage = extractBackendMessage(error);

      // ------------------------------------------------
      // 400 — session expired / invalid.
      //
      // Backend contract guarantees a string `detail`
      // for this case. If it's missing, we still need
      // *something* to show, but flag it as a contract
      // violation.
      // ------------------------------------------------
      if (status === 400) {
        if (!backendMessage) {
          // eslint-disable-next-line no-console
          console.error(
            "Backend returned 400 without `detail`. " +
              "Contract violation.",
          );
        }

        const msg = backendMessage ?? "Session expired.";
        setErrorMessage(msg);
        onError?.(msg, status);

        if (onSessionExpired) {
          window.setTimeout(() => {
            if (mountedRef.current) onSessionExpired();
          }, 1500);
        }
        return;
      }

      // ------------------------------------------------
      // 429 — rate limited.
      //
      // Backend owns the copy AND the cooldown value
      // via `detail` + `Retry-After`.
      // ------------------------------------------------
      if (status === 429) {
        if (!backendMessage) {
          // eslint-disable-next-line no-console
          console.error(
            "Backend returned 429 without `detail`. " +
              "Contract violation.",
          );
        }

        const msg = backendMessage ?? "Too many requests.";
        setErrorMessage(msg);
        onError?.(msg, status);

        const retryAfterSeconds = extractRetryAfter(error);
        if (retryAfterSeconds !== null) {
          setCooldown(retryAfterSeconds);
        }
        return;
      }

      // ------------------------------------------------
      // All other statuses (422, 500, etc.)
      //
      // Backend detail is authoritative. Only fall back
      // when the backend gave us nothing (e.g. reverse
      // proxy returned a bare 502 HTML page).
      // ------------------------------------------------
      const msg =
        backendMessage ??
        `Request failed${status ? ` (${status})` : ""}.`;

      setErrorMessage(msg);
      onError?.(msg, status);

    } finally {
      if (mountedRef.current) setIsSending(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [
    email,
    accountToken,
    otpType,
    cooldownSeconds,
    cooldown,
    isSending,
    disabled,
    onSessionExpired,
    onSuccess,
    onError,
  ]);


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  const isButtonDisabled = disabled || isSending || cooldown > 0;

  return (
    <div className="d-flex flex-column gap-2">
      <Button
        variant="link"
        className="p-0 text-decoration-none align-self-center"
        onClick={handleResend}
        disabled={isButtonDisabled}
        aria-busy={isSending}
      >
        {isSending ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
              className="me-2"
            />
            Sending...
          </>
        ) : cooldown > 0 ? (
          `Resend in ${cooldown}s`
        ) : (
          buttonLabel
        )}
      </Button>

      <div aria-live="polite" aria-atomic="true">
        {successMessage && (
          <Alert variant="info" className="mb-0 py-2 small text-center">
            {successMessage}
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="warning" className="mb-0 py-2 small text-center">
            {errorMessage}
          </Alert>
        )}
      </div>
    </div>
  );
};


export default ResendOtp;
