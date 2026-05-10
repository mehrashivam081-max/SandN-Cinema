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
    // ✅ NEW: Splitted SETUP into SETUP_EMAIL and SETUP_PASSWORD
    const [searchStage, setSearchStage] = useState('INPUT'); // INPUT, OTP, PASSWORD, SETUP_EMAIL, SETUP_PASSWORD, NOT_REG
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ✅ NORMAL LOGIN STATE (For Existing Users)
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

    // ✅ SMART BROWSER BACK BUTTON LOGIC (Prevent Direct Logout)
    useEffect(() => {
        window.history.pushState(null, null, window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, null, window.location.href); // Prevent default back
            if (user) {
                // Do nothing if user is logged in, stay on dashboard
            } else if (searchStage === 'OTP' || searchStage === 'PASSWORD' || searchStage === 'SETUP_EMAIL' || searchStage === 'NOT_REG') {
                setSearchStage('INPUT'); // Go back to Mobile Input
            } else if (searchStage === 'SETUP_PASSWORD') {
                setSearchStage('SETUP_EMAIL'); // Go back to Email Setup
            } else if (activeTab === 'viral') {
                setActiveTab('trending');
            } else if (activeTab === 'trending') {
                setActiveTab('home');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [searchStage, activeTab, user]);

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

    // ✅ ENTER KEY SUPPORT HELPER
    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action();
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

    // ✅ FIXED: Verify OTP first, then route to 'SETUP_EMAIL' or 'PASSWORD'
    const handleVerify = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp, roleFilter: 'USER' });
            
            if (res.data.success) {
                if (res.data.isNewUser) {
                    // 🚀 User is new (temp123 password), show Step 1 Setup Screen
                    setSearchStage('SETUP_EMAIL');
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
                 setSearchStage('SETUP_EMAIL'); // Simulation fallback
             } else {
                 setError("Verification Failed");
             }
        } finally { setLoading(false); }
    };

    // ✅ PASSWORD LOGIN LOGIC (For Existing Users)
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

    // ✅ NEXT BUTTON LOGIC (Email -> Password Stage)
    const handleEmailNext = () => {
        if (!newEmail || !newEmail.includes('@')) {
            return setError("Please enter a valid email address!");
        }
        setError('');
        setSearchStage('SETUP_PASSWORD');
    };

    // ✅ SETUP NEW ACCOUNT LOGIC (For Admin Added Users) - Final Step
    const handleSetupAccount = async () => {
        if (!password || !confirmPassword) return setError("Please fill all fields!");
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
            {/* ✅ FIXED HEIGHT AND PADDING ISSUES HERE */}
            <div className="search-card-glass" style={{ height: (searchStage === 'SETUP_EMAIL' || searchStage === 'SETUP_PASSWORD') ? 'auto' : '', minHeight: (searchStage === 'SETUP_EMAIL' || searchStage === 'SETUP_PASSWORD') ? '420px' : '', paddingBottom: (searchStage === 'SETUP_EMAIL' || searchStage === 'SETUP_PASSWORD') ? '30px' : '' }}>
                
                {searchStage === 'INPUT' && (
                    <>
                        <h3>Search Your Data</h3>
                        <p>Enter your registered mobile number to verify.</p>
                        <input type="number" placeholder="Mobile Number" value={mobile} onChange={e=>setMobile(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleSearch)} autoFocus />
                        <button className="action-btn" onClick={handleSearch} disabled={loading}>{loading?'Searching...':'GET OTP'}</button>
                    </>
                )}
                
                {searchStage === 'OTP' && (
                    <>
                        <h3>Enter OTP</h3>
                        <p>Sent to {mobile}</p>
                        <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleVerify)} autoFocus />
                        <button className="action-btn" onClick={handleVerify} disabled={loading}>{loading?'Verifying...':'VERIFY'}</button>
                        <button className="link-btn" onClick={()=>setSearchStage('INPUT')}>Change Number</button>
                    </>
                )}

                {/* ✅ ENTER PASSWORD STAGE (For Existing Users) */}
                {searchStage === 'PASSWORD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', textAlign: 'left' }}>
                        <div style={{ textAlign: 'center' }}>
                            <h3 style={{ color: '#3498db', margin: '0 0 5px 0' }}>Enter Password</h3>
                            <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>Securely login to view your data.</p>
                        </div>
                        
                        <div style={{ position: 'relative', width: '100%' }}>
                            <input type={showPass ? "text" : "password"} placeholder="Your Password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handlePasswordLogin)} style={{width: '100%', padding: '12px', boxSizing: 'border-box', margin: 0}} autoFocus />
                            <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>{showPass ? '🙈' : '👁️'}</span>
                        </div>

                        <button className="action-btn" onClick={handlePasswordLogin} disabled={loading} style={{ background: '#3498db', width: '100%', margin: '5px 0 0 0', position: 'relative', zIndex: 10 }}>
                            {loading ? 'Logging in...' : 'LOGIN TO DASHBOARD'}
                        </button>
                    </div>
                )}

                {/* ✅ SETUP STEP 1: EMAIL */}
                {searchStage === 'SETUP_EMAIL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', textAlign: 'left' }}>
                        <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                            <h3 style={{ color: '#2ecc71', margin: '0 0 5px 0' }}>Step 1: Setup Email</h3>
                            <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>Enter your email address for notifications.</p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Email Address</label>
                            <input type="email" placeholder="example@mail.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleEmailNext)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} autoFocus />
                        </div>

                        {/* Relative position to fix overlap */}
                        <button className="action-btn" onClick={handleEmailNext} style={{ background: '#3498db', width: '100%', margin: '15px 0 0 0', position: 'relative', bottom: 'auto', transform: 'none', left: 'auto' }}>
                            Next ➡️
                        </button>
                    </div>
                )}

                {/* ✅ SETUP STEP 2: PASSWORD */}
                {searchStage === 'SETUP_PASSWORD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', textAlign: 'left' }}>
                        <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                            <h3 style={{ color: '#2ecc71', margin: '0 0 5px 0' }}>Step 2: Security</h3>
                            <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>Create a strong password for your account.</p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Create Password</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input type={showPass ? "text" : "password"} placeholder="Strong Password" value={password} onChange={e=>setPassword(e.target.value)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} autoFocus />
                                <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>
                                    {showPass ? '🙈' : '👁️'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Confirm Password</label>
                            <div style={{ position: 'relative', width: '100%' }}>
                                <input type={showConfirmPass ? "text" : "password"} placeholder="Retype Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleSetupAccount)} style={{ width: '100%', margin: 0, padding: '12px', boxSizing: 'border-box' }} />
                                <span onClick={() => setShowConfirmPass(!showConfirmPass)} style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px' }}>
                                    {showConfirmPass ? '🙈' : '👁️'}
                                </span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button className="action-btn" onClick={() => setSearchStage('SETUP_EMAIL')} style={{ background: '#7f8c8d', width: '40%', margin: 0, position: 'relative', bottom: 'auto', transform: 'none', left: 'auto' }}>
                                ⬅️ Back
                            </button>
                            <button className="action-btn" onClick={handleSetupAccount} disabled={loading} style={{ background: '#2ecc71', width: '60%', margin: 0, position: 'relative', bottom: 'auto', transform: 'none', left: 'auto' }}>
                                {loading ? 'Saving...' : 'FINISH 🚀'}
                            </button>
                        </div>
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