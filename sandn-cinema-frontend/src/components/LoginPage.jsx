import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import useBackButton from '../hooks/useBackButton'; 

// ✅ Firebase Imports
import { auth } from '../firebase'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const LoginPage = ({ onBack, onSignupClick, onLoginSuccess }) => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('loginTab') || 'user');
    const [step, setStep] = useState(() => parseInt(sessionStorage.getItem('loginStep')) || 1); 
    const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('loginInput') || ''); 
    const [otpMethod, setOtpMethod] = useState(() => sessionStorage.getItem('loginOtpMethod') || 'mobile'); 
    
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [newEmail, setNewEmail] = useState(''); 
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);

    useEffect(() => { sessionStorage.setItem('loginTab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('loginStep', step.toString()); }, [step]);
    useEffect(() => { sessionStorage.setItem('loginInput', inputValue); }, [inputValue]);
    useEffect(() => { sessionStorage.setItem('loginOtpMethod', otpMethod); }, [otpMethod]);

    useEffect(() => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {}
            });
        }
    }, []);

    const handleCheckUser = async () => {
        if (!inputValue) return setError("Please enter details");
        
        if (activeTab === 'code' && inputValue !== "0000000000CODEIS*@OWNER*") {
            return setError("Invalid Secret Code");
        }

        setLoading(true); setError('');
        try {
            if (activeTab !== 'code') {
                const searchRes = await axios.post(`${API_BASE}/search-account`, { 
                    mobile: inputValue.trim(),
                    roleFilter: activeTab.toUpperCase() 
                });
                
                if (!searchRes.data.success) {
                    setError(`Not Registered as ${activeTab.toUpperCase()}! Please ask Admin to add you or Signup.`);
                    setLoading(false);
                    return;
                }
            }

            if (otpMethod === 'mobile' && activeTab !== 'code') {
                const formattedMobile = "+91" + inputValue.trim(); 
                const appVerifier = window.recaptchaVerifier;
                
                const confirmation = await signInWithPhoneNumber(auth, formattedMobile, appVerifier);
                setConfirmationResult(confirmation); 
                alert("OTP Sent successfully via Google SMS!");
                setStep(2);
            } else {
                const res = await axios.post(`${API_BASE}/check-send-otp`, { 
                    mobile: inputValue.trim(),
                    sendVia: otpMethod,
                    roleFilter: activeTab.toUpperCase() 
                });
                
                if (res.data.success) {
                    const methodLabel = otpMethod === 'mobile' ? 'SMS' : otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
                    alert(`OTP Sent successfully via ${methodLabel}!`);
                    setStep(2);
                } else {
                    setError(res.data.message || "Failed to send OTP.");
                }
            }
        } catch (e) {
            console.error(e);
            setError(e.response?.data?.message || "Connection Error. Failed to send OTP."); 
        } finally { setLoading(false); }
    };

    const handleVerifyOTP = async () => {
        if (!otp) return setError("Please enter OTP");
        setLoading(true); setError('');
        
        try {
            let isNewUser = false;

            if (otpMethod === 'mobile' && activeTab !== 'code') {
                await confirmationResult.confirm(otp);
                
                const searchRes = await axios.post(`${API_BASE}/search-account`, { 
                    mobile: inputValue.trim(),
                    roleFilter: activeTab.toUpperCase() 
                });
                const userData = searchRes.data.data;
                const dbPass = userData.password ? String(userData.password).trim() : "";
                
                if (!dbPass || dbPass === "temp123") {
                    isNewUser = true;
                }
            } else {
                const res = await axios.post(`${API_BASE}/verify-otp`, { 
                    mobile: inputValue.trim(), 
                    otp,
                    roleFilter: activeTab.toUpperCase() 
                });
                if (res.data.success) {
                    isNewUser = res.data.isNewUser;
                } else {
                    throw new Error(res.data.message || "Invalid OTP");
                }
            }

            if (isNewUser) setStep(4); 
            else setStep(3); 

        } catch (e) {
            setError(e.message || e.response?.data?.message || "Invalid OTP or Verification Failed.");
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
                localStorage.setItem('authToken', 'super_admin_bypass_token_999'); // Fallback token for owner
                sessionStorage.clear(); 
                if (onLoginSuccess) onLoginSuccess(adminData);
                else navigate('/'); 
                return;
            } else { setError("Invalid Admin Password"); setLoading(false); return; }
        }

        try {
            const res = await axios.post(`${API_BASE}/login`, { 
                mobile: inputValue.trim(), 
                password: cleanPassword,
                roleFilter: activeTab.toUpperCase() 
            });
            if (res.data.success) {
                // 🔒 SAVE JWT TOKEN AND USER
                localStorage.setItem('user', JSON.stringify(res.data.user));
                if (res.data.token) localStorage.setItem('authToken', res.data.token); 
                
                sessionStorage.clear(); 
                if (onLoginSuccess) onLoginSuccess(res.data.user);
                else navigate('/'); 
            } else {
                setError(res.data.message || "Wrong Password"); 
            }
        } catch (e) { 
            setError(e.response?.data?.message || "Login Failed. Try again."); 
        } finally { setLoading(false); }
    };

    const handleSetupAccount = async () => {
        if (!password || !newEmail || !confirmPassword) return setError("Please fill all fields!");
        if (password !== confirmPassword) return setError("Passwords do not match!"); 
        
        setLoading(true); setError('');

        try {
            const res = await axios.post(`${API_BASE}/create-password`, { 
                mobile: inputValue.trim(), 
                email: newEmail.trim(),
                password: password.trim(),
                roleFilter: activeTab.toUpperCase() 
            });

            if (res.data.success) {
                alert("Account Setup Complete! 🎉 Logging you in...");
                // 🔒 SAVE JWT TOKEN AND USER
                localStorage.setItem('user', JSON.stringify(res.data.user));
                if (res.data.token) localStorage.setItem('authToken', res.data.token);
                
                sessionStorage.clear(); 
                if (onLoginSuccess) onLoginSuccess(res.data.user);
                else navigate('/'); 
            } else {
                setError(res.data.message || "Setup Failed."); 
            }
        } catch (e) { 
            setError("Server Error during setup."); 
        } finally { setLoading(false); }
    };

    const handleStepBack = () => {
        if (step > 1) {
            setStep(step - 1);
        } else {
            sessionStorage.clear();
            if (onBack) onBack(); else navigate('/');
        }
    };

    useBackButton(() => {
        handleStepBack();
    });

    return (
        <div className="login-page">
            <div id="recaptcha-container"></div>
            
            <div style={{position: 'absolute', top: '20px', left: '20px', cursor: 'pointer', color: '#fff', fontWeight: 'bold'}} onClick={() => { sessionStorage.clear(); if(onBack) onBack(); else navigate('/'); }}>
                🏠 Home
            </div>

            <div className="login-container">
                <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>
                    {activeTab === 'code' ? 'Security Access' : 'SandN Cinema'}
                </h2>

                <div className="auth-tabs">
                    {step === 1 ? (
                        <>
                            <button className={activeTab === 'user' ? 'active' : ''} onClick={() => {setActiveTab('user'); setStep(1); setError('');}}>User</button>
                            <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => {setActiveTab('studio'); setStep(1); setError('');}}>Studio</button>
                            <button className={activeTab === 'code' ? 'active' : ''} onClick={() => {setActiveTab('code'); setStep(1); setError('');}}>Code</button>
                        </>
                    ) : (
                        <button className="active" style={{ cursor: 'default', flex: 1, pointerEvents: 'none' }}>
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Verification
                        </button>
                    )}
                </div>

                {error && <div className="error-msg">{error}</div>}

                {step === 1 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleCheckUser(); }}>
                        <div className="input-group">
                            <label>{activeTab === 'code' ? "Enter Secret Code" : "Registered Mobile Number"}</label>
                            <input type={activeTab === 'code' ? "password" : "number"} placeholder="Type here..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px', display: 'block' }}>Receive OTP via:</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" onClick={(e) => { e.preventDefault(); setOtpMethod('mobile'); }} style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'mobile' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>📱 SMS</button>
                                <button type="button" onClick={(e) => { e.preventDefault(); setOtpMethod('whatsapp'); }} style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'whatsapp' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>💬 WhatsApp</button>
                                <button type="button" onClick={(e) => { e.preventDefault(); setOtpMethod('email'); }} style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'email' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>✉️ Email</button>
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Checking...' : 'GET OTP'}</button>
                    </form>
                )}

                {step === 2 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }}>
                        <div className="input-group">
                            <label>Enter OTP</label>
                            <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>VERIFY OTP</button>
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>
                            {activeTab === 'code' ? '← Edit Secret Code' : '← Edit Number'}
                        </p>
                    </form>
                )}

                {step === 3 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                        <div className="input-group">
                            <label>Password</label>
                            <div className="pass-wrapper">
                                <input type={showPass ? "text" : "password"} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>LOGIN NOW</button>
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>← Back</p>
                    </form>
                )}

                {step === 4 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleSetupAccount(); }}>
                        <p style={{ color: '#28a745', fontSize: '12px', marginBottom: '15px' }}>✅ Number Verified! Please complete your profile setup.</p>
                        
                        <div className="input-group">
                            <label>Your Email Address</label>
                            <input type="email" placeholder="example@gmail.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        </div>

                        <div className="input-group">
                            <label>Create New Password</label>
                            <div className="pass-wrapper">
                                <input type={showPass ? "text" : "password"} placeholder="Strong Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Confirm Password</label>
                            <div className="pass-wrapper">
                                <input type={showConfirmPass ? "text" : "password"} placeholder="Retype Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowConfirmPass(!showConfirmPass)}>{showConfirmPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>COMPLETE SETUP & LOGIN</button>
                    </form>
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