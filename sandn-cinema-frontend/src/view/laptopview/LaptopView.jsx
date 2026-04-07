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
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpMethod, setOtpMethod] = useState('mobile');
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false); 
  const [newEmail, setNewEmail] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const goHome = () => { 
      setViewState('HOME'); 
      setSearchStep(0); 
      setFeedType(null);
      setShowOtpPopup(false);
      setIsFirstTimeUser(false);
      setNewEmail('');
      setOtp('');
      setPassword('');
      setConfirmPassword('');
      setShowPass(false);
      setShowConfirmPass(false);
  };

  // ==========================================
  // 🧭 1. ADVANCED BROWSER HISTORY LOGIC
  // ==========================================
  useEffect(() => {
      if (!userData) {
          window.history.pushState({ step: searchStep, view: viewState }, "Snevio Step");
      } else {
          window.history.replaceState({ step: 3, view: 'HOME', loggedIn: true }, "Snevio Dashboard");
      }
  }, [searchStep, viewState, userData]);

  useEffect(() => {
      const handlePopState = (e) => {
          if (userData) {
              window.history.pushState({ step: 3, view: 'HOME', loggedIn: true }, ""); 
          } else if (e.state) {
              if (e.state.view) setViewState(e.state.view);
              if (e.state.step !== undefined) setSearchStep(e.state.step);
          } else {
              goHome();
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [userData, setViewState, setSearchStep]);

  // ==========================================
  // 🔄 2. GLOBAL AUTO-REFRESH ENGINE
  // ==========================================
  useEffect(() => {
      const globalRefreshInterval = setInterval(() => {
          if (userData) {
              console.log("🔄 Global Auto-Refresh: Syncing data...");
          }
      }, 15000); 
      return () => clearInterval(globalRefreshInterval);
  }, [userData]);


  const handleKeyDown = (e, action) => { if (e.key === 'Enter') { e.preventDefault(); action(); } };

  const handleSearchClick = () => {
      if (mobile.length !== 10) return alert("Invalid Mobile Number");
      setShowOtpPopup(true); 
  };

  const handleSendOtp = async (selectedMethod) => {
      setOtpMethod(selectedMethod);
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile, sendVia: selectedMethod, roleFilter: 'USER' });
          if (res.data.success) { 
              const methodLabel = selectedMethod === 'mobile' ? 'SMS' : selectedMethod === 'whatsapp' ? 'WhatsApp' : 'Email';
              alert(`OTP Sent successfully via ${methodLabel}`); 
              setSearchStep(1); 
              setShowOtpPopup(false); 
          } else {
              setIsNotRegistered(true);
              setShowOtpPopup(false);
          }
      } catch (e) { alert(e.response?.data?.message || "Server Error."); } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
      if (!otp) return alert("Please enter OTP");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp, roleFilter: 'USER' });
          if (res.data.success) {
              setIsFirstTimeUser(res.data.isNewUser);
              setSearchStep(2); 
          } else alert(res.data.message || "Invalid OTP!");
      } catch (e) { alert("Verification Failed."); } finally { setLoading(false); }
  };

  const handleLoginOrSetup = async () => {
      if (!password) return alert("Please enter password");
      setLoading(true);
      try {
          if (isFirstTimeUser) {
              if (!newEmail) return alert("Email required.");
              if (password !== confirmPassword) return alert("Passwords don't match!");
              const res = await axios.post(`${API_BASE}/create-password`, { mobile, password, email: newEmail, roleFilter: 'USER' });
              if (res.data.success) { 
                  setUserData(res.data.user); sessionStorage.setItem('user', JSON.stringify(res.data.user)); setSearchStep(3); 
              } else alert(res.data.message || "Setup Failed");
          } else {
              const res = await axios.post(`${API_BASE}/login`, { mobile, password, roleFilter: 'USER' });
              if (res.data.success) { 
                  setUserData(res.data.user); sessionStorage.setItem('user', JSON.stringify(res.data.user)); setSearchStep(3); 
              } else alert(res.data.message || "Wrong Password");
          }
      } catch (e) { alert("Action Failed."); } finally { setLoading(false); }
  };

  const handleManualSwipe = (direction) => {
      if (direction === 'left') setFeedType('trending');
      if (direction === 'right') setFeedType('viral');   
  };

  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard user={userData} onLogout={handleLogout} />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard user={userData} userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'COLLAB') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh', textAlign:'center'}}><h2>🤝 Partnership & Collab</h2><p>Contact Admin for collaborations.</p><button onClick={goHome} style={{marginTop:'20px', padding:'10px', background:'red', color:'white', border:'none', borderRadius:'5px'}}>Go Back</button></div>;
  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); sessionStorage.setItem('user', JSON.stringify(u)); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'SIGNUP') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); sessionStorage.setItem('user', JSON.stringify(u)); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'RECOVERY') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><ForgotPassword onLoginClick={() => setViewState('AUTH')} /></div>;

  return (
    <div className="laptop-container" style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={() => setViewState('HOME')} />}

      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} onOpenRecovery={() => setViewState('RECOVERY')} />

      {/* OTP POPUP OVERLAY */}
      {showOtpPopup && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ background: '#fff', padding: '30px', borderRadius: '15px', width: '350px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', animation: 'popIn 0.3s ease' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#333' }}>Send OTP to {mobile}</h3>
                  <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>Select verification method:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button onClick={() => handleSendOtp('mobile')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#2b5876', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>📱 Send via Text SMS</button>
                      <button onClick={() => handleSendOtp('whatsapp')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#25D366', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>💬 Send via WhatsApp</button>
                      <button onClick={() => handleSendOtp('email')} disabled={loading} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#EA4335', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>✉️ Send via Email</button>
                  </div>
                  <p onClick={() => setShowOtpPopup(false)} style={{ marginTop: '20px', color: '#999', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>Cancel</p>
              </div>
          </div>
      )}

      {/* ==========================================
          💎 HEADER: ORIGINAL BRAND UI + NEW RIGHT SECTION
          ========================================== */}
{/* ==========================================
          💎 HEADER: FIXED ALIGNMENT & CAPSULE SEARCH BAR
          ========================================== */}
      {!userData && (
          <header className="laptop-header" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '10px 30px', 
              width: '100%', 
              boxSizing: 'border-box', 
              position: 'relative', 
              zIndex: 100,
              minHeight: '80px',
              background: '#ececec'
          }}>
            
            {/* LEFT: Menu Icon & Brand Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '0 0 250px' }}>
                <div className="menu-icon" onClick={() => setMenuOpen(true)} style={{cursor: 'pointer'}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <h1 className="brand-title" onClick={goHome} style={{cursor:'pointer', margin: 0, fontSize: '24px', whiteSpace: 'nowrap'}}>
                         S N E <span className="brand-highlight">V I O</span>
                </h1>
            </div>

            {/* CENTER: CAPSULE SEARCH BAR (Absolute Centered) */}
            <div style={{ 
                position: 'absolute', 
                left: '50%', 
                transform: 'translateX(-50%)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                zIndex: 101 
            }}>
              <div className="laptop-search-wrapper" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {searchStep > 0 && searchStep < 3 && (
                    <button onClick={() => { setSearchStep(prev => prev - 1); window.history.back(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#333', textAlign: 'left', padding: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      ⬅️ Back
                    </button>
                 )}
                 {searchStep === 0 && (
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: '#f1f3f4', 
                        borderRadius: '30px', 
                        padding: '4px 4px 4px 20px', 
                        border: '1px solid #000000',
                        width: '400px',
                        height: '40px'
                    }}>
                        <input 
                            type="text" 
                            placeholder="Search registered mobile number" 
                            value={mobile} 
                            onChange={e=>setMobile(e.target.value)} 
                            onKeyDown={(e) => handleKeyDown(e, handleSearchClick)} 
                            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#555' }} 
                            autoFocus 
                        />
                        <button 
                            onClick={handleSearchClick} 
                            disabled={loading} 
                            style={{ 
                                background: 'linear-gradient(to right, #5d78b4, #b486d5)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '25px', 
                                padding: '8px 25px', 
                                cursor: 'pointer', 
                                fontWeight: 'bold',
                                fontSize: '14px'
                            }}
                        >
                            {loading ? '...' : 'Search'}
                        </button>
                    </div>
                 )}

                 {searchStep === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f3f4', borderRadius: '30px', padding: '4px 4px 4px 20px', border: '1px solid #ccc', width: '300px' }}>
                        <input type="text" placeholder="Enter OTP" value={otp} onChange={e=>setOtp(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleVerifyOTP)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none' }} autoFocus />
                        <button onClick={handleVerifyOTP} disabled={loading} style={{ background: 'linear-gradient(to right, #5d78b4, #b486d5)', color: 'white', border: 'none', borderRadius: '25px', padding: '8px 20px', fontWeight: 'bold' }}>Verify</button>
                    </div>
                 )}

                 {searchStep === 2 && (
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f1f3f4', borderRadius: '30px', padding: '4px 4px 4px 20px', border: '1px solid #ccc', width: '300px' }}>
                        <input type={showPass ? "text" : "password"} placeholder="Enter Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleLoginOrSetup)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none' }} autoFocus />
                        <button onClick={handleLoginOrSetup} disabled={loading} style={{ background: 'linear-gradient(to right, #5d78b4, #b486d5)', color: 'white', border: 'none', borderRadius: '25px', padding: '8px 20px', fontWeight: 'bold' }}>Login</button>
                    </div>
                 )}
              </div>
            </div>

            {/* RIGHT: Buttons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
                <button onClick={() => handleManualSwipe('left')} style={{padding:'8px 14px', background:'#fff', color: '#333', border:'1px solid #ddd', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>🔥 Trending</button>
                <button onClick={() => handleManualSwipe('right')} style={{padding:'8px 14px', background:'#fff', color: '#333', border:'1px solid #ddd', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'}}>🚀 Viral</button>
                <button onClick={() => setViewState('BOOKING')} style={{padding: '8px 18px', background: 'linear-gradient(45deg, #FF512F, #DD2476)', color: '#fff', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 10px rgba(221, 36, 118, 0.3)'}}>Book Now</button>
                <div onClick={() => setViewState('COLLAB')} style={{cursor: 'pointer', background: '#111', color: '#FFD700', borderRadius: '50%', border: '2px solid #FFD700', width: '38px', height: '38px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.2)'}} title="Partnership & Collab">
                    <span style={{fontSize:'16px'}}>🤝</span>
                </div>
            </div>
          </header>
      )}

      {/* MAIN CONTENT AREA */}
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
            </>
        )}
      </div>
    </div>
  );
};

export default LaptopView;