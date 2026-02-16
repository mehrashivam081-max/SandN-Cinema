import React from 'react';
import './LoginPage.css';

const ForgotPassword = ({ onLoginClick }) => {
    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Recovery</h2>
                <p style={{color: 'var(--text-muted)', marginBottom: '20px'}}>Enter your registered mobile to receive OTP.</p>
                <input className="auth-input" placeholder="Mobile Number" />
                <button className="btn-primary">SEND OTP</button>
                <p className="link-text" onClick={onLoginClick}>Back to Login</p>
            </div>
        </div>
    );
};
export default ForgotPassword;