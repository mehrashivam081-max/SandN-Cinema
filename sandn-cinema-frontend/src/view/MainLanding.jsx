// src/view/MainLanding.jsx
import React from 'react';
import useViewport from '../hooks/useViewport'; // Hook import kiya
import LaptopView from './laptopview/LaptopView'; // Laptop component
import MobileView from './mobileview/MobileView'; // Mobile component

// Mobile breakpoint (e.g., iPad ya usse chote devices ke liye 768px theek hai)
const MOBILE_BREAKPOINT = 768;

const MainLanding = () => {
  const width = useViewport(); // Current screen width pata ki

  // Agar width 768 se kam hai to MobileView, nahi to LaptopView
  return width < MOBILE_BREAKPOINT ? <MobileView /> : <LaptopView />;
};

export default MainLanding;