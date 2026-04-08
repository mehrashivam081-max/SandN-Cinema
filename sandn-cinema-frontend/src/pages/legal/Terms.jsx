import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
    const navigate = useNavigate();

    // Jab page khule toh scroll ekdum top par aa jaye
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div style={{ minHeight: '100vh', background: '#f4f7f6', padding: '30px 15px', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
            
            {/* 🔙 BACK BUTTON */}
            <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '20px' }}>
                <button 
                    onClick={() => navigate('/')} 
                    style={{ background: 'none', border: 'none', color: '#2b5876', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
                >
                    <span style={{ fontSize: '18px' }}>←</span> Back to Home
                </button>
            </div>

            {/* 📄 MAIN CONTENT BOX (White box with dark text for clear visibility) */}
            <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto', 
                background: '#ffffff', 
                borderRadius: '12px', 
                padding: '40px 30px', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.08)', 
                color: '#333' // 🔥 FIX: Explicit dark text color
            }}>
                <h1 style={{ textAlign: 'center', color: '#111', marginBottom: '5px', fontSize: '28px', fontWeight: '800' }}>Terms & Conditions</h1>
                <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', marginBottom: '35px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Last Updated: April 2026 | Snevio Cloud
                </p>

                <div style={{ lineHeight: '1.8', fontSize: '15px', color: '#444' }}>
                    
                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>1. Introduction</h3>
                    <p style={{ marginBottom: '15px' }}>
                        Welcome to <strong>Snevio</strong>. By using our platform, you agree that Snevio is a premium digital media delivery and cloud service. If you disagree with any part of these terms, you may not access the service.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>2. Media Delivery & Privacy</h3>
                    <p style={{ marginBottom: '15px' }}>
                        All images and videos hosted on Snevio are for the intended recipient only. Unauthorized sharing, downloading, or distribution of media without the creator's explicit consent is strictly prohibited.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>3. Security Protocols</h3>
                    <p style={{ marginBottom: '15px' }}>
                        We prioritize the security of your media. We reserve the right to immediately suspend or terminate accounts that violate our security protocols, attempt unauthorized access, or misuse the data-sharing features.
                    </p>

                    <h3 style={{ color: '#2b5876', marginTop: '30px', marginBottom: '12px', fontSize: '18px' }}>4. Bookings & Payments</h3>
                    <p style={{ marginBottom: '15px' }}>
                        All studio and freelance bookings made through Snevio are subject to availability. Payments processed via our platform are secured. Cancellations and refunds are strictly governed by our dedicated Refund Policy.
                    </p>

                    <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', borderLeft: '4px solid #2b5876' }}>
                        <h4 style={{ color: '#111', marginBottom: '8px', fontSize: '16px' }}>Questions about these Terms?</h4>
                        <p style={{ fontSize: '14px', color: '#555', margin: 0 }}>
                            Please contact our support team at <strong>support@snevio.com</strong> or via the Contact Us page.
                        </p>
                    </div>

                </div>
            </div>
            
            {/* Footer space */}
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#999', fontSize: '13px' }}>
                © 2026 Snevio Cloud. All rights reserved.
            </div>
        </div>
    );
};

export default Terms;