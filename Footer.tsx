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
