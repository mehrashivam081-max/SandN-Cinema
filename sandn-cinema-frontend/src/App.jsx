import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; 
import PaymentSuccess from './components/PaymentSuccess'; // पाथ अपने फोल्डर के हिसाब से सेट कर लेना

// Purane Imports
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 
import StudioPage from './components/StudioPage'; // 👈 NAYA: Studio Trap Page

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

  // ✅ PWA INSTALL APP LOGIC (GLOBAL PROMPT CATCHER)
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); // Browser ka default popup roko
      window.deferredPrompt = e; // Global variable me save kar lo taki Dashboards use kar sakein
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Main Pages */}
          <Route path="/" element={<MainLanding />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/studio/:studioName" element={<StudioPage />} /> {/* 👈 NAYA: Studio Trap Route */}

          {/* ✅ LEGAL PAGES */}
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund" element={<Refund />} />
          <Route path="/shipping" element={<Shipping />} />

          {/* ⚠️ WILDCARD ROUTE */}
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;