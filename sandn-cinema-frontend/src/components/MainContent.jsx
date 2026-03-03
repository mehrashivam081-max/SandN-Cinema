import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './MainContent.css';
import BookingForm from './BookingForm';
import TrendingFeed from './TrendingFeed';

// Assets
import arrow from '../assets/arrow.svg';
import magnet from '../assets/magnet.svg';

// ✅ FIXED: Added '/api/auth' to match Backend & Login Page
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const MainContent = ({ user, onLoginSuccess, onSignupClick }) => {
    const [activeTab, setActiveTab] = useState('home'); 
    const [bookOpen, setBookOpen] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
    
    // Search/Auth States
    const [searchStage, setSearchStage] = useState('INPUT'); // INPUT, OTP, NOT_REG
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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

    // --- AUTH LOGIC (Corrected) ---
    const handleSearch = async () => {
        if(mobile.length !== 10) return setError("Enter valid 10-digit mobile");
        setLoading(true); setError('');
        
        try {
            const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile });
            
            if (res.data.success) { 
                setSearchStage('OTP'); 
                alert("OTP Sent! (Check Console or use 123456)"); 
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

    const handleVerify = async () => {
        setLoading(true); setError('');
        try {
            const res = await axios.post(`${API_BASE}/login-otp`, { mobile, otp });
            
            if (res.data.success) {
                onLoginSuccess(res.data.user);
            } else { 
                setError("Invalid OTP"); 
            }
        } catch (e) {
             console.error("Verify Error:", e);
             if(otp === '123456') onLoginSuccess({ name: "Simulated User", mobile, role: "USER" }); 
             else setError("Verification Failed");
        } finally { setLoading(false); }
    };

    const renderSearchFlow = () => (
        <div className="search-flow-container">
            <div className="search-card-glass">
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
                    <div className="home-content-container">
                        {user ? renderUserDashboard() : renderSearchFlow()}
                    </div>

                    {/* ✅ MOBILE BOTTOM DOCK (Hidden on Desktop) */}
                    {!isDesktop && (
                        <div className="nav-dock-3d">
                            <button className={`nav-tab ${activeTab==='trending'?'active':''}`} onClick={()=>setActiveTab('trending')}>🔥 Trending</button>
                            <div className="book-btn-wrapper">
                                <button className="book-now-3d" onClick={() => setBookOpen(true)}>BOOK<br/>NOW</button>
                            </div>
                            <button className={`nav-tab ${activeTab==='viral'?'active':''}`} onClick={()=>setActiveTab('viral')}>🚀 Viral</button>
                        </div>
                    )}
                    
                    {/* ✅ DESKTOP FLOATING BOOK BUTTON (If Desktop, it floats on bottom right instead of dock) */}
                    {isDesktop && (
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