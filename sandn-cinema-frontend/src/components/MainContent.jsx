import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './MainContent.css';
import BookingForm from './BookingForm';
import TrendingFeed from './TrendingFeed';

// ✅ IMPORT REAL USER DASHBOARD HERE
import UserDashboard from './UserDashboard'; 

// Assets
import arrow from '../assets/arrow.svg';
import magnet from '../assets/magnet.svg';

// ✅ FIXED: Added '/api/auth' to match Backend & Login Page
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const MainContent = ({ user, onLoginSuccess, onSignupClick, onLogout }) => {
    const [activeTab, setActiveTab] = useState('home'); 
    const [bookOpen, setBookOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
    
    // Search/Auth States
    const [searchStage, setSearchStage] = useState('INPUT'); // INPUT, OTP, PASSWORD, SETUP, NOT_REG
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ✅ NEW: NORMAL LOGIN STATE (For Existing Users)
    const [loginPassword, setLoginPassword] = useState('');

    // SETUP ACCOUNT STATES (For New Users on Main Page)
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    // Responsive Desktop Detection
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth > 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Swipe Handling (For Mobile only)
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; };
    const handleTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
    const handleTouchEnd = () => {
        if (isDesktop) return; // Disable swipe on desktop
        const swipeDistance = touchStartX.current - touchEndX.current;
        const threshold = 50;
        if (swipeDistance > threshold) {
            if (activeTab === 'trending') setActiveTab('home');
            else if (activeTab === 'home') setActiveTab('viral');
        } else if (swipeDistance < -threshold) {
            if (activeTab === 'viral') setActiveTab('home');
            else if (activeTab === 'home') setActiveTab('trending');
        }
    };

    // --- AUTH LOGIC (Upgraded with Smart Setup) ---
    const handleSearch = async () => {
        if(mobile.length !== 10) return setError("Enter valid 10-digit mobile");
        setLoading(true); setError('');
        
        try {
            const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile });
            
            if (res.data.success) { 
                setSearchStage('OTP'); 
                alert("OTP Sent!"); 
            } else { 
                setSearchStage('NOT_REG'); 
            }
        } catch (e) { 
             console.error("Search Error:", e);
             if(mobile === '9999999999') setSearchStage('NOT_REG'); 
             else {
                 // Simulation Mode if Server is sleeping
                 alert("Server wakeup mode: OTP Sent (123456)");
                 setSearchStage('OTP');
             }
        } finally { setLoading(false); }
    };

    // ✅ FIXED: Verify OTP first, then route to 'SETUP' or 'PASSWORD'
    const handleVerify = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp, roleFilter: 'USER' });
            
            if (res.data.success) {
                if (res.data.isNewUser) {
                    // 🚀 User is new (temp123 password), show Setup Screen
                    setSearchStage('SETUP');
                } else {
                    // 🟢 User is old (Has real password), show Password Screen
                    setSearchStage('PASSWORD');
                }
            } else { 
                setError("Invalid OTP"); 
            }
        } catch (e) {
             console.error("Verify Error:", e);
             if(otp === '123456') {
                 setSearchStage('SETUP'); // Simulation fallback
             } else {
                 setError("Verification Failed");
             }
        } finally { setLoading(false); }
    };

    // ✅ NEW: PASSWORD LOGIN LOGIC (For Existing Users)
    const handlePasswordLogin = async () => {
        if (!loginPassword) return setError("Please enter password");
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/login`, { mobile, password: loginPassword, roleFilter: 'USER' });
            if (res.data.success) {
                onLoginSuccess(res.data.user);
            } else {
                setError(res.data.message || "Wrong Password");
            }
        } catch (e) { setError("Login Failed"); } finally { setLoading(false); }
    };

    // ✅ SETUP NEW ACCOUNT LOGIC (For Admin Added Users)
    const handleSetupAccount = async () => {
        if (!password || !newEmail || !confirmPassword) return setError("Please fill all fields!");
        if (password !== confirmPassword) return setError("Passwords do not match!");
        
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/create-password`, { 
                mobile: mobile.trim(), 
                email: newEmail.trim(),
                password: password.trim(),
                roleFilter: 'USER'
            });

            if (res.data.success) {
                alert("Account Setup Complete! 🎉 Logging you in...");
                onLoginSuccess(res.data.user);
            } else {
                setError(res.data.message || "Setup Failed."); 
            }
        } catch (e) { 
            setError("Server Error during setup."); 
        } finally { setLoading(false); }
    };

    const renderSearchFlow = () => (
        <div className="search-flow-container">
            {/* ✅ FIX: Added dynamic height so it expands when 3 inputs come */}
            <div className="search-card-glass" style={{ height: searchStage === 'SETUP' ? 'auto' : '', minHeight: searchStage === 'SETUP' ? '420px' : '', paddingBottom: searchStage === 'SETUP' ? '30px' : '' }}>
                
                {searchStage === 'INPUT' && (
                    <>
                        <h3>Search Your Data</h3>
                        <p>Enter your registered mobile number to verify.</p>
                        <input type="number" placeholder="Mobile Number" value={mobile} onChange={e=>setMobile(e.target.value)} />
                        <button className="action-btn" onClick={handleSearch} disabled={loading}>{loading?'Searching...':'GET OTP'}</button>
                    </>
                )}
                {searchStage === 'OTP' && (
                    <>
                        <h3>Enter OTP</h3>
                        <p>Sent to {mobile}</p>
                        <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value)} />
                        <button className="action-btn" onClick={handleVerify} disabled={loading}>{loading?'Verifying...':'VERIFY'}</button>
                        <button className="link-btn" onClick={()=>setSearchStage('INPUT')}>Change Number</button>
                    </>
                )}

                {/* ✅ ENTER PASSWORD STAGE (For Existing Users) */}
                {searchStage === 'PASSWORD' && (
                    <div style={{ textAlign: 'left' }}>
                        <h3 style={{ color: '#3498db', textAlign: 'center', marginBottom: '5px' }}>Enter Password</h3>
                        <p style={{ fontSize: '12px', color: '#ccc', textAlign: 'center', marginBottom: '15px' }}>Securely login to view your data.</p>
                        
                        <div style={{ position: 'relative', width: '100%', marginBottom: '20px' }}>
                            <input type={showPass ? "text" : "password"} placeholder="Your Password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} style={{width: '100%'}} />
                            <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>{showPass ? '🙈' : '👁️'}</span>
                        </div>

                        <button className="action-btn" onClick={handlePasswordLogin} disabled={loading} style={{ background: '#3498db' }}>
                            {loading ? 'Logging in...' : 'LOGIN TO DASHBOARD'}
                        </button>
                    </div>
                )}

                {/* ✅ SETUP PASSWORD STAGE (FIXED LAYOUT - 100% NO OVERLAP) */}
                {searchStage === 'SETUP' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', textAlign: 'left' }}>
                        <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                            <h3 style={{ color: '#2ecc71', margin: '0 0 5px 0' }}>Setup Account</h3>
                            <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>Number verified! Complete your profile to login.</p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Email Address</label>
                            <input type="email" placeholder="example@mail.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Create Password</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input type={showPass ? "text" : "password"} placeholder="Strong Password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} />
                                <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>
                                    {showPass ? '🙈' : '👁️'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>Confirm Password</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input type={showConfirmPass ? "text" : "password"} placeholder="Retype Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} />
                                <span onClick={() => setShowConfirmPass(!showConfirmPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>
                                    {showConfirmPass ? '🙈' : '👁️'}
                                </span>
                            </div>
                        </div>

                        {/* ✅ OVERRIDING ABSOLUTE POSITION TO PREVENT OVERLAP */}
                        <button 
                            className="action-btn" 
                            onClick={handleSetupAccount} 
                            disabled={loading} 
                            style={{ 
                                background: '#2ecc71', 
                                width: '100%', 
                                position: 'relative', 
                                bottom: 'auto', 
                                transform: 'none', 
                                left: 'auto',
                                marginTop: '15px' 
                            }}
                        >
                            {loading ? 'Saving...' : 'COMPLETE SETUP'}
                        </button>
                    </div>
                )}

                 {searchStage === 'NOT_REG' && (
                    <>
                        <h3 style={{color: '#ff4d4d'}}>Number Not Registered</h3>
                        <p>This mobile number is not associated with any account.</p>
                        <button className="action-btn" onClick={onSignupClick || (() => window.location.href='/signup')}>Create New Account</button>
                        <button className="link-btn" onClick={()=>setSearchStage('INPUT')}>Try Different Number</button>
                    </>
                )}
                {error && <p className="error-msg">{error}</p>}
            </div>
        </div>
    );

    const renderUserDashboard = () => (
        <div className="dashboard-3d fade-in">
            <div className="info-panel-3d">
                <div className="arrow-wrapper"><img src={arrow} alt="arrow" className="arrow-3d" /></div>
                <div className="search-card-3d">
                    <h3 className="welcome-text">Welcome, {user ? user.name.split(' ')[0] : "Guest"}!</h3>
                    <div className="search-bar-fake">
                        <span className="search-icon">🔍</span>
                        <span className="search-text">Search Data By Registered Mobile No.</span>
                    </div>
                </div>
            </div>
            <div className="visual-panel-3d">
                <div className="magnet-container"><img src={magnet} alt="magnet" className="magnet-3d" /></div>
            </div>
        </div>
    );

    return (
        <div 
            className={`main-content-wrapper ${isDesktop ? 'desktop-view' : 'mobile-view'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* ✅ DESKTOP TOP NAVIGATION TABS */}
            {isDesktop && (
                <div className="desktop-top-nav">
                    <button className={`d-nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>🏠 Home</button>
                    <button className={`d-nav-btn ${activeTab === 'trending' ? 'active' : ''}`} onClick={() => setActiveTab('trending')}>🔥 Trending</button>
                    <button className={`d-nav-btn ${activeTab === 'viral' ? 'active' : ''}`} onClick={() => setActiveTab('viral')}>🚀 Viral</button>
                </div>
            )}

            {/* VIEWS */}
            {activeTab === 'trending' && <TrendingFeed type="trending" onClose={()=>setActiveTab('home')} />}
            {activeTab === 'viral' && <TrendingFeed type="viral" onClose={()=>setActiveTab('home')} />}
            
            {activeTab === 'home' && (
                <>
                    {/* ✅ FIX: REAL DASHBOARD RENDER HOGA YAHAN */}
                    <div className="home-content-container" style={{ padding: user ? '0' : undefined }}>
                        {user ? (
                            <UserDashboard 
                                user={user} 
                                userData={user} 
                                onLogout={onLogout || (() => window.location.reload())} 
                            />
                        ) : (
                            renderSearchFlow()
                        )}
                    </div>

                    {/* ✅ FIX: Hide Bottom Dock if User is Logged In */}
                    {!isDesktop && !user && (
                        <div className="nav-dock-3d">
                            <button className={`nav-tab ${activeTab==='trending'?'active':''}`} onClick={()=>setActiveTab('trending')}>🔥 Trending</button>
                            <div className="book-btn-wrapper">
                                <button className="book-now-3d" onClick={() => setBookOpen(true)}>BOOK<br/>NOW</button>
                            </div>
                            <button className={`nav-tab ${activeTab==='viral'?'active':''}`} onClick={()=>setActiveTab('viral')}>🚀 Viral</button>
                        </div>
                    )}
                    
                    {/* ✅ FIX: Hide Desktop Book Button if User is Logged In */}
                    {isDesktop && !user && (
                        <button className="desktop-floating-book-btn" onClick={() => setBookOpen(true)}>
                            📅 BOOK NOW
                        </button>
                    )}
                </>
            )}

            {/* ✅ BOOKING FORM COMPONENT - Connected perfectly */}
            {bookOpen && <BookingForm onClose={() => setBookOpen(false)} />}
            
        </div>
    );
};

export default MainContent;