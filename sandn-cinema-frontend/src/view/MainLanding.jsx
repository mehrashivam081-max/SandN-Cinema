// src/view/MainLanding.jsx
import React, { useState, useEffect, useCallback } from 'react';
import useViewport from '../hooks/useViewport'; 
import LaptopView from './laptopview/LaptopView'; 
import MobileView from './mobileview/MobileView';
import axios from 'axios';

const MOBILE_BREAKPOINT = 768;
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth'; // ✅ Update if backend URL changes

const MainLanding = () => {
  const width = useViewport();

  // ✅ BRANDING UPDATED: Using 'snevio_' prefix for storage
  const [viewState, setViewState] = useState(() => sessionStorage.getItem('snevio_viewState') || 'HOME');
  const [searchStep, setSearchStep] = useState(() => parseInt(sessionStorage.getItem('snevio_searchStep')) || 0);
  // 🔥 FIX: User data ko directly global 'user' key se bhi uthayega refresh par
  const [userData, setUserData] = useState(() => {
      const specificSaved = sessionStorage.getItem('snevio_userData');
      const globalSaved = sessionStorage.getItem('user'); // Fallback for refresh
      
      if (specificSaved && specificSaved !== "undefined") return JSON.parse(specificSaved);
      if (globalSaved && globalSaved !== "undefined") return JSON.parse(globalSaved);
      
      return null;
  });

  const [feedType, setFeedType] = useState(() => sessionStorage.getItem('snevio_feedType') || null);
  const [mobile, setMobile] = useState(() => sessionStorage.getItem('snevio_mobile') || '');
  const [otp, setOtp] = useState(() => sessionStorage.getItem('snevio_otp') || '');
  const [password, setPassword] = useState(() => sessionStorage.getItem('snevio_password') || '');
  
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync states to Storage
  useEffect(() => { sessionStorage.setItem('snevio_viewState', viewState); }, [viewState]);
  useEffect(() => { sessionStorage.setItem('snevio_searchStep', searchStep.toString()); }, [searchStep]);
  useEffect(() => { 
      if(userData) {
          sessionStorage.setItem('snevio_userData', JSON.stringify(userData));
          sessionStorage.setItem('user', JSON.stringify(userData)); // Keeps global sync
      } else {
          sessionStorage.removeItem('snevio_userData');
      }
  }, [userData]);

  useEffect(() => { 
    if(feedType) sessionStorage.setItem('snevio_feedType', feedType); 
    else sessionStorage.removeItem('snevio_feedType'); 
  }, [feedType]);

  // 🔄 AUTO-REFRESH LOGIC (Real-time Status Polling)
  useEffect(() => {
    if (!userData || viewState === 'HOME') return;

    // Har 10 second mein status check karega
    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const res = await axios.get(`${API_BASE}/get-user-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Agar backend se data badal gaya hai (e.g. Subscription active ho gayi)
        if (res.data.success && JSON.stringify(res.data.user) !== JSON.stringify(userData)) {
          console.log("🔄 Snevio: Data auto-refreshed!");
          setUserData(res.data.user);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(pollInterval);
  }, [userData, viewState]);

  

  const handleLogout = useCallback(() => {
      setSearchStep(0);
      setUserData(null);
      setMobile('');
      setOtp('');
      setPassword('');
      setViewState('HOME');
      setFeedType(null);
      localStorage.clear();
      sessionStorage.clear(); 
      window.location.href = "/";
  }, []);

  const sharedProps = {
      viewState, setViewState,
      searchStep, setSearchStep,
      userData, setUserData,
      feedType, setFeedType,
      mobile, setMobile,
      otp, setOtp,
      password, setPassword,
      isNotRegistered, setIsNotRegistered,
      loading, setLoading,
      handleLogout
  };

  return width < MOBILE_BREAKPOINT ? <MobileView {...sharedProps} /> : <LaptopView {...sharedProps} />;
};

export default MainLanding;