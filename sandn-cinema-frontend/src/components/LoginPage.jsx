import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css';

const API_BASE = 'http://localhost:5000/api/auth';

const LoginPage = ({ onBack, onForgotClick, onSignupClick, onLoginSuccess }) => {
    const [activeTab, setActiveTab] = useState('user');
    const [step, setStep] = useState(1); 
    const [inputValue, setInputValue] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    // ✅ Password Visibility
    const [showPass, setShowPass] = useState(false);

    const handleCheckUser = async () => {
        if (!inputValue) return setError("Please enter Mobile Number");
        // Admin Code Bypass
        if (activeTab === 'code' && inputValue === "0000000000CODEIS*@OWNER*") {
            setStep(3); return;
        }
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile: inputValue.trim() });
            if (res.data.success) {
                alert("OTP Sent: Check Backend Console");
                setStep(2);
            } else { setError(res.data.message); }
        } catch (e) {
            // Simulation
            if(inputValue.length === 10) { setStep(2); alert("Simulation: OTP Sent"); } 
            else { setError("Connection Error"); }
        } finally { setLoading(false); }
    };

    const handleVerifyOTP = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile: inputValue, otp });
            if (res.data.success) setStep(3); else setError("Invalid OTP");
        } catch (e) {
            if(otp === "123456") setStep(3); else setError("Verification Failed");
        } finally { setLoading(false); }
    };

    const handleLogin = async () => {
        setLoading(true); setError('');
        const cleanPassword = password.trim(); // ✅ Remove spaces

        if (activeTab === 'code') {
            if (cleanPassword === "shivam@9111") {
                onLoginSuccess({ name: "Owner", role: "ADMIN", status: "VIP" });
                return;
            } else { setError("Invalid Admin Password"); setLoading(false); return; }
        }

        try {
            const res = await axios.post(`${API_BASE}/login`, { mobile: inputValue.trim(), password: cleanPassword });
            if (res.data.success) onLoginSuccess(res.data.user);
            else setError("Wrong Password");
        } catch (e) { setError("Login Failed"); }
        finally { setLoading(false); }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <h2 className="auth-title">
                    {activeTab === 'user' ? 'User Login' : activeTab === 'studio' ? 'Studio Login' : 'Admin Access'}
                </h2>

                <div className="auth-tabs">
                    <button className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>User</button>
                    <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')}>Studio</button>
                    <button className={activeTab === 'code' ? 'active' : ''} onClick={() => setActiveTab('code')}>Code</button>
                </div>

                <div className="auth-body">
                    <input 
                        type="number" 
                        placeholder={activeTab === 'code' ? "Enter Secret Code" : "Mobile Number"}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={step > 1}
                    />
                    
                    {step === 1 && (
                        <button className="auth-btn" onClick={handleCheckUser} disabled={loading}>{loading?'Checking...':'GET OTP'}</button>
                    )}

                    {step === 2 && activeTab !== 'code' && (
                        <div className="fade-in">
                            <input type="number" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                            <button className="auth-btn" onClick={handleVerifyOTP} disabled={loading}>VERIFY OTP</button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="fade-in">
                            {/* ✅ Updated Password Input with Eye */}
                            <div className="password-wrapper" style={{marginBottom: '10px'}}>
                                <input 
                                    type={showPass ? "text" : "password"} 
                                    placeholder="Enter Password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                />
                                <span 
                                    className="eye-icon" 
                                    onClick={() => setShowPass(!showPass)}
                                    style={{color: 'grey'}} // Visible color fix for white card
                                >
                                    {showPass ? '🙈' : '👁️'}
                                </span>
                            </div>

                            <button className="auth-btn glow-btn" onClick={handleLogin} disabled={loading}>LOGIN</button>
                        </div>
                    )}

                    {error && <p className="error-text">{error}</p>}
                </div>

                <div className="auth-footer">
                    {activeTab !== 'code' && step === 1 && (
                        <p onClick={onSignupClick}>New User? <span>Create Account</span></p>
                    )}
                    <p onClick={onBack}>Back to Search</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;