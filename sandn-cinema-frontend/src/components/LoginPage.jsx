import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';
import useBackButton from '../hooks/useBackButton'; 

// ✅ Firebase Imports
import { auth } from '../firebase'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const API_BASE = import.meta.env.VITE_API_BASE;

const LoginPage = ({ onBack, onSignupClick, onLoginSuccess }) => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('loginTab') || 'user');
    const [step, setStep] = useState(() => parseInt(sessionStorage.getItem('loginStep')) || 1); 
    const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('loginInput') || ''); 
    const [otpMethod, setOtpMethod] = useState(() => sessionStorage.getItem('loginOtpMethod') || 'mobile'); 

    // 🔥 FIX: Automatically set default OTP method based on selected tab
    useEffect(() => {
        if (activeTab === 'code') {
            setOtpMethod('email'); // Admin/Code login switches to Email by default
        } else {
            setOtpMethod('mobile'); // Users/Studio switch to Mobile/SMS by default
        }
    }, [activeTab]); 
    
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [newEmail, setNewEmail] = useState(''); 
    const [referralCode, setReferralCode] = useState(''); // 👈 NAYA: Referral Code State
    const [rememberMe, setRememberMe] = useState(true); // Default true
    
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
                
                // 🔒 ADMIN PERSISTENCE LOGIC
                const storage = rememberMe ? localStorage : sessionStorage;
                (rememberMe ? sessionStorage : localStorage).clear();
                
                storage.setItem('user', JSON.stringify(adminData));
                storage.setItem('authToken', 'super_admin_bypass_token_999'); 
                
                if (onLoginSuccess) onLoginSuccess(adminData);
                else navigate('/'); 
                return;
            } else { 
                setError("Invalid Admin Password"); 
                setLoading(false); 
                return; 
            }
        }

        try {
            const res = await axios.post(`${API_BASE}/login`, { 
                mobile: inputValue.trim(), 
                password: cleanPassword,
                roleFilter: activeTab.toUpperCase() 
            });
            
            if (res.data.success) {
                // 🔒 SMART PERSISTENCE LOGIC
                const storage = rememberMe ? localStorage : sessionStorage;
                
                // Clear opposite storage so no conflict occurs
                (rememberMe ? sessionStorage : localStorage).clear();

                storage.setItem('user', JSON.stringify(res.data.user));
                if (res.data.token) storage.setItem('authToken', res.data.token);
                
                if (onLoginSuccess) onLoginSuccess(res.data.user);
                else navigate('/'); 
            } else {
                setError(res.data.message || "Wrong Password"); 
            }
        } catch (e) { 
            setError(e.response?.data?.message || "Login Failed. Try again."); 
        } finally { 
            setLoading(false); 
        }
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
                roleFilter: activeTab.toUpperCase(),
                referralCode: referralCode.trim() // 👈 NAYA: Send Code to Backend
            });

            if (res.data.success) {
                alert("Account Setup Complete! 🎉 Logging you in...");
                // 🔒 SMART PERSISTENCE LOGIC
                const storage = rememberMe ? localStorage : sessionStorage;
                
                // Clear opposite storage so no conflict occurs
                (rememberMe ? sessionStorage : localStorage).clear();

                storage.setItem('user', JSON.stringify(res.data.user));
                if (res.data.token) storage.setItem('authToken', res.data.token);
                
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
            <div id="recaptcha-container" style={{ display: 'none' }}></div>
            
            {/* 🔥 Ultra-Premium Floating Back Button */}
            <div className="home-btn-glass" onClick={() => { sessionStorage.clear(); if(onBack) onBack(); else navigate('/'); }} title="Back to Main Page">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span className="home-text">Back to Website</span>
            </div>

            <div className="login-container">
                <h2 className="login-brand-title">
                    {activeTab === 'code' ? 'Security Access' : <>SNE<span style={{color: '#FFD700'}}>VIO</span></>}
                </h2>
                <p className="login-subtitle">{activeTab === 'code' ? 'Enter admin credentials' : 'Login to your premium account'}</p>

                {/* 🔥 Apple-style Segmented Controls */}
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

                {error && <div className="error-msg">⚠️ {error}</div>}

                {/* STEP 1: MOBILE INPUT */}
                {step === 1 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleCheckUser(); }}>
                        <div className="input-group">
                            <label>{activeTab === 'code' ? "Enter Secret Code" : "Registered Mobile Number"}</label>
                            <div className="input-with-icon">
                                {activeTab !== 'code' && <span className="country-code">+91</span>}
                                <input type={activeTab === 'code' ? "password" : "number"} placeholder="Type here..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} autoFocus />
                            </div>
                        </div>
                        
                        {/* 🔥 Responsive & Secure OTP Methods (Disabled during loading) */}
                        {/* 🔥 Fixed: OTP options now show everywhere, with smart presets */}
                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', marginBottom: '12px', display: 'block', textAlign: 'left', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase' }}>Receive OTP via:</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', justifyContent: 'space-between', overflowX: 'auto', paddingBottom: '5px' }}>
                                {/* SMS Option - Hide or disable for code tab if premium rules apply */}
                                <button type="button" disabled={loading} onClick={(e) => { e.preventDefault(); setOtpMethod('mobile'); }} style={{ flex: 1, minWidth: '85px', padding: '10px 5px', fontSize: '11px', borderRadius: '10px', border: '1px solid', borderColor: otpMethod === 'mobile' ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', background: otpMethod === 'mobile' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: otpMethod === 'mobile' ? '#FFD700' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: '600', transition: 'all 0.3s ease', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>📱 SMS</button>
                                <button type="button" disabled={loading} onClick={(e) => { e.preventDefault(); setOtpMethod('whatsapp'); }} style={{ flex: 1, minWidth: '95px', padding: '10px 5px', fontSize: '11px', borderRadius: '10px', border: '1px solid', borderColor: otpMethod === 'whatsapp' ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', background: otpMethod === 'whatsapp' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: otpMethod === 'whatsapp' ? '#FFD700' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: '600', transition: 'all 0.3s ease', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>💬 WhatsApp</button>
                                <button type="button" disabled={loading} onClick={(e) => { e.preventDefault(); setOtpMethod('email'); }} style={{ flex: 1, minWidth: '85px', padding: '10px 5px', fontSize: '11px', borderRadius: '10px', border: '1px solid', borderColor: otpMethod === 'email' ? '#FFD700' : 'rgba(255, 255, 255, 0.2)', background: otpMethod === 'email' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: otpMethod === 'email' ? '#FFD700' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: '600', transition: 'all 0.3s ease', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>✉️ Email</button>
                            </div>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Checking...' : 'CONTINUE ➡️'}</button>
                    </form>
                )}

                {/* STEP 2: OTP VERIFICATION */}
                {step === 2 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleVerifyOTP(); }}>
                        <div className="input-group">
                            <label>Enter Verification Code</label>
                            <input type="number" placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} style={{letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem'}} autoFocus />
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Verifying...' : 'VERIFY OTP'}</button>
                        <p className="resend-text" onClick={handleStepBack}>
                            {activeTab === 'code' ? '← Edit Secret Code' : '← Edit Number'}
                        </p>
                    </form>
                )}

                {/* STEP 3: LOGIN (PASSWORD) */}
                {step === 3 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                        <div className="input-group">
                            <label>Account Password</label>
                            <div className="pass-wrapper">
                                <input type={showPass ? "text" : "password"} placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                            
                            <div className="checkbox-wrapper">
                                <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} id="remember" />
                                <label htmlFor="remember">Keep me securely logged in</label>
                            </div>
                        </div>
                        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Authenticating...' : 'SECURE LOGIN 🔒'}</button>
                        <p className="resend-text" onClick={handleStepBack}>← Back</p>
                    </form>
                )}

                {/* STEP 4: NEW USER SETUP */}
                {step === 4 && (
                    <form className="fade-in" onSubmit={(e) => { e.preventDefault(); handleSetupAccount(); }}>
                        <div style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px solid #2ecc71', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
                            <p style={{ color: '#2ecc71', fontSize: '12px', margin: 0, fontWeight: 'bold' }}>✅ Number Verified! Complete setup to continue.</p>
                        </div>
                        
                        <div className="input-group">
                            <input type="email" placeholder="Email Address (For Recovery)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoFocus />
                        </div>

                        <div className="input-group">
                            <div className="pass-wrapper">
                                <input type={showPass ? "text" : "password"} placeholder="Create Strong Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <div className="pass-wrapper">
                                <input type={showConfirmPass ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                <span className="eye-icon" onClick={() => setShowConfirmPass(!showConfirmPass)}>{showConfirmPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Referral Code (Optional)</span>
                                <span style={{ color: '#2ecc71', fontSize: '10px', background: 'rgba(46, 204, 113, 0.15)', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>+20 Free Coins</span>
                            </label>
                            <input type="text" placeholder="Got an invite code?" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 'bold', color: '#f1c40f' }} />
                        </div>

                        <div className="checkbox-wrapper">
                            <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(!rememberMe)} id="remember-new" />
                            <label htmlFor="remember-new">Keep me logged in</label>
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Creating Account...' : 'CREATE & LOGIN 🚀'}</button>
                    </form>
                )}

                <div className="toggle-text">
                    {step === 1 && activeTab !== 'code' && (
                        <>Don't have an account? <span onClick={onSignupClick || (() => navigate('/signup'))}>Sign Up</span></>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;