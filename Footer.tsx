# api/payments/logics.py (rewritten resolver)

async def _load_methods_for_country(
    db: AsyncSession,
    country_id: int,
) -> list[PaymentMethods]:
    """Load payment methods for a country by id, ordered by name."""
    result = await db.execute(
        select(PaymentMethods)
        .where(col(PaymentMethods.country_id) == country_id)
        .order_by(col(PaymentMethods.name))
    )
    return list(result.scalars().all())


async def _country_by_name(
    db: AsyncSession,
    name: str,
) -> Country | None:
    """Case-insensitive country lookup by name."""
    result = await db.execute(
        select(Country).where(
            func.lower(col(Country.name)) == name.lower()
        )
    )
    return result.scalars().first()


async def read_resolved_payment_methods(
    db: AsyncSession,
    current_user: ReadUser | None,
    country_name: str,
) -> CountryPaymentMethodsRead:
    """
    Resolve payment methods by priority, skipping empty tiers:

        1. Authenticated user's country  — if it has methods
        2. The passed-in `country_name`  — if it has methods
        3. Default country (Liberia)     — if it has methods
        4. Empty                         — no country has methods

    `country_name` is the *already-resolved* name from
    `get_country_name_from_host` — this function does not inspect
    HTTP headers.

    Public — no authentication required.
    """
    from api.core.country import DEFAULT_COUNTRY_NAME

    # ------------------------------------------------------------------
    # Build the candidate list in priority order, deduped
    # ------------------------------------------------------------------
    candidates: list[Country] = []

    # 1. Authenticated user's country
    if current_user is not None and current_user.country_id:
        try:
            user_country = await db.get(Country, current_user.country_id)
            if user_country is not None:
                candidates.append(user_country)
        except Exception:
            logger.exception(
                "Failed to load user country id=%s",
                current_user.country_id,
            )

    # 2. Host-resolved country (already resolved by the route)
    try:
        host_country = await _country_by_name(db, country_name)
        if host_country is not None and all(
            country_id_of(c) != country_id_of(host_country)
            for c in candidates
        ):
            candidates.append(host_country)
    except Exception:
        logger.exception(
            "Failed to load host-resolved country name=%s", country_name
        )

    # 3. Default country
    if all(
        c.name.lower() != DEFAULT_COUNTRY_NAME.lower()
        for c in candidates
    ):
        try:
            default_country = await _country_by_name(
                db, DEFAULT_COUNTRY_NAME
            )
            if default_country is not None:
                candidates.append(default_country)
        except Exception:
            logger.exception(
                "Failed to load default country name=%s",
                DEFAULT_COUNTRY_NAME,
            )

    # ------------------------------------------------------------------
    # Walk candidates; return the first with methods
    # ------------------------------------------------------------------
    for country in candidates:
        try:
            methods = await _load_methods_for_country(
                db, country_id_of(country)
            )
        except Exception:
            logger.exception(
                "Failed to load methods for country id=%s",
                country_id_of(country),
            )
            continue

        if methods:
            return CountryPaymentMethodsRead(
                country_id=country_id_of(country),
                country_name=country.name,
                payment_methods=[
                    to_payment_method_read(m) for m in methods
                ],
            )

    # ------------------------------------------------------------------
    # No tier had methods
    # ------------------------------------------------------------------
    return CountryPaymentMethodsRead(
        country_id=0,
        country_name=DEFAULT_COUNTRY_NAME,
        payment_methods=[],
    )



# api/payments/routes.py (the resolved route)

from fastapi import APIRouter, Request, status

from api.core.country import get_country_name_from_host
from api.core.database import DBDep
from api.payments.logics import read_resolved_payment_methods
from api.payments.schemas import CountryPaymentMethodsRead
from api.users.deps import OptionalCurrentUser

router = APIRouter(prefix="/payment-methods", tags=["Payment Methods"])


@router.get(
    "/resolved",
    response_model=CountryPaymentMethodsRead,
    status_code=status.HTTP_200_OK,
    summary="Payment methods resolved by user country, host, or default",
)
async def list_resolved_payment_methods(
    request: Request,
    db: DBDep,
    current_user: OptionalCurrentUser,
):
    """
    Return payment methods relevant to the caller.

    The country name is resolved from the Host header by
    `get_country_name_from_host`. If the caller is authenticated
    and has a country assigned, that takes priority — with a
    fallback to the host-resolved country, then the default.

    Public — guests still get the default country's methods.
    """

    # ------------------------------------------------------------------
    # The one place we touch the raw request
    # ------------------------------------------------------------------
    country_name = get_country_name_from_host(
        request.headers.get("host")
    )

    # ------------------------------------------------------------------
    # Hand off to the service — it receives a plain string, not a Request
    # ------------------------------------------------------------------
    return await read_resolved_payment_methods(
        db=db,
        current_user=current_user,
        country_name=country_name,
    )






// src/components/payments/ResolvedPaymentMethods.tsx

import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

import { useAuth } from "@/context/AuthContext";
import { useResolvedPaymentMethods } from "@/hooks/useResolvedPaymentMethods";
import type { PaymentMethodRead } from "@/types";


interface ResolvedPaymentMethodsProps {
  variant?: "grid" | "inline";
}


