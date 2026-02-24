// src/view/MainLanding.jsx
import React, { useState, useEffect } from 'react';
import useViewport from '../hooks/useViewport'; // Hook import kiya
import LaptopView from './laptopview/LaptopView'; // Laptop component
import MobileView from './mobileview/MobileView'; // Mobile component

// Mobile breakpoint (e.g., iPad ya usse chote devices ke liye 768px theek hai)
const MOBILE_BREAKPOINT = 768;

const MainLanding = () => {
  const width = useViewport(); // Current screen width pata ki

  // ✅ PERSISTENT STATE LOGIC (For Refresh & Screen Switch)
  const [viewState, setViewState] = useState(() => sessionStorage.getItem('sn_viewState') || 'HOME');
  const [searchStep, setSearchStep] = useState(() => parseInt(sessionStorage.getItem('sn_searchStep')) || 0);
  const [userData, setUserData] = useState(() => {
      const saved = sessionStorage.getItem('sn_userData');
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
  });

  // ✅ PERSISTENT INPUT LOGIC (Inputs bhi refresh par safe rahenge)
  const [feedType, setFeedType] = useState(() => sessionStorage.getItem('sn_feedType') || null);
  const [mobile, setMobile] = useState(() => sessionStorage.getItem('sn_mobile') || '');
  const [otp, setOtp] = useState(() => sessionStorage.getItem('sn_otp') || '');
  const [password, setPassword] = useState(() => sessionStorage.getItem('sn_password') || '');
  
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state changes to LocalStorage
  useEffect(() => { sessionStorage.setItem('sn_viewState', viewState); }, [viewState]);
  useEffect(() => { sessionStorage.setItem('sn_searchStep', searchStep.toString()); }, [searchStep]);
  useEffect(() => { 
      if(userData) sessionStorage.setItem('sn_userData', JSON.stringify(userData)); 
      else sessionStorage.removeItem('sn_userData');
  }, [userData]);

  // Sync inputs to SessionStorage 
  useEffect(() => { if(feedType) sessionStorage.setItem('sn_feedType', feedType); else sessionStorage.removeItem('sn_feedType'); }, [feedType]);
  useEffect(() => { sessionStorage.setItem('sn_mobile', mobile); }, [mobile]);
  useEffect(() => { sessionStorage.setItem('sn_otp', otp); }, [otp]);
  useEffect(() => { sessionStorage.setItem('sn_password', password); }, [password]);

  // ✅ HARDWARE BACK BUTTON LOGIC (1 Step Back)
  useEffect(() => {
      window.history.pushState(null, null, window.location.href);
      
      const handleBackButton = (e) => {
          e.preventDefault();
          if (searchStep > 0) {
              setSearchStep(prev => prev - 1); 
              window.history.pushState(null, null, window.location.href);
          } else if (feedType !== null) {
              setFeedType(null); 
              window.history.pushState(null, null, window.location.href);
          } else if (viewState !== 'HOME') {
              setViewState('HOME'); 
              window.history.pushState(null, null, window.location.href);
          } else {
              window.history.back(); // App exit
          }
      };

      window.addEventListener('popstate', handleBackButton);
      return () => window.removeEventListener('popstate', handleBackButton);
  }, [searchStep, feedType, viewState]);

  const handleLogout = () => {
      setSearchStep(0);
      setUserData(null);
      setMobile('');
      setOtp('');
      setPassword('');
      setViewState('HOME');
      setFeedType(null);
      localStorage.removeItem('sn_userData');
      sessionStorage.clear(); 
  };

  // Bundling all states to pass as props
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

  // Agar width 768 se kam hai to MobileView, nahi to LaptopView
  return width < MOBILE_BREAKPOINT ? <MobileView {...sharedProps} /> : <LaptopView {...sharedProps} />;
};

export default MainLanding;