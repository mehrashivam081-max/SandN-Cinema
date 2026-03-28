import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios'; // ✅ AXIOS IMPORTED
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

// 🔒 GLOBAL AXIOS INTERCEPTOR (The Auto-Attacher)
// Ye app se jaane wali har request me digital lock/token add kar dega
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function App() {

  // ✅ SUPER SECURITY: Auto-Logout & Digital Lock Verification
  useEffect(() => {
    const handleOffline = () => {
      alert("⚠️ Internet connection lost! For security reasons, your session has been locked.");
      localStorage.removeItem('user'); 
      localStorage.removeItem('authToken'); // Clear token
      sessionStorage.removeItem('user'); 
      window.location.href = "/SandN-Cinema/"; 
    };

    window.addEventListener('offline', handleOffline);

    // 🔒 THE DIGITAL LOCK CHECK (JWT Verification)
    const verifyDigitalLock = async () => {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      
      // Hacker check: Agar user ka data pada hai par Token nahi hai, iska matlab hack kiya gaya hai!
      if (userStr && !token) {
        console.warn("Security Alert: No token found. Kicking out.");
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/SandN-Cinema/";
        return;
      }

      // Agar dono hain, toh backend se verify karo ki token valid hai
      if (token && userStr) {
        const userObj = JSON.parse(userStr);
        // Owner/Admin hardcode bypass for now
        if (token === 'super_admin_bypass_token_999') return; 

        try {
          const res = await axios.post(`${API_BASE}/verify-session`, {
            token: token,
            roleExpected: userObj.role
          });
          
          if (!res.data.success) {
            alert("Your session has expired or is invalid! Please log in again.");
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/SandN-Cinema/";
          }
        } catch (e) {
          console.error("Session verification failed", e);
        }
      }
    };

    verifyDigitalLock(); // Run verification instantly on load

    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    <BrowserRouter basename="/SandN-Cinema">
      <div className="App">
        <Routes>
          <Route path="/" element={<MainLanding />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;