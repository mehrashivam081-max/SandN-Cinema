import React, { useState, useRef, useEffect } from 'react';
import './ProfilePage.css';
import profileImg from '../assets/sandn-logo.jpg'; 

const ProfilePage = ({ isOpen, onClose, onOpenService, onOpenAuth, onOpenRecovery }) => {
    
    // --- STATES ---
    const [isFullView, setIsFullView] = useState(false);
    const [activePopup, setActivePopup] = useState(null); 
    const [popupTab, setPopupTab] = useState('tab1'); 
    
    // Feature States
    const [careerSubTab, setCareerSubTab] = useState('short'); 
    const [adInterest, setAdInterest] = useState(false);
    const [careerInterest, setCareerInterest] = useState(false);
    const [userRating, setUserRating] = useState(0); 

    // --- COMPANY DATA ---
    const companyDetails = {
        name: "SandN Cinema",
        tagline: "Capturing Moments, Creating Magic",
        desc: "SandN Cinema is a professional photography and media production house. We specialize in cinematic weddings, fashion shoots, brand ad-films, and creative content creation.",
        founded: "Since 2024"
    };

    const contactInfo = {
        phone: "+91 98765 43210",
        email: "bookings@sandncinema.com",
        hours: "Studio Open: 10 AM - 8 PM",
        address: "Vijay Nagar, Indore, India"
    };

    const socialLinks = [
        { id: 'insta', name: 'Instagram', icon: '📸', url: '#', color: '#E1306C', handle: '@sandn_cinema' },
        { id: 'yt', name: 'YouTube', icon: '▶️', url: '#', color: '#FF0000', handle: 'SandN Films' },
        { id: 'fb', name: 'Facebook', icon: '📘', url: '#', color: '#1877F2', handle: 'SandN Official' },
        { id: 'wa', name: 'WhatsApp', icon: '💬', url: '#', color: '#25D366', handle: 'Chat with us' },
        { id: 'twitter', name: 'Twitter', icon: '🐦', url: '#', color: '#1DA1F2', handle: '@sandn_tweets' },
        { id: 'mail', name: 'Email', icon: '✉️', url: '#', color: '#EA4335', handle: 'Mail Us' }
    ];

    const ourBestPoints = [
        { icon: '🎥', title: 'Cinematic Quality', desc: 'We use high-end 4K cameras & drones for premium output.' },
        { icon: '🎨', title: 'Creative Editing', desc: 'Our editors turn raw footage into magical stories.' },
        { icon: '⚡', title: 'Fast Delivery', desc: 'Get your edited photos & videos within the promised timeline.' },
        { icon: '🤵', title: 'Pro Team', desc: 'Experienced photographers who know the perfect angles.' }
    ];

    const activeVacancies = [
        { id: 1, role: "Video Editor", type: "Long Term", time: "Full Time (10-7)", salary: "₹20k - ₹35k", urgent: true },
        { id: 2, role: "Poster Designer", type: "Short Term", time: "Project Based", salary: "₹500 - ₹2k/art", urgent: false }
    ];

    // --- REAL-TIME TRAFFIC STATE ---
    const [trafficStats, setTrafficStats] = useState({
        tab1: { label: "Today", visitors: 1240, registered: 45 },
        tab2: { label: "This Month", visitors: 35890, registered: 1250 },
        tab3: { label: "Till Now", visitors: 845100, registered: 24108 }
    });

    const timerRef = useRef(null); 

    // --- EFFECTS ---
    useEffect(() => {
        if (!isOpen) {
            setActivePopup(null);
            setIsFullView(false);
            setPopupTab('tab1'); 
            setAdInterest(false);
            setCareerInterest(false);
            setCareerSubTab('short');
            setUserRating(0); 
        }
    }, [isOpen]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTrafficStats(prev => {
                const newData = { ...prev };
                newData.tab1.visitors += Math.floor(Math.random() * 3);
                if(Math.random() > 0.8) newData.tab1.registered += 1;
                newData.tab3.visitors += Math.floor(Math.random() * 5) + 2;
                return newData;
            });
        }, 2500); 
        return () => clearInterval(interval);
    }, []);

    // --- YE CODE ADD KAREIN (Background Scroll Lock) ---
    useEffect(() => {
        if (isOpen) {
            // Jab Sidebar open ho, body scroll band kar do
            document.body.style.overflow = 'hidden';
        } else {
            // Jab Sidebar close ho, wapas normal kar do
            document.body.style.overflow = 'unset';
        }

        // Cleanup function (agar component unmount ho jaye)
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const formatNum = (num) => num.toLocaleString('en-IN');

    // --- MENU ITEMS (Updated) ---
    const menuItems = [
        { id: "Services", label: "Services & Portfolio", icon: "🛠️" },
        { id: "Accounts", label: "Accounts (Login/Signup)", icon: "👤" },
        { id: "Recovery", label: "Recovery (Forgot Pass)", icon: "🔄" },
        { id: "Traffic", label: "Traffic Status", icon: "📊" },
        { id: "Advertisement", label: "Business & Ads", icon: "📢" },
        { id: "Career & Vacancy", label: "Career & Vacancy", icon: "💼" },
        { id: "About us", label: "About us", icon: "🏢" },
        { id: "Security & Privacy Policy", label: "Security & Privacy Policy", icon: "🔒" },
        { id: "Customer Care", label: "Customer Care", icon: "🎧" },
        { id: "How do we best for you", label: "How do we best for you", icon: "🤝" },
        { id: "Rate us", label: "Rate us", icon: "⭐" },
        { id: "More way to connect us...", label: "Connect with us...", icon: "🌐" }
    ];

    // Handlers
    const handleMenuClick = (itemId) => { 
        if (itemId === "Services") {
            onClose();
            onOpenService();
        } else if (itemId === "Accounts") {
            onClose();
            onOpenAuth();
        } else if (itemId === "Recovery") {
            onClose();
            onOpenRecovery();
        } else {
            setActivePopup(itemId); 
            setPopupTab('tab1'); 
            setCareerSubTab('short'); 
            setAdInterest(false);
            setCareerInterest(false);
        }
    };

    const closePopup = (e) => { if(e) e.stopPropagation(); setActivePopup(null); };
    const handlePressStart = () => { timerRef.current = setTimeout(() => { setIsFullView(true); }, 600); };
    const handlePressEnd = () => { if (timerRef.current) clearTimeout(timerRef.current); };
    const handleDoubleTap = (e) => { if(e) e.stopPropagation(); setIsFullView(false); };


    // --- RENDER POPUP CONTENT ---
    const renderPopupContent = () => {
        switch(activePopup) {
            
            case "About us":
                return (
                    <div className="popup-inner-box about-box">
                        <div className="about-header">
                            <img src={profileImg} alt="Logo" className="about-logo" />
                            <h3>{companyDetails.name}</h3>
                            <span className="about-tagline">{companyDetails.tagline}</span>
                        </div>
                        <div className="about-content">
                            <p>{companyDetails.desc}</p>
                            <div className="about-footer">
                                <span>{companyDetails.founded}</span> • <span>Made for Creators 🎬</span>
                            </div>
                        </div>
                    </div>
                );

            case "Customer Care":
                return (
                    <div className="popup-inner-box contact-box">
                        <h3>Studio Support</h3>
                        <p className="contact-sub">Need help with a booking or shoot?</p>
                        
                        <div className="contact-list">
                            <div className="contact-item">
                                <span className="c-icon">📞</span>
                                <div><p>Booking Inquiry</p><strong>{contactInfo.phone}</strong></div>
                            </div>
                            <div className="contact-item">
                                <span className="c-icon">✉️</span>
                                <div><p>Support Email</p><strong>{contactInfo.email}</strong></div>
                            </div>
                            <div className="contact-item">
                                <span className="c-icon">🕒</span>
                                <div><p>Studio Hours</p><strong>{contactInfo.hours}</strong></div>
                            </div>
                        </div>
                        <button className="green-btn contact-btn">WhatsApp Us</button>
                    </div>
                );

            case "How do we best for you":
                return (
                    <div className="popup-inner-box best-box">
                        <h3>Why Choose SandN?</h3>
                        <div className="usp-grid">
                            {ourBestPoints.map((point, index) => (
                                <div key={index} className="usp-card">
                                    <div className="usp-icon">{point.icon}</div>
                                    <h4>{point.title}</h4>
                                    <p>{point.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case "Rate us":
                return (
                    <div className="popup-inner-box rate-box center-content">
                        <h3>Rate Our Service</h3>
                        
                        <div className="rating-score-circle">
                            <span className="rating-num">4.9</span>
                            <span className="rating-total">/ 5</span>
                        </div>
                        <p style={{fontSize:'12px', color:'#666', marginBottom:'20px'}}>Trusted by 10k+ Artists</p>

                        {userRating === 0 ? (
                            <>
                                <p style={{fontWeight:'bold'}}>How was your experience?</p>
                                <div className="stars-container">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span key={star} className="star-btn" onClick={() => setUserRating(star)}>★</span>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="thank-rating">
                                <span style={{fontSize:'40px'}}>💖</span>
                                <h4>Thanks for Feedback!</h4>
                                <p>You rated us {userRating}/5 stars.</p>
                            </div>
                        )}
                    </div>
                );

            case "More way to connect us...":
                return (
                    <div className="popup-inner-box connect-box">
                        <h3>Follow Our Work</h3>
                        <p className="connect-desc">Check out our latest shoots & BTS on social media.</p>
                        
                        <div className="social-grid">
                            {socialLinks.map((link) => (
                                <a key={link.id} href={link.url} className="social-card" style={{borderColor: link.color}}>
                                    <span className="social-icon">{link.icon}</span>
                                    <span className="social-name" style={{color: link.color}}>{link.name}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                );

            case "Security & Privacy Policy":
                return (
                    <>
                        <div className="popup-tabs">
                            <button className={`p-tab-btn ${popupTab === 'tab1' ? 'active' : ''}`} onClick={() => setPopupTab('tab1')}>Security</button>
                            <button className={`p-tab-btn ${popupTab === 'tab2' ? 'active' : ''}`} onClick={() => setPopupTab('tab2')}>Privacy</button>
                        </div>
                        <div className="popup-inner-box security-box">
                            {popupTab === 'tab1' ? (
                                <div className="policy-content">
                                    <div className="policy-item">
                                        <span className="p-icon">🔒</span>
                                        <p><strong>Media Safety:</strong> Your photos & raw footage are stored on encrypted servers.</p>
                                    </div>
                                    <div className="policy-item">
                                        <span className="p-icon">🛡️</span>
                                        <p><strong>Secure Account:</strong> Only you can access your booking history via OTP.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="policy-content">
                                    <div className="policy-item">
                                        <span className="p-icon">👁️</span>
                                        <p><strong>Copyright Policy:</strong> We respect your IP. Your content is never used without permission.</p>
                                    </div>
                                    <div className="policy-item">
                                        <span className="p-icon">📄</span>
                                        <p><strong>Data Privacy:</strong> We do not share your contact info with third-party agencies.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                );

            case "Career & Vacancy":
                return (
                    <div className="popup-inner-box career-box">
                        <div className="career-header"><span className="career-icon">🚀</span><h3>SandN Opportunities</h3></div>
                        <div className="popup-tabs career-tabs">
                            <button className={`p-tab-btn ${popupTab === 'tab1' ? 'active' : ''}`} onClick={() => setPopupTab('tab1')}>Career Path</button>
                            <button className={`p-tab-btn ${popupTab === 'tab2' ? 'active' : ''}`} onClick={() => setPopupTab('tab2')}>Open Vacancy</button>
                        </div>
                        {popupTab === 'tab1' && (
                            <>
                                <div className="sub-tabs-container">
                                    <button className={`t-tab ${careerSubTab === 'short' ? 'active' : ''}`} onClick={() => setCareerSubTab('short')}>Short Term</button>
                                    <button className={`t-tab ${careerSubTab === 'long' ? 'active' : ''}`} onClick={() => setCareerSubTab('long')}>Long Term</button>
                                </div>
                                <div className="career-content-area">
                                    {careerSubTab === 'short' ? (
                                        <><h4 className="career-sub-title">Freelance & Gigs</h4><ul className="career-list"><li>⚡ Project Based Pay</li><li>🕒 Flexible Shoot Timings</li><li>🎨 Build Creative Portfolio</li></ul></>
                                    ) : (
                                        <><h4 className="career-sub-title">Core Team</h4><ul className="career-list"><li>💼 Permanent Role</li><li>📈 Growth in Production</li><li>🌟 Studio Perks & Insurance</li></ul></>
                                    )}
                                </div>
                                <div style={{marginTop: '15px'}}>{!careerInterest ? <button className="green-btn career-apply-btn" onClick={() => setCareerInterest(true)}>I am Interested</button> : <div className="ad-success-msg"><span className="check-icon">✓</span><div><strong>Interest Noted!</strong></div></div>}</div>
                            </>
                        )}
                        {popupTab === 'tab2' && (
                            <div className="vacancy-list-container">
                                {activeVacancies.map((job) => (
                                    <div key={job.id} className="vacancy-card">
                                        {job.urgent && <div className="urgent-badge">Urgent</div>}
                                        <div className="vacancy-role-header"><h4 className="v-role">{job.role}</h4><span className={`v-type ${job.type === 'Long Term' ? 'v-long' : 'v-short'}`}>{job.type}</span></div>
                                        <div className="vacancy-details"><div className="v-detail-row"><span>🕒 {job.time}</span></div><div className="v-detail-row"><span className="v-salary">💰 {job.salary}</span></div></div>
                                        <button className="vacancy-apply-btn">Apply Now</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case "Traffic":
                const currentStats = trafficStats[popupTab]; 
                return (
                    <div className="popup-inner-box traffic-professional-box">
                        <div className="traffic-header-row"><span className="traffic-icon-main">📊</span><span className="traffic-title-main">Analytics</span></div>
                        <div className="traffic-filter-container"><select className="traffic-dropdown-pro" value={popupTab} onChange={(e) => setPopupTab(e.target.value)}><option value="tab1">Today's Data</option><option value="tab2">This Month</option><option value="tab3">All Time</option></select></div>
                        <div className="traffic-stats-grid">
                            <div className="stat-card"><div className="stat-icon-bg">👁️</div><div className="stat-info"><span className="stat-value">{formatNum(currentStats.visitors)}</span><span className="stat-label">Visitors</span></div></div>
                            <div className="stat-card"><div className="stat-icon-bg">👤</div><div className="stat-info"><span className="stat-value highlight">{formatNum(currentStats.registered)}</span><span className="stat-label">Registered</span></div></div>
                        </div>
                        <div className="live-indicator"><span className="dot-blink"></span> Live Updates</div>
                    </div>
                );

            case "Advertisement":
                return (
                    <div className="popup-inner-box ad-professional-box">
                        <div className="ad-header-icon">🚀</div><h2 className="ad-pro-title">Grow Your Brand</h2><p className="ad-pro-subtitle">Promote your production house or equipment here.</p><div className="ad-status-badge">Launching Soon</div><div className="ad-divider"></div>
                        <div className="ad-action-wrapper">{!adInterest ? <><p className="ad-question">Want to advertise?</p><button className="green-btn ad-notify-btn" onClick={() => setAdInterest(true)}>Notify Me</button></> : <div className="ad-success-msg"><span className="check-icon">✓</span><div><strong>Received!</strong><p>We'll contact you soon.</p></div></div>}</div>
                    </div>
                );

            default: return null;
        }
    };

    return (
        <>
            <div className={`sidebar-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}></div>
            <div className={`profile-sidebar-container ${isOpen ? 'slide-in' : ''}`}>
                
                {isFullView && (
                    <div className="full-image-overlay" onDoubleClick={handleDoubleTap} onClick={(e) => e.stopPropagation()}>
                        <img src={profileImg} alt="Full Profile" className="full-screen-img" onDoubleClick={handleDoubleTap} />
                        <p className="close-instruction">Double tap to close</p>
                    </div>
                )}

                {activePopup && (
                    <div className="popup-overlay-fixed" onClick={closePopup}>
                        <div className="custom-popup-box" onClick={(e) => e.stopPropagation()}>
                            <div className="popup-header-row">
                                <div className="popup-title-badge">
                                    {activePopup === "Advertisement" ? "Promotions" : (activePopup === "Traffic" ? "Analytics" : (activePopup.includes("...") ? "Connect" : activePopup.split('&')[0]))}
                                </div>
                                <button className="popup-close-x" onClick={closePopup}>X</button>
                            </div>
                            {renderPopupContent()}
                        </div>
                    </div>
                )}

                <div className="sidebar-header-row"><button className="sidebar-close-btn" onClick={onClose}>✕</button></div>
                <div className="sidebar-content">
                    <div className="dp-section">
                        <div className="profile-img-container" onMouseDown={handlePressStart} onMouseUp={handlePressEnd} onMouseLeave={handlePressEnd} onTouchStart={handlePressStart} onTouchEnd={handlePressEnd} onContextMenu={(e) => e.preventDefault()}>
                            <img src={profileImg} alt="DP" className="profile-dp" />
                        </div>
                    </div>
                    <div className="profile-header-text">SandN Cinema<div className="header-underline"></div></div>
                    <ul className="profile-menu-list">
                        {menuItems.map((item, index) => (
                            <li key={index} className="profile-menu-item" onClick={() => handleMenuClick(item.id)}>
                                <div className="menu-left-group"><span className="menu-icon">{item.icon}</span><span className="menu-label">{item.label}</span></div>
                                <span className="menu-arrow">›</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
};

export default ProfilePage;