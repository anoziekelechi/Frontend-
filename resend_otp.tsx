
// src/components/auth/ResendOtp.tsx

import { useEffect, useRef, useState } from "react";
import axios from "axios";

import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import type { MessageResponse, OtpType, ResendOtpRequest } from "@/types";


// =============================================================
// PROPS
// =============================================================

interface ResendOtpProps {
  /**
   * Email used to look up the user.
   *
   * NOTE: for `email_change`, the backend resolves the user from
   * the Redis session — the value of `email` here is not used for
   * the lookup. It's still required by the request schema, so pass
   * the current account email.
   */
  email: string;

  /** Anti-replay session token from the flow that initiated OTP. */
  accountToken: string;

  /** Which flow this OTP belongs to. */
  otpType: OtpType;

  /**
   * Label for the button. Defaults to "Resend code".
   * e.g. "Resend verification code", "Send new login code".
   */
  buttonLabel?: string;

  /**
   * Called when the session token is expired / invalid (HTTP 400).
   * Parent decides where to redirect (e.g. /register, /login).
   */
  onSessionExpired?: () => void;

  /** Disable while the parent is in a success/terminal state. */
  disabled?: boolean;

  /** Cooldown (seconds) enforced client-side after success. */
  cooldownSeconds?: number;
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
}: ResendOtpProps) => {
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Avoid setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
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
  // Reset state when the session token or flow changes
  //
  // Prevents a cooldown / success / error message from one
  // flow leaking into the next (e.g. re-entering the page
  // with a fresh token).
  // ---------------------------------------------------------
  useEffect(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setCooldown(0);
  }, [accountToken, otpType]);


  // ---------------------------------------------------------
  // Send
  // ---------------------------------------------------------
  const handleResend = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    const payload: ResendOtpRequest = {
      email,
      account_token: accountToken,
      otp_type: otpType,
    };

    try {
      const response = await api.post<MessageResponse>(
        "/auth/resend-otp",
        payload
      );

      if (!mountedRef.current) return;

      // Trust backend message; fall back only if absent.
      setSuccessMessage(response.data.message);

      setCooldown(cooldownSeconds);

    } catch (error: unknown) {
      if (!mountedRef.current) return;

      if (!axios.isAxiosError(error)) {
        setErrorMessage("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // -------------------------------------------------------
      // 400 — session token expired / invalid.
      //
      // Backend contract: this status is reserved for
      // "session expired or invalid" across all flows.
      // Notify parent so it can route the user back to the
      // initiate-* page for this flow.
      // -------------------------------------------------------
      if (status === 400) {
        setErrorMessage(
          typeof detail === "string"
            ? detail
            : "Session expired. Please start over."
        );

        if (onSessionExpired) {
          window.setTimeout(() => {
            if (mountedRef.current) onSessionExpired();
          }, 1500);
        }
        return;
      }

      // -------------------------------------------------------
      // 429 — rate limited / OTP cooldown.
      //
      // Prefer the Retry-After header when present; otherwise
      // show the backend's detail as-is.
      // -------------------------------------------------------
      if (status === 429) {
        const retryAfterHeader = error.response?.headers?.["retry-after"];
        const parsed = retryAfterHeader
          ? parseInt(String(retryAfterHeader), 10)
          : NaN;
        const retryAfterSeconds =
          Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        setErrorMessage(
          typeof detail === "string"
            ? detail
            : retryAfterSeconds
              ? `Please wait ${retryAfterSeconds}s before requesting another code.`
              : "Please wait before requesting another code."
        );

        if (retryAfterSeconds !== null) {
          setCooldown(retryAfterSeconds);
        }
        return;
      }

      // -------------------------------------------------------
      // 422 — validation. Show the first backend message.
      // -------------------------------------------------------
      if (status === 422 && Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | undefined;
        setErrorMessage(first?.msg ?? "Invalid request.");
        return;
      }

      // -------------------------------------------------------
      // Everything else: trust backend detail.
      // -------------------------------------------------------
      setErrorMessage(
        typeof detail === "string"
          ? detail
          : `Unable to resend code${
              status ? ` (${status})` : ""
            }. Please try again.`
      );
    } finally {
      if (mountedRef.current) setIsSending(false);
    }
  };


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

      {/* Live region for screen readers */}
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
