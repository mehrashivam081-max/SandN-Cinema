import { useEffect, useRef } from 'react';

const useBackButton = (callbackFunction) => {
    // 1. Ek ref banayenge jo humesha latest function ko yaad rakhega bina infinite loop banaye
    const callbackRef = useRef(callbackFunction);

    // 2. Jab bhi page me kuch change ho (jaise input type karna), bas is ref ko chupchap update kar do
    useEffect(() => {
        callbackRef.current = callbackFunction;
    }, [callbackFunction]);

    // 3. Ye logic life me sirf ek baar run hoga (Empty array [] ki wajah se)
    useEffect(() => {
        // App me aate hi ek invisible history trap set karo
        window.history.pushState(null, null, window.location.href);

        const handlePopState = (event) => {
            // Jaise hi user back dabaye, bahar nikalne se pehle wapas trap set kar do
            window.history.pushState(null, null, window.location.href);
            
            // Aur apna internal logic (modal close / tab change) chala do
            if (callbackRef.current) {
                callbackRef.current();
            }
        };

        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []); 
};

export default useBackButton;