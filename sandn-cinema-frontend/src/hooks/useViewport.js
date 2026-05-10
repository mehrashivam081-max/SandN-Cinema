// src/hooks/useViewport.js
import { useState, useEffect } from 'react';

const useViewport = () => {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleWindowResize = () => setWidth(window.innerWidth);
    
    // Jaise hi window resize ho, width update karo
    window.addEventListener("resize", handleWindowResize);
    
    // Cleanup function
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // Hamein sirf width return karni hai
  return width;
};

export default useViewport;