import React, { useState } from 'react';
import profileImg from '../assets/sandn-logo.jpg';
import './QuickActions.css';

const QuickActions = () => {
    const [activePopup, setActivePopup] = useState(null);
    const [userRating, setUserRating] = useState(0);

    const companyDetails = {
        name: "SandN Cinema",
        tagline: "Capturing Moments, Creating Magic",
        desc: "SandN Cinema is a professional photography and media production house. We specialize in cinematic weddings, fashion shoots, brand ad-films, and creative content creation.",
        founded: "Since 2024"
    };

    const contactInfo = {
        phone: "+91 98765 43210", email: "bookings@sandncinema.com",
        hours: "Studio Open: 10 AM - 8 PM", address: "Vijay Nagar, Indore, India"
    };

    const socialLinks = [
        { id: 'insta', name: 'Instagram', icon: '📸', url: '#', color: '#E1306C' },
        { id: 'yt', name: 'YouTube', icon: '▶️', url: '#', color: '#FF0000' },
        { id: 'fb', name: 'Facebook', icon: '📘', url: '#', color: '#1877F2' },
        { id: 'wa', name: 'WhatsApp', icon: '💬', url: '#', color: '#25D366' }
    ];

    const closePopup = (e) => { if (e) e.stopPropagation(); setActivePopup(null); };

    return (
        <div className="quick-actions-container">
            <div className="qa-icon-btn" onClick={() => setActivePopup('About us')} title="About">🏢</div>
            <div className="qa-icon-btn" onClick={() => setActivePopup('Support')} title="Support">🎧</div>
            <div className="qa-icon-btn" onClick={() => setActivePopup('Rate us')} title="Rate">⭐</div>
            <div className="qa-icon-btn" onClick={() => setActivePopup('Connect')} title="Connect">🌐</div>

            {activePopup && (
                <div className="popup-overlay-fixed" onClick={closePopup}>
                    <div className="custom-popup-box" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-header-row">
                            <div className="popup-title-badge">{activePopup}</div>
                            <button className="popup-close-x" onClick={closePopup}>X</button>
                        </div>
                        
                        {/* --- POPUP CONTENT --- */}
                        {activePopup === 'About us' && (
                            <div className="popup-inner-box about-box">
                                <div className="about-header">
                                    <img src={profileImg} alt="Logo" className="about-logo" />
                                    <h3>{companyDetails.name}</h3>
                                    <span className="about-tagline">{companyDetails.tagline}</span>
                                </div>
                                <div className="about-content">
                                    <p>{companyDetails.desc}</p>
                                    <div className="about-footer"><span>{companyDetails.founded}</span> • <span>Made for Creators 🎬</span></div>
                                </div>
                            </div>
                        )}
                        {activePopup === 'Support' && (
                            <div className="popup-inner-box contact-box">
                                <h3>Studio Support</h3><p className="contact-sub">Need help with a booking?</p>
                                <div className="contact-list">
                                    <div className="contact-item"><span className="c-icon">📞</span><div><p>Booking Inquiry</p><strong>{contactInfo.phone}</strong></div></div>
                                    <div className="contact-item"><span className="c-icon">✉️</span><div><p>Support Email</p><strong>{contactInfo.email}</strong></div></div>
                                </div>
                                <button className="green-btn contact-btn">WhatsApp Us</button>
                            </div>
                        )}
                        {activePopup === 'Rate us' && (
                            <div className="popup-inner-box rate-box center-content">
                                <h3>Rate Our Service</h3>
                                <div className="rating-score-circle"><span className="rating-num">4.9</span><span className="rating-total">/ 5</span></div>
                                {userRating === 0 ? (
                                    <div className="stars-container">
                                        {[1, 2, 3, 4, 5].map((star) => (<span key={star} className="star-btn" onClick={() => setUserRating(star)}>★</span>))}
                                    </div>
                                ) : (
                                    <div className="thank-rating"><h4>Thanks for Feedback!</h4><p>You rated us {userRating}/5 stars.</p></div>
                                )}
                            </div>
                        )}
                        {activePopup === 'Connect' && (
                            <div className="popup-inner-box connect-box">
                                <h3>Follow Our Work</h3>
                                <div className="social-grid">
                                    {socialLinks.map((link) => (
                                        <a key={link.id} href={link.url} className="social-card" style={{borderColor: link.color}}>
                                            <span className="social-icon">{link.icon}</span><span className="social-name" style={{color: link.color}}>{link.name}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default QuickActions;