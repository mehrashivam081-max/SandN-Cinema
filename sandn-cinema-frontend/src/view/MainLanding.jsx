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
  const [viewState, setViewState] = useState(() => localStorage.getItem('sn_viewState') || 'HOME');
  const [searchStep, setSearchStep] = useState(() => parseInt(localStorage.getItem('sn_searchStep')) || 0);
  const [userData, setUserData] = useState(() => {
      const saved = localStorage.getItem('sn_userData');
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
  });

  const [feedType, setFeedType] = useState(null);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state changes to LocalStorage
  useEffect(() => { localStorage.setItem('sn_viewState', viewState); }, [viewState]);
  useEffect(() => { localStorage.setItem('sn_searchStep', searchStep.toString()); }, [searchStep]);
  useEffect(() => { 
      if(userData) localStorage.setItem('sn_userData', JSON.stringify(userData)); 
      else localStorage.removeItem('sn_userData');
  }, [userData]);

  const handleLogout = () => {
      setSearchStep(0);
      setUserData(null);
      setMobile('');
      setOtp('');
      setPassword('');
      setViewState('HOME');
      localStorage.removeItem('sn_userData');
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