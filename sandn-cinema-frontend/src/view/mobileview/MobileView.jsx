import React, { useState, useRef, useEffect } from 'react';
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

const API_BASE = import.meta.env.VITE_API_BASE;

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
  
  // Confirm Password & Eye Icon States
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

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
      setConfirmPassword('');
      setShowPass(false);
      setShowConfirmPass(false);
  };

  const [swipeOffset, setSwipeOffset] = useState(0);
  const isSwiping = useRef(false);
  const touchStartX = useRef(0);

  const magnetRef = useRef(null);
  const [magnetStyle, setMagnetStyle] = useState({ transform: 'translate(0px, 0px)', transition: 'transform 0.3s ease-out' });

  // ✅ SMART BROWSER BACK BUTTON LOGIC (No Direct Logout)
  useEffect(() => {
      // Har bar state change hone par dummy state history me daalte hain
      window.history.pushState(null, null, window.location.href);

      const handlePopState = () => {
          // Default browser back rokne ke liye
          window.history.pushState(null, null, window.location.href);

          if (userData && searchStep === 3) {
              // Agar user Dashboard me hai, to logout NAHI hona chahiye
              // Aap chahein to yahan ek custom popup dikha sakte hain, abhi silently rok diya hai.
              console.log("Prevented logout from back button");
          } else if (feedType) {
              setFeedType(null); // Feed band karke Home par wapas
          } else if (menuOpen) {
              setMenuOpen(false); // Menu close
          } else if (viewState !== 'HOME') {
              setViewState('HOME'); // Kisi bhi dusre page se wapas Home pe
          } else if (searchStep > 0 && searchStep < 3) {
              setSearchStep(prev => prev - 1); // Search Steps reverse karna (Setup/Login -> OTP -> Input)
          } else if (showOtpPopup) {
              setShowOtpPopup(false); // Popup band karna
          }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [userData, searchStep, viewState, feedType, menuOpen, showOtpPopup, setFeedType, setViewState, setSearchStep]);

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

  // ✅ ENTER KEY SUPPORT HELPER
  const handleKeyDown = (e, action) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          action();
      }
  };

  // --- API LOGIC ---

  const handleSearchClick = () => {
      if (mobile.length !== 10) return alert("Please enter valid 10 digit number");
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
      } catch (e) {
          alert(e.response?.data?.message || "Server Error. Please try again.");
      } finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
      if (!otp) return alert("Please enter OTP");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/verify-otp`, { mobile, otp, roleFilter: 'USER' });
          if (res.data.success) {
              if (res.data.isNewUser) {
                  setIsFirstTimeUser(true);
                  setSearchStep(2); // Setup Screen
              } else {
                  setIsFirstTimeUser(false);
                  setSearchStep(2); // Login Screen
              }
          } else {
              alert(res.data.message || "Invalid OTP! Kripya sahi OTP dalein.");
          }
      } catch (e) {
          alert("Verification Failed. Server error.");
      } finally { setLoading(false); }
  };

  // ✅ UPDATED: Login OR Setup Logic with Strict Token Saving
  const handleLoginOrSetup = async () => {
      if (!password) return alert("Please enter password");
      setLoading(true);

      try {
          if (isFirstTimeUser) {
              if (!newEmail) return alert("Please enter your email for future recovery.");
              if (password !== confirmPassword) return alert("Passwords do not match!");
              
              const res = await axios.post(`${API_BASE}/create-password`, { 
                  mobile, password, email: newEmail, roleFilter: 'USER' 
              });

              if (res.data.success) {
                  // 🔥 THE FIX: Saving the Authentication Token securely!
                  localStorage.setItem('authToken', res.data.token);
                  localStorage.setItem('user', JSON.stringify(res.data.user));
                  setUserData(res.data.user);
                  setSearchStep(3);
              } else {
                  alert(res.data.message);
              }
          } else {
              const res = await axios.post(`${API_BASE}/login`, { mobile, password, roleFilter: 'USER' });
              if (res.data.success) {
                  // 🔥 THE FIX: Saving the Authentication Token securely!
                  localStorage.setItem('authToken', res.data.token);
                  localStorage.setItem('user', JSON.stringify(res.data.user));
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

  // ✅ Real Dashboard Routing
  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard user={userData} onLogout={handleLogout} />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard user={userData} userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'COLLAB') return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ background: '#16213e', border: '1px solid #3498db', borderRadius: '20px', padding: '40px 20px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: '60px', marginBottom: '15px' }}>🤝</div>
              <h2 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '24px', letterSpacing: '1px' }}>
                  Partnership & <span style={{ color: '#3498db' }}>Collab</span>
              </h2>
              <p style={{ color: '#aaa', fontSize: '14px', lineHeight: '1.6', marginBottom: '30px' }}>
                  We are always looking for creative minds, talented studios, and strategic partners. Let's build something amazing together! Reach out to our admin team.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <button onClick={() => window.location.href = 'mailto:admin@snevio.com'} style={{ background: 'linear-gradient(90deg, #f1c40f, #f39c12)', color: '#000', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(241, 196, 15, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      ✉️ Email Admin Team
                  </button>
                  <button onClick={() => window.open('https://wa.me/917828011282', '_blank')} style={{ background: '#25D366', color: '#fff', border: 'none', padding: '15px', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 15px rgba(37, 211, 102, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      💬 Chat on WhatsApp
                  </button>
                  <button onClick={goHome} style={{ background: 'transparent', color: '#aaa', border: '1px solid #555', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                      ⬅ Go Back Home
                  </button>
              </div>
          </div>
      </div>
  );
  if (viewState === 'SERVICE') return <ServicesPage onBack={goHome} />;
  if (viewState === 'AUTH') return <LoginPage onBack={goHome} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'SIGNUP') return <SignupPage onLoginClick={() => setViewState('AUTH')} onBack={goHome} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'RECOVERY') return <ForgotPassword onLoginClick={() => setViewState('AUTH')} onBack={goHome} />;

  // 🔥 नया लॉजिक: चेक करने के लिए कि यूज़र डैशबोर्ड पर है या लॉगिन पेज पर
  const isDashboard = userData && searchStep === 3;

  return (
    <div className="mobile-container" style={{ 
        overflowX: 'hidden', 
        overflowY: isDashboard ? 'auto' : 'hidden', /* 🔥 FIX 1: डैशबोर्ड में स्क्रॉल चालू कर दिया */
        position: 'relative', 
        background: isDashboard ? '#0f172a' : '#000', /* 🔥 FIX 2: डैशबोर्ड के लिए डार्क बैकग्राउंड */
        minHeight: '100dvh', 
        height: isDashboard ? 'auto' : '100dvh', /* 🔥 FIX 3: हाइट को लॉक से हटा दिया */
        width: '100vw' 
    }}>
      
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={goHome} />}
      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} />

      {/* 🔥 PREMIUM OTP POPUP (Added Email & Luxe Theme) */}
      {showOtpPopup && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(15px)' }}>
              <div className="fade-in" style={{ background: 'rgba(25, 25, 30, 0.75)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '30px 25px', borderRadius: '24px', width: '85%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', backdropFilter: 'blur(25px)' }}>
                  
                  <h3 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '18px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>Verify Number</h3>
                  <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '25px', letterSpacing: '0.5px' }}>Send OTP to <strong style={{color:'#FFD700'}}>{mobile}</strong></p>
                  
                  {/* 🔥 ANIMATED & SECURE BUTTONS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('mobile')} 
                          style={{ padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 5px 15px rgba(243, 156, 18, 0.3)', opacity: loading && otpMethod !== 'mobile' ? 0.4 : 1, transform: loading && otpMethod === 'mobile' ? 'scale(0.95)' : 'scale(1)' }}>
                          {loading && otpMethod === 'mobile' ? '⏳ SENDING...' : '📱 Send SMS'}
                      </button>
                      
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('whatsapp')} 
                          style={{ padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #2ecc71, #27ae60)', color: '#fff', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 5px 15px rgba(46, 204, 113, 0.3)', opacity: loading && otpMethod !== 'whatsapp' ? 0.4 : 1, transform: loading && otpMethod === 'whatsapp' ? 'scale(0.95)' : 'scale(1)' }}>
                          {loading && otpMethod === 'whatsapp' ? '⏳ SENDING...' : '💬 Send WhatsApp'}
                      </button>
                      
                      <button 
                          disabled={loading} 
                          onClick={() => handleSendOtp('email')} 
                          style={{ padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3498db, #2980b9)', color: '#fff', fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: loading ? 'none' : '0 5px 15px rgba(52, 152, 219, 0.3)', opacity: loading && otpMethod !== 'email' ? 0.4 : 1, transform: loading && otpMethod === 'email' ? 'scale(0.95)' : 'scale(1)' }}>
                          {loading && otpMethod === 'email' ? '⏳ SENDING...' : '✉️ Send Email'}
                      </button>
                  </div>
                  
                  {/* Cancel Button - Also disabled during loading */}
                  {loading ? (
                      <p style={{ color: '#555', marginTop: '25px', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '1px' }}>Please Wait...</p>
                  ) : (
                      <p onClick={() => setShowOtpPopup(false)} style={{ color: '#888', marginTop: '25px', cursor: 'pointer', fontSize: '12px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '1px' }}>Cancel</p>
                  )}
              </div>
          </div>
      )}

      {/* SWIPE WRAPPER & MAIN CONTENT */}
      <div 
        className="mobile-swipe-wrapper"
        onTouchStart={isDashboard ? undefined : handleTouchStart} 
        onTouchMove={isDashboard ? undefined : handleTouchMove} 
        onTouchEnd={isDashboard ? undefined : handleTouchEnd}
        style={isDashboard ? {
            width: '100%', minHeight: '100vh' /* 🔥 डैशबोर्ड के लिए सिंपल स्टाइल्स */
        } : {
            transform: `translateX(${swipeOffset}px)`, 
            transition: isSwiping.current ? 'none' : 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)', 
            height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
            position: 'absolute', zIndex: feedType ? 0 : 5,
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop')`,
            backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#000'
        }}
      >
          {!isDashboard && (
              <header style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '20px 25px', position: 'absolute', top: 0, width: '100%', zIndex: 10, boxSizing: 'border-box'
              }}>
                <div onClick={() => setMenuOpen(true)} style={{ background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '50%', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </div>
                <h1 onClick={goHome} style={{margin: 0, fontSize: '22px', color: '#fff', fontWeight: '800', letterSpacing: '1px', cursor: 'pointer', textShadow: '0 2px 10px rgba(0,0,0,0.5)'}}>
                    SNE<span style={{color: '#FFD700'}}>VIO</span>
                </h1>
                <div onClick={() => setViewState('AUTH')} style={{ background: 'rgba(255,255,255,0.08)', padding: '10px', borderRadius: '50%', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
              </header>
          )}

          {/* 🔥 MAIN LOGIC: Render Dashboard OR Soft UI */}
          {isDashboard ? (
              renderDashboard() /* 🔥 FIX 4: बिना किसी पैडिंग/गैप के डायरेक्ट डैशबोर्ड रेंडर किया */
          ) : (
              <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '0 25px 90px 25px', marginTop: '80px', boxSizing: 'border-box'}}>
                  
                  <h2 style={{color: '#ffffff', fontSize: '2.8rem', fontWeight: '800', textAlign: 'center', marginBottom: '8px', lineHeight: '1.1'}}>
                      Relive <br/><span style={{color: '#FFD700'}}>Memories</span>
                  </h2>
                  <p style={{ color: '#E0E0E0', fontSize: '15px', textAlign: 'center', marginBottom: '35px', opacity: 0.9 }}>Access your studio quality event photos securely.</p>
                  
                  {/* ULTRA SOFT AUTH CARD */}
                  <div style={{width: '100%', maxWidth: '400px', background: 'rgba(255, 255, 255, 0.04)', padding: '30px 25px', borderRadius: '30px', backdropFilter: 'blur(25px)', WebkitBackdropFilter: 'blur(25px)', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)'}}>
                      
                      {searchStep > 0 && <span onClick={() => setSearchStep(prev => prev - 1)} style={{ color: '#aaa', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '25px', cursor: 'pointer', transition: '0.2s' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back</span>}

                      {searchStep === 0 && (
                          <>
                              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '20px', padding: '5px', display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
                                  <span style={{ padding: '0 15px', color: '#FFD700', fontWeight: 'bold' }}>+91</span>
                                  <input type="number" placeholder="Mobile Number" value={mobile} onChange={e=>setMobile(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleSearchClick)} style={{flex: 1, padding: '16px 0', border: 'none', background: 'transparent', color: '#fff', outline: 'none', fontSize: '16px'}} autoFocus />
                              </div>
                              <button onClick={handleSearchClick} disabled={loading} style={{width: '100%', padding: '16px', borderRadius: '20px', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', fontWeight: '800', border: 'none', fontSize: '16px', boxShadow: '0 10px 20px -5px rgba(243, 156, 18, 0.4)'}}>{loading?'Searching...':'Search Data'}</button>
                          </>
                      )}

                      {searchStep === 1 && (
                          <>
                              <input type="number" placeholder="Enter 6-digit OTP" value={otp} onChange={e=>setOtp(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleVerifyOTP)} style={{width: '100%', padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.08)', color: '#fff', marginBottom: '20px', boxSizing: 'border-box', outline: 'none', fontSize: '16px', textAlign: 'center', letterSpacing: '4px'}} autoFocus />
                              <button onClick={handleVerifyOTP} disabled={loading} style={{width: '100%', padding: '16px', borderRadius: '20px', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', fontWeight: '800', border: 'none', fontSize: '16px', boxShadow: '0 10px 20px -5px rgba(243, 156, 18, 0.4)'}}>{loading?'Verifying...':'Verify OTP'}</button>
                          </>
                      )}

                      {searchStep === 2 && (
                          <div style={{ textAlign: 'left', width: '100%' }}>
                              <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
                                  <input type={showPass ? "text" : "password"} placeholder="Enter Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleLoginOrSetup)} style={{width: '100%', padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.08)', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '15px'}} autoFocus />
                                  <span onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px', opacity: 0.7 }}>{showPass ? '🙈' : '👁️'}</span>
                              </div>
                              
                              {isFirstTimeUser && (
                                  <>
                                      <input type="email" placeholder="Link Email (Required)" value={newEmail} onChange={e=>setNewEmail(e.target.value)} style={{width: '100%', padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.08)', color: '#fff', marginBottom: '15px', boxSizing: 'border-box', outline: 'none', fontSize: '15px'}} />
                                      
                                      <div style={{ position: 'relative', width: '100%', marginBottom: '15px' }}>
                                          <input type={showConfirmPass ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onKeyDown={(e) => handleKeyDown(e, handleLoginOrSetup)} style={{width: '100%', padding: '18px 20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.08)', color: '#fff', boxSizing: 'border-box', outline: 'none', fontSize: '15px'}} />
                                          <span onClick={() => setShowConfirmPass(!showConfirmPass)} style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: '18px', opacity: 0.7 }}>{showConfirmPass ? '🙈' : '👁️'}</span>
                                      </div>
                                  </>
                              )}
                              
                              <button onClick={handleLoginOrSetup} disabled={loading} style={{width: '100%', padding: '16px', borderRadius: '20px', background: 'linear-gradient(135deg, #FFD700, #F39C12)', color: '#000', fontWeight: '800', border: 'none', fontSize: '16px', boxShadow: '0 10px 20px -5px rgba(243, 156, 18, 0.4)', marginTop: '10px'}}>{loading ? 'Processing...' : isFirstTimeUser ? 'Setup Account' : 'Login & Access'}</button>
                          </div>
                      )}
                  </div>
                  
                  {/* Trust Badges */}
                  <div style={{ display: 'flex', gap: '20px', marginTop: '35px', color: '#bbb', fontSize: '0.8rem', fontWeight: '500' }}>
                      <span style={{display: 'flex', alignItems:'center', gap:'6px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Secure</span>
                      <span style={{display: 'flex', alignItems:'center', gap:'6px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Fast</span>
                      <span style={{display: 'flex', alignItems:'center', gap:'6px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg> Quality</span>
                  </div>
              </div>
          )}
          
          {/* FLOATING BOOK BUTTON */}
          {!isDashboard && (
              <div style={{position: 'absolute', bottom: '30px', left: 0, width: '100%', display: 'flex', justifyContent: 'center', zIndex: 20}}>
                  <button onClick={() => setViewState('BOOKING')} style={{padding: '15px 45px', background: 'rgba(255,255,255,0.1)', color: '#fff', borderRadius: '30px', fontWeight: '700', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', boxShadow: '0 15px 25px rgba(0,0,0,0.5)', fontSize: '15px', letterSpacing: '1px'}}>
                      Book Studio
                  </button>
              </div>
          )}

      </div>
    </div>
  );
};

export default MobileView;