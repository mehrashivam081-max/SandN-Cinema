import React from 'react';
import './Header.css';

const Header = ({ user, onLoginClick, onProfileClick, theme, toggleTheme }) => {
    return (
        <header 
            className="app-header"
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 20px',
                width: '100%',
                boxSizing: 'border-box',
                position: 'fixed', // 🔥 हेडर को टॉप पर फिक्स रखने के लिए
                top: 0,
                left: 0,
                zIndex: 1000,
                background: 'rgba(18, 18, 18, 0.4)', // 🔥 डार्क ट्रांसपेरेंट 
                backdropFilter: 'blur(12px)', // 🔥 शीशे जैसा ब्लर इफ़ेक्ट
                WebkitBackdropFilter: 'blur(12px)', // Safari सपोर्ट के लिए
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)' // हल्की सी नीचे की लाइन
            }}
        >
            {/* 1. Logo Section */}
            <div className="logo-container" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="/favicon.png" alt="Snevio Logo" className="header-logo-icon" style={{ width: '32px', height: '32px' }} />
                <h1 className="logo-text" style={{ margin: 0, color: '#ffffff', fontSize: '22px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    SNEVIO
                </h1>
            </div>

            {/* 2. Actions Section */}
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                
                {/* Theme Toggle Button */}
                <button 
                    className="theme-toggle-btn" 
                    onClick={toggleTheme}
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                        width: '38px',
                        height: '38px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: '0.3s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                >
                    {theme === 'theme-red' ? '🔵' : '🔴'}
                </button>

                {/* Profile or Login Button */}
                {user ? (
                    <div 
                        className="user-profile-icon" 
                        onClick={onProfileClick}
                        style={{
                            background: '#FFD700', // 🔥 येलो ब्रांड कलर
                            color: '#121212',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: 'pointer',
                            border: '2px solid rgba(255, 215, 0, 0.5)',
                            boxShadow: '0 2px 10px rgba(255, 215, 0, 0.2)'
                        }}
                    >
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                ) : (
                    <button 
                        className="header-login-btn" 
                        onClick={onLoginClick}
                        style={{
                            padding: '8px 22px', 
                            background: 'rgba(255, 255, 255, 0.1)', // 🔥 ट्रांसपेरेंट ग्लास बटन
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.3)', 
                            borderRadius: '30px', 
                            cursor: 'pointer',
                            fontWeight: 'bold', 
                            fontSize: '14px',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => { 
                            e.target.style.background = '#FFD700'; 
                            e.target.style.color = '#121212'; 
                            e.target.style.border = '1px solid #FFD700'; 
                            e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => { 
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)'; 
                            e.target.style.color = '#ffffff'; 
                            e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)'; 
                            e.target.style.boxShadow = 'none';
                        }}
                    >
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;