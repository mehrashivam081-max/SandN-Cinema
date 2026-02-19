import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLanding from './view/MainLanding'; 
import LoginPage from './components/LoginPage'; 
import SignupPage from './components/SignupPage'; 

function App() {
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