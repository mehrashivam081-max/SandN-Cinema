import React from 'react';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <div className="footer-brand">
                    <div className="footer-logo-container">
                        <img src="/favicon.png" alt="Snevio Logo" className="footer-logo-icon" />
                        <h2 className="footer-logo-text">Snevio <span className="logo-highlight">Cloud</span></h2>
                    </div>
                    <p className="footer-tagline">
                        Premium Photography & Studios Cloud Platform. Your memories, securely stored and beautifully presented.
                    </p>
                </div>

                <div className="footer-links">
                    <div className="link-group">
                        <h3>Explore</h3>
                        <a href="#">Home</a>
                        <a href="#">Portfolio</a>
                        <a href="#">Book a Slot</a>
                    </div>
                    <div className="link-group">
                        <h3>Legal</h3>
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                        <a href="#">Contact Us</a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {currentYear} Snevio. All rights reserved.</p>
                <p className="developer-tag">Designed & Developed by Shivam</p>
            </div>
        </footer>
    );
};

export default Footer;