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
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // Syncing state to session storage
    useEffect(() => { sessionStorage.setItem('loginTab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('loginStep', step.toString()); }, [step]);
    useEffect(() => { sessionStorage.setItem('loginInput', inputValue); }, [inputValue]);

    const handleCheckUser = async () => {
        if (!inputValue) return setError("Please enter details");
        
        if (activeTab === 'code' && inputValue === "0000000000CODEIS*@OWNER*") {
            setStep(3); setError(""); return;
        }

        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile: inputValue.trim() });
            if (res.data.success) {
                alert("OTP Sent! (Use '123456' if SMS fails)");
                setStep(2);
            } else setError(res.data.message); 
        } catch (e) {
            if(inputValue.length === 10) { setStep(2); alert("Simulation: OTP Sent (123456)"); } 
            else setError("Connection Error."); 
        } finally { setLoading(false); }
    };

    const handleVerifyOTP = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile: inputValue, otp });
            if (res.data.success) setStep(3); 
            else setError("Invalid OTP"); 
        } catch (e) {
            if(otp === "123456") setStep(3); else setError("Verification Failed");
        } finally { setLoading(false); }
    };

    const handleLogin = async () => {
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
            } else setError("Wrong Password"); 
        } catch (e) { setError("Login Failed. Try again."); } 
        finally { setLoading(false); }
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
                            <label>{activeTab === 'code' ? "Enter Secret Code" : "Mobile Number"}</label>
                            <input type={activeTab === 'code' ? "password" : "number"} placeholder="Type here..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                        </div>
                        {/* ✅ GET OTP Text changed for User/Studio tabs */}
                        <button className="login-btn" onClick={handleCheckUser} disabled={loading}>{loading ? 'Checking...' : activeTab === 'code' ? 'Access' : 'GET OTP'}</button>
                    </div>
                )}

                {step === 2 && activeTab !== 'code' && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>Enter OTP</label>
                            <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                        </div>
                        <button className="login-btn" onClick={handleVerifyOTP} disabled={loading}>VERIFY OTP</button>
                        {/* ✅ Step Back implementation */}
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>← Edit Number</p>
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
                    {/* ✅ Removed 'Back to Home' Link from here */}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;