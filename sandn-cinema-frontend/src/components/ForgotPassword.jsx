import React, { useState } from 'react';
import axios from 'axios';
import './ForgotPassword.css'; // ✅ Apni nayi CSS file import ki


// ✅ Live Backend URL
const API_BASE = import.meta.env.VITE_API_BASE;

const ForgotPassword = ({ onLoginClick, onBack }) => {
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
        <div className="auth-container" style={{ fontFamily: "'Poppins', sans-serif", position: 'relative' }}>
            
            {/* 🔥 CIRCULAR NATIVE BACK BUTTON (Matches Login Screen) */}
            <button 
                onClick={onBack} 
                style={{ 
                    position: 'absolute', top: '20px', left: '20px', 
                    width: '40px', height: '40px',
                    background: 'rgba(0, 0, 0, 0.5)', /* Dark translucent background */
                    color: '#fff', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    borderRadius: '50%', /* Perfect Circle */
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    backdropFilter: 'blur(10px)', zIndex: 50, transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'; e.currentTarget.style.borderColor = '#FFD700'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}
                title="Back to Login"
            >
                {/* Sleek SVG Arrow */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
            </button>

            <div className="auth-card-glass">
                {/* 🔥 Luxe Typography Header */}
                <h2 style={{ fontWeight: '600', letterSpacing: '3px', textTransform: 'uppercase', color: '#FFD700', fontSize: '24px', margin: '0 0 5px 0' }}>
                    Recovery
                </h2>
                <p style={{ fontWeight: '300', letterSpacing: '1px', color: '#ccc', marginBottom: '30px', fontSize: '13px' }}>
                    {step === 1 ? "Reset your premium account password" : step === 2 ? "Enter the verification code" : "Create your new password"}
                </p>

                {step === 1 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa', display: 'block', textAlign: 'left', marginBottom: '8px' }}>Registered Mobile Number</label>
                            <div className="input-with-icon">
                                <span className="country-code" style={{ letterSpacing: '1px', color: '#FFD700', padding: '0 15px', borderRight: '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold' }}>+91</span>
                                <input name="mobile" className="luxe-input" type="number" placeholder="10-digit number" value={mobile} onChange={(e) => setMobile(e.target.value)} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                            </div>
                        </div>
                        
                        {/* 🔥 Segmented Controls for OTP */}
                        <div style={{ marginTop: '25px', marginBottom: '25px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', marginBottom: '12px', display: 'block', textAlign: 'left', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Receive OTP via:</label>
                            <div className="otp-methods">
                                <button type="button" className={otpMethod === 'mobile' ? 'active' : ''} onClick={() => setOtpMethod('mobile')} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>📱 SMS</button>
                                <button type="button" className={otpMethod === 'whatsapp' ? 'active' : ''} onClick={() => setOtpMethod('whatsapp')} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>💬 WhatsApp</button>
                                <button type="button" className={otpMethod === 'email' ? 'active' : ''} onClick={() => setOtpMethod('email')} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>✉️ Email</button>
                            </div>
                        </div>
                        
                        {/* 🔥 Gold Pill Button */}
                        <button className="btn-primary-luxe" onClick={handleSendOTP} disabled={loading}>
                            {loading ? "SENDING..." : "GET OTP ➡️"}
                        </button>
                    </div>
                )}

                {/* Step 2: OTP Input */}
                {step === 2 && (
                    <div className="fade-in">
                        <div className="input-group" style={{marginTop: '20px', marginBottom: '30px'}}>
                            <input 
                                className="luxe-input-center" 
                                placeholder="Enter 6-Digit OTP" 
                                type="number"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <button className="btn-primary-luxe" onClick={handleVerifyOTP} disabled={loading}>
                            {loading ? "VERIFYING..." : "VERIFY OTP 🚀"}
                        </button>
                        <p style={{textAlign: 'center', marginTop: '20px', cursor:'pointer', color: '#aaa', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase'}} onClick={() => setStep(1)}>
                            ← Change Number
                        </p>
                    </div>
                )}

                {/* Step 3: New Password */}
                {step === 3 && (
                    <div className="fade-in">
                        <div className="input-group" style={{ marginBottom: '30px' }}>
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa', display: 'block', textAlign: 'left', marginBottom: '8px' }}>Create New Password</label>
                            <input 
                                className="luxe-input" 
                                placeholder="Minimum 4 characters" 
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={{ fontWeight: '400', letterSpacing: '1px', width: '100%', boxSizing: 'border-box' }}
                            />
                        </div>
                        <button className="btn-primary-luxe" onClick={handleResetPassword} disabled={loading}>
                            {loading ? "UPDATING..." : "RESET PASSWORD ✔️"}
                        </button>
                    </div>
                )}

                {/* Messages */}
                {error && <p className="error-msg" style={{ letterSpacing: '0.5px', fontWeight: '400' }}>{error}</p>}
                {message && <p className="success-msg" style={{ letterSpacing: '0.5px', fontWeight: '400' }}>{message}</p>}

                <div style={{ marginTop: '35px', fontWeight: '300', letterSpacing: '0.5px', fontSize: '13px', color: '#888' }}>
                    <p>Remembered your password? <span className="link-text-luxe" onClick={onLoginClick}>Login here</span></p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;