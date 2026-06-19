import React, { useState } from 'react';
import axios from 'axios'; // API call ke liye
import './ServicesPage.css';

const API_BASE = import.meta.env.VITE_API_BASE;

const ServicesPage = ({ onBack }) => {
    // State to track which section is open
    const [openSection, setOpenSection] = useState(null);

    // --- COLLAB FORM STATES ---
    const [collabData, setCollabData] = useState({ name: '', brand: '', email: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const toggleSection = (index) => {
        if (openSection === index) setOpenSection(null);
        else setOpenSection(index); 
    };

    // --- COLLAB SUBMIT HANDLER ---
    const handleCollabSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const res = await axios.post(`${API_BASE}/create-collab`, collabData);
            if (res.data.success) {
                setSubmitSuccess(true);
                setCollabData({ name: '', brand: '', email: '' }); // Form clear
                setTimeout(() => setSubmitSuccess(false), 5000); // 5 sec baad msg hide
            } else {
                alert("Failed to submit: " + res.data.message);
            }
        } catch (error) {
            alert("Server Error. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Data extracted from the uploaded image
    const servicesData = [
        {
            title: "Photography Services",
            icon: "📸",
            items: [
                "Model Photography", "Event Photography", "Fashion Photography",
                "Product Photography", "Wedding Photography", "Abstract Photography",
                "Portrait Photography", "Candid Photography", "Personal Photography",
                "Travel Photography", "Couple Photography", "Light Painting Photography",
                "Kids Photography"
            ]
        },
        {
            title: "Videography Services",
            icon: "🎥",
            items: [
                "Song Video", "Photo Video", "Live Stream (Facebook & YouTube)", "Instagram Reels"
            ]
        },
        {
            title: "Social Media Management",
            icon: "📱",
            items: [
                "Account Handling", "Facebook & YouTube Thumbnails", "Google AdSense"
            ]
        },
        {
            title: "Brand Promotion",
            icon: "📢",
            items: [
                "Collaboration", "Product Awareness", "Influencer Marketing"
            ]
        },
        {
            title: "Editing",
            icon: "🎬",
            items: [
                "Reels Editing", "Cinematic Clips", "Video & Photos", "Creative Editing"
            ]
        }
    ];

    return (
        <div className="services-container" style={{ fontFamily: "'Poppins', sans-serif" }}>
            
            {/* 🔥 Glass Back Button (Matched with Auth Pages) */}
            <div className="home-btn-glass" onClick={onBack} title="Back to Main Page">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span className="home-text">Go Back</span>
            </div>

            <div className="services-card-glass">
                
                {/* 🔥 Cinematic Header Section */}
                <div className="services-header">
                    <h2 className="services-title">Ms Studio Indore</h2>
                    <p className="services-subtitle">Exclusive Services Portfolio</p>
                </div>

                {/* 🔥 Luxe Accordion List */}
                <div className="services-list">
                    {servicesData.map((service, index) => (
                        <div key={index} className="service-item-glass">
                            
                            {/* Clickable Header */}
                            <div 
                                className={`service-category-btn-glass ${openSection === index ? 'active' : ''}`} 
                                onClick={() => toggleSection(index)}
                            >
                                <span className="category-icon">{service.icon}</span>
                                <span className="category-title">{service.title}</span>
                                <span className="arrow-indicator">{openSection === index ? '▲' : '▼'}</span>
                            </div>

                            {/* Dropdown Content */}
                            <div className={`service-content-glass ${openSection === index ? 'open' : ''}`}>
                                <ul>
                                    {service.items.map((item, idx) => (
                                        <li key={idx} className="service-li"><span className="li-bullet">✦</span> {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 🔥 PREMIUM COLLABORATION FORM SECTION */}
                <div className="collab-box-glass">
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#FFD700', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '600', display:'flex', alignItems:'center', gap:'10px' }}>
                        <span>🤝</span> Request Collaboration
                    </h3>
                    
                    {submitSuccess ? (
                        <div className="success-badge fade-in">
                            ✅ Request Sent! Our exclusive team will contact you.
                        </div>
                    ) : (
                        <form onSubmit={handleCollabSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div className="input-group">
                                <label className="luxe-label">Your Name</label>
                                <input type="text" className="luxe-input" placeholder="e.g. Rohan Mehta" value={collabData.name} onChange={(e) => setCollabData({...collabData, name: e.target.value})} required />
                            </div>
                            <div className="input-group">
                                <label className="luxe-label">Brand / Page Name</label>
                                <input type="text" className="luxe-input" placeholder="e.g. Zara Fashion" value={collabData.brand} onChange={(e) => setCollabData({...collabData, brand: e.target.value})} required />
                            </div>
                            <div className="input-group">
                                <label className="luxe-label">Email Address</label>
                                <input type="email" className="luxe-input" placeholder="contact@brand.com" value={collabData.email} onChange={(e) => setCollabData({...collabData, email: e.target.value})} required />
                            </div>
                            <button type="submit" className="btn-primary-luxe" disabled={isSubmitting} style={{marginTop: '5px'}}>
                                {isSubmitting ? 'SENDING REQUEST...' : 'SEND INQUIRY ⚡'}
                            </button>
                        </form>
                    )}
                </div>

                {/* 🔥 Luxe Contact Info Footer */}
                <div className="contact-info-glass">
                    <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Official Contact</h3>
                    <div className="contact-grid">
                        <div className="contact-row"><span className="c-icon">📸</span> <span><strong>IG:</strong> ms_studio</span></div>
                        <div className="contact-row"><span className="c-icon">📞</span> <span><strong>Tel:</strong> +91 7828011282</span></div>
                        <div className="contact-row"><span className="c-icon">✉️</span> <span><strong>Email:</strong> msstudioindore7@gmail.com</span></div>
                        <div className="contact-row"><span className="c-icon">📍</span> <span><strong>Location:</strong> Vijay Nagar, Indore</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServicesPage;