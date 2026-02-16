import React from 'react';
import './Header.css';

const Header = ({ user, onLoginClick, onProfileClick, theme, toggleTheme }) => {
    return (
        <header className="app-header">
            <div className="logo-container">
                <h1 className="logo-text">SandN <span className="logo-highlight">Cinema</span></h1>
            </div>

            <div className="header-actions">
                <button className="theme-toggle-btn" onClick={toggleTheme}>
                    {theme === 'theme-red' ? '🔵' : '🔴'}
                </button>

                {user ? (
                    <div className="user-profile-icon" onClick={onProfileClick}>
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                ) : (
                    <button className="header-login-btn" onClick={onLoginClick}>
                        Login
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;