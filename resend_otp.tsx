
// src/components/ResendOtp.tsx

import { useEffect, useRef, useState } from "react";
import axios from "axios";

import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import api from "@/api/client";
import type {
  MessageResponse,
  OtpType,
} from "@/types/user";


// =============================================================
// PROPS
// =============================================================

interface ResendOtpProps {
  /** Email used to look up the user (see backend caveat for email_change). */
  email: string;

  /** Anti-replay session token from the flow that initiated OTP. */
  accountToken: string;

  /** Which flow this OTP belongs to. */
  otpType: OtpType;

  /**
   * Label for the button. Defaults to "Resend code".
   * e.g. "Resend verification code", "Send new login code"
   */
  buttonLabel?: string;

  /**
   * Called when the session token is expired / invalid (400).
   * Parent decides where to redirect (e.g. /register, /login).
   */
  onSessionExpired?: () => void;

  /** Disable while the parent is in a success/terminal state. */
  disabled?: boolean;

  /** Optional cooldown (seconds) enforced client-side after success. */
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

  // Ensure setState after unmount is avoided
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
  // Reset alerts when session token changes (new flow)
  // ---------------------------------------------------------
  useEffect(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [accountToken, otpType]);


  // ---------------------------------------------------------
  // Send
  // ---------------------------------------------------------
  const handleResend = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    try {
      const response = await api.post<MessageResponse>(
        "/auth/resend-otp",
        {
          email,
          account_token: accountToken,
          otp_type: otpType,
        }
      );

      if (!mountedRef.current) return;

      setSuccessMessage(
        response.data?.message || "A new OTP has been sent to your email."
      );

      setCooldown(cooldownSeconds);

    } catch (error: unknown) {
      if (!mountedRef.current) return;

      if (!axios.isAxiosError(error)) {
        setErrorMessage("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // 400 → session expired; notify parent, don't show raw message
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

      // 429 → cooldown; parse retry-after
      if (status === 429) {
        const retryAfterHeader = error.response?.headers?.["retry-after"];
        const retryAfter = retryAfterHeader
          ? parseInt(String(retryAfterHeader), 10)
          : null;

        setErrorMessage(
          typeof detail === "string"
            ? detail
            : retryAfter
              ? `Please wait ${retryAfter}s before requesting another code.`
              : "Please wait before requesting another code."
        );

        if (retryAfter && !Number.isNaN(retryAfter)) {
          setCooldown(retryAfter);
        }
        return;
      }

      // 422 → validation
      if (status === 422 && Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | undefined;
        setErrorMessage(first?.msg || "Invalid request.");
        return;
      }

      setErrorMessage(
        typeof detail === "string"
          ? detail
          : "Unable to resend code. Please try again."
      );
    } finally {
      if (mountedRef.current) setIsSending(false);
    }
  };


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------
  const isButtonDisabled =
    disabled || isSending || cooldown > 0;

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
  );
};


export default ResendOtp;
