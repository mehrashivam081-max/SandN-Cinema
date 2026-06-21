// src/view/laptopview/LaptopView.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LaptopView.css';

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

const API_BASE = import.meta.env.VITE_API_BASE;

const LaptopView = ({
    viewState, setViewState, searchStep, setSearchStep,
    userData, setUserData, feedType, setFeedType,
    mobile, setMobile, otp, setOtp, password, setPassword,
    isNotRegistered, setIsNotRegistered, loading, setLoading, handleLogout
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpMethod, setOtpMethod] = useState('mobile');
  
  // 🔥 Login Role Management
  const [loginRole, setLoginRole] = useState('USER');
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
  // 🧭 ADVANCED BROWSER HISTORY LOGIC
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
  // 🔄 GLOBAL AUTO-REFRESH ENGINE
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
          const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile, sendVia: selectedMethod, roleFilter: loginRole });
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
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp, roleFilter: loginRole });
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
              
              const res = await axios.post(`${API_BASE}/create-password`, { mobile, password, email: newEmail, roleFilter: loginRole });
              if (res.data.success) { 
                  localStorage.setItem('authToken', res.data.token);
                  localStorage.setItem('user', JSON.stringify(res.data.user));
                  sessionStorage.setItem('user', JSON.stringify(res.data.user));
                  setUserData(res.data.user); 
                  setSearchStep(3); 
              } else alert(res.data.message || "Setup Failed");
          } else {
              const res = await axios.post(`${API_BASE}/login`, { mobile, password, roleFilter: loginRole });
              if (res.data.success) { 
                  localStorage.setItem('authToken', res.data.token);
                  localStorage.setItem('user', JSON.stringify(res.data.user));
                  sessionStorage.setItem('user', JSON.stringify(res.data.user));
                  setUserData(res.data.user); 
                  setSearchStep(3); 
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

  if (viewState === 'COLLAB') return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ background: '#16213e', border: '1px solid #3498db', borderRadius: '20px', padding: '40px 30px', maxWidth: '450px', width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: '60px', marginBottom: '15px' }}>🤝</div>
              <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '26px', letterSpacing: '1px' }}>
                  Partnership & <span style={{ color: '#3498db' }}>Collab</span>
              </h2>
              <p style={{ color: '#aaa', fontSize: '15px', lineHeight: '1.6', marginBottom: '35px' }}>
                  We are always looking for creative minds, talented studios, and strategic partners. Let's build something amazing together! Reach out to our admin team to discuss opportunities.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <button onClick={() => window.location.href = 'mailto:admin@snevio.com'} style={{ background: 'linear-gradient(90deg, #f1c40f, #f39c12)', color: '#000', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(241, 196, 15, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      ✉️ Email Admin Team
                  </button>
                  <button onClick={() => window.open('https://wa.me/917828011282', '_blank')} style={{ background: '#25D366', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(37, 211, 102, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      💬 Chat on WhatsApp
                  </button>
                  <button onClick={goHome} style={{ background: 'transparent', color: '#aaa', border: '1px solid #555', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', transition: '0.3s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#888'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = '#555'; }}>
                      ⬅ Go Back
                  </button>
              </div>
          </div>
      </div>
  );
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

      {/* 🔥 PREMIUM ANIMATED OTP POPUP (Laptop View) */}
      {showOtpPopup && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(15px)' }}>
              <div className="fade-in" style={{ background: 'rgba(20, 20, 25, 0.85)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '35px 30px', borderRadius: '24px', width: '380px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.8)', backdropFilter: 'blur(25px)' }}>
                  
                  <h3 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Verify Number</h3>
                  <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '25px', letterSpacing: '0.5px' }}>Send OTP to <strong style={{color:'#FFD700', fontSize: '15px'}}>{mobile}</strong></p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('mobile')} 
                          style={{ padding: '15px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', fontWeight: '800', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 8px 20px rgba(243, 156, 18, 0.3)', opacity: loading && otpMethod !== 'mobile' ? 0.4 : 1, transform: loading && otpMethod === 'mobile' ? 'scale(0.95)' : 'scale(1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          {loading && otpMethod === 'mobile' ? '⏳ SENDING...' : '📱 Send via Text SMS'}
                      </button>
                      
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('whatsapp')} 
                          style={{ padding: '15px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2ecc71, #27ae60)', color: '#fff', fontWeight: '800', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 8px 20px rgba(46, 204, 113, 0.3)', opacity: loading && otpMethod !== 'whatsapp' ? 0.4 : 1, transform: loading && otpMethod === 'whatsapp' ? 'scale(0.95)' : 'scale(1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          {loading && otpMethod === 'whatsapp' ? '⏳ SENDING...' : '💬 Send via WhatsApp'}
                      </button>
                      
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('email')} 
                          style={{ padding: '15px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #3498db, #2980b9)', color: '#fff', fontWeight: '800', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 8px 20px rgba(52, 152, 219, 0.3)', opacity: loading && otpMethod !== 'email' ? 0.4 : 1, transform: loading && otpMethod === 'email' ? 'scale(0.95)' : 'scale(1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          {loading && otpMethod === 'email' ? '⏳ SENDING...' : '✉️ Send via Email'}
                      </button>
                  </div>
                  
                  {/* Cancel Button */}
                  {loading ? (
                      <p style={{ color: '#555', marginTop: '25px', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '1px', marginBottom: '0' }}>Please Wait...</p>
                  ) : (
                      <p onClick={() => setShowOtpPopup(false)} style={{ color: '#888', marginTop: '25px', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '1px', transition: '0.3s', marginBottom: '0' }} onMouseEnter={(e)=>e.target.style.color='#fff'} onMouseLeave={(e)=>e.target.style.color='#888'}>Cancel</p>
                  )}
              </div>
          </div>
      )}

      {/* ==========================================
          💎 HEADER SECTION (DARK PREMIUM GLASS)
          ========================================== */}
      {!userData && (
          <header className="laptop-header" style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
              padding: '15px 30px', width: '100%', boxSizing: 'border-box', 
              position: 'absolute', top: 0, left: 0, zIndex: 100, minHeight: '80px',
              background: 'rgba(18, 18, 18, 0.3)', backdropFilter: 'blur(10px)', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            
            {/* LEFT SECTION */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '0 0 380px' }}>
                <div className="menu-icon" onClick={() => setMenuOpen(true)} style={{cursor: 'pointer'}}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <h1 className="brand-title" onClick={goHome} style={{cursor:'pointer', margin: 0, fontSize: '24px', whiteSpace: 'nowrap', color: '#ffffff'}}>
                         S N E <span className="brand-highlight" style={{color: '#FFD700'}}>V I O</span>
                </h1>

                <button 
                    onClick={() => setViewState('AUTH')}
                    style={{
                        padding: '8px 25px', background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '30px', 
                        cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', position: 'relative',
                        left: '+70px', transition: '0.3s', whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => { e.target.style.background = '#FFD700'; e.target.style.color = '#121212'; e.target.style.border = '1px solid #FFD700'; }}
                    onMouseLeave={(e) => { e.target.style.background = 'rgba(255, 255, 255, 0.1)'; e.target.style.color = '#ffffff'; e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)'; }}
                >
                    Login
                </button>
            </div>

            {/* CENTER: CAPSULE SEARCH BAR */}
            <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 101 }}>
              <div className="laptop-search-wrapper" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 {searchStep === 0 && (
                    <div style={{ 
                        display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.15)', 
                        borderRadius: '30px', padding: '4px 4px 4px 20px', border: '1px solid rgba(255, 255, 255, 0.3)', width: '400px', height: '40px'
                    }}>
                        <input type="text" placeholder="Search registered mobile number" value={mobile} onChange={e=>setMobile(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleSearchClick)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', color: '#ffffff' }} autoFocus />
                        <button onClick={handleSearchClick} disabled={loading} style={{ background: '#FFD700', color: '#121212', border: 'none', borderRadius: '25px', padding: '8px 25px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 10px rgba(255, 215, 0, 0.3)' }}>{loading ? '...' : 'Search'}</button>
                    </div>
                 )}
                 {searchStep === 1 && (
                     <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '30px', padding: '4px 4px 4px 20px', border: '1px solid rgba(255, 255, 255, 0.3)', width: '400px', height: '40px' }}>
                        <input type="text" placeholder="Enter OTP" className="search-input" value={otp} onChange={e=>setOtp(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleVerifyOTP)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#ffffff', fontSize: '15px', fontWeight: '500' }} autoFocus />
                        <button onClick={handleVerifyOTP} disabled={loading} style={{ background: '#FFD700', color: '#121212', border: 'none', borderRadius: '25px', padding: '8px 20px', fontWeight: 'bold' }}>Verify</button>
                    </div>
                 )}
                 {searchStep === 2 && (
                     <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.15)', borderRadius: '30px', padding: '4px 4px 4px 20px', border: '1px solid rgba(255, 255, 255, 0.3)', width: '400px', height: '40px' }}>
                        <input type={showPass ? "text" : "password"} placeholder="Enter Password" className="search-input" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleLoginOrSetup)} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#ffffff', fontSize: '15px', fontWeight: '500' }} autoFocus />
                        <button onClick={handleLoginOrSetup} disabled={loading} style={{ background: '#FFD700', color: '#121212', border: 'none', borderRadius: '25px', padding: '8px 20px', fontWeight: 'bold' }}>Login</button>
                    </div>
                 )}
              </div>
            </div>

            {/* RIGHT BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
                <button onClick={() => handleManualSwipe('left')} style={{padding:'8px 14px', background:'rgba(255, 255, 255, 0.1)', color: '#ffffff', border:'1px solid rgba(255, 255, 255, 0.2)', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize: '13px', transition: '0.3s'}} onMouseEnter={(e) => e.target.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.target.style.background='rgba(255,255,255,0.1)'}>🔥 Trending</button>
                <button onClick={() => handleManualSwipe('right')} style={{padding:'8px 14px', background:'rgba(255, 255, 255, 0.1)', color: '#ffffff', border:'1px solid rgba(255, 255, 255, 0.2)', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize: '13px', transition: '0.3s'}} onMouseEnter={(e) => e.target.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.target.style.background='rgba(255,255,255,0.1)'}>🚀 Viral</button>
                
                <button onClick={() => setViewState('BOOKING')} style={{padding: '8px 18px', background: 'linear-gradient(45deg, #FFD700, #F39C12)', color: '#121212', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', boxShadow: '0 4px 10px rgba(255, 215, 0, 0.3)', transition: '0.3s'}} onMouseEnter={(e) => e.target.style.transform='scale(1.05)'} onMouseLeave={(e) => e.target.style.transform='scale(1)'}>Book Now</button>
                
                <div onClick={() => setViewState('COLLAB')} style={{cursor: 'pointer', background: 'rgba(255, 255, 255, 0.1)', color: '#FFD700', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)', width: '38px', height: '38px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0, transition: '0.3s'}} onMouseEnter={(e) => e.currentTarget.style.background='rgba(255,255,255,0.2)'} onMouseLeave={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'} title="Partnership & Collab">
                    <span style={{fontSize:'16px'}}>🤝</span>
                </div>
            </div>
          </header>
      )}

      {/* ==========================================
          💎 MAIN CONTENT AREA (Fixed Dashboard Spacing)
          ========================================== */}
      <div 
        className="laptop-main-content" 
        style={{ 
            minHeight: searchStep === 3 ? '100vh' : 'calc(100vh - 80px)', /* 🔥 FIX: Dashboard takes full 100vh */
            backgroundColor: searchStep === 3 ? '#0a0a0a' : 'transparent', /* 🔥 FIX: Premium dark background for dashboard */
            transition: 'background-color 0.3s ease',
            width: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            margin: 0, padding: 0 /* 🔥 FIX: Removed any accidental gaps */
        }}
      >
        {searchStep === 3 ? (
            <div style={{width: '100%', minHeight: '100vh', padding: '0', margin: '0', display: 'flex', flexDirection: 'column'}}> 
                {renderDashboard()}
            </div>
        ) : (
            <div style={{ 
                flex: 1, 
                width: '100%', 
                boxSizing: 'border-box',
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: 'calc(100vh - 80px)', 
                textAlign: 'center', 
                padding: '0 20px',
                backgroundImage: `linear-gradient(rgba(18, 18, 18, 0.75), rgba(18, 18, 18, 0.95)), url('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=2069&auto=format&fit=crop')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}>
                
                <h1 style={{ color: '#ffffff', fontSize: '4rem', fontWeight: '800', marginBottom: '15px', letterSpacing: '1px', textShadow: '0px 4px 15px rgba(0,0,0,0.6)' }}>
                    Relive Your Best <span style={{ color: '#FFD700', textShadow: '0px 4px 20px rgba(255, 215, 0, 0.4)' }}>Memories</span>
                </h1>
                
                <p style={{ color: '#E0E0E0', fontSize: '1.25rem', maxWidth: '650px', marginBottom: '40px', lineHeight: '1.6', textShadow: '0px 2px 10px rgba(0,0,0,0.8)' }}>
                    Securely access, select, and manage your high-quality event photos directly from your studio's digital album.
                </p>
                
                <div style={{ 
                    display: 'flex', 
                    gap: '40px', 
                    marginTop: '10px', 
                    color: '#E0E0E0', 
                    fontSize: '1rem', 
                    fontWeight: '500',
                    background: 'rgba(255, 255, 255, 0.08)', 
                    padding: '15px 35px',
                    borderRadius: '50px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🔒 100% Secure</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⚡ Instant Access</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>📸 Studio Quality</span>
                </div>

                {/* 🔥 SCROLL INDICATOR */}
                <div className="scroll-indicator-icon" onClick={() => window.scrollBy({top: window.innerHeight, behavior: 'smooth'})}>
                    {/* 🔥 SCROLL INDICATOR (Upgraded to Clean SVG) */}
                <div className="scroll-indicator-icon" onClick={() => window.scrollBy({top: window.innerHeight, behavior: 'smooth'})}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                </div>

            </div>
        )}
      </div>
    </div>
  );
};

export default LaptopView;