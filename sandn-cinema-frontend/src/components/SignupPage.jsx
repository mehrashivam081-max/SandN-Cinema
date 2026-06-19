import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SignupPage.css';

const API_BASE = import.meta.env.VITE_API_BASE;

const SignupPage = ({ onLoginClick, onSuccessLogin, onBack }) => {
    const navigate = useNavigate(); 
    
    // ✅ Refresh Proof: Keep data in sessionStorage
    const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('signupTab') || 'user');
    const [formData, setFormData] = useState(() => {
        const savedData = sessionStorage.getItem('signupForm');
        return savedData ? JSON.parse(savedData) : {
            name: '', email: '', mobile: '', password: '', confirm: '',  
            studioName: '', adhaar: '', whatsapp: ''
        };
    });

    // ✅ Added OTP Method Selection for Signup
    const [otpMethod, setOtpMethod] = useState(() => sessionStorage.getItem('signupOtpMethod') || 'mobile'); 

    useEffect(() => { sessionStorage.setItem('signupTab', activeTab); }, [activeTab]);
    useEffect(() => { sessionStorage.setItem('signupForm', JSON.stringify(formData)); }, [formData]);
    useEffect(() => { sessionStorage.setItem('signupOtpMethod', otpMethod); }, [otpMethod]);

    const [terms, setTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // ✅ Terms Modal State
    const [showTermsModal, setShowTermsModal] = useState(false);
    
    const [location, setLocation] = useState({ lat: null, long: null });
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [otp, setOtp] = useState('');

    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({ lat: position.coords.latitude, long: position.coords.longitude });
                },
                (error) => console.log("Location Denied by User")
            );
        }
    }, []);

    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

    const goToLogin = () => {
        sessionStorage.removeItem('signupForm');
        sessionStorage.removeItem('signupTab');
        if (onLoginClick) onLoginClick();
        else navigate('/login'); 
    };

    const handleSendOtp = async () => {
        const cleanPassword = formData.password.trim();
        const cleanConfirm = formData.confirm.trim();
        const cleanMobile = formData.mobile.trim();
        const cleanEmail = formData.email.trim(); 

        if (!terms) return alert("Please accept Terms & Conditions");
        if (!cleanEmail) return alert("Please enter your Email Address"); 
        if (cleanPassword !== cleanConfirm) return alert("Passwords do not match");
        if (cleanMobile.length !== 10) return alert("Mobile must be 10 digits");
        if (cleanPassword.length < 4) return alert("Password too short (min 4 chars)");

        setLoading(true);
        try {
            // ✅ Include sendVia logic
            const res = await axios.post(`${API_BASE}/send-signup-otp`, { 
                mobile: cleanMobile, 
                email: cleanEmail,
                sendVia: otpMethod 
            });
            if (res.data.success) {
                const methodLabel = otpMethod === 'mobile' ? 'SMS' : otpMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
                alert(`Verification Code Sent via ${methodLabel}!`);
                setIsOtpSent(true); 
            } else {
                alert(res.data.message);
            }
        } catch (e) { alert("Failed to send OTP. Server Error."); } 
        finally { setLoading(false); }
    };

    const handleVerifyAndRegister = async () => {
        if (!otp || otp.length < 4) return alert("Please enter a valid OTP");
        
        setLoading(true);
        const cleanMobile = formData.mobile.trim();
        const cleanPassword = formData.password.trim();

        const payload = { 
            type: activeTab, 
            ...formData, 
            mobile: cleanMobile, 
            email: formData.email.trim(), 
            password: cleanPassword,
            location: location, 
            otp: otp 
        };

        try {
            const res = await axios.post(`${API_BASE}/signup`, payload);
            if (res.data.success) {
                try {
                    const loginRes = await axios.post(`${API_BASE}/login`, { mobile: cleanMobile, password: cleanPassword });
                    if(loginRes.data.success) {
                         alert("Account Verified & Created Successfully!");
                         sessionStorage.removeItem('signupForm');
                         sessionStorage.removeItem('signupTab');
                         localStorage.setItem('user', JSON.stringify(loginRes.data.user));
                         if (onSuccessLogin) onSuccessLogin(loginRes.data.user);
                         else navigate('/'); 
                    } else { alert("Account Created! Please Login."); goToLogin(); }
                } catch { alert("Account Created! Please Login."); goToLogin(); }
            } else alert(res.data.message); 
        } catch (e) { alert("Registration Failed: Server Error"); } 
        finally { setLoading(false); }
    };

    return (
        <div className="signup-page-container" style={{ fontFamily: "'Poppins', sans-serif" }}>
            
            {/* 🔥 Ultra-Premium Floating Back Button (Matched with Login Page) */}
            <div className="home-btn-glass" onClick={() => { sessionStorage.removeItem('signupForm'); if(onBack) onBack(); else navigate('/'); }} title="Back to Main Page">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span className="home-text">Back to Website</span>
            </div>

            {/* ✅ Terms Modal (Premium Glass Design) */}
            {showTermsModal && (
                <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.85)', zIndex:9999, display:'flex', justifyContent:'center', alignItems:'center', backdropFilter: 'blur(10px)'}}>
                    <div className="fade-in" style={{background:'rgba(25, 30, 40, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding:'30px', borderRadius:'20px', width:'90%', maxWidth:'400px', color:'#fff', textAlign:'left', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'}}>
                        <h3 style={{margin: '0 0 15px 0', color: '#FFD700', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600'}}>Terms & Privacy Access</h3>
                        <div style={{fontSize:'13px', lineHeight:'1.8', maxHeight:'300px', overflowY:'auto', color: '#ccc', paddingRight: '10px', fontWeight: '300', letterSpacing: '0.5px'}}>
                            <strong>1. Data Collection:</strong> We collect details and location to offer accurate services.<br/><br/>
                            <strong>2. Security:</strong> Your media is fully encrypted.<br/><br/>
                            <strong>3. Policy Update:</strong> Admin holds the right to alter content & guidelines.
                        </div>
                        <button onClick={() => setShowTermsModal(false)} style={{marginTop:'25px', width:'100%', background:'linear-gradient(135deg, #FFD700, #F39C12)', color:'#000', padding:'14px', border:'none', borderRadius:'12px', fontWeight:'700', cursor:'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1.5px', boxShadow: '0 5px 15px rgba(243, 156, 18, 0.3)'}}>I Understand</button>
                    </div>
                </div>
            )}

            <div className="signup-card-glass">
                {/* 🔥 Luxe Typography for Headers */}
                <h2 className="signup-title" style={{ fontWeight: '600', letterSpacing: '3px', textTransform: 'uppercase', color: '#FFD700', fontSize: '24px' }}>
                    {isOtpSent ? "Verify Account" : "Create Account"}
                </h2>
                <p className="signup-subtitle" style={{ fontWeight: '300', letterSpacing: '1px', color: '#ccc', marginBottom: '30px', fontSize: '13px' }}>
                    {isOtpSent ? "Enter the 6-digit code sent to you" : "Join the premium community today"}
                </p>
                
                {/* 🔥 Apple-style Segmented Controls */}
                <div className="auth-tabs" style={{ letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {!isOtpSent ? (
                        <>
                            <button className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')} style={{ fontWeight: '600', fontSize: '12px' }}>User</button>
                            <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')} style={{ fontWeight: '600', fontSize: '12px' }}>Studio</button>
                        </>
                    ) : (
                        <button className="active" style={{ cursor: 'default', flex: 1, pointerEvents: 'none', fontWeight: '600', fontSize: '12px' }}>
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Verification
                        </button>
                    )}
                </div>

                {!isOtpSent ? (
                    <div className="signup-body">
                        {/* 🔥 Minimalist & Spaced Labels */}
                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>{activeTab === 'studio' ? "Owner Full Name" : "Full Name"}</label>
                            <input name="name" value={formData.name} placeholder="e.g. Rahul Sharma" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '0.5px' }} />
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Email Address</label>
                            <input name="email" value={formData.email} type="email" placeholder="you@example.com" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '0.5px' }} />
                        </div>

                        {activeTab === 'studio' && (
                            <>
                                <div className="input-group">
                                    <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Studio Name</label>
                                    <input name="studioName" value={formData.studioName} placeholder="e.g. Rahul Photography" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '0.5px' }} />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>WhatsApp Number</label>
                                    <input name="whatsapp" value={formData.whatsapp} placeholder="10-digit number" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Aadhaar Number</label>
                                    <input name="adhaar" value={formData.adhaar} placeholder="12-digit number" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                                </div>
                            </>
                        )}
                        
                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Mobile Number</label>
                            <div className="input-with-icon">
                                <span className="country-code" style={{ letterSpacing: '1px' }}>+91</span>
                                <input name="mobile" value={formData.mobile} type="number" placeholder="10-digit number" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                            </div>
                        </div>
                        
                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Create Password</label>
                            <div className="pass-wrapper">
                                <input name="password" value={formData.password} type={showPass ? "text" : "password"} placeholder="Minimum 4 characters" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa' }}>Confirm Password</label>
                            <div className="pass-wrapper">
                                <input name="confirm" value={formData.confirm} type={showConfirm ? "text" : "password"} placeholder="Retype password" onChange={handleChange} style={{ fontWeight: '400', letterSpacing: '1px' }} />
                                <span className="eye-icon" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? '🙈' : '👁️'}</span>
                            </div>
                        </div>

                        {/* 🔥 Modern OTP Option Buttons */}
                        <div style={{ marginTop: '20px', marginBottom: '25px' }}>
                            <label style={{ fontSize: '11px', color: '#aaa', marginBottom: '12px', display: 'block', textAlign: 'left', fontWeight: '500', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Receive OTP via:</label>
                            <div className="otp-methods">
                                <button type="button" className={otpMethod === 'mobile' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setOtpMethod('mobile'); }} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>📱 SMS</button>
                                <button type="button" className={otpMethod === 'whatsapp' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setOtpMethod('whatsapp'); }} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>💬 WhatsApp</button>
                                <button type="button" className={otpMethod === 'email' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setOtpMethod('email'); }} style={{ letterSpacing: '1px', fontWeight: '500', textTransform: 'uppercase', fontSize: '11px' }}>✉️ Email</button>
                            </div>
                        </div>

                        {/* 🔥 Clean Checkbox */}
                        <div className="checkbox-wrapper" style={{ letterSpacing: '0.5px', fontWeight: '300', marginBottom: '25px' }}>
                            <input type="checkbox" id="terms" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                            <label htmlFor="terms">I agree to the <span onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} style={{color:'#FFD700', textDecoration:'underline', fontWeight: '500', cursor: 'pointer'}}>Terms & Location Access</span></label>
                        </div>

                        <button className="signup-btn-primary" onClick={handleSendOtp} disabled={loading} style={{ letterSpacing: '2px', fontWeight: '700', fontSize: '13px' }}>
                            {loading ? 'Sending OTP...' : 'PROCEED TO VERIFY ➡️'}
                        </button>
                    </div>
                ) : (
                    <div className="signup-body otp-verification-section fade-in">
                        <div className="input-group" style={{marginTop: '20px'}}>
                            <input 
                                type="number" 
                                placeholder="Enter 6-Digit OTP" 
                                value={otp} 
                                onChange={(e) => setOtp(e.target.value)} 
                                style={{textAlign: 'center', letterSpacing: '8px', fontSize: '22px', fontWeight: '600', padding: '15px'}}
                                autoFocus
                            />
                        </div>
                        <button className="signup-btn-primary" onClick={handleVerifyAndRegister} disabled={loading} style={{ letterSpacing: '2px', fontWeight: '700', fontSize: '13px', marginTop: '10px' }}>
                            {loading ? 'Creating Account...' : 'VERIFY & REGISTER 🚀'}
                        </button>
                        <p className="text-link" style={{textAlign: 'center', marginTop: '20px', cursor:'pointer', color: '#aaa', fontSize: '12px', fontWeight: '500', letterSpacing: '1px', textTransform: 'uppercase'}} onClick={() => setIsOtpSent(false)}>
                            ← Edit Details
                        </p>
                    </div>
                )}

                <div className="signup-footer toggle-text" style={{ fontWeight: '300', letterSpacing: '0.5px', marginTop: '30px' }}>
                    <p>Already have an account? <span onClick={goToLogin} style={{ fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Login here</span></p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;