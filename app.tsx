//main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
//import './index.css'
import { RouterProvider } from 'react-router-dom'
import {router} from './App.tsx'
import 'bootstrap/dist/css/bootstrap.min.css'
//import 'bootstrap-icons/font/bootstrap-icons.css';
//<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)


//app.tsx
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
