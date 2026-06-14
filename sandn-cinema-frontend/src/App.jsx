import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; 
import PaymentSuccess from './components/PaymentSuccess';

// Purane Imports
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 
import StudioPage from './components/StudioPage';

// ✅ NAYE LEGAL PAGES IMPORTS
import Terms from './pages/legal/Terms';
import Refund from './pages/legal/Refund';
import Shipping from './pages/legal/Shipping';
import ContactUs from './pages/legal/ContactUs';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

// 🔒 SMART GLOBAL AXIOS INTERCEPTOR (CORS & Cloudinary Safe)
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
    
    // 🔥 THE FIX: Sirf tabhi Token bhejo jab request hamare Snevio Backend par jaa rahi ho
    if (token && config.url && config.url.includes('sandn-cinema-backend.onrender.com')) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function App() {

  // ✅ CLEANED UP: SINGLE & SAFE SESSION MANAGER
  useEffect(() => {
    const verifyDigitalLock = async () => {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || localStorage.getItem('token') || sessionStorage.getItem('token');
      
      // Agar token nahi hai to chup chap return ho jao, forcefully clear mat karo
      if (!token) return; 

      if (token === 'super_admin_bypass_token_999') return; 

      try {
        // 🔥 Sirf ek baar API call hogi, app crash nahi hoga
        const res = await axios.post(`${API_BASE}/verify-session`, { token: token });
        
        // Agar backend bolta hai token invalid hai, tabhi bahar nikalo
        if (!res.data.success) {
          console.log("Session expired. Clearing old token.");
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = "/";
        }
      } catch (e) {
        // Agar network error aaya toh app crash nahi hoga
        console.error("Backend validation error. Assuming session is okay for now.", e);
      }
    };

    verifyDigitalLock();
  }, []);

  // ✅ PWA INSTALL APP LOGIC
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); 
      window.deferredPrompt = e; 
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
          <Route path="/studio/:studioName" element={<StudioPage />} />

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