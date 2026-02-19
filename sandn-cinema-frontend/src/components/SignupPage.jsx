import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './SignupPage.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const SignupPage = ({ onLoginClick, onSuccessLogin }) => {
    const navigate = useNavigate(); 
    const [activeTab, setActiveTab] = useState('user');
    const [formData, setFormData] = useState({
        name: '', mobile: '', password: '', confirm: '', 
        studioName: '', adhaar: '', whatsapp: ''
    });
    const [terms, setTerms] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

    const goToLogin = () => {
        if (onLoginClick) onLoginClick();
        else navigate('/login'); 
    };

    const handleRegister = async () => {
        const cleanPassword = formData.password.trim();
        const cleanConfirm = formData.confirm.trim();
        const cleanMobile = formData.mobile.trim();

        if (!terms) return alert("Please accept Terms & Conditions");
        if (cleanPassword !== cleanConfirm) return alert("Passwords do not match");
        if (cleanMobile.length !== 10) return alert("Mobile must be 10 digits");
        if (cleanPassword.length < 4) return alert("Password too short (min 4 chars)");

        setLoading(true);
        const payload = { type: activeTab, ...formData, mobile: cleanMobile, password: cleanPassword };

        try {
            const res = await axios.post(`${API_BASE}/signup`, payload);
            if (res.data.success) {
                try {
                    const loginRes = await axios.post(`${API_BASE}/login`, { mobile: cleanMobile, password: cleanPassword });
                    if(loginRes.data.success) {
                         alert("Account Created & Logged In!");
                         localStorage.setItem('user', JSON.stringify(loginRes.data.user));
                         if (onSuccessLogin) onSuccessLogin(loginRes.data.user);
                         else navigate('/'); // ✅ FIXED BLACK SCREEN
                    } else { alert("Account Created! Please Login."); goToLogin(); }
                } catch { alert("Account Created! Please Login."); goToLogin(); }
            } else alert(res.data.message);
        } catch (e) { alert("Registration Failed: Server Error"); } 
        finally { setLoading(false); }
    };

    return (
        <div className="signup-page-container">
            <div className="signup-card-glass">
                <h2 className="signup-title">Create Account</h2>
                
                <div className="signup-tabs">
                    <button className={activeTab === 'user' ? 'active' : ''} onClick={() => setActiveTab('user')}>User</button>
                    <button className={activeTab === 'studio' ? 'active' : ''} onClick={() => setActiveTab('studio')}>Studio</button>
                </div>

                <div className="signup-body">
                    <input name="name" placeholder={activeTab === 'studio' ? "Owner Full Name" : "Full Name"} onChange={handleChange} />
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
                        <label htmlFor="terms">I agree to Terms & Security Policy</label>
                    </div>

                    <button className="signup-btn-primary" onClick={handleRegister} disabled={loading}>
                        {loading ? 'Creating Account...' : 'REGISTER'}
                    </button>
                </div>

                <div className="signup-footer">
                    <p>Already have an account? <span className="text-link" onClick={goToLogin}>Login here</span></p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;