
// src/hooks/useOtpConfig.ts

import { useEffect, useState } from "react";

import api from "@/api/client";
import type { OtpConfig } from "@/types";


// =============================================================
// MODULE-LEVEL CACHE
//
// The OTP config is identical for every user of the app, so
// fetching it once per session is sufficient. We cache it at
// module scope so:
//
//   1. The first mount triggers the network request.
//   2. Every subsequent mount reads from cache instantly.
//   3. Concurrent mounts during the in-flight request share
//      the same promise (no duplicate requests).
// =============================================================

let cachedConfig: OtpConfig | null = null;
let inflight: Promise<OtpConfig> | null = null;


async function fetchOtpConfig(): Promise<OtpConfig> {
  // Cache hit — return immediately.
  if (cachedConfig) return cachedConfig;

  // Request already in flight — reuse the same promise.
  if (inflight) return inflight;

  // Start a fresh request and memoize its promise.
  inflight = api
    .get<OtpConfig>("/auth/otp-config")
    .then((res) => {
      cachedConfig = res.data;
      return res.data;
    })
    .finally(() => {
      // Clear the in-flight reference whether we succeeded or failed,
      // so a retry after failure doesn't hang on a stale promise.
      inflight = null;
    });

  return inflight;
}


/**
 * Return the public OTP configuration (expiry, rate limits, windows).
 *
 * Values come from the backend `GET /auth/otp-config` endpoint,
 * which mirrors the server-side settings. This keeps the frontend
 * countdown and attempts counters in sync with the actual backend
 * limits without hardcoding any numbers in the UI.
 *
 * Caching:
 *   - Module-level cache — fetched once per browser session.
 *   - Concurrent consumers share a single in-flight request.
 *   - No refetch on remount; call `reloadOtpConfig()` if you
 *     ever need to force a refresh.
 */
