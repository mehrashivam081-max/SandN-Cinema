import React, { useState, useRef } from 'react';
import axios from 'axios'; 
import './MobileView.css';

// Video File Import (Ensure it exists in assets folder)
import magnetVideo from '../../assets/magnet-clip.mp4'; 

import ProfilePage from '../../components/ProfilePage';
import ServicesPage from '../../components/ServicesPage';
import LoginPage from '../../components/LoginPage';
import SignupPage from '../../components/SignupPage';
import ForgotPassword from '../../components/ForgotPassword';
import BookingForm from '../../components/BookingForm';
import TrendingFeed from '../../components/TrendingFeed';
import NotRegisteredPage from '../../components/NotRegisteredPage';

// Dashboards
import UserDashboard from '../../components/UserDashboard'; 
import StudioDashboard from '../../StudioPanel/StudioDashboard';
import OwnerDashboard from '../../AdminPanel/OwnerDashboard';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const MobileView = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewState, setViewState] = useState('HOME');
  const [feedType, setFeedType] = useState(null);
  
  const [searchStep, setSearchStep] = useState(0); 
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState(null);
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ REAL-TIME SWIPE LOGIC STATES
  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => { 
      if (userData || feedType || viewState !== 'HOME') return;
      touchStartX.current = e.targetTouches[0].clientX; 
      isSwiping.current = true;
  };
  
  const handleTouchMove = (e) => { 
      if (!isSwiping.current || userData || feedType) return;
      const currentX = e.targetTouches[0].clientX; 
      const diff = currentX - touchStartX.current;
      setSwipeOffset(diff); 
  };
  
  const handleTouchEnd = () => {
      if (!isSwiping.current) return;
      isSwiping.current = false;
      
      if (swipeOffset < -80) setFeedType('trending'); 
      else if (swipeOffset > 80) setFeedType('viral'); 
      
      setSwipeOffset(0); 
  };

  // ✅ REAL API LOGIC (WhatsApp OTP)
  const handleMobileSearch = async () => {
      if (mobile.length !== 10) return alert("Please enter valid 10 digit number");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile });
          if (res.data.success) { 
              // ✅ Changed to WhatsApp message
              alert(`WhatsApp OTP Sent to ${mobile}`); 
              setSearchStep(1); 
          } else {
              setIsNotRegistered(true);
          }
      } catch (e) {
          alert("Server Error. Thoda wait karein.");
      } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
      if (!otp) return alert("Please enter OTP");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp });
          if (res.data.success) {
              setSearchStep(2); 
          } else {
              alert("Galat OTP! Kripya sahi OTP dalein.");
          }
      } catch (e) {
          alert("Verification Failed. Server error.");
      } finally { setLoading(false); }
  };

  const handleVerifyPassword = async () => {
      if (!password) return alert("Please enter password");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/login`, { mobile, password });
          if (res.data.success) {
              setUserData(res.data.user);
              setSearchStep(3);
          } else {
              alert("Wrong Password");
          }
      } catch (e) {
          alert("Login Failed. Server error.");
      } finally { setLoading(false); }
  };

  const handleLogout = () => {
      setSearchStep(0); setUserData(null); setMobile(''); setOtp(''); setPassword(''); setViewState('HOME');
  };

  // ✅ ROLE BASED DASHBOARD ROUTING
  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'SIGNUP') return <SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'RECOVERY') return <ForgotPassword onLoginClick={() => setViewState('AUTH')} />;

  return (
    <div className="mobile-container" style={{ overflow: 'hidden', position: 'relative', background: '#222' }}>
      
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={() => setViewState('HOME')} />}
      
      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} onOpenRecovery={() => setViewState('RECOVERY')} />

      <div 
        className="mobile-swipe-wrapper"
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
        style={{ 
            transform: `translateX(${swipeOffset}px)`, 
            transition: isSwiping.current ? 'none' : 'transform 0.3s ease-out',
            height: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#fff', 
            position: 'absolute',
            zIndex: feedType ? 0 : 5 
        }}
      >
          {!userData && (
              <header className="mobile-header">
                <div className="menu-icon-mob" onClick={() => setMenuOpen(true)}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </div>
                <h1 className="brand-title-mob">SandN <br/> Cinema</h1>
                <div className="logo-circle-mob">SN</div>
              </header>
          )}

          <div className="mobile-main-content" style={userData ? {padding:0, background:'#f4f4f4', flex: 1} : {flex: 1}}>
            
            {searchStep === 3 && userData ? (
                renderDashboard()
            ) : (
                <>
                    <div className="mobile-search-block">
                        {searchStep === 0 && (
                            <>
                                <input type="number" placeholder="Search registered mobile no." className="mobile-input-field" value={mobile} onChange={e=>setMobile(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleMobileSearch} disabled={loading}>{loading?'Searching...':'Search'}</button>
                            </>
                        )}
                        {searchStep === 1 && (
                            <>
                                <input type="number" placeholder="Enter WhatsApp OTP" className="mobile-input-field" value={otp} onChange={e=>setOtp(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleVerifyOTP} disabled={loading}>{loading?'Verifying...':'Verify OTP'}</button>
                            </>
                        )}
                        {searchStep === 2 && (
                            <>
                                <input type="password" placeholder="Enter Password" className="mobile-input-field" value={password} onChange={e=>setPassword(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleVerifyPassword} disabled={loading}>{loading?'Logging in...':'Login & Access'}</button>
                            </>
                        )}
                    </div>

                    <div className="info-box-red-mob">
                        <h2>{searchStep === 0 ? "Search Your Data By Registered Mobile No." : searchStep === 1 ? "WhatsApp OTP Verification" : "Security Check"}</h2>
                    </div>

                    <div className="magnet-section-mob">
                      <video className="magnet-video-mob" autoPlay loop muted playsInline>
                        <source src={magnetVideo} type="video/mp4" />
                      </video>
                    </div>

                    <div className="footer-section-mob">
                      <button className="book-btn-mob" onClick={() => setViewState('BOOKING')}>Book <br/> Now</button>
                    </div>
                </>
            )}
          </div>
      </div>
    </div>
  );
};

export default MobileView;