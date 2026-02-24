import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const LoginPage = ({ onBack, onSignupClick, onLoginSuccess }) => {
    const navigate = useNavigate();

    // ✅ Session Storage Logic for Refresh Proof
    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('loginTab') || 'user');
    const [step, setStep] = useState(() => parseInt(sessionStorage.getItem('loginStep')) || 1); 
    const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('loginInput') || ''); 
    
    // ✅ OTP Method Selection (Default: mobile)
    const [otpMethod, setOtpMethod] = useState(() => sessionStorage.getItem('loginOtpMethod') || 'mobile'); 
    
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // Syncing state to session storage
    useEffect(() => { sessionStorage.setItem('loginTab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('loginStep', step.toString()); }, [step]);
    useEffect(() => { sessionStorage.setItem('loginInput', inputValue); }, [inputValue]);
    useEffect(() => { sessionStorage.setItem('loginOtpMethod', otpMethod); }, [otpMethod]);

    const handleCheckUser = async () => {
        if (!inputValue) return setError("Please enter details");
        
        // ✅ Code (Admin) tab verification before sending OTP
        if (activeTab === 'code' && inputValue !== "0000000000CODEIS*@OWNER*") {
            return setError("Invalid Secret Code");
        }

        setLoading(true); setError('');
        try {
            // ✅ REAL OTP LOGIC: Sent via API based on user's selection
            const res = await axios.post(`${API_BASE}/check-send-otp`, { 
                mobile: inputValue.trim(),
                sendVia: otpMethod 
            });
            
            if (res.data.success) {
                alert(`OTP Sent successfully via ${otpMethod === 'mobile' ? 'SMS' : 'Email'}!`);
                setStep(2);
            } else {
                setError(res.data.message || "Failed to send OTP.");
            }
        } catch (e) {
            // ✅ Simulation Bypass Removed. Strict Backend Validation now.
            setError(e.response?.data?.message || "Connection Error. Failed to send OTP."); 
        } finally { setLoading(false); }
    };

    const handleVerifyOTP = async () => {
        if (!otp) return setError("Please enter OTP");
        setLoading(true); setError('');
        try {
            // ✅ REAL OTP VERIFICATION
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile: inputValue, otp });
            if (res.data.success) {
                setStep(3); 
            } else {
                setError(res.data.message || "Invalid OTP"); 
            }
        } catch (e) {
            // ✅ Simulation Bypass Removed.
            setError(e.response?.data?.message || "Verification Failed. Try again.");
        } finally { setLoading(false); }
    };

    const handleLogin = async () => {
        if (!password) return setError("Please enter password");
        setLoading(true); setError('');
        const cleanPassword = password.trim();

        if (activeTab === 'code') {
            if (cleanPassword === "shivam@9111") {
                const adminData = { name: "Owner", role: "ADMIN", status: "VIP" };
                localStorage.setItem('user', JSON.stringify(adminData));
                sessionStorage.clear(); // Clear session data on success
                if (onLoginSuccess) onLoginSuccess(adminData);
                else navigate('/'); 
                return;
            } else { setError("Invalid Admin Password"); setLoading(false); return; }
        }

        try {
            const res = await axios.post(`${API_BASE}/login`, { mobile: inputValue.trim(), password: cleanPassword });
            if (res.data.success) {
                localStorage.setItem('user', JSON.stringify(res.data.user));
                sessionStorage.clear(); // Clear session data on success
                if (onLoginSuccess) onLoginSuccess(res.data.user);
                else navigate('/'); 
            } else {
                setError(res.data.message || "Wrong Password"); 
            }
        } catch (e) { 
            setError(e.response?.data?.message || "Login Failed. Try again."); 
        } finally { setLoading(false); }
    };

    // ✅ Hardware Back Button Logic Inside Form (Step by step back)
    const handleStepBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            sessionStorage.clear();
            if (onBack) onBack(); else navigate('/');
        }
    };

    return (
        <div className="login-page">
            
            {/* ✅ Top-Left Home Button */}
            <div style={{position: 'absolute', top: '20px', left: '20px', cursor: 'pointer', color: '#fff', fontWeight: 'bold'}} onClick={() => { sessionStorage.clear(); if(onBack) onBack(); else navigate('/'); }}>
                🏠 Home
            </div>

            <div className="login-container">
                <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>
                    {activeTab === 'code' ? 'Security Access' : 'SandN Cinema'}
                </h2>

                <div className="auth-tabs">
                    <button className={activeTab === 'user' ? 'active' : ''} onClick={() => {setActiveTab('user'); setStep(1); setError('');}}>User</button>
                    <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => {setActiveTab('studio'); setStep(1); setError('');}}>Studio</button>
                    <button className={activeTab === 'code' ? 'active' : ''} onClick={() => {setActiveTab('code'); setStep(1); setError('');}}>Code</button>
                </div>

                {error && <div className="error-msg">{error}</div>}

                {step === 1 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>{activeTab === 'code' ? "Enter Secret Code" : "Registered Mobile Number"}</label>
                            <input type={activeTab === 'code' ? "password" : "number"} placeholder="Type here..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                        </div>
                        
{/* ✅ OTP Selection Logic (SMS, WhatsApp, Email) visible for ALL tabs */}
<div style={{ marginBottom: '15px' }}>
    <label style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px', display: 'block' }}>Receive OTP via:</label>
    <div style={{ display: 'flex', gap: '8px' }}>
        <button 
            onClick={() => setOtpMethod('mobile')}
            style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'mobile' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
        >
            📱 SMS
        </button>
        <button 
            onClick={() => setOtpMethod('whatsapp')}
            style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'whatsapp' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
        >
            💬 WhatsApp
        </button>
        <button 
            onClick={() => setOtpMethod('email')}
            style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'email' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
        >
            ✉️ Email
        </button>
    </div>
</div>

                        {/* ✅ GET OTP Button */}
                        <button className="login-btn" onClick={handleCheckUser} disabled={loading}>{loading ? 'Checking...' : 'GET OTP'}</button>
                    </div>
                )}

                {/* ✅ Step 2 (OTP Verification) applies to all tabs */}
                {step === 2 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>Enter OTP</label>
                            <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                        </div>
                        <button className="login-btn" onClick={handleVerifyOTP} disabled={loading}>VERIFY OTP</button>
                        {/* ✅ Step Back implementation */}
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>
                            {activeTab === 'code' ? '← Edit Secret Code' : '← Edit Number'}
                        </p>
                    </div>
                )}

                {step === 3 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>Password</label>
                            <div className="pass-wrapper">
                                <input type={showPass ? "text" : "password"} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>
                        <button className="login-btn" onClick={handleLogin} disabled={loading}>LOGIN NOW</button>
                        {/* ✅ Step Back implementation */}
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>← Back</p>
                    </div>
                )}

                <div className="toggle-text">
                    {step === 1 && activeTab !== 'code' && (
                        <>New here? <span onClick={onSignupClick || (() => navigate('/signup'))}>Create Account</span></>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;