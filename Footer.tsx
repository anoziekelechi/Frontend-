

import { Link } from "react-router-dom";

const Footer = () => {
const currentyear = new Date().getFullYear();
    return (
    <>

    <div className="text-center text-white d-flex flex-row justify-content-center flex-wrap">
        <Link to="/contactus" className='p-2 flex-fill text-decoration-none'>ContactUs</Link>
        <Link to="/aboutus" className='p-2 flex-fill text-decoration-none'>About Us</Link>
        <Link to="/privacypolicy" className='p-2 flex-fill text-decoration-none'>Privacy Policy</Link>
        <Link to="/terms/conditions" className='p-2 flex-fill text-decoration-none'>Terms & Condition</Link>
    </div>
        <p className="mt-4 text-dark text-center">
        &copy; {currentyear}. All right reserved <Link to="/" className="text-decoration-none text-info">Sitename</Link>
        </p>

    </>
      
    );
};
export default Footer;
