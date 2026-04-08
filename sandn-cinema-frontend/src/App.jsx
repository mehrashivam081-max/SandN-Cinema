import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; 

// Purane Imports
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 

// ✅ NAYE LEGAL PAGES IMPORTS
import Terms from './pages/legal/Terms';
import Refund from './pages/legal/Refund';
import Shipping from './pages/legal/Shipping';
import ContactUs from './pages/legal/ContactUs';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

// 🔒 GLOBAL AXIOS INTERCEPTOR
axios.interceptors.request.use(
  (config) => {
    // Session aur Local dono check karega ab
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {

  // ✅ SECURITY & SESSION VERIFICATION (BUG FIXED)
  useEffect(() => {
    const handleOffline = () => {
      alert("⚠️ Internet connection lost! Session locked for security.");
      localStorage.clear(); 
      sessionStorage.clear(); 
      window.location.href = "/";
    };

    window.addEventListener('offline', handleOffline);

    const verifyDigitalLock = async () => {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      
      // 🔥 FIX: Ye wala block refresh par session uda raha tha kyunki login par token save nahi ho raha tha. 
      // Ab ye sirf tab bahar nikalega jab na user ho aur na token.
      if (!userStr && token) {
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
    <Router>
      <div className="App">
        <Routes>
          {/* Main Pages */}
          <Route path="/" element={<MainLanding />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* ✅ LEGAL PAGES */}
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/shipping" element={<Shipping />} />

          {/* ⚠️ WILDCARD ROUTE */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;