import React, { useState, useRef } from 'react';
import axios from 'axios'; 
import './MobileView.css';

// --- ASSETS ---
import magnetVideo from '../../assets/magnet-clip.mp4'; 

// --- COMPONENTS ---
import ProfilePage from '../../components/ProfilePage';
import ServicesPage from '../../components/ServicesPage';
import LoginPage from '../../components/LoginPage';
import SignupPage from '../../components/SignupPage';
import ForgotPassword from '../../components/ForgotPassword';
import BookingForm from '../../components/BookingForm';
import TrendingFeed from '../../components/TrendingFeed';
import NotRegisteredPage from '../../components/NotRegisteredPage';
import UserDashboard from '../../components/UserDashboard'; // ✅ IMPORTED

const MobileView = () => {
  // --- STATES ---
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewState, setViewState] = useState('HOME');
  const [feedType, setFeedType] = useState(null);
  
  // Search & Auth Logic States
  const [searchStep, setSearchStep] = useState(0); 
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState(null);
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  // --- SWIPE LOGIC ---
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchMove = (e) => { touchEndX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = () => {
      const distance = touchStartX.current - touchEndX.current;
      const threshold = 50;
      // Disable swipe if user is logged in (to prevent conflict with dashboard scroll)
      if (!userData) {
          if (distance > threshold) { setFeedType('trending'); } 
          else if (distance < -threshold) { setFeedType('viral'); }
      }
  };

  // --- HANDLERS ---
  const handleMobileSearch = () => {
      if (mobile.length !== 10) return alert("Please enter valid 10 digit number");
      if (mobile === "0000000000") { 
          setIsNotRegistered(true); 
      } else {
          alert(`OTP Sent to ${mobile}`);
          setSearchStep(1); 
      }
  };

  const handleVerifyOTP = () => {
      if (otp === "123456") { 
          setSearchStep(2); 
      } else {
          alert("Invalid OTP");
      }
  };

  const handleVerifyPassword = async () => {
      if (!password) return alert("Please enter password");

      try {
          // Mocking Success for Demo (Replace with real Axios call)
          // const res = await axios.post(...)
          if (password === "admin123") {
              const mockUser = {
                  name: "SandN User",
                  mobile: mobile,
                  // Mock Wallet Data for First Login
                  wallet: { coins: 10, lastLoginDate: '2023-01-01', currentStreak: 5 },
                  folders: [
                      { id: '1', name: 'Stranger Photography', date: '2025-01-01', isDefault: true, unseen: false },
                      { id: '2', name: 'New Collection', date: '2025-02-15', isDefault: false, unseen: true }
                  ]
              };
              setUserData(mockUser);
              setSearchStep(3);
          } else {
              alert("Wrong Password (Try: admin123)");
          }
      } catch (error) {
          alert("Login Failed");
      }
  };

  const handleLogout = () => {
      setSearchStep(0);
      setUserData(null);
      setMobile('');
      setOtp('');
      setPassword('');
      setViewState('HOME');
  };

  // --- RENDERING ---
  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'SIGNUP') return <SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} />;
  if (viewState === 'RECOVERY') return <ForgotPassword onLoginClick={() => setViewState('AUTH')} />;

  return (
    <div className="mobile-container" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={() => setViewState('HOME')} />}
      
      <ProfilePage 
        isOpen={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        onOpenService={() => setViewState('SERVICE')}
        onOpenAuth={() => setViewState('AUTH')}
        onOpenRecovery={() => setViewState('RECOVERY')}
      />

      {/* Header (Hide if logged in) */}
      {!userData && (
          <header className="mobile-header">
            <div className="menu-icon-mob" onClick={() => setMenuOpen(true)}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </div>
            <h1 className="brand-title-mob">SandN <br/> Cinema</h1>
            <div className="logo-circle-mob">SN</div>
          </header>
      )}

      <div className="mobile-main-content" style={userData ? {padding:0, background:'#f4f4f4'} : {}}>
        
        {/* --- LOGGED IN VIEW --- */}
        {searchStep === 3 && userData ? (
            <UserDashboard userData={userData} onLogout={handleLogout} />
        ) : (
            /* --- NOT LOGGED IN VIEW --- */
            <>
                <div className="mobile-search-block">
                    {searchStep === 0 && (
                        <>
                            <input type="number" placeholder="Search registered mobile no." className="mobile-input-field" value={mobile} onChange={e=>setMobile(e.target.value)} />
                            <button className="mobile-blue-btn" onClick={handleMobileSearch}>Search</button>
                        </>
                    )}
                    {searchStep === 1 && (
                        <>
                            <input type="number" placeholder="Enter OTP" className="mobile-input-field" value={otp} onChange={e=>setOtp(e.target.value)} />
                            <button className="mobile-blue-btn" onClick={handleVerifyOTP}>Verify OTP</button>
                        </>
                    )}
                    {searchStep === 2 && (
                        <>
                            <input type="password" placeholder="Enter Password" className="mobile-input-field" value={password} onChange={e=>setPassword(e.target.value)} />
                            <button className="mobile-blue-btn" onClick={handleVerifyPassword}>Login & Access</button>
                        </>
                    )}
                </div>

                <div className="info-box-red-mob">
                    <h2>{searchStep === 0 ? "Search Your Data By Registered Mobile No." : searchStep === 1 ? "OTP Verification" : "Security Check"}</h2>
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
  );
};

export default MobileView;