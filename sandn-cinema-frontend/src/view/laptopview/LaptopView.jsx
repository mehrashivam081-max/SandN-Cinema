import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LaptopView.css';
import magnetVideo from '../../assets/magnet-clip.mp4';
import ProfilePage from '../../components/ProfilePage';
import ServicesPage from '../../components/ServicesPage';
import LoginPage from '../../components/LoginPage';
import SignupPage from '../../components/SignupPage';
import ForgotPassword from '../../components/ForgotPassword';
import BookingForm from '../../components/BookingForm';
import TrendingFeed from '../../components/TrendingFeed';
import NotRegisteredPage from '../../components/NotRegisteredPage';

import UserDashboard from '../../components/UserDashboard'; 
import StudioDashboard from '../../StudioPanel/StudioDashboard';
import OwnerDashboard from '../../AdminPanel/OwnerDashboard';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

const LaptopView = ({
    viewState, setViewState, searchStep, setSearchStep,
    userData, setUserData, feedType, setFeedType,
    mobile, setMobile, otp, setOtp, password, setPassword,
    isNotRegistered, setIsNotRegistered, loading, setLoading, handleLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // States for Popup & Password Creation
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpMethod, setOtpMethod] = useState('mobile');
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false); 
  const [newEmail, setNewEmail] = useState(''); 

  // App Name Clickable as Home (Reset everything)
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

  // 1. Handle Search Click (Open Popup)
  const handleSearchClick = () => {
      if (mobile.length !== 10) return alert("Invalid Mobile Number");
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

  // 3. Verify OTP & Check User Status
  const handleVerifyOTP = async () => {
      if (!otp) return alert("Please enter OTP");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp });
          if (res.data.success) {
              if (res.data.isNewUser) {
                  setIsFirstTimeUser(true);
                  setSearchStep(2); 
              } else {
                  setSearchStep(2); 
              }
          } else {
              alert(res.data.message || "Galat OTP! Kripya sahi OTP dalein.");
          }
      } catch (e) {
          alert("Verification Failed. Server error.");
      } finally { setLoading(false); }
  };

  // 4. Login OR Setup Password
  const handleLoginOrSetup = async () => {
      if (!password) return alert("Please enter password");
      setLoading(true);
      
      try {
          if (isFirstTimeUser) {
              if (!newEmail) return alert("Please enter your email for account recovery.");
              
              const res = await axios.post(`${API_BASE}/create-password`, { 
                  mobile, 
                  password, 
                  email: newEmail 
              });

              if (res.data.success) { 
                  alert("Account Setup Successful! Logging in...");
                  setUserData(res.data.user); 
                  setSearchStep(3); 
              } else {
                  alert(res.data.message || "Setup Failed");
              }
          } else {
              const res = await axios.post(`${API_BASE}/login`, { mobile, password });
              if (res.data.success) { 
                  setUserData(res.data.user); 
                  setSearchStep(3); 
              } else {
                  alert(res.data.message || "Wrong Password");
              }
          }
      } catch (e) {
          alert("Action Failed. Server error.");
      } finally { setLoading(false); }
  };

  const handleManualSwipe = (direction) => {
      if (direction === 'left') setFeedType('trending');
      if (direction === 'right') setFeedType('viral');   
  };

  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'COLLAB') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh', textAlign:'center'}}><h2>🤝 Partnership & Collab</h2><p>Contact Admin for collaborations.</p><button onClick={goHome} style={{marginTop:'20px', padding:'10px', background:'red', color:'white', border:'none', borderRadius:'5px'}}>Go Back</button></div>;

  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'SIGNUP') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'RECOVERY') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><ForgotPassword onLoginClick={() => setViewState('AUTH')} /></div>;

  return (
    <div className="laptop-container" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={() => setViewState('HOME')} />}

      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} onOpenRecovery={() => setViewState('RECOVERY')} />

      {/* ✅ PROFESSIONAL OTP POPUP OVERLAY */}
      {showOtpPopup && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', width: '350px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', animation: 'popIn 0.3s ease' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#333' }}>Send OTP to {mobile}</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Select verification method:</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button onClick={() => handleSendOtp('mobile')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#2b5876', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          📱 Send via Text SMS
                      </button>
                      <button onClick={() => handleSendOtp('whatsapp')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          💬 Send via WhatsApp
                      </button>
                      <button onClick={() => handleSendOtp('email')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#EA4335', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          ✉️ Send via Email
                      </button>
                  </div>

                  <p onClick={() => setShowOtpPopup(false)} style={{ marginTop: '20px', color: '#999', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</p>
              </div>
          </div>
      )}

      {!userData && (
          <header className="laptop-header">
            <div className="menu-icon" onClick={() => setMenuOpen(true)} style={{cursor: 'pointer'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                 <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="brand-section">
              <h1 className="brand-title" onClick={goHome} style={{cursor:'pointer'}}>SandN Cinema</h1>
              
              <div className="laptop-search-wrapper" style={{ flexDirection: 'column', gap: '8px' }}>
                 {searchStep === 0 && (
                    <>
                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            <input type="text" placeholder="Search registered mobile number" className="search-input" value={mobile} onChange={e=>setMobile(e.target.value)} />
                            <button className="search-btn" onClick={handleSearchClick} disabled={loading}>{loading?'...':'Search'}</button>
                        </div>
                    </>
                 )}
                 {searchStep === 1 && (
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <input type="text" placeholder="Enter OTP" className="search-input" value={otp} onChange={e=>setOtp(e.target.value)} style={{flex:1}} />
                        <button className="search-btn" onClick={handleVerifyOTP} disabled={loading}>{loading?'...':'Verify'}</button>
                    </div>
                 )}
                 {/* Dynamic Step 2: Login OR Create Password */}
                 {searchStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                        {isFirstTimeUser && (
                            <input type="email" placeholder="Link your Email (Required)" className="search-input" value={newEmail} onChange={e=>setNewEmail(e.target.value)} style={{width: '100%'}} />
                        )}
                        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                            <input type="password" placeholder={isFirstTimeUser ? "Create New Password" : "Enter Password"} className="search-input" value={password} onChange={e=>setPassword(e.target.value)} style={{flex: 1}} />
                            <button className="search-btn" onClick={handleLoginOrSetup} disabled={loading}>
                                {loading ? '...' : isFirstTimeUser ? 'Setup Account' : 'Login'}
                            </button>
                        </div>
                    </div>
                 )}
              </div>
            </div>
            <div className="logo-circle" onClick={() => setViewState('COLLAB')} style={{cursor: 'pointer', fontSize: '12px', textAlign: 'center', lineHeight: '1.2', display:'flex', alignItems:'center', justifyContent:'center'}}>
                🤝<br/>Collab
            </div>
          </header>
      )}

      {!userData && (
        <>
            <div style={{position:'absolute', left:'20px', top:'50%', zIndex:10}}>
                <button onClick={() => handleManualSwipe('left')} style={{padding:'10px', background:'rgba(255,255,255,0.5)', borderRadius:'50%', border:'none', cursor:'pointer', fontWeight:'bold'}}>🔥 Trending</button>
            </div>
            <div style={{position:'absolute', right:'20px', top:'50%', zIndex:10}}>
                <button onClick={() => handleManualSwipe('right')} style={{padding:'10px', background:'rgba(255,255,255,0.5)', borderRadius:'50%', border:'none', cursor:'pointer', fontWeight:'bold'}}>🚀 Viral</button>
            </div>
        </>
      )}

      <div className="laptop-main-content">
        {searchStep === 3 ? (
            <div style={{width: '100%', padding: '20px'}}>
                {renderDashboard()}
            </div>
        ) : (
            <>
                <div className="down-arrow">⮉</div>
                <div className="info-box-red">
                    <h2>Search Your Data<br />By Your Registered<br />Mobile No.</h2>
                </div>
                <div className="magnet-section">
                  <video className="magnet-video" autoPlay loop muted playsInline>
                    <source src={magnetVideo} type="video/mp4" />
                  </video>
                </div>
                <div className="footer-section">
                  <div className="line"></div>
                  <button className="book-btn" onClick={() => setViewState('BOOKING')}>Book <br/> Now</button>
                  <div className="line"></div>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default LaptopView;