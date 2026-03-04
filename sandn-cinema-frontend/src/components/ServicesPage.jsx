import React, { useState } from 'react';
import axios from 'axios'; // API call ke liye
import './ServicesPage.css';

const API_BASE = 'https://sandn-cinema.onrender.com/api/auth';

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
        <div className="services-container">
            <div className="services-card">
                
                {/* Header Section */}
                <div className="services-header">
                    <h2 className="services-title">Ms Studio Indore</h2>
                    <p className="services-subtitle">Service Chart</p>
                </div>

                {/* Services List (Accordion) */}
                <div className="services-list">
                    {servicesData.map((service, index) => (
                        <div key={index} className="service-item">
                            
                            {/* Clickable Header */}
                            <div 
                                className={`service-category-btn ${openSection === index ? 'active' : ''}`} 
                                onClick={() => toggleSection(index)}
                            >
                                <span className="category-icon">{service.icon}</span>
                                <span className="category-title">{service.title}</span>
                                <span className="arrow-indicator">{openSection === index ? '▲' : '▼'}</span>
                            </div>

                            {/* Dropdown Content */}
                            <div className={`service-content ${openSection === index ? 'open' : ''}`}>
                                <ul>
                                    {service.items.map((item, idx) => (
                                        <li key={idx}>🔹 {item}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ✅ COLLABORATION FORM SECTION (NEW) */}
                <div style={{ background: '#f5f6fa', padding: '20px', borderRadius: '10px', marginTop: '30px', border: '1px solid #ddd' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#2c3e50', display:'flex', alignItems:'center', gap:'8px' }}>
                        🤝 Want to Collaborate?
                    </h3>
                    
                    {submitSuccess ? (
                        <div style={{ background: '#2ecc71', color: '#fff', padding: '15px', borderRadius: '5px', textAlign: 'center', fontWeight: 'bold' }}>
                            ✅ Request Sent! Our team will contact you soon.
                        </div>
                    ) : (
                        <form onSubmit={handleCollabSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <input 
                                type="text" 
                                placeholder="Your Name" 
                                value={collabData.name}
                                onChange={(e) => setCollabData({...collabData, name: e.target.value})}
                                required
                                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                            />
                            <input 
                                type="text" 
                                placeholder="Brand / Page Name" 
                                value={collabData.brand}
                                onChange={(e) => setCollabData({...collabData, brand: e.target.value})}
                                required
                                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                            />
                            <input 
                                type="email" 
                                placeholder="Email Address" 
                                value={collabData.email}
                                onChange={(e) => setCollabData({...collabData, email: e.target.value})}
                                required
                                style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
                            />
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                style={{ 
                                    padding: '12px', 
                                    background: isSubmitting ? '#95a5a6' : '#e50914', 
                                    color: '#fff', 
                                    border: 'none', 
                                    borderRadius: '5px', 
                                    fontWeight: 'bold', 
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isSubmitting ? 'Sending...' : 'Send Request'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Contact Info Footer */}
                <div className="contact-info-box" style={{ marginTop: '20px' }}>
                    <h3>Contact Us</h3>
                    <p><strong>Instagram:</strong> ms_studio</p>
                    <p><strong>Contact:</strong> 7828011282</p>
                    <p><strong>Email:</strong> msstudioindore7@gmail.com</p>
                    <p><strong>Location:</strong> Vijay Nagar, Indore</p>
                </div>

                {/* Back Button */}
                <button className="back-btn" onClick={onBack} style={{ marginTop: '15px' }}>
                    Back to Home
                </button>
            </div>
        </div>
    );
};

export default ServicesPage;