const ResolvedPaymentMethods = ({
  variant = "grid",
}: ResolvedPaymentMethodsProps) => {
  const { user } = useAuth();
  const { data, loading, error } = useResolvedPaymentMethods();

  if (loading) {
    return (
      <div className="text-center py-3">
        <Spinner animation="border" size="sm" role="status" />
        <span className="text-muted small ms-2">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="py-2 small mb-0">
        {error}
      </Alert>
    );
  }

  const methods = data?.payment_methods ?? [];
  const countryName = data?.country_name ?? "";
  const resolvedCountryId = data?.country_id ?? 0;

  // ===========================================================
  // State 1: no methods available anywhere
  // ===========================================================
  if (methods.length === 0) {
    return (
      <p className="text-muted small text-center mb-0">
        No available payment option in our system now
      </p>
    );
  }

  // ===========================================================
  // State 2: pick the label
  // ===========================================================
  let label: string;

  if (!user) {
    // Guest — whatever the host resolved to
    label = `Payment options for ${countryName}`;
  } else if (!user.country_id) {
    // Authenticated but no country assigned
    label = `Default payment options (${countryName})`;
  } else if (resolvedCountryId === user.country_id) {
    // User's own country has methods — no fallback
    label = "Payment option for your country";
  } else {
    // User has a country, but it had no methods — backend fell
    // back to `countryName`. Tell them the truth.
    label = `Default payment options (${countryName})`;
  }

  // ===========================================================
  // State 3: render
  // ===========================================================
  return (
    <div>
      <div className="text-muted small text-center mb-3">{label}</div>

      {variant === "inline" ? (
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3">
          {methods.map((method) => (
            <PaymentLogo key={method.id} method={method} />
          ))}
        </div>
      ) : (
        <Row
          xs={3}
          sm={4}
          md={5}
          lg={6}
          xl={8}
          className="g-3 justify-content-center align-items-center"
        >
          {methods.map((method) => (
            <Col
              key={method.id}
              className="d-flex justify-content-center align-items-center"
            >
              <PaymentLogo method={method} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};


function PaymentLogo({ method }: { method: PaymentMethodRead }) {
  if (!method.payment_logo_url) {
    return (
      <span
        className="badge bg-light text-dark border fw-normal text-truncate"
        style={{
          maxWidth: "100%",
          fontSize: "0.7rem",
          padding: "4px 8px",
        }}
        title={method.name}
      >
        {method.name}
      </span>
    );
  }

  return (
    <img
      src={method.payment_logo_url}
      alt={method.name}
      title={method.name}
      style={{
        height: 28,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "block",
      }}
      loading="lazy"
    />
  );
}


export default ResolvedPaymentMethods;


// src/hooks/useResolvedPaymentMethods.ts

import { useEffect, useState } from "react";
import axios from "axios";

import api from "@/api/client";
import type { CountryPaymentMethodsRead } from "@/types";


interface UseResolvedPaymentMethodsResult {
  data: CountryPaymentMethodsRead | null;
  loading: boolean;
  error: string | null;
}


/**
 * Fetch the payment methods relevant to the current caller.
 *
 * The backend resolves the country from the request Host header
 * (and, if authenticated, from the user's assigned country).
 * We don't pass a slug — the server decides.
 *
 * Public endpoint — guests also get a result.
 */
export function useResolvedPaymentMethods(): UseResolvedPaymentMethodsResult {
  const [data, setData] = useState<CountryPaymentMethodsRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    api
      .get<CountryPaymentMethodsRead>("/payment-methods/resolved", {
        signal: controller.signal,
      })
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        if (!mounted) return;

        if (!axios.isAxiosError(err)) {
          setError("An unexpected error occurred.");
          return;
        }

        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        setError(
          typeof detail === "string"
            ? detail
            : `Request failed (${status ?? "unknown"}).`
        );
      })
      .finally(() => {
        if (mounted && !controller.signal.aborted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  return { data, loading, error };
}






// src/components/Footer.tsx

import { Link } from "react-router-dom";

import ResolvedPaymentMethods from "@/components/payments/ResolvedPaymentMethods";
import { useSite } from "@/context/SiteContext";


const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { settings } = useSite();

  // SiteContext always provides a `settings` object (with a fallback),
  // so we can read the name directly without a null check.
  const siteName = settings.sitename || "this site";

  return (
    <>
      {/* =====================================================
          Payment methods block
      ===================================================== */}
      <div className="container py-4">
        <ResolvedPaymentMethods variant="grid" />
      </div>

      {/* =====================================================
          Nav links
      ===================================================== */}
      <div className="text-center d-flex flex-row justify-content-center flex-wrap">
        <Link to="/contactus" className="p-2 flex-fill text-decoration-none">
          Contact Us
        </Link>
        <Link to="/aboutus" className="p-2 flex-fill text-decoration-none">
          About Us
        </Link>
        <Link to="/privacypolicy" className="p-2 flex-fill text-decoration-none">
          Privacy Policy
        </Link>
        <Link
          to="/terms/conditions"
          className="p-2 flex-fill text-decoration-none"
        >
          Terms &amp; Conditions
        </Link>
      </div>

      {/* =====================================================
          Copyright
      ===================================================== */}
      <p className="mt-4 text-dark text-center">
        &copy; {currentYear}. All rights reserved.{" "}
        <Link to="/" className="text-decoration-none text-info">
          {siteName}
        </Link>
      </p>
    </>
  );
};


export default Footer;
