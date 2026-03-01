import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

// ✅ Firebase Imports (Make sure path is correct based on where you saved firebase.js)
import { auth } from '../firebase'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const LoginPage = ({ onBack, onSignupClick, onLoginSuccess }) => {
    const navigate = useNavigate();

    // Session Storage Logic for Refresh Proof
    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('loginTab') || 'user');
    const [step, setStep] = useState(() => parseInt(sessionStorage.getItem('loginStep')) || 1); 
    const [inputValue, setInputValue] = useState(() => sessionStorage.getItem('loginInput') || ''); 
    const [otpMethod, setOtpMethod] = useState(() => sessionStorage.getItem('loginOtpMethod') || 'mobile'); 
    
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [newEmail, setNewEmail] = useState(''); // ✅ Added for New User Email Setup
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    // ✅ Firebase Confirmation Result State
    const [confirmationResult, setConfirmationResult] = useState(null);

    // Syncing state to session storage
    useEffect(() => { sessionStorage.setItem('loginTab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('loginStep', step.toString()); }, [step]);
    useEffect(() => { sessionStorage.setItem('loginInput', inputValue); }, [inputValue]);
    useEffect(() => { sessionStorage.setItem('loginOtpMethod', otpMethod); }, [otpMethod]);

    // ✅ Initialize Firebase Invisible reCAPTCHA on Load
    useEffect(() => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber.
                }
            });
        }
    }, []);

    const handleCheckUser = async () => {
        if (!inputValue) return setError("Please enter details");
        
        // Code (Admin) tab verification before sending OTP
        if (activeTab === 'code' && inputValue !== "0000000000CODEIS*@OWNER*") {
            return setError("Invalid Secret Code");
        }

        setLoading(true); setError('');
        try {
            // ✅ 1. SECURITY CHECK: Check if user actually exists in DB before sending any OTP
            if (activeTab !== 'code') {
                const searchRes = await axios.post(`${API_BASE}/search-account`, { mobile: inputValue.trim() });
                if (!searchRes.data.success) {
                    setError("Not Registered! Please ask Admin to add you or Signup.");
                    setLoading(false);
                    return;
                }
            }

            // ✅ 2. ROUTING LOGIC: Firebase for SMS, Backend for WA/Email
            if (otpMethod === 'mobile' && activeTab !== 'code') {
                // 🚀 Send SMS via FIREBASE
                const formattedMobile = "+91" + inputValue.trim(); // Added Indian Code (+91)
                const appVerifier = window.recaptchaVerifier;
                
                const confirmation = await signInWithPhoneNumber(auth, formattedMobile, appVerifier);
                setConfirmationResult(confirmation); // Save this to verify later
                alert("OTP Sent successfully via Google SMS!");
                setStep(2);
            } else {
                // 🚀 Send WA / Email / Admin OTP via BACKEND
                const res = await axios.post(`${API_BASE}/check-send-otp`, { 
                    mobile: inputValue.trim(),
                    sendVia: otpMethod 
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

            // ✅ ROUTING LOGIC: Verify via Firebase or Backend
            if (otpMethod === 'mobile' && activeTab !== 'code') {
                // 🚀 Verify FIREBASE OTP
                await confirmationResult.confirm(otp);
                
                // If success, check backend if password is 'temp123'
                const searchRes = await axios.post(`${API_BASE}/search-account`, { mobile: inputValue.trim() });
                const userData = searchRes.data.data;
                if (!userData.password || userData.password === "temp123") {
                    isNewUser = true;
                }
            } else {
                // 🚀 Verify BACKEND OTP
                const res = await axios.post(`${API_BASE}/verify-otp`, { mobile: inputValue, otp });
                if (res.data.success) {
                    isNewUser = res.data.isNewUser;
                } else {
                    throw new Error(res.data.message || "Invalid OTP");
                }
            }

            // ✅ Decide Next Step
            if (isNewUser) {
                setStep(4); // 🚀 GO TO NEW SETUP STEP (Email + Password)
            } else {
                setStep(3); // Go to normal login step
            }

        } catch (e) {
            setError(e.message || e.response?.data?.message || "Invalid OTP or Verification Failed.");
        } finally { setLoading(false); }
    };

    // ✅ NORMAL LOGIN LOGIC (For Existing Users)
    const handleLogin = async () => {
        if (!password) return setError("Please enter password");
        setLoading(true); setError('');
        const cleanPassword = password.trim();

        if (activeTab === 'code') {
            if (cleanPassword === "shivam@9111") {
                const adminData = { name: "Owner", role: "ADMIN", status: "VIP" };
                localStorage.setItem('user', JSON.stringify(adminData));
                sessionStorage.clear(); 
                if (onLoginSuccess) onLoginSuccess(adminData);
                else navigate('/'); 
                return;
            } else { setError("Invalid Admin Password"); setLoading(false); return; }
        }

        try {
            const res = await axios.post(`${API_BASE}/login`, { mobile: inputValue.trim(), password: cleanPassword });
            if (res.data.success) {
                localStorage.setItem('user', JSON.stringify(res.data.user));
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

    // ✅ SETUP ACCOUNT LOGIC (For Manually Added Admin Users)
    const handleSetupAccount = async () => {
        if (!password || !newEmail) return setError("Please fill all fields!");
        setLoading(true); setError('');

        try {
            const res = await axios.post(`${API_BASE}/create-password`, { 
                mobile: inputValue.trim(), 
                email: newEmail.trim(),
                password: password.trim() 
            });

            if (res.data.success) {
                alert("Account Setup Complete! 🎉 Logging you in...");
                localStorage.setItem('user', JSON.stringify(res.data.user));
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

    return (
        <div className="login-page">
            {/* ✅ REQUIRED FOR FIREBASE PHONE AUTH */}
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

                {/* --- STEP 1: MOBILE INPUT --- */}
                {step === 1 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>{activeTab === 'code' ? "Enter Secret Code" : "Registered Mobile Number"}</label>
                            <input type={activeTab === 'code' ? "password" : "number"} placeholder="Type here..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                        </div>
                        
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px', display: 'block' }}>Receive OTP via:</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('mobile'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'mobile' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>
                                    📱 SMS
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('whatsapp'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'whatsapp' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>
                                    💬 WhatsApp
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('email'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'email' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}>
                                    ✉️ Email
                                </button>
                            </div>
                        </div>

                        <button className="login-btn" onClick={handleCheckUser} disabled={loading}>{loading ? 'Checking...' : 'GET OTP'}</button>
                    </div>
                )}

                {/* --- STEP 2: OTP VERIFICATION --- */}
                {step === 2 && (
                    <div className="fade-in">
                        <div className="input-group">
                            <label>Enter OTP</label>
                            <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
                        </div>
                        <button className="login-btn" onClick={handleVerifyOTP} disabled={loading}>VERIFY OTP</button>
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>
                            {activeTab === 'code' ? '← Edit Secret Code' : '← Edit Number'}
                        </p>
                    </div>
                )}

                {/* --- STEP 3: REGULAR PASSWORD LOGIN --- */}
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
                        <p className="resend-text" onClick={handleStepBack} style={{cursor: 'pointer'}}>← Back</p>
                    </div>
                )}

                {/* --- STEP 4: NEW ACCOUNT SETUP (Email & Pass) --- */}
                {step === 4 && (
                    <div className="fade-in">
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

                        <button className="login-btn" onClick={handleSetupAccount} disabled={loading}>COMPLETE SETUP & LOGIN</button>
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