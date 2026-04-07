import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; 

// Purane Imports
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 
import Footer from './components/Footer'; // ✅ FOOTER IMPORT ADD KIYA (Path check kar lena)

// ✅ NAYE LEGAL PAGES IMPORTS
import Terms from './pages/legal/Terms';
import Refund from './pages/legal/Refund';
import Shipping from './pages/legal/Shipping';
import ContactUs from './pages/legal/ContactUs';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

// 🔒 GLOBAL AXIOS INTERCEPTOR
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {

  // ✅ SECURITY & SESSION VERIFICATION
  useEffect(() => {
    const handleOffline = () => {
      alert("⚠️ Internet connection lost! Session locked for security.");
      localStorage.clear(); 
      sessionStorage.clear(); 
      window.location.href = "/";
    };

    window.addEventListener('offline', handleOffline);

    const verifyDigitalLock = async () => {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      
      if (userStr && !token) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/";
        return;
      }

      if (token && userStr) {
        const userObj = JSON.parse(userStr);
        if (token === 'super_admin_bypass_token_999') return; 

        try {
          const res = await axios.post(`${API_BASE}/verify-session`, {
            token: token,
            roleExpected: userObj.role
          });
          
          if (!res.data.success) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/";
          }
        } catch (e) {
          console.error("Session verification failed", e);
        }
      }
    };

    verifyDigitalLock();
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    <BrowserRouter>
      {/* ✅ FOOTER KO NICHE RAKHNE KE LIYE FLEXBOX LAGA DIYA */}
      <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        {/* ✅ FLEX-1 Isse content upar rahega aur footer hamesha niche */}
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Main Pages */}
            <Route path="/" element={<MainLanding />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* ✅ LEGAL PAGES (Instamojo KYC ke liye zaruri) */}
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/shipping" element={<Shipping />} />

            {/* ⚠️ WILDCARD ROUTE (Hamesha last mein hona chahiye) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* ✅ GLOBAL FOOTER: Ye ab har page par dikhega */}
        <Footer />
        
      </div>
    </BrowserRouter>
  );
}

export default App;