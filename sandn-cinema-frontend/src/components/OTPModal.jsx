import React, { useState } from 'react';
import './OTPModal.css';

const OTPModal = ({ mobileNumber, onVerify, onResend, isLoading, error, onClose }) => {
    const [otp, setOtp] = useState('');

    return (
        <div className="modal-overlay">
            <div className="verification-modal">
                <button className="close-btn" onClick={onClose}>×</button>
                <h2 className="modal-title">Varification Process</h2>
                <h3 className="modal-subtitle">OTP(One Time Password)</h3>
                <p className="otp-message">
                    was send on your registered mobile no.<br/>
                    check your what's app
                </p>
                <div className="input-section">
                    <label>
                        enter 6 digit code : 
                        <span className="resend-link" onClick={onResend}> Resend</span>
                    </label>
                    <input 
                        type="text" 
                        maxLength="6"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="otp-input"
                    />
                </div>
                {error && <p className="error-text">{error}</p>}
                <button 
                    className="verify-btn" 
                    onClick={() => onVerify(otp)}
                    disabled={isLoading || otp.length !== 6}
                >
                    {isLoading ? 'Checking...' : 'verify'}
                </button>
            </div>
        </div>
    );
};
export default OTPModal;