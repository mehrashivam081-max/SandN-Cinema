import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SignupPage.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const SignupPage = ({ onLoginClick, onSuccessLogin }) => {
    const navigate = useNavigate(); 
    const [activeTab, setActiveTab] = useState('user');
    const [formData, setFormData] = useState({
        name: '', email: '', mobile: '', password: '', confirm: '',  
        studioName: '', adhaar: '', whatsapp: ''
    });
    const [terms, setTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // ✅ New States for Location and OTP Verification
    const [location, setLocation] = useState({ lat: null, long: null });
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [otp, setOtp] = useState('');

    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // ✅ Get Live Location Tracker on component mount
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
        if (onLoginClick) onLoginClick();
        else navigate('/login'); 
    };

    // ✅ STEP 1: Validate Form and Send OTP
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
            const res = await axios.post(`${API_BASE}/send-signup-otp`, { mobile: cleanMobile, email: cleanEmail });
            if (res.data.success) {
                alert("Verification Code Sent to Mobile & Email!");
                setIsOtpSent(true); // Switch to OTP Input view
            } else {
                alert(res.data.message);
            }
        } catch (e) { alert("Failed to send OTP. Server Error."); } 
        finally { setLoading(false); }
    };

    // ✅ STEP 2: Verify OTP, Register, Save Location & Auto-Login
    const handleVerifyAndRegister = async () => {
        if (!otp || otp.length < 4) return alert("Please enter a valid OTP");
        
        setLoading(true);
        const cleanMobile = formData.mobile.trim();
        const cleanPassword = formData.password.trim();

        // Location & OTP added to payload
        const payload = { 
            type: activeTab, 
            ...formData, 
            mobile: cleanMobile, 
            email: formData.email.trim(), 
            password: cleanPassword,
            location: location, // Location Tracking Data
            otp: otp // Verification OTP
        };

        try {
            const res = await axios.post(`${API_BASE}/signup`, payload);
            if (res.data.success) {
                try {
                    const loginRes = await axios.post(`${API_BASE}/login`, { mobile: cleanMobile, password: cleanPassword });
                    if(loginRes.data.success) {
                         alert("Account Verified & Created Successfully!");
                         localStorage.setItem('user', JSON.stringify(loginRes.data.user));
                         if (onSuccessLogin) onSuccessLogin(loginRes.data.user);
                         else navigate('/'); // FIXED BLACK SCREEN
                    } else { alert("Account Created! Please Login."); goToLogin(); }
                } catch { alert("Account Created! Please Login."); goToLogin(); }
            } else alert(res.data.message); // Shows "Invalid OTP" if wrong
        } catch (e) { alert("Registration Failed: Server Error"); } 
        finally { setLoading(false); }
    };

    return (
        <div className="signup-page-container">
            <div className="signup-card-glass">
                <h2 className="signup-title">{isOtpSent ? "Verify Account" : "Create Account"}</h2>
                
                {!isOtpSent ? (
                    <>
                        <div className="signup-tabs">
                            <button className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>User</button>
                            <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')}>Studio</button>
                        </div>

                        <div className="signup-body">
                            <input name="name" placeholder={activeTab === 'studio' ? "Owner Full Name" : "Full Name"} onChange={handleChange} />
                            <input name="email" type="email" placeholder="Email Address (for Verification)" onChange={handleChange} />

                            {activeTab === 'studio' && (
                                <>
                                    <input name="studioName" placeholder="Studio Name" onChange={handleChange} />
                                    <input name="whatsapp" placeholder="WhatsApp Number" onChange={handleChange} />
                                    <input name="adhaar" placeholder="Aadhaar Number (12 Digit)" onChange={handleChange} />
                                </>
                            )}
                            <input name="mobile" type="number" placeholder="Mobile Number" onChange={handleChange} />
                            
                            <div className="password-wrapper">
                                <input name="password" type={showPass ? "text" : "password"} placeholder="Create Password" onChange={handleChange} />
                                <span className="eye-icon" onClick={() => setShowPass(!showPass)}>{showPass ? '🙈' : '👁️'}</span>
                            </div>

                            <div className="password-wrapper">
                                <input name="confirm" type={showConfirm ? "text" : "password"} placeholder="Confirm Password" onChange={handleChange} />
                                <span className="eye-icon" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? '🙈' : '👁️'}</span>
                            </div>

                            <div className="terms-check-aligned">
                                <input type="checkbox" id="terms" onChange={(e) => setTerms(e.target.checked)} />
                                <label htmlFor="terms">I agree to Terms & Location Access</label>
                            </div>

                            <button className="signup-btn-primary" onClick={handleSendOtp} disabled={loading}>
                                {loading ? 'Sending OTP...' : 'PROCEED TO VERIFY'}
                            </button>
                        </div>
                    </>
                ) : (
                    // ✅ OTP VERIFICATION SECTION
                    <div className="signup-body otp-verification-section">
                        <p style={{color: 'white', textAlign: 'center', fontSize: '14px', marginBottom: '15px'}}>
                            Verification code sent to {formData.mobile} & {formData.email}
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
                        <p className="text-link" style={{textAlign: 'center', marginTop: '10px'}} onClick={() => setIsOtpSent(false)}>
                            ← Edit Details
                        </p>
                    </div>
                )}

                <div className="signup-footer">
                    <p>Already have an account? <span className="text-link" onClick={goToLogin}>Login here</span></p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;