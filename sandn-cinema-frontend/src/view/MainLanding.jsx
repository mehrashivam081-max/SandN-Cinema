// src/view/MainLanding.jsx
import React, { useState, useEffect, useCallback } from 'react';
import useViewport from '../hooks/useViewport'; 
import LaptopView from './laptopview/LaptopView'; 
import MobileView from './mobileview/MobileView';
import axios from 'axios';

const MOBILE_BREAKPOINT = 768;
const API_BASE = import.meta.env.VITE_API_BASE; // ✅ Update if backend URL changes

const MainLanding = () => {
  const width = useViewport();

  // 🔥 THE FIX: sessionStorage ki jagah localStorage use kar rahe hain taaki refresh par data na ude
  const [viewState, setViewState] = useState(() => localStorage.getItem('snevio_viewState') || 'HOME');
  const [searchStep, setSearchStep] = useState(() => parseInt(localStorage.getItem('snevio_searchStep')) || 0);
  
  const [userData, setUserData] = useState(() => {
      const localSaved = localStorage.getItem('user');
      const sessionSaved = sessionStorage.getItem('user'); 
      
      if (localSaved && localSaved !== "undefined") return JSON.parse(localSaved);
      if (sessionSaved && sessionSaved !== "undefined") return JSON.parse(sessionSaved);
      
      return null;
  });

  const [feedType, setFeedType] = useState(() => sessionStorage.getItem('snevio_feedType') || null);
  const [mobile, setMobile] = useState(() => localStorage.getItem('snevio_mobile') || '');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ SAFELY SYNC STATES TO LOCAL STORAGE
  useEffect(() => { localStorage.setItem('snevio_viewState', viewState); }, [viewState]);
  useEffect(() => { localStorage.setItem('snevio_searchStep', searchStep.toString()); }, [searchStep]);
  useEffect(() => { 
      if(userData) {
          localStorage.setItem('user', JSON.stringify(userData)); 
          localStorage.setItem('snevio_mobile', userData.mobile || mobile);
      }
  }, [userData, mobile]);

  useEffect(() => { 
    if(feedType) sessionStorage.setItem('snevio_feedType', feedType); 
    else sessionStorage.removeItem('snevio_feedType'); 
  }, [feedType]);

  // 🔄 AUTO-REFRESH LOGIC (CRASH FIX: Added Timeout & Safety Checks to prevent endless loops)
  useEffect(() => {
    // Agar user nahi hai ya Dashboard me nahi hai, to mat chalao
    if (!userData || searchStep !== 3) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;

        const res = await axios.get(`${API_BASE}/get-user-status`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000 // 🔥 Crash Fix: Agar 5 second me reply na aaye to cancel kardo (Browser hang nahi hoga)
        });

        if (res.data.success && JSON.stringify(res.data.user) !== JSON.stringify(userData)) {
          console.log("🔄 Snevio: Data auto-refreshed!");
          setUserData(res.data.user);
        }
      } catch (err) {
        console.log("Polling skipped this cycle to prevent crash.");
      }
    }, 15000); // 🔥 Time badhakar 15 sec kar diya taaki server overload na ho

    return () => clearInterval(pollInterval);
  }, [userData, searchStep]);

  

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