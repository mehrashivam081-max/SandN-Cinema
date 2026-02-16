import React, { useState } from 'react';
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

const LaptopView = () => {
  // --- STATES ---
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewState, setViewState] = useState('HOME'); 
  const [feedType, setFeedType] = useState(null); 
  
  // Search Logic States
  const [searchStep, setSearchStep] = useState(0); 
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState(null);
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  // --- SEARCH HANDLERS ---
  const handleSearch = () => {
      if (mobile.length !== 10) return alert("Invalid Mobile Number");
      if (mobile === "9999999999") { 
          setIsNotRegistered(true); 
      } else { 
          alert(`OTP Sent to ${mobile}`); 
          setSearchStep(1); 
      }
  };

  const handleVerifyOTP = () => {
      if (otp === "123456") setSearchStep(2); else alert("Invalid OTP");
  };

  const handleVerifyPassword = () => {
      if (password === "admin123") {
          setUserData({ name: "User", mobile: mobile });
          setSearchStep(3);
      } else alert("Wrong Password");
  };

  // Laptop Swipe Buttons (Manual Triggers)
  const handleManualSwipe = (direction) => {
      if (direction === 'left') setFeedType('trending'); // Left Swipe -> Trending
      if (direction === 'right') setFeedType('viral');   // Right Swipe -> Viral
  };

  // --- RENDERING ---
  if (viewState === 'SERVICE') return <ServicesPage onBack={() => setViewState('HOME')} />;
  if (viewState === 'AUTH') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><LoginPage onBack={() => setViewState('HOME')} onSignupClick={() => setViewState('SIGNUP')} onLoginSuccess={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'SIGNUP') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><SignupPage onLoginClick={() => setViewState('AUTH')} onSuccessLogin={(u)=>{setUserData(u); setSearchStep(3); setViewState('HOME')}} /></div>;
  if (viewState === 'RECOVERY') return <div style={{padding:'50px', background:'#eee', minHeight:'100vh'}}><ForgotPassword onLoginClick={() => setViewState('AUTH')} /></div>;

  return (
    <div className="laptop-container">
      {/* Overlays */}
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

      <header className="laptop-header">
        <div className="menu-icon" onClick={() => setMenuOpen(true)}>☰</div>
        <div className="brand-section">
          <h1 className="brand-title">SandN Cinema</h1>
          
          {/* Laptop Search Bar Logic */}
          <div className="laptop-search-wrapper">
             {searchStep === 0 && (
                <>
                    <input type="text" placeholder="Search registered mobile number" className="search-input" value={mobile} onChange={e=>setMobile(e.target.value)} />
                    <button className="search-btn" onClick={handleSearch}>Search</button>
                </>
             )}
             {searchStep === 1 && (
                <>
                    <input type="text" placeholder="Enter OTP" className="search-input" value={otp} onChange={e=>setOtp(e.target.value)} style={{width:'150px'}} />
                    <button className="search-btn" onClick={handleVerifyOTP}>Verify</button>
                </>
             )}
             {searchStep === 2 && (
                <>
                    <input type="password" placeholder="Enter Password" className="search-input" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'150px'}} />
                    <button className="search-btn" onClick={handleVerifyPassword}>Login</button>
                </>
             )}
             {searchStep === 3 && (
                 <div style={{color:'green', fontWeight:'bold', marginLeft:'10px'}}>Welcome, {userData?.name} ✅</div>
             )}
          </div>
        </div>
        <div className="logo-circle">SN</div>
      </header>

      {/* Side Controls for "Swipe" on Laptop */}
      <div style={{position:'absolute', left:'20px', top:'50%', zIndex:10}}>
         <button onClick={() => handleManualSwipe('left')} style={{padding:'10px', background:'rgba(255,255,255,0.5)', borderRadius:'50%', border:'none', cursor:'pointer', fontWeight:'bold'}}>🔥 Trending</button>
      </div>
      <div style={{position:'absolute', right:'20px', top:'50%', zIndex:10}}>
         <button onClick={() => handleManualSwipe('right')} style={{padding:'10px', background:'rgba(255,255,255,0.5)', borderRadius:'50%', border:'none', cursor:'pointer', fontWeight:'bold'}}>🚀 Viral</button>
      </div>

      <div className="laptop-main-content">
        <div className="down-arrow">⮉</div>
        
        {searchStep === 3 ? (
            <div className="info-box-red" style={{background: 'rgba(0,0,0,0.8)'}}>
                <h2>Dashboard Access Granted</h2>
                <p>Viewing data for: {userData?.mobile}</p>
                <button className="search-btn" onClick={() => {setSearchStep(0); setUserData(null);}} style={{marginTop:'10px'}}>Logout</button>
            </div>
        ) : (
            <div className="info-box-red">
                <h2>Search Your Data<br />By Your Registered<br />Mobile No.</h2>
            </div>
        )}

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
      </div>
    </div>
  );
};

export default LaptopView;