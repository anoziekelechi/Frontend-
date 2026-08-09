
import { createBrowserRouter, Outlet } from 'react-router-dom';
import Navigation from './base/Navigation';
import Home from './pages/Home'
import Registration from './features/users/Registration';
import Login from './features/users/Login';
import Footer from './base/Footer';
import Search from './base/Search';
import Contact from './base/Contact';
import Whatsapp from './base/Whatsapp';
import NotFound from './NotFound';

// Create A layout components to hold common elements
const Layout = () =>{
  return (
    <>
    <Whatsapp />
    <Search />
    <Navigation  />
    
      <Outlet />
    
    <Footer />
    </>
  );
};


// define the routes <ScrollToTop />
export const router = createBrowserRouter([

  {
    //path: '/',
    element: <Layout />,
    children: [
      { path: '/', element: <Home />},
      { path: 'login', element: <Login />},
      { path: 'register', element: <Registration />},
      { path: 'contactus', element: <Contact />},

      // 404 route must be the last
      {path: "*", element: <NotFound />},
    ],
  },
 

]);
