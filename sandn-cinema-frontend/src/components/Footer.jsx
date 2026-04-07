import React from 'react';
import { Link } from 'react-router-dom'; // ✅ Link import kiya navigation ke liye
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
                        <Link to="/">Home</Link>
                        <Link to="#">Portfolio</Link>
                        <Link to="#">Book a Slot</Link>
                    </div>
                    
                    {/* ✅ Instamojo KYC ke liye ye section sabse zaruri hai */}
                    <div className="link-group">
                        <h3>Legal & Support</h3>
                        <Link to="/terms">Terms & Conditions</Link>
                        <Link to="/refund">Refund & Cancellation</Link>
                        <Link to="/shipping">Shipping & Delivery</Link>
                        <Link to="/contact">Contact Us</Link>
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