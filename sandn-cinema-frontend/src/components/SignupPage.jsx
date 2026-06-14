import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SignupPage.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

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
        <div className="signup-page-container">
            
            {/* ✅ Top-Left Home Button */}
            <div style={{position: 'absolute', top: '20px', left: '20px', cursor: 'pointer', color: '#fff', fontSize: '18px', fontWeight: 'bold'}} onClick={() => { sessionStorage.removeItem('signupForm'); if(onBack) onBack(); else navigate('/'); }}>
                🏠 Home
            </div>

            {/* ✅ Terms Modal (Customizable by Super Admin Later) */}
            {showTermsModal && (
                <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', zIndex:9999, display:'flex', justifyContent:'center', alignItems:'center'}}>
                    <div style={{background:'white', padding:'25px', borderRadius:'15px', width:'85%', maxWidth:'400px', color:'black', textAlign:'left'}}>
                        <h3>Terms & Privacy Access</h3>
                        <div style={{fontSize:'13px', marginTop:'15px', lineHeight:'1.6', maxHeight:'300px', overflowY:'auto'}}>
                            <strong>1. Data Collection:</strong> We collect details and location to offer accurate services.<br/><br/>
                            <strong>2. Security:</strong> Your media is fully encrypted.<br/><br/>
                            <strong>3. Policy Update:</strong> Admin holds the right to alter content & guidelines.
                        </div>
                        <button onClick={() => setShowTermsModal(false)} style={{marginTop:'20px', width:'100%', background:'#e50914', color:'white', padding:'10px', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>I Understand</button>
                    </div>
                </div>
            )}

            <div className="signup-card-glass">
                <h2 className="signup-title">{isOtpSent ? "Verify Account" : "Create Account"}</h2>
                
                {/* ✅ SMART TABS LOGIC: Hide other tabs after OTP is sent */}
                <div className="signup-tabs">
                    {!isOtpSent ? (
                        <>
                            <button className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>User</button>
                            <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')}>Studio</button>
                        </>
                    ) : (
                        <button className="active" style={{ cursor: 'default', flex: 1, pointerEvents: 'none' }}>
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Verification
                        </button>
                    )}
                </div>

                {!isOtpSent ? (
                    <div className="signup-body">
                        <input name="name" value={formData.name} placeholder={activeTab === 'studio' ? "Owner Full Name" : "Full Name"} onChange={handleChange} />
                        <input name="email" value={formData.email} type="email" placeholder="Email Address (for Verification)" onChange={handleChange} />

                        {activeTab === 'studio' && (
                            <>
                                <input name="studioName" value={formData.studioName} placeholder="Studio Name" onChange={handleChange} />
                                <input name="whatsapp" value={formData.whatsapp} placeholder="WhatsApp Number" onChange={handleChange} />
                                <input name="adhaar" value={formData.adhaar} placeholder="Aadhaar Number (12 Digit)" onChange={handleChange} />
                            </>
                        )}
                        <input name="mobile" value={formData.mobile} type="number" placeholder="Mobile Number" onChange={handleChange} />
                        
                        <div className="password-wrapper">
                            <input name="password" value={formData.password} type={showPass ? "text" : "password"} placeholder="Create Password" onChange={handleChange} />
                            <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                        </div>

                        <div className="password-wrapper">
                            <input name="confirm" value={formData.confirm} type={showConfirm ? "text" : "password"} placeholder="Confirm Password" onChange={handleChange} />
                            <span className="eye-icon" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? '🙈' : '👁️'}</span>
                        </div>

                        {/* ✅ 3-Button OTP Selection for Signup */}
                        <div style={{ marginTop: '10px', marginBottom: '5px' }}>
                            <label style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '8px', display: 'block', textAlign: 'left' }}>Receive OTP via:</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('mobile'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'mobile' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
                                >
                                    📱 SMS
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('whatsapp'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'whatsapp' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
                                >
                                    💬 WhatsApp
                                </button>
                                <button 
                                    onClick={(e) => { e.preventDefault(); setOtpMethod('email'); }}
                                    style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '8px', border: '1px solid #444', background: otpMethod === 'email' ? '#e50914' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s ease' }}
                                >
                                    ✉️ Email
                                </button>
                            </div>
                        </div>

                        {/* ✅ Fixed Checkbox Alignment & Clickable Terms Text */}
                        <div className="terms-check-aligned" style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', marginTop:'5px', marginBottom:'15px', color:'white', fontSize:'13px'}}>
                            <input type="checkbox" id="terms" onChange={(e) => setTerms(e.target.checked)} style={{margin:0, width:'16px', height:'16px', cursor:'pointer'}} />
                            <label htmlFor="terms" style={{cursor:'pointer'}}>I agree to <span onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} style={{color:'red', textDecoration:'underline'}}>Terms & Location Access</span></label>
                        </div>

                        <button className="signup-btn-primary" onClick={handleSendOtp} disabled={loading}>
                            {loading ? 'Sending OTP...' : 'PROCEED TO VERIFY'}
                        </button>
                    </div>
                ) : (
                    <div className="signup-body otp-verification-section">
                        <p style={{color: 'white', textAlign: 'center', fontSize: '14px', marginBottom: '15px'}}>
                            Verification code sent!
                        </p>
                        <input 
                            type="text" 
                            placeholder="Enter 6-Digit OTP" 
                            value={otp} 
                            onChange={(e) => setOtp(e.target.value)} 
                            style={{textAlign: 'center', letterSpacing: '3px', fontSize: '16px'}}
                        />
                        <button className="signup-btn-primary" onClick={handleVerifyAndRegister} disabled={loading}>
                            {loading ? 'Creating Account...' : 'VERIFY & REGISTER'}
                        </button>
                        {/* ✅ Step Back Logic (Return to Edit) */}
                        <p className="text-link" style={{textAlign: 'center', marginTop: '10px', cursor:'pointer'}} onClick={() => setIsOtpSent(false)}>
                            ← Edit Details
                        </p>
                    </div>
                )}

                <div className="signup-footer">
                    <p>Already have an account? <span className="text-link" onClick={goToLogin} style={{cursor:'pointer'}}>Login here</span></p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;