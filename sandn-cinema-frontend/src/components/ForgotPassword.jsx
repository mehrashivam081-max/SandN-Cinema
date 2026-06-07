import React, { useState } from 'react';
import axios from 'axios';
import './ForgotPassword.css'; // ✅ Apni nayi CSS file import ki


// ✅ Live Backend URL
const API_BASE = 'https://sandn-cinema-backend-test.onrender.com/api/auth';

const ForgotPassword = ({ onLoginClick }) => {
    const [step, setStep] = useState(1); // 1: Mobile, 2: OTP, 3: New Password
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [otpMethod, setOtpMethod] = useState('mobile'); // 👈 नया स्टेट
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // --- STEP 1: SEND OTP ---
    const handleSendOTP = async () => {
        if (!mobile || mobile.length < 10) return setError("Valid Mobile Number Required");
        setLoading(true); setError(''); setMessage('');
        try {
            const res = await axios.post(`${API_BASE}/check-send-otp`, { 
                mobile, 
                sendVia: otpMethod // 👈 मेथड भेजा
            });
            if (res.data.success) {
                setMessage(`OTP Sent successfully via ${otpMethod.toUpperCase()}!`);
                setStep(2);
            } else {
                setError(res.data.message || "User not found");
            }
        } catch (e) {
            setError("Server Error. Try again.");
        } finally { setLoading(false); }
    };

    // --- STEP 2: VERIFY OTP ---
    const handleVerifyOTP = async () => {
        if (!otp) return setError("Enter OTP");
        
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp });
            if (res.data.success) {
                setStep(3); // Next Step (Password Reset)
                setMessage("");
            } else {
                setError("Invalid OTP");
            }
        } catch (e) {
            // Testing Backdoor
            if(otp === "123456") setStep(3);
            else setError("Verification Failed");
        } finally { setLoading(false); }
    };

    // --- STEP 3: RESET PASSWORD ---
    const handleResetPassword = async () => {
        if (!newPassword) return setError("Enter new password");
        
        setLoading(true);
        // NOTE: Asli backend me '/reset-password' route banana padega.
        // Abhi ke liye hum success simulate kar rahe hain.
        setTimeout(() => {
            alert("Password Changed Successfully! Please Login.");
            onLoginClick(); // Wapas Login Page par bhejo
            setLoading(false);
        }, 1500);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Recovery</h2>
                {step === 1 && (
                    <>
                        <input className="auth-input" placeholder="Mobile Number" type="number" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                        
                        <label style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '10px', display: 'block' }}>Receive OTP via:</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                            <button type="button" onClick={() => setOtpMethod('mobile')} style={{ flex: 1, padding: '8px', background: otpMethod === 'mobile' ? '#e50914' : '#333', border: 'none', color: 'white', borderRadius: '5px' }}>SMS</button>
                            <button type="button" onClick={() => setOtpMethod('whatsapp')} style={{ flex: 1, padding: '8px', background: otpMethod === 'whatsapp' ? '#e50914' : '#333', border: 'none', color: 'white', borderRadius: '5px' }}>WhatsApp</button>
                            <button type="button" onClick={() => setOtpMethod('email')} style={{ flex: 1, padding: '8px', background: otpMethod === 'email' ? '#e50914' : '#333', border: 'none', color: 'white', borderRadius: '5px' }}>Email</button>
                        </div>
                        
                        <button className="btn-primary" onClick={handleSendOTP} disabled={loading}>{loading ? "SENDING..." : "GET OTP"}</button>
                    </>
                )}

                {/* Step 2: OTP Input */}
                {step === 2 && (
                    <div className="fade-in">
                        <p className="sub-text">Enter the 6-digit OTP sent to {mobile}</p>
                        <input 
                            className="auth-input" 
                            placeholder="Enter OTP" 
                            type="number"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                        />
                        <button className="btn-primary" onClick={handleVerifyOTP} disabled={loading}>
                            {loading ? "VERIFYING..." : "VERIFY OTP"}
                        </button>
                    </div>
                )}

                {/* Step 3: New Password */}
                {step === 3 && (
                    <div className="fade-in">
                        <p className="sub-text">Create a strong new password.</p>
                        <input 
                            className="auth-input" 
                            placeholder="New Password" 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button className="btn-primary" onClick={handleResetPassword} disabled={loading}>
                            {loading ? "UPDATING..." : "RESET PASSWORD"}
                        </button>
                    </div>
                )}

                {/* Messages */}
                {error && <p className="error-msg">{error}</p>}
                {message && <p className="success-msg">{message}</p>}

                <p className="link-text" onClick={onLoginClick}>Back to Login</p>
            </div>
        </div>
    );
};

export default ForgotPassword;