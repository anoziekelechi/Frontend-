# app/routers/auth.py

@router.get(
    "/auth/otp-config",
    response_model=OtpConfigResponse,
    summary="Public OTP configuration (expiry, rate limit, window)",
)
async def get_otp_config() -> OtpConfigResponse:
    """
    Public endpoint. Returns the constants the frontend uses to render
    the countdown timer and attempts counter. Safe to cache aggressively.
    """
    return OtpConfigResponse(
        otp_expire_minutes=OTP_EXPIRE_MINUTES,
        otp_rate_limit=OTP_RATE_LIMIT,
        otp_rate_window_seconds=OTP_RATE_WINDOW,
    )









// src/hooks/useOtpConfig.ts

import { useEffect, useState } from "react";
import api from "@/api/client";
import type { OtpConfig } from "@/types";


// Module-level cache — config is identical for all users
let cachedConfig: OtpConfig | null = null;
let inflight: Promise<OtpConfig> | null = null;


async function fetchOtpConfig(): Promise<OtpConfig> {
  if (cachedConfig) return cachedConfig;
  if (inflight) return inflight;

  inflight = api
    .get<OtpConfig>("/auth/otp-config")
    .then((r) => {
      cachedConfig = r.data;
      return r.data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}


export function useOtpConfig() {
  const [config, setConfig] = useState<OtpConfig | null>(cachedConfig);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedConfig) return;

    let mounted = true;
    fetchOtpConfig()
      .then((c) => {
        if (mounted) setConfig(c);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err?.response?.data?.detail ||
              "Unable to load OTP configuration."
          );
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { config, error };
}






// src/hooks/useOtpSession.ts

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import api from "@/api/client";
import { useOtpConfig } from "./useOtpConfig";
import type {
  ResendOtpResponse,
  OtpType,
  ResendOtpRequest,
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
      setSecondsLeft((s) =>
        s === null || s <= 1 ? 0 : s - 1
      );
    }, 1000);

    return () => window.clearInterval(id);
  }, [secondsLeft]);


  // ---------------------------------------------------------
  // Reset state when the session token changes (new flow)
  // ---------------------------------------------------------
  useEffect(() => {
    setResendMessage(null);
    setResendError(null);
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
    setIsResending(true);

    const payload: ResendOtpRequest = {
      email,
      account_token: accountToken,
      otp_type: otpType,
    };

    try {
      const response = await api.post<ResendOtpResponse>(
        "/auth/resend-otp",
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

      if (status === 429) {
        const header = error.response?.headers?.["retry-after"];
        const parsed = header ? parseInt(String(header), 10) : NaN;
        const retryAfter =
          Number.isFinite(parsed) && parsed > 0 ? parsed : null;

        // Sync attempts state to exhausted; if we know the limit, mark it
        setAttemptsUsed(attemptsLimit);

        setResendError(
          typeof detail === "string"
            ? detail
            : retryAfter
              ? `OTP attempts exhausted. Please wait ${retryAfter}s before retrying.`
              : "OTP attempts exhausted. Please try again later."
        );
        return;
      }

      if (status === 400 || status === 403) {
        setResendError(
          typeof detail === "string"
            ? detail
            : "Session expired or invalid."
        );
        return;
      }

      setResendError(
        typeof detail === "string"
          ? detail
          : `Unable to resend code${status ? ` (${status})` : ""}.`
      );
    } finally {
      if (mountedRef.current) setIsResending(false);
    }
  }, [email, accountToken, otpType, attemptsLimit]);


  return {
    /** Seconds remaining; null while config loads. */
    secondsLeft,
    /** True once countdown reaches zero. */
    isExpired,
    /** False until config arrives — lets the UI show a spinner. */
    isCountdownReady,
    /** Attempts used so far (1 after initiate, +1 per resend). */
    attemptsUsed,
    /** Max attempts allowed within the rate window. */
    attemptsLimit,
    /** True when attemptsUsed >= attemptsLimit. */
    isExhausted,
    /** Resend in flight. */
    isResending,
    /** Success text after a resend. */
    resendMessage,
    /** Error text from resend. */
    resendError,
    /** Trigger a resend. Safe to call when !isExhausted. */
    resend,
  };
        }









// src/components/auth/OtpCountdown.tsx

interface OtpCountdownProps {
  secondsLeft: number | null;
  isExpired: boolean;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

interface OtpResendPanelProps {
  attemptsUsed: number;
  attemptsLimit: number;
  isExhausted: boolean;
  isResending: boolean;
  resendMessage: string | null;
  resendError: string | null;
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
  onResend,
  disabled = false,
}: OtpResendPanelProps) => {
  return (
    <div className="d-flex flex-column gap-2">

      {/* Attempts counter — shown once more than one attempt used */}
      {attemptsUsed > 1 && !isExhausted && (
        <p className="text-muted small text-center mb-0">
          Using <strong>{attemptsUsed}</strong> attempts of{" "}
          <strong>{attemptsLimit}</strong> of OTP requests
        </p>
      )}

      {/* Exhausted state */}
      {isExhausted ? (
        <Alert variant="warning" className="mb-0 py-2 small text-center">
          OTP attempts exhausted. Please wait 1 hour to retry.
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












