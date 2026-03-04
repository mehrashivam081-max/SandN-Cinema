import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ProfilePage.css';
import profileImg from '../assets/sandn-logo.jpg'; 

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

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

    // ✅ State for Accounts Dropdown
    const [isAccountsOpen, setIsAccountsOpen] = useState(false);

    // ✅ Ref to control scroll position
    const sidebarContentRef = useRef(null);

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

    // ✅ DYNAMIC DATA STATES (Fetched from DB)
    const [socialLinks, setSocialLinks] = useState([]);
    const [policyData, setPolicyData] = useState({
        terms: "Loading...",
        privacy: "Loading...",
        bestForYou: "Loading..."
    });

    const activeVacancies = [
        { id: 1, role: "Video Editor", type: "Long Term", time: "Full Time (10-7)", salary: "₹20k - ₹35k", urgent: true },
        { id: 2, role: "Poster Designer", type: "Short Term", time: "Project Based", salary: "₹500 - ₹2k/art", urgent: false }
    ];

    const [trafficStats, setTrafficStats] = useState({
        tab1: { label: "Today", visitors: 1240, registered: 45 },
        tab2: { label: "This Month", visitors: 35890, registered: 1250 },
        tab3: { label: "Till Now", visitors: 845100, registered: 24108 }
    });

    // --- EFFECTS ---

    // ✅ FETCH REAL DATA FROM BACKEND WHEN SIDEBAR OPENS
    useEffect(() => {
        if (isOpen) {
            const fetchDynamicData = async () => {
                try {
                    const res = await axios.get(`${API_BASE}/get-platform-settings`);
                    if (res.data.success && res.data.data) {
                        if (res.data.data.socialLinks) {
                            // Backend icon map
                            const iconMap = {
                                'Instagram': { icon: '📸', color: '#E1306C' },
                                'YouTube': { icon: '▶️', color: '#FF0000' },
                                'Facebook': { icon: '📘', color: '#1877F2' },
                                'WhatsApp': { icon: '💬', color: '#25D366' },
                                'Twitter': { icon: '🐦', color: '#1DA1F2' }
                            };
                            
                            // Filter empty URLs and map UI properties
                            const validLinks = res.data.data.socialLinks
                                .filter(link => link.url && link.url.trim() !== '')
                                .map(link => ({
                                    ...link,
                                    icon: iconMap[link.platform]?.icon || '🌐',
                                    color: iconMap[link.platform]?.color || '#333'
                                }));
                            
                            setSocialLinks(validLinks);
                        }
                        if (res.data.data.policies) {
                            setPolicyData(res.data.data.policies);
                        }
                    }
                } catch(e) { console.log("Failed to fetch settings", e); }
            };
            fetchDynamicData();
            
            // Scroll memory reset
            if (sidebarContentRef.current) sidebarContentRef.current.scrollTop = 0;
            document.body.style.overflow = 'hidden';
        } else {
            // Reset states when closed
            setActivePopup(null);
            setIsFullView(false);
            setPopupTab('tab1'); 
            setAdInterest(false);
            setCareerInterest(false);
            setCareerSubTab('short');
            setUserRating(0); 
            setIsAccountsOpen(false); 
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
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


    const formatNum = (num) => num.toLocaleString('en-IN');

    const menuItems = [
        { id: "Services", label: "Services & Portfolio", icon: "🛠️" },
        { id: "Recovery", label: "Recovery (Forgot Pass)", icon: "🔄" },
        { id: "Traffic", label: "Traffic Status", icon: "📊" },
        { id: "Advertisement", label: "Business & Ads", icon: "📢" },
        { id: "Career & Vacancy", label: "Career & Vacancy", icon: "💼" },
        { id: "Security & Privacy Policy", label: "Security & Privacy Policy", icon: "🔒" },
        { id: "How do we best for you", label: "How do we best for you", icon: "🤝" }
    ];

    const profileActions = [
        { id: "About us", label: "About", icon: "🏢" },
        { id: "Customer Care", label: "Support", icon: "🎧" },
        { id: "Rate us", label: "Rate", icon: "⭐" },
        { id: "More way to connect us...", label: "Connect", icon: "🌐" }
    ];

    // Handlers
    const handleMenuClick = (itemId) => { 
        if (itemId === "Services") {
            onClose();
            onOpenService();
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
                        <div style={{marginTop: '15px', background:'#f9f9f9', padding:'15px', borderRadius:'8px', whiteSpace:'pre-line', fontSize:'14px', lineHeight:'1.6', color:'#444'}}>
                            {policyData.bestForYou}
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
                            {socialLinks.length > 0 ? (
                                socialLinks.map((link, idx) => (
                                    <a key={idx} href={link.url} target="_blank" rel="noreferrer" className="social-card" style={{borderColor: link.color}}>
                                        <span className="social-icon">{link.icon}</span>
                                        <span className="social-name" style={{color: link.color}}>{link.platform}</span>
                                    </a>
                                ))
                            ) : (
                                <p style={{color: '#888', fontSize: '13px', textAlign: 'center', width: '100%'}}>No social links added yet.</p>
                            )}
                        </div>
                    </div>
                );

            case "Security & Privacy Policy":
                return (
                    <>
                        <div className="popup-tabs">
                            <button className={`p-tab-btn ${popupTab === 'tab1' ? 'active' : ''}`} onClick={() => setPopupTab('tab1')}>Terms & Conditions</button>
                            <button className={`p-tab-btn ${popupTab === 'tab2' ? 'active' : ''}`} onClick={() => setPopupTab('tab2')}>Privacy Policy</button>
                        </div>
                        <div className="popup-inner-box security-box">
                            {popupTab === 'tab1' ? (
                                <div className="policy-content" style={{whiteSpace:'pre-line', fontSize:'13px', lineHeight:'1.6', color:'#555'}}>
                                    {policyData.terms}
                                </div>
                            ) : (
                                <div className="policy-content" style={{whiteSpace:'pre-line', fontSize:'13px', lineHeight:'1.6', color:'#555'}}>
                                    {policyData.privacy}
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
                    <div className="full-image-overlay" onClick={() => setIsFullView(false)} style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh', background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                        <img src={profileImg} alt="Full Profile" className="full-screen-img" style={{width: '100%', maxWidth: '500px', height: 'auto', maxHeight: '80vh', objectFit: 'contain'}} />
                        <p className="close-instruction" style={{color: 'white', marginTop: '20px', fontSize: '14px', opacity: 0.7}}>Tap anywhere to close</p>
                    </div>
                )}

                {activePopup && (
                    <div className="popup-overlay-fixed" onClick={closePopup} style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'}}>
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
                
                <div className="sidebar-content" ref={sidebarContentRef} style={{flexGrow: 1, overflowY: 'auto'}}>
                    <div className="dp-section">
                        <div className="profile-img-container" onClick={() => setIsFullView(true)} style={{cursor: 'pointer'}}>
                            <img src={profileImg} alt="DP" className="profile-dp" />
                        </div>
                    </div>
                    
                    <div className="profile-header-text">SandN Cinema</div>

                    <div className="profile-actions-row">
                        {profileActions.map(action => (
                            <div key={action.id} className="profile-action-btn" onClick={() => handleMenuClick(action.id)}>
                                <div className="p-action-icon">{action.icon}</div>
                                <div className="p-action-label">{action.label}</div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="header-underline" style={{marginTop: '0px'}}></div>
                    
                    <ul className="profile-menu-list" style={{marginTop: '15px'}}>
                        <li className="profile-menu-item" style={{flexDirection: 'column', alignItems: 'flex-start'}} onClick={() => setIsAccountsOpen(!isAccountsOpen)}>
                            <div style={{display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center'}}>
                                <div className="menu-left-group">
                                    <span className="menu-icon">👤</span>
                                    <span className="menu-label">Accounts (Login/Signup)</span>
                                </div>
                                <span className="menu-arrow" style={{ transform: isAccountsOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.3s' }}>›</span>
                            </div>
                            
                            {isAccountsOpen && (
                                <div className="accounts-dropdown" style={{width: '100%', marginTop: '10px', paddingLeft: '35px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); onClose(); onOpenAuth(); }} 
                                        style={{padding: '8px 12px', background: '#f5f5f5', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', color: '#333'}}>
                                        🔑 Login
                                    </div>
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); onClose(); onOpenAuth(); }} 
                                        style={{padding: '8px 12px', background: '#f5f5f5', borderRadius: '5px', cursor: 'pointer', fontSize: '14px', color: '#333'}}>
                                        📝 Create Account
                                    </div>
                                </div>
                            )}
                        </li>

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