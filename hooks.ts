

// src/hooks/useOtpSession.ts

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

import api from "@/api/client";
import { useOtpConfig } from "./useOtpConfig";
import { humanizeSeconds } from "@/lib/time";

import type {
  OtpType,
  ResendOtpRequest,
  ResendOtpResponse,
} from "@/types";

/**
 * Cooldown (seconds) enforced client-side between resend clicks.
 *
 * Separate from OTP expiry. Prevents a user from spamming "resend"
 * and burning through the server-side rate limit without ever
 * attempting to verify.
 */
const RESEND_COOLDOWN_SECONDS = 30;

interface UseOtpSessionArgs {
  email: string;
  accountToken: string;
  otpType: OtpType;
  initialAttemptsUsed: number;
  initialSecondsLeft?: number;
}

export function useOtpSession({
  email,
  accountToken,
  otpType,
  initialAttemptsUsed,
  initialSecondsLeft,
}: UseOtpSessionArgs) {
  const { config } = useOtpConfig();

  // OTP lifetime countdown
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Resend cooldown (separate from OTP lifetime)
  const [resendCooldown, setResendCooldown] = useState(0);

  const [attemptsUsed, setAttemptsUsed] = useState(initialAttemptsUsed);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------
  // Initialize OTP countdown
  // ---------------------------------------------------------
  useEffect(() => {
    if (secondsLeft !== null) return;
    if (initialSecondsLeft !== undefined) {
      setSecondsLeft(initialSecondsLeft);
      return;
    }
    if (config) {
      setSecondsLeft(config.otp_expire_minutes * 60);
    }
  }, [config, initialSecondsLeft, secondsLeft]);

  // ---------------------------------------------------------
  // OTP countdown ticker
  // ---------------------------------------------------------
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s === null || s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  // ---------------------------------------------------------
  // Resend cooldown ticker
  // ---------------------------------------------------------
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  // ---------------------------------------------------------
  // Reset state when the session token / flow changes
  // ---------------------------------------------------------
  useEffect(() => {
    setResendMessage(null);
    setResendError(null);
    setRetryAfterSeconds(null);
    setAttemptsUsed(initialAttemptsUsed);
    setResendCooldown(0);
    if (config) setSecondsLeft(config.otp_expire_minutes * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountToken, otpType]);

  // ---------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------
  const attemptsLimit = config?.otp_rate_limit ?? 5;
  const isExpired = secondsLeft !== null && secondsLeft <= 0;
  const isExhausted = attemptsUsed >= attemptsLimit;
  const isResendLocked = resendCooldown > 0;
  const isCountdownReady = secondsLeft !== null;

  // ---------------------------------------------------------
  // Resend
  // ---------------------------------------------------------
  const resend = useCallback(async () => {
    // Guard against double-clicks and cooldown violations
    if (isResending || resendCooldown > 0 || isExhausted) return;

    setResendMessage(null);
    setResendError(null);
    setRetryAfterSeconds(null);
    setIsResending(true);

    const payload: ResendOtpRequest = {
      email,
      account_token: accountToken,
      otp_type: otpType,
    };

    try {
      const response = await api.post<ResendOtpResponse>(
        "/auth/otp/resend",
        payload
      );

      if (!mountedRef.current) return;

      setAttemptsUsed(response.data.otp_attempts_used);
      setSecondsLeft(response.data.otp_expires_in_seconds);
      setResendMessage(response.data.message);

      // Start the client-side cooldown so a user can't spam resend
      // and burn through the backend rate limit without verifying.
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: unknown) {
      if (!mountedRef.current) return;

      if (!axios.isAxiosError(error)) {
        setResendError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // 429 — rate limited / OTP cooldown
      if (status === 429) {
        const header = error.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds =
          Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        setAttemptsUsed(attemptsLimit);
        setRetryAfterSeconds(seconds);

        // Honor the server's cooldown, whichever is longer
        if (seconds !== null) {
          setResendCooldown(Math.max(seconds, RESEND_COOLDOWN_SECONDS));
        } else {
          setResendCooldown(RESEND_COOLDOWN_SECONDS);
        }

        setResendError(
          typeof detail === "string"
            ? detail
            : seconds
              ? `Too many attempts. Try again in ${humanizeSeconds(seconds)}.`
              : "Too many attempts. Please try again later."
        );
        return;
      }

      if (status === 400 || status === 403) {
        setResendError(
          typeof detail === "string" ? detail : `Request failed (${status}).`
        );
        return;
      }

      if (status === 422 && Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | undefined;
        setResendError(first?.msg ?? "Invalid request.");
        return;
      }

      setResendError(
        typeof detail === "string"
          ? detail
          : `Request failed (${status ?? "unknown"}).`
      );
    } finally {
      if (mountedRef.current) setIsResending(false);
    }
  }, [
    email,
    accountToken,
    otpType,
    attemptsLimit,
    isResending,
    resendCooldown,
    isExhausted,
  ]);

  return {
    secondsLeft,
    isExpired,
    isCountdownReady,
    attemptsUsed,
    attemptsLimit,
    isExhausted,
    isResending,
    resendCooldown,
    isResendLocked,
    resendMessage,
    resendError,
    retryAfterSeconds,
    resend,
  };
}




// src/components/auth/OtpResendPanel.tsx

import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";

import { humanizeSeconds } from "@/lib/time";

interface OtpResendPanelProps {
  attemptsUsed: number;
  attemptsLimit: number;
  isExhausted: boolean;
  isResending: boolean;
  resendMessage: string | null;
  resendError: string | null;
  retryAfterSeconds?: number | null;

  /** Seconds until the user can click resend again. 0 = ready. */
  resendCooldown?: number;

  /** True when the OTP has expired — changes the link copy. */
  isExpired?: boolean;

  onResend: () => void;
  disabled?: boolean;
}

const OtpResendPanel = ({
  attemptsUsed,
  attemptsLimit,
  isExhausted,
  isResending,
  resendMessage,
  resendError,
  retryAfterSeconds = null,
  resendCooldown = 0,
  isExpired = false,
  onResend,
  disabled = false,
}: OtpResendPanelProps) => {
  const exhaustedText =
    retryAfterSeconds && retryAfterSeconds > 0
      ? `OTP attempts exhausted. Try again in ${humanizeSeconds(retryAfterSeconds)}.`
      : "OTP attempts exhausted. Please wait before retrying.";

  // ---------------- Link copy ----------------
  // Before expiry: "Didn't get the code? Resend code"
  // After expiry:  "Didn't get the code? Request a new code"
  const idleLabel = isExpired
    ? "Didn't get the code? Request a new code"
    : "Didn't get the code? Resend code";

  const isLocked = resendCooldown > 0;

  return (
    <div className="d-flex flex-column gap-2">

      {/* Attempts counter — shown once more than one attempt used */}
      {attemptsUsed > 1 && !isExhausted && (
        <p className="text-muted small text-center mb-0">
          Using <strong>{attemptsUsed}</strong> attempts of{" "}
          <strong>{attemptsLimit}</strong> of OTP requests
        </p>
      )}

      {/* ---------------------------------------------------
          Resend action area
      --------------------------------------------------- */}
      {isExhausted ? (
        <Alert variant="warning" className="mb-0 py-2 small text-center">
          {exhaustedText}
        </Alert>
      ) : (
        <Button
          variant="link"
          className="p-0 text-decoration-none align-self-center"
          onClick={onResend}
          disabled={disabled || isResending || isLocked}
        >
          {isResending ? (
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
          ) : isLocked ? (
            `Resend available in ${resendCooldown}s`
          ) : (
            idleLabel
          )}
        </Button>
      )}

      {resendMessage && (
        <Alert variant="info" className="mb-0 py-2 small text-center">
          {resendMessage}
        </Alert>
      )}

      {resendError && (
        <Alert variant="warning" className="mb-0 py-2 small text-center">
          {resendError}
        </Alert>
      )}
    </div>
  );
};

export default OtpResendPanel;
