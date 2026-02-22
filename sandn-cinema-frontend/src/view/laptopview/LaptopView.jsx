import React, { useState } from 'react';
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

const LaptopView = () => {
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

  const handleSearch = async () => {
      if (mobile.length !== 10) return alert("Invalid Mobile Number");
      setLoading(true);
      try {
          const res = await axios.post(`${API_BASE}/check-send-otp`, { mobile });
          if (res.data.success) { 
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

  const handleManualSwipe = (direction) => {
      if (direction === 'left') setFeedType('trending');
      if (direction === 'right') setFeedType('viral');   
  };

  const handleLogout = () => {
      setSearchStep(0); setUserData(null); setMobile(''); setOtp(''); setPassword('');
  };

  const renderDashboard = () => {
      if (userData.role === 'ADMIN') return <OwnerDashboard />; 
      if (userData.role === 'STUDIO') return <StudioDashboard user={userData} onLogout={handleLogout} />;
      return <UserDashboard userData={userData} onLogout={handleLogout} />;
  };

  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'SIGNUP') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'RECOVERY') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><ForgotPassword onLoginClick={() => setViewState('AUTH')} /></div>;

  return (
    <div className="laptop-container">
      {feedType && <TrendingFeed type={feedType} onClose={() => setFeedType(null)} />}
      {isNotRegistered && <NotRegisteredPage onTryAgain={() => setIsNotRegistered(false)} onLogin={() => {setIsNotRegistered(false); setViewState('SIGNUP');}} />}
      {viewState === 'BOOKING' && <BookingForm onClose={() => setViewState('HOME')} />}

      <ProfilePage isOpen={menuOpen} onClose={() => setMenuOpen(false)} onOpenService={() => setViewState('SERVICE')} onOpenAuth={() => setViewState('AUTH')} onOpenRecovery={() => setViewState('RECOVERY')} />

      {/* ✅ UPDATED: Header will hide completely when user logs in */}
      {!userData && (
          <header className="laptop-header">
            {/* User Profile Icon */}
            <div className="menu-icon" onClick={() => setMenuOpen(true)} style={{cursor: 'pointer'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                 <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="brand-section">
              <h1 className="brand-title">SandN Cinema</h1>
              
              <div className="laptop-search-wrapper">
                 {searchStep === 0 && (
                    <>
                        <input type="text" placeholder="Search registered mobile number" className="search-input" value={mobile} onChange={e=>setMobile(e.target.value)} />
                        <button className="search-btn" onClick={handleSearch} disabled={loading}>{loading?'Searching...':'Search'}</button>
                    </>
                 )}
                 {searchStep === 1 && (
                    <>
                        <input type="text" placeholder="Enter WhatsApp OTP" className="search-input" value={otp} onChange={e=>setOtp(e.target.value)} style={{width:'150px'}} />
                        <button className="search-btn" onClick={handleVerifyOTP} disabled={loading}>{loading?'Verifying...':'Verify'}</button>
                    </>
                 )}
                 {searchStep === 2 && (
                    <>
                        <input type="password" placeholder="Enter Password" className="search-input" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'150px'}} />
                        <button className="search-btn" onClick={handleVerifyPassword} disabled={loading}>{loading?'Logging...':'Login'}</button>
                    </>
                 )}
              </div>
            </div>
            <div className="logo-circle">SN</div>
          </header>
      )}

      {/* ✅ UPDATED: Feed Buttons will hide completely when user logs in */}
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