export function useOtpConfig() {
  const [config, setConfig] = useState<OtpConfig | null>(cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Already resolved — nothing to do.
    if (cachedConfig) {
      setConfig(cachedConfig);
      return;
    }

    let mounted = true;

    fetchOtpConfig()
      .then((c) => {
        if (mounted) {
          setConfig(c);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;

        // Best-effort error message — trust backend detail if
        // the response is structured, otherwise fall back to a
        // generic string. Config fetch failures should never
        // block the page; consumers use a defensive fallback.
        const detail =
          err &&
          typeof err === "object" &&
          "response" in err &&
          (err as { response?: { data?: { detail?: unknown } } }).response
            ?.data?.detail;

        setError(
          typeof detail === "string"
            ? detail
            : "Unable to load OTP configuration."
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { config, error };
}


/**
 * Force a fresh fetch on the next mount.
 * Useful in tests or when you know the backend config has changed.
 */
export function invalidateOtpConfigCache(): void {
  cachedConfig = null;
  inflight = null;
}




// src/lib/time.ts

/**
 * Format a duration in seconds as a human-readable string.
 *
 * Examples:
 *   45      → "45s"
 *   60      → "1m"
 *   125     → "2m 5s"
 *   3600    → "1h"
 *   3665    → "1h 1m 5s"
 *
 * Non-finite or negative input returns "0s".
 */
export function humanizeSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0s";

  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);

  return parts.length > 0 ? parts.join(" ") : "0s";
}


/**
 * Format a duration in seconds as MM:SS (or H:MM:SS when >= 1 hour).
 * Used by live countdown UI where the display ticks smoothly.
 *
 * Examples:
 *   5      → "00:05"
 *   65     → "01:05"
 *   3600   → "1:00:00"
 *   3665   → "1:01:05"
 */
export function formatMMSS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "00:00";
  }

  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}




// src/components/auth/OtpCountdown.tsx

import { formatMMSS } from "@/lib/time";

interface OtpCountdownProps {
  secondsLeft: number | null;
  isExpired: boolean;
}

const OtpCountdown = ({ secondsLeft, isExpired }: OtpCountdownProps) => {
  if (secondsLeft === null) {
    return (
      <p className="text-muted small text-center mb-3">
        Preparing verification...
      </p>
    );
  }

  if (isExpired) {
    return (
      <p className="text-danger fw-semibold small text-center mb-3">
        YOUR OTP TIME HAS EXPIRED
      </p>
    );
  }

  return (
    <p className="text-muted small text-center mb-3">
      OTP expires in: <strong>{formatMMSS(secondsLeft)}</strong>
    </p>
  );
};

export default OtpCountdown;






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

  /**
   * Seconds until the user can retry — populated from the
   * Retry-After header on a 429. When provided, the exhausted
   * copy shows an exact remaining time (e.g. "47m 23s") instead
   * of a generic "wait" message.
   */
  retryAfterSeconds?: number | null;

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
  onResend,
  disabled = false,
}: OtpResendPanelProps) => {
  const exhaustedText =
    retryAfterSeconds && retryAfterSeconds > 0
      ? `OTP attempts exhausted. Try again in ${humanizeSeconds(retryAfterSeconds)}.`
      : "OTP attempts exhausted. Please wait before retrying.";

  return (
    <div className="d-flex flex-column gap-2">

      {/* Attempts counter — shown once more than one attempt used */}
      {attemptsUsed > 1 && !isExhausted && (
        <p className="text-muted small text-center mb-0">
          Using <strong>{attemptsUsed}</strong> attempts of{" "}
          <strong>{attemptsLimit}</strong> of OTP requests
        </p>
      )}

      {/* Exhausted OR resend link */}
      {isExhausted ? (
        <Alert variant="warning" className="mb-0 py-2 small text-center">
          {exhaustedText}
        </Alert>
      ) : (
        <Button
          variant="link"
          className="p-0 text-decoration-none align-self-center"
          onClick={onResend}
          disabled={disabled || isResending}
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
          ) : (
            "Click to Request for new OTP"
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

interface UseOtpSessionArgs {
  email: string;
  accountToken: string;
  otpType: OtpType;
  /** Attempts already used before this page loaded (usually 1). */
  initialAttemptsUsed: number;
  /** Seconds left on the current OTP. If omitted, uses config default. */
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

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
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
  // Initialize countdown once config arrives
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
  // Countdown ticker
  // ---------------------------------------------------------
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;

    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s === null || s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [secondsLeft]);

  // ---------------------------------------------------------
  // Reset state when the session token / flow changes
  // ---------------------------------------------------------
  useEffect(() => {
    setResendMessage(null);
    setResendError(null);
    setRetryAfterSeconds(null);
    setAttemptsUsed(initialAttemptsUsed);
    if (config) setSecondsLeft(config.otp_expire_minutes * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountToken, otpType]);

  // ---------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------
  const attemptsLimit = config?.otp_rate_limit ?? 5;
  const isExpired = secondsLeft !== null && secondsLeft <= 0;
  const isExhausted = attemptsUsed >= attemptsLimit;
  const isCountdownReady = secondsLeft !== null;

  // ---------------------------------------------------------
  // Resend
  // ---------------------------------------------------------
  const resend = useCallback(async () => {
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
    } catch (error: unknown) {
      if (!mountedRef.current) return;

      if (!axios.isAxiosError(error)) {
        setResendError("An unexpected error occurred.");
        return;
      }

      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // ---------------------------------------------------
      // 429 — rate limited / OTP cooldown
      // ---------------------------------------------------
      if (status === 429) {
        const header = error.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const seconds =
          Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        // Mark as exhausted in the UI and surface the exact wait time.
        setAttemptsUsed(attemptsLimit);
        setRetryAfterSeconds(seconds);

        setResendError(
          typeof detail === "string"
            ? detail
            : seconds
              ? `OTP attempts exhausted. Try again in ${humanizeSeconds(seconds)}.`
              : "OTP attempts exhausted. Please try again later."
        );
        return;
      }

      // ---------------------------------------------------
      // 400 / 403 — session expired or account state changed
      // ---------------------------------------------------
      if (status === 400 || status === 403) {
        setResendError(
          typeof detail === "string"
            ? detail
            : "Session expired or invalid."
        );
        return;
      }

      // ---------------------------------------------------
      // 422 — validation
      // ---------------------------------------------------
      if (status === 422 && Array.isArray(detail)) {
        const first = detail[0] as { msg?: string } | undefined;
        setResendError(first?.msg ?? "Invalid request.");
        return;
      }

      // ---------------------------------------------------
      // Fallback — trust backend detail
      // ---------------------------------------------------
      setResendError(
        typeof detail === "string"
          ? detail
          : `Unable to resend code${status ? ` (${status})` : ""}. Please try again.`
      );
    } finally {
      if (mountedRef.current) setIsResending(false);
    }
  }, [email, accountToken, otpType, attemptsLimit]);

  return {
    secondsLeft,
    isExpired,
    isCountdownReady,
    attemptsUsed,
    attemptsLimit,
    isExhausted,
    isResending,
    resendMessage,
    resendError,
    retryAfterSeconds,
    resend,
  };
    }
