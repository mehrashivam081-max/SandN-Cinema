import React from 'react';

const ScreenProtection = ({ children }) => {
    // Basic wrapper jo children ko render kare
    return (
        <div style={{ width: '100%', minHeight: '100vh' }}>
            {children}
        </div>
    );
};

export default ScreenProtection;