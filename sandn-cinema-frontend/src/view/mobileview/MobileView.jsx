import React, { useState, useRef } from 'react';
import axios from 'axios'; 
import './MobileView.css';

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

// API BASE URL - Update this to local during local testing if needed
const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const MobileView = ({
    viewState, setViewState, searchStep, setSearchStep,
    userData, setUserData, feedType, setFeedType,
    mobile, setMobile, otp, setOtp, password, setPassword,
    isNotRegistered, setIsNotRegistered, loading, setLoading, handleLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // States for Popup & First Time User Setup
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpMethod, setOtpMethod] = useState('mobile');
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  // TOP LEFT HOME FUNCTION (Resets everything)
  const goHome = () => { 
      setViewState('HOME'); 
      setSearchStep(0); 
      setFeedType(null); 
      setShowOtpPopup(false);
      setIsFirstTimeUser(false);
      setNewEmail(''); 
      setOtp('');
      setPassword('');
  };

  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);
  const touchStartX = useRef(0);

  const magnetRef = useRef(null);
  const [magnetStyle, setMagnetStyle] = useState({ transform: 'translate(0px, 0px)', transition: 'transform 0.3s ease-out' });

  // --- SWIPE HANDLERS ---
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

  // --- MAGNET HANDLERS ---
  const handleMagnetMove = (e) => {
    e.stopPropagation(); 
    if (!magnetRef.current) return;
    const rect = magnetRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    setMagnetStyle({ transform: `translate(${deltaX * 0.3}px, ${deltaY * 0.3}px)`, transition: 'none' });
  };

  const handleMagnetLeave = () => {
    setMagnetStyle({ transform: 'translate(0px, 0px)', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' });
  };

  // --- API LOGIC (Production Ready - Fast2SMS/Brevo) ---

  // 1. Search Click -> Open Popup
  const handleSearchClick = () => {
      if (mobile.length !== 10) return alert("Please enter valid 10 digit number");
      setShowOtpPopup(true); 
  };

  // 2. Send OTP via Selected Method
  const handleSendOtp = async (selectedMethod) => {
      setOtpMethod(selectedMethod);
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile, sendVia: selectedMethod });
          
          if (res.data.success) { 
              const methodLabel = selectedMethod === 'mobile' ? 'SMS' : selectedMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
              alert(`OTP Sent successfully via ${methodLabel}`); 
              setSearchStep(1); 
              setShowOtpPopup(false);
          } else {
              setIsNotRegistered(true);
              setShowOtpPopup(false);
          }
      } catch (e) {
          alert(e.response?.data?.message || "Server Error. Please try again.");
      } finally { setLoading(false); }
  };

  // 3. Verify OTP -> Check if new user
  const handleVerifyOTP = async () => {
      if (!otp) return alert("Please enter OTP");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp });
          if (res.data.success) {
              if (res.data.isNewUser) {
                  // User has no password -> Show Setup Screen
                  setIsFirstTimeUser(true);
                  setSearchStep(2); 
              } else {
                  // Normal User -> Login Screen
                  setSearchStep(2); 
              }
          } else {
              alert(res.data.message || "Invalid OTP! Kripya sahi OTP dalein.");
          }
      } catch (e) {
          alert("Verification Failed. Server error.");
      } finally { setLoading(false); }
  };

  // 4. Login OR Create Password
  const handleLoginOrSetup = async () => {
      if (!password) return alert("Please enter password");
      setLoading(true);

      try {
          if (isFirstTimeUser) {
              // --- SETUP LOGIC ---
              if (!newEmail) return alert("Please enter your email for future recovery.");
              
              const res = await axios.post(`${API_BASE}/create-password`, { 
                  mobile, 
                  password, 
                  email: newEmail 
              });

              if (res.data.success) {
                  alert("Account Setup Complete! Logging in...");
                  setUserData(res.data.user);
                  setSearchStep(3);
              } else {
                  alert(res.data.message);
              }
          } else {
              // --- NORMAL LOGIN ---
              const res = await axios.post(`${API_BASE}/login`, { mobile, password });
              if (res.data.success) {
                  setUserData(res.data.user);
                  setSearchStep(3);
              } else {
                  alert("Wrong Password");
              }
          }
      } catch (e) {
          alert("Login Failed. Server error.");
      } finally { setLoading(false); }
  };

  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'COLLAB') return <div style={{padding:'50px', background:'#eee', height:'100vh', textAlign:'center'}}><h2>🤝 Partnership & Collab</h2><p>Contact Admin for collaborations.</p><button onClick={goHome} style={{marginTop:'20px', padding:'10px', background:'red', color:'white', border:'none', borderRadius:'5px'}}>Go Back Home</button></div>;
  if (viewState === 'SERVICE') return <ServicesPage onBack={goHome} />;
  if (viewState === 'AUTH') return <LoginPage onBack={goHome} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'SIGNUP') return <SignupPage onLoginClick={() => setViewState('AUTH')} onBack={goHome} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'RECOVERY') return <ForgotPassword onLoginClick={() => setViewState('AUTH')} onBack={goHome} />;

  return (
    <div className="mobile-container" style={{ overflow: 'hidden', position: 'relative', background: '#222' }}>
      
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={goHome} />}
      
      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} onOpenRecovery={() => setViewState('RECOVERY')} />

      {/* ✅ OTP Selection Popup Overlay */}
      {showOtpPopup && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(5px)' }}>
              <div style={{ background: '#fff', padding: '25px', borderRadius: '20px', width: '85%', maxWidth: '320px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s ease-in-out' }}>
                  <h3 style={{ color: '#333', marginBottom: '10px', fontSize: '1.1rem' }}>Send OTP to {mobile}</h3>
                  <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>Choose your preferred method below:</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button onClick={() => handleSendOtp('mobile')} disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px', border: 'none', background: '#2b5876', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                          📱 Send via Text SMS
                      </button>
                      <button onClick={() => handleSendOtp('whatsapp')} disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px', border: 'none', background: '#25D366', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                          💬 Send via WhatsApp
                      </button>
                      <button onClick={() => handleSendOtp('email')} disabled={loading} style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px', border: 'none', background: '#EA4335', color: '#fff', cursor: 'pointer', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                          ✉️ Send via Email
                      </button>
                  </div>

                  <p onClick={() => setShowOtpPopup(false)} style={{ color: '#888', marginTop: '20px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', textDecoration: 'underline' }}>
                      Cancel
                  </p>
              </div>
          </div>
      )}

      <div 
        className="mobile-swipe-wrapper"
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleTouchEnd}
        style={{ 
            transform: `translateX(${swipeOffset}px)`, 
            transition: isSwiping.current ? 'none' : 'transform 0.3s ease-out',
            height: '100dvh',
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
                <h1 className="brand-title-mob" onClick={goHome} style={{cursor:'pointer'}}>SandN <br/> Cinema</h1>
                <div className="logo-circle-mob" onClick={() => setViewState('COLLAB')} style={{cursor:'pointer', fontSize:'10px', textAlign:'center', lineHeight:'1.2', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    🤝<br/>Collab
                </div>
              </header>
          )}

          <div className="mobile-main-content" style={userData ? {padding:0, background:'#f4f4f4', flex: 1} : {flex: 1}}>
            
            {searchStep === 3 && userData ? (
                renderDashboard()
            ) : (
                <>
                    <div className="mobile-search-block">
                        {searchStep > 0 && <span onClick={() => setSearchStep(prev => prev - 1)} style={{ alignSelf: 'flex-start', color: '#555', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px', display: 'block' }}>← Back</span>}

                        {searchStep === 0 && (
                            <>
                                <input type="number" placeholder="Search registered mobile no." className="mobile-input-field" value={mobile} onChange={e=>setMobile(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleSearchClick} disabled={loading}>{loading?'Searching...':'Search'}</button>
                            </>
                        )}
                        {searchStep === 1 && (
                            <>
                                {/* Clean OTP input field */}
                                <input type="number" placeholder="Enter OTP" className="mobile-input-field" value={otp} onChange={e=>setOtp(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleVerifyOTP} disabled={loading}>{loading?'Verifying...':'Verify OTP'}</button>
                            </>
                        )}
                        {/* Dynamic Step 2: Login OR Setup Password */}
                        {searchStep === 2 && (
                            <>
                                {isFirstTimeUser && (
                                     <input type="email" placeholder="Link your Email (Required)" className="mobile-input-field" value={newEmail} onChange={e=>setNewEmail(e.target.value)} style={{marginBottom: '10px'}} />
                                )}
                                <input type="password" placeholder={isFirstTimeUser ? "Create New Password" : "Enter Password"} className="mobile-input-field" value={password} onChange={e=>setPassword(e.target.value)} />
                                <button className="mobile-blue-btn" onClick={handleLoginOrSetup} disabled={loading}>
                                    {loading ? 'Processing...' : isFirstTimeUser ? 'Setup Account' : 'Login & Access'}
                                </button>
                            </>
                        )}
                    </div>

                    <div className="info-box-red-mob">
                        <h2>{searchStep === 0 ? "Search Your Data By Registered Mobile No." : searchStep === 1 ? "OTP Verification" : "Security Check"}</h2>
                    </div>

                    <div 
                      className="magnet-section-mob"
                      ref={magnetRef}
                      onTouchMove={handleMagnetMove}
                      onTouchEnd={handleMagnetLeave}
                      onMouseMove={handleMagnetMove}
                      onMouseLeave={handleMagnetLeave}
                      style={{ 
                        ...magnetStyle, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', touchAction: 'none' 
                      }}
                    >
                      <video 
                        className="magnet-video-mob" 
                        autoPlay loop muted playsInline
                        style={{ width: '80%', maxWidth: '300px', borderRadius: '15px', boxShadow: '0px 10px 30px rgba(0,0,0,0.2)', pointerEvents: 'none' }}
                      >
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