import React, { useState } from 'react';
import './ServicesPage.css';

const ServicesPage = ({ onBack }) => {
    // State to track which section is open
    const [openSection, setOpenSection] = useState(null);

    const toggleSection = (index) => {
        if (openSection === index) {
            setOpenSection(null); // Close if already open
        } else {
            setOpenSection(index); // Open clicked section
        }
    };

    // Data extracted from the uploaded image
    const servicesData = [
        {
            title: "Photography Services",
            icon: "📸",
            items: [
                "Model Photography",
                "Event Photography",
                "Fashion Photography",
                "Product Photography",
                "Wedding Photography",
                "Abstract Photography",
                "Portrait Photography",
                "Candid Photography",
                "Personal Photography",
                "Travel Photography",
                "Couple Photography",
                "Light Painting Photography",
                "Kids Photography"
            ]
        },
        {
            title: "Videography Services",
            icon: "🎥",
            items: [
                "Song Video",
                "Photo Video",
                "Live Stream (Facebook & YouTube)",
                "Instagram Reels"
            ]
        },
        {
            title: "Social Media Management",
            icon: "📱",
            items: [
                "Account Handling",
                "Facebook & YouTube Thumbnails",
                "Google AdSense"
            ]
        },
        {
            title: "Brand Promotion",
            icon: "📢",
            items: [
                "Collaboration",
                "Product Awareness",
                "Influencer Marketing"
            ]
        },
        {
            title: "Editing",
            icon: "🎬",
            items: [
                "Reels Editing",
                "Cinematic Clips",
                "Video & Photos",
                "Creative Editing"
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

                {/* Contact Info Footer */}
                <div className="contact-info-box">
                    <h3>Contact Us</h3>
                    <p><strong>Instagram:</strong> ms_studio</p>
                    <p><strong>Contact:</strong> 7828011282</p>
                    <p><strong>Email:</strong> msstudioindore7@gmail.com</p>
                    <p><strong>Location:</strong> Vijay Nagar, Indore</p>
                </div>

                {/* Back Button */}
                <button className="back-btn" onClick={onBack}>
                    Back to Home
                </button>
            </div>
        </div>
    );
};

export default ServicesPage;