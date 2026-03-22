import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 

function App() {

  // ✅ SUPER SECURITY: Auto-Logout on Connection Lost
  useEffect(() => {
    const handleOffline = () => {
      // Jab bhi device ka internet connection cut hoga
      alert("⚠️ Internet connection lost! For security reasons, your session has been locked.");
      
      // Clear both storages to be 100% safe
      localStorage.removeItem('user'); 
      sessionStorage.removeItem('user'); 
      
      // Redirect to home/login page
      window.location.href = "/SandN-Cinema/"; 
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return (
    // ✅ Basename add kiya gaya hai